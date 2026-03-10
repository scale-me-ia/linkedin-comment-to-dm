// ============================================================
// Comment Scanner — Monitors LinkedIn posts for keyword comments
// ============================================================

import { SELECTORS, DELAYS, STORAGE_KEYS } from './config.js';
import { log, getCommentId, randomDelay, sleep, waitForElement } from './utils.js';

export class CommentScanner {
  constructor() {
    this.observer = null;
    this.scanInterval = null;
    this.processedComments = new Set();
    this.onKeywordMatch = null; // callback(matchData)
    this.thematics = [];
    this.isRunning = false;
  }

  /**
   * Initialize scanner with thematics and callback
   */
  async init(thematics, onKeywordMatch) {
    this.thematics = thematics.filter(t => t.enabled);
    this.onKeywordMatch = onKeywordMatch;
    
    // Load previously processed comments from storage
    await this._loadProcessedComments();
    
    log('info', `Scanner initialized with ${this.thematics.length} active thematics`);
    log('info', `Already processed: ${this.processedComments.size} comments`);
  }

  /**
   * Start scanning for comments
   */
  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    
    log('info', '🔍 Comment scanner started');
    
    // 1. Initial scan of visible comments
    this._scanAllVisibleComments();
    
    // 2. Set up MutationObserver for new comments appearing in DOM
    this._setupObserver();
    
    // 3. Periodic full scan as backup
    this._startPeriodicScan();
  }

  /**
   * Stop scanning
   */
  stop() {
    this.isRunning = false;
    
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    
    log('info', '🛑 Comment scanner stopped');
  }

  /**
   * Update thematics config
   */
  updateThematics(thematics) {
    this.thematics = thematics.filter(t => t.enabled);
    log('info', `Thematics updated: ${this.thematics.length} active`);
  }

  // ── Private methods ──────────────────────────────────────

  /**
   * Set up MutationObserver to detect new comments in the DOM
   */
  _setupObserver() {
    const targetNode = document.querySelector(SELECTORS.FEED_CONTAINER) || document.body;
    
    this.observer = new MutationObserver((mutations) => {
      let hasNewComments = false;
      
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Check if the added node is or contains a comment
              if (node.matches?.(SELECTORS.COMMENT_ITEM) || 
                  node.querySelector?.(SELECTORS.COMMENT_ITEM)) {
                hasNewComments = true;
                break;
              }
            }
          }
        }
        if (hasNewComments) break;
      }
      
      if (hasNewComments) {
        log('debug', 'New comments detected in DOM, scanning...');
        // Small delay to let DOM settle
        setTimeout(() => this._scanAllVisibleComments(), 1000);
      }
    });
    
    this.observer.observe(targetNode, {
      childList: true,
      subtree: true,
    });
    
    log('debug', 'MutationObserver set up on', targetNode.className || 'body');
  }

  /**
   * Periodic full scan of all visible comments
   */
  _startPeriodicScan() {
    const doScan = async () => {
      if (!this.isRunning) return;
      await randomDelay(DELAYS.COMMENT_SCAN_INTERVAL);
      this._scanAllVisibleComments();
      if (this.isRunning) {
        this.scanInterval = setTimeout(doScan, 0);
      }
    };
    
    this.scanInterval = setTimeout(doScan, DELAYS.COMMENT_SCAN_INTERVAL.min);
  }

  /**
   * Scan all currently visible comments on the page
   */
  _scanAllVisibleComments() {
    const posts = document.querySelectorAll(SELECTORS.POST_CONTAINER);
    let matchCount = 0;
    
    for (const post of posts) {
      const postUrn = post.getAttribute(SELECTORS.POST_URN) || '';
      const comments = post.querySelectorAll(SELECTORS.COMMENT_ITEM);
      
      for (const comment of comments) {
        const match = this._analyzeComment(comment, postUrn);
        if (match) matchCount++;
      }
    }
    
    if (matchCount > 0) {
      log('info', `🎯 Found ${matchCount} new keyword matches`);
    }
  }

  /**
   * Analyze a single comment element for keyword matches
   */
  _analyzeComment(commentElement, postUrn) {
    try {
      // Extract comment data
      const textEl = commentElement.querySelector(SELECTORS.COMMENT_TEXT);
      const authorEl = commentElement.querySelector(SELECTORS.COMMENT_AUTHOR);
      const authorLinkEl = commentElement.querySelector(SELECTORS.COMMENT_AUTHOR_LINK);
      
      if (!textEl || !authorEl) return null;
      
      const commentText = textEl.textContent.trim().toLowerCase();
      const authorName = authorEl.textContent.trim();
      const authorProfileUrl = authorLinkEl?.href || '';
      
      // Generate unique comment ID
      const commentId = getCommentId(postUrn, authorName, commentText);
      
      // Skip if already processed
      if (this.processedComments.has(commentId)) return null;
      
      // Check against all active thematics
      for (const thematic of this.thematics) {
        // If thematic is post-specific, check URN
        if (thematic.postUrns.length > 0 && !thematic.postUrns.includes(postUrn)) {
          continue;
        }
        
        // Check keywords
        const matchedKeyword = thematic.keywords.find(kw => 
          commentText.includes(kw.toLowerCase())
        );
        
        if (matchedKeyword) {
          // Mark as processed
          this.processedComments.add(commentId);
          this._saveProcessedComments();
          
          const matchData = {
            commentId,
            postUrn,
            commentText: textEl.textContent.trim(),
            authorName,
            authorProfileUrl,
            matchedKeyword,
            thematic,
            commentElement,
            timestamp: Date.now(),
          };
          
          log('info', `✅ Keyword match: "${matchedKeyword}" by ${authorName} on post ${postUrn.slice(-8)}`);
          
          // Fire callback
          if (this.onKeywordMatch) {
            this.onKeywordMatch(matchData);
          }
          
          return matchData;
        }
      }
      
      return null;
    } catch (err) {
      log('error', 'Error analyzing comment:', err);
      return null;
    }
  }

  // ── Storage ──────────────────────────────────────────────

  async _loadProcessedComments() {
    try {
      const data = await chrome.storage.local.get(STORAGE_KEYS.PROCESSED_COMMENTS);
      const saved = data[STORAGE_KEYS.PROCESSED_COMMENTS] || [];
      this.processedComments = new Set(saved);
    } catch (err) {
      log('error', 'Error loading processed comments:', err);
    }
  }

  async _saveProcessedComments() {
    try {
      // Keep only last 5000 entries to avoid storage bloat
      const entries = [...this.processedComments];
      const trimmed = entries.slice(-5000);
      await chrome.storage.local.set({
        [STORAGE_KEYS.PROCESSED_COMMENTS]: trimmed,
      });
    } catch (err) {
      log('error', 'Error saving processed comments:', err);
    }
  }
}
