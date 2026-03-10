// ============================================================
// Action Executor — Handles reply + DM sending
// ============================================================

import { SELECTORS, DELAYS, LIMITS, STORAGE_KEYS } from './config.js';
import { 
  log, randomDelay, sleep, simulateTyping, simulateClick, 
  waitForElement, fillTemplate, extractFirstName, getTodayKey 
} from './utils.js';

export class ActionExecutor {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    this.dailyCounters = { replies: 0, dms: 0, date: getTodayKey() };
    this.settings = {};
  }

  /**
   * Initialize executor
   */
  async init(settings) {
    this.settings = settings;
    await this._loadDailyCounters();
    log('info', `ActionExecutor initialized. Today's counters: ${this.dailyCounters.replies} replies, ${this.dailyCounters.dms} DMs`);
  }

  /**
   * Enqueue a matched comment for processing
   */
  enqueue(matchData) {
    // Check daily limits
    if (this.dailyCounters.replies >= LIMITS.MAX_REPLIES_PER_DAY) {
      log('warn', `⚠️ Daily reply limit reached (${LIMITS.MAX_REPLIES_PER_DAY}). Skipping.`);
      this._notifyLimitReached('replies');
      return false;
    }
    
    if (this.dailyCounters.dms >= LIMITS.MAX_DMS_PER_DAY) {
      log('warn', `⚠️ Daily DM limit reached (${LIMITS.MAX_DMS_PER_DAY}). Skipping.`);
      this._notifyLimitReached('dms');
      return false;
    }
    
    this.queue.push(matchData);
    log('info', `📋 Queued action for ${matchData.authorName} (queue: ${this.queue.length})`);
    
    // Start processing if not already running
    if (!this.isProcessing) {
      this._processQueue();
    }
    
    return true;
  }

  // ── Queue Processing ─────────────────────────────────────

  async _processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;
    
    while (this.queue.length > 0) {
      const matchData = this.queue.shift();
      
      try {
        await this._processMatch(matchData);
      } catch (err) {
        log('error', `Error processing match for ${matchData.authorName}:`, err);
        await this._logAction(matchData, 'error', err.message);
      }
      
      // Wait between actions
      if (this.queue.length > 0) {
        log('debug', `Waiting before next action... (${this.queue.length} remaining)`);
        await randomDelay(DELAYS.BETWEEN_ACTIONS);
      }
    }
    
    this.isProcessing = false;
  }

  /**
   * Process a single match: reply to comment + send DM
   */
  async _processMatch(matchData) {
    const { thematic, authorName, commentElement } = matchData;
    const firstName = extractFirstName(authorName);
    
    const templateVars = {
      firstName,
      fullName: authorName,
      link: thematic.leadMagnetUrl,
      keyword: matchData.matchedKeyword,
      thematic: thematic.name,
    };
    
    // ── Step 1: Reply to the comment ──
    if (this.settings.dryRun) {
      const replyText = fillTemplate(thematic.replyTemplate, templateVars);
      log('info', `🏜️ [DRY RUN] Would reply to ${authorName}: "${replyText}"`);
    } else {
      const replySuccess = await this._replyToComment(commentElement, thematic.replyTemplate, templateVars);
      
      if (replySuccess) {
        this.dailyCounters.replies++;
        await this._saveDailyCounters();
        await this._logAction(matchData, 'reply_sent');
        log('info', `💬 Reply sent to ${authorName}`);
      } else {
        log('warn', `Failed to reply to ${authorName}'s comment`);
        await this._logAction(matchData, 'reply_failed');
      }
    }
    
    // ── Step 2: Wait before DM (human-like gap) ──
    await randomDelay(DELAYS.BEFORE_DM);
    
    // ── Step 3: Send DM with lead magnet ──
    if (this.settings.dryRun) {
      const dmText = fillTemplate(thematic.dmTemplate, templateVars);
      log('info', `🏜️ [DRY RUN] Would DM ${authorName}: "${dmText}"`);
    } else {
      const dmSuccess = await this._sendDM(authorName, thematic.dmTemplate, templateVars);
      
      if (dmSuccess) {
        this.dailyCounters.dms++;
        await this._saveDailyCounters();
        await this._logAction(matchData, 'dm_sent');
        log('info', `📩 DM sent to ${authorName}`);
      } else {
        log('warn', `Failed to DM ${authorName}`);
        await this._logAction(matchData, 'dm_failed');
      }
    }
    
    // Notify via chrome notification
    if (this.settings.notificationsEnabled) {
      chrome.runtime.sendMessage({
        type: 'SHOW_NOTIFICATION',
        title: `✅ ${thematic.name}`,
        message: `Reply + DM sent to ${authorName} (keyword: "${matchData.matchedKeyword}")`,
      });
    }
  }

  // ── Comment Reply ────────────────────────────────────────

  async _replyToComment(commentElement, template, vars) {
    try {
      const replyText = fillTemplate(template, vars);
      
      // 1. Find and click the reply button on this comment
      const replyBtn = commentElement.querySelector(SELECTORS.COMMENT_REPLY_BTN);
      if (!replyBtn) {
        log('warn', 'Reply button not found on comment element');
        return false;
      }
      
      await simulateClick(replyBtn);
      await sleep(1500);
      
      // 2. Find the reply input that appeared
      const replyInput = await waitForElement(
        SELECTORS.COMMENT_INPUT, 
        5000, 
        commentElement.closest(SELECTORS.COMMENT_ENTITY) || commentElement.parentElement
      );
      
      if (!replyInput) {
        // Fallback: try broader search
        const inputs = document.querySelectorAll(SELECTORS.COMMENT_INPUT);
        const lastInput = inputs[inputs.length - 1];
        if (!lastInput) {
          log('warn', 'Reply input not found');
          return false;
        }
        await simulateTyping(lastInput, replyText, DELAYS.TYPING_CHAR);
      } else {
        await simulateTyping(replyInput, replyText, DELAYS.TYPING_CHAR);
      }
      
      // 3. Wait a beat, then submit
      await randomDelay(DELAYS.BEFORE_SEND);
      
      const submitBtn = await waitForElement(SELECTORS.COMMENT_SUBMIT_BTN, 3000);
      if (!submitBtn) {
        log('warn', 'Submit button not found');
        return false;
      }
      
      await simulateClick(submitBtn);
      await sleep(2000);
      
      return true;
    } catch (err) {
      log('error', 'Error replying to comment:', err);
      return false;
    }
  }

  // ── DM Sending ───────────────────────────────────────────

  async _sendDM(recipientName, template, vars) {
    try {
      const dmText = fillTemplate(template, vars);
      
      // 1. Open messaging compose
      // Click on the messaging icon/compose button
      const composeBtn = document.querySelector(SELECTORS.MSG_COMPOSE_BTN) ||
                          document.querySelector('.msg-overlay-bubble-header__button--new');
      
      if (!composeBtn) {
        // Try opening messaging overlay first
        const msgIcon = document.querySelector('#messaging-tab-icon') ||
                        document.querySelector('.msg-overlay-list-bubble__btn');
        if (msgIcon) {
          await simulateClick(msgIcon);
          await sleep(2000);
        }
        
        const retryComposeBtn = await waitForElement(SELECTORS.MSG_COMPOSE_BTN, 5000);
        if (!retryComposeBtn) {
          log('warn', 'Cannot find compose message button');
          return false;
        }
        await simulateClick(retryComposeBtn);
      } else {
        await simulateClick(composeBtn);
      }
      
      await sleep(2000);
      
      // 2. Search for recipient
      const searchInput = await waitForElement(SELECTORS.MSG_SEARCH_INPUT, 5000);
      if (!searchInput) {
        log('warn', 'Message search input not found');
        return false;
      }
      
      await simulateTyping(searchInput, recipientName, DELAYS.TYPING_CHAR);
      await sleep(2000);
      
      // 3. Click on the first matching result
      const firstResult = await waitForElement(SELECTORS.MSG_RECIPIENT_RESULT, 5000);
      if (!firstResult) {
        log('warn', `No messaging result found for "${recipientName}"`);
        // Close the compose window
        const closeBtn = document.querySelector(SELECTORS.MSG_CLOSE_BTN);
        if (closeBtn) await simulateClick(closeBtn);
        return false;
      }
      
      await simulateClick(firstResult);
      await sleep(1500);
      
      // 4. Type the message
      const msgInput = await waitForElement(SELECTORS.MSG_BODY_INPUT, 5000);
      if (!msgInput) {
        log('warn', 'Message body input not found');
        return false;
      }
      
      await simulateTyping(msgInput, dmText, DELAYS.TYPING_CHAR);
      await randomDelay(DELAYS.BEFORE_SEND);
      
      // 5. Send
      const sendBtn = await waitForElement(SELECTORS.MSG_SEND_BTN, 3000);
      if (!sendBtn) {
        log('warn', 'Send button not found');
        return false;
      }
      
      await simulateClick(sendBtn);
      await sleep(2000);
      
      // 6. Close the conversation
      const closeBtn = document.querySelector(SELECTORS.MSG_CLOSE_BTN);
      if (closeBtn) {
        await sleep(1000);
        await simulateClick(closeBtn);
      }
      
      return true;
    } catch (err) {
      log('error', 'Error sending DM:', err);
      return false;
    }
  }

  // ── Storage & Logging ────────────────────────────────────

  async _loadDailyCounters() {
    try {
      const data = await chrome.storage.local.get(STORAGE_KEYS.DAILY_COUNTERS);
      const saved = data[STORAGE_KEYS.DAILY_COUNTERS];
      const today = getTodayKey();
      
      if (saved && saved.date === today) {
        this.dailyCounters = saved;
      } else {
        // New day, reset counters
        this.dailyCounters = { replies: 0, dms: 0, date: today };
        await this._saveDailyCounters();
      }
    } catch (err) {
      log('error', 'Error loading daily counters:', err);
    }
  }

  async _saveDailyCounters() {
    try {
      await chrome.storage.local.set({
        [STORAGE_KEYS.DAILY_COUNTERS]: this.dailyCounters,
      });
    } catch (err) {
      log('error', 'Error saving daily counters:', err);
    }
  }

  async _logAction(matchData, action, errorMsg = '') {
    try {
      const data = await chrome.storage.local.get(STORAGE_KEYS.ACTION_LOG);
      const logs = data[STORAGE_KEYS.ACTION_LOG] || [];
      
      logs.push({
        timestamp: Date.now(),
        action,
        author: matchData.authorName,
        keyword: matchData.matchedKeyword,
        thematic: matchData.thematic.name,
        postUrn: matchData.postUrn,
        error: errorMsg,
      });
      
      // Keep last 500 entries
      const trimmed = logs.slice(-500);
      await chrome.storage.local.set({ [STORAGE_KEYS.ACTION_LOG]: trimmed });
    } catch (err) {
      log('error', 'Error logging action:', err);
    }
  }

  _notifyLimitReached(type) {
    chrome.runtime.sendMessage({
      type: 'SHOW_NOTIFICATION',
      title: '⚠️ Limite quotidienne atteinte',
      message: `${type === 'replies' ? 'Réponses' : 'DMs'} : limite de ${type === 'replies' ? LIMITS.MAX_REPLIES_PER_DAY : LIMITS.MAX_DMS_PER_DAY} atteinte pour aujourd'hui.`,
    });
  }
}
