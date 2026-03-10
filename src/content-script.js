// ============================================================
// Content Script — Main entry point on LinkedIn pages
// ============================================================

// Note: Can't use ES modules in content scripts (Manifest V3 limitation)
// All imports are bundled or inlined. Using IIFE pattern.

(async function ScaleMeLinkedIn() {
  'use strict';

  // ── Config (inline from config.js) ───────────────────────
  const SELECTORS = {
    FEED_CONTAINER: '.scaffold-finite-scroll__content',
    POST_CONTAINER: '.feed-shared-update-v2',
    POST_URN: 'data-urn',
    COMMENTS_SECTION: '.comments-comments-list',
    COMMENT_ITEM: '.comments-comment-item',
    COMMENT_ENTITY: '.comments-comment-entity',
    COMMENT_TEXT: '.comments-comment-item__main-content .update-components-text',
    COMMENT_AUTHOR: '.comments-post-meta__name-text',
    COMMENT_AUTHOR_LINK: '.comments-post-meta__name-text a',
    COMMENT_REPLY_BTN: '.comments-comment-social-bar__reply-btn',
    COMMENT_INPUT: '.comments-comment-box__form .ql-editor',
    COMMENT_SUBMIT_BTN: '.comments-comment-box__submit-button',
    LOAD_MORE_COMMENTS: '.comments-comments-list__load-more-comments-button',
    MSG_COMPOSE_BTN: '.msg-overlay-bubble-header__control--new-convo-btn',
    MSG_SEARCH_INPUT: '.msg-connections-typeahead__search-field',
    MSG_RECIPIENT_RESULT: '.msg-connections-typeahead__result-item',
    MSG_BODY_INPUT: '.msg-form__contenteditable',
    MSG_SEND_BTN: '.msg-form__send-button',
    MSG_CLOSE_BTN: '.msg-overlay-bubble-header__control--close-btn',
  };

  const DELAYS = {
    BETWEEN_ACTIONS: { min: 30000, max: 120000 },
    TYPING_CHAR: { min: 30, max: 80 },
    BEFORE_SEND: { min: 2000, max: 5000 },
    BEFORE_DM: { min: 10000, max: 60000 },
    COMMENT_SCAN_INTERVAL: { min: 30000, max: 60000 },
  };

  const LIMITS = {
    MAX_REPLIES_PER_DAY: 25,
    MAX_DMS_PER_DAY: 20,
  };

  const STORAGE_KEYS = {
    THEMATICS: 'scaleme_thematics',
    SETTINGS: 'scaleme_settings',
    ACTION_LOG: 'scaleme_action_log',
    PROCESSED_COMMENTS: 'scaleme_processed_comments',
    DAILY_COUNTERS: 'scaleme_daily_counters',
  };

  // ── Utilities ────────────────────────────────────────────

  function randomDelay(range) {
    const ms = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function extractFirstName(fullName) {
    if (!fullName) return '';
    return fullName.trim().split(/\s+/)[0];
  }

  function fillTemplate(template, vars) {
    return template
      .replace(/\{\{firstName\}\}/g, vars.firstName || '')
      .replace(/\{\{fullName\}\}/g, vars.fullName || '')
      .replace(/\{\{link\}\}/g, vars.link || '')
      .replace(/\{\{keyword\}\}/g, vars.keyword || '')
      .replace(/\{\{thematic\}\}/g, vars.thematic || '');
  }

  async function simulateTyping(element, text, charDelay = { min: 30, max: 80 }) {
    element.focus();
    for (const char of text) {
      element.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
      document.execCommand('insertText', false, char);
      element.dispatchEvent(new InputEvent('input', { data: char, inputType: 'insertText', bubbles: true }));
      element.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true }));
      await randomDelay(charDelay);
    }
  }

  async function simulateClick(element) {
    if (!element) return false;
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await sleep(500);
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    for (const eventType of ['mouseenter', 'mouseover', 'mousemove', 'mousedown', 'mouseup', 'click']) {
      element.dispatchEvent(new MouseEvent(eventType, { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y }));
      await sleep(50 + Math.random() * 100);
    }
    return true;
  }

  async function waitForElement(selector, timeout = 10000, parent = document) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const el = parent.querySelector(selector);
      if (el) return el;
      await sleep(500);
    }
    return null;
  }

  function getCommentId(postUrn, authorName, commentText) {
    const raw = `${postUrn}|${authorName}|${commentText.substring(0, 50)}`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = ((hash << 5) - hash) + raw.charCodeAt(i);
      hash |= 0;
    }
    return `comment_${Math.abs(hash).toString(36)}`;
  }

  function getTodayKey() {
    return new Date().toISOString().split('T')[0];
  }

  function log(level, ...args) {
    const prefix = `[ScaleMe] [${level.toUpperCase()}]`;
    const ts = new Date().toLocaleTimeString('fr-FR');
    if (level === 'error') console.error(prefix, ts, ...args);
    else if (level === 'warn') console.warn(prefix, ts, ...args);
    else console.log(prefix, ts, ...args);
  }

  // ── State ────────────────────────────────────────────────

  let settings = { enabled: false, dryRun: false, notificationsEnabled: true, debugMode: false };
  let thematics = [];
  let processedComments = new Set();
  let dailyCounters = { replies: 0, dms: 0, date: getTodayKey() };
  let actionQueue = [];
  let isProcessingQueue = false;
  let observer = null;
  let scanTimeout = null;

  // ── Init ─────────────────────────────────────────────────

  async function init() {
    log('info', '⚡ Scale Me LinkedIn extension loaded');

    // Load config from storage
    const data = await chrome.storage.local.get([
      STORAGE_KEYS.SETTINGS,
      STORAGE_KEYS.THEMATICS,
      STORAGE_KEYS.PROCESSED_COMMENTS,
      STORAGE_KEYS.DAILY_COUNTERS,
    ]);

    settings = data[STORAGE_KEYS.SETTINGS] || settings;
    thematics = (data[STORAGE_KEYS.THEMATICS] || []).filter(t => t.enabled);
    
    const savedComments = data[STORAGE_KEYS.PROCESSED_COMMENTS] || [];
    processedComments = new Set(savedComments);
    
    const savedCounters = data[STORAGE_KEYS.DAILY_COUNTERS];
    if (savedCounters && savedCounters.date === getTodayKey()) {
      dailyCounters = savedCounters;
    }

    log('info', `Config: ${thematics.length} thematics, ${processedComments.size} processed, enabled=${settings.enabled}`);

    if (settings.enabled) {
      startScanning();
    }

    // Listen for messages from popup/service-worker
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (msg.type === 'TOGGLE_ENABLED') {
        settings.enabled = msg.enabled;
        if (settings.enabled) startScanning();
        else stopScanning();
        sendResponse({ ok: true });
      }
      if (msg.type === 'UPDATE_THEMATICS') {
        thematics = (msg.thematics || []).filter(t => t.enabled);
        log('info', `Thematics updated: ${thematics.length} active`);
        sendResponse({ ok: true });
      }
      if (msg.type === 'UPDATE_SETTINGS') {
        settings = msg.settings;
        sendResponse({ ok: true });
      }
      if (msg.type === 'GET_STATUS') {
        sendResponse({
          enabled: settings.enabled,
          queueLength: actionQueue.length,
          dailyCounters,
          processedCount: processedComments.size,
          isProcessing: isProcessingQueue,
        });
      }
      return true; // async
    });

    // Inject status badge
    injectStatusBadge();
  }

  // ── Scanning ─────────────────────────────────────────────

  function startScanning() {
    log('info', '🔍 Scanner started');
    scanAllVisibleComments();
    setupObserver();
    startPeriodicScan();
    updateBadge(true);
  }

  function stopScanning() {
    log('info', '🛑 Scanner stopped');
    if (observer) { observer.disconnect(); observer = null; }
    if (scanTimeout) { clearTimeout(scanTimeout); scanTimeout = null; }
    updateBadge(false);
  }

  function setupObserver() {
    const target = document.querySelector(SELECTORS.FEED_CONTAINER) || document.body;
    observer = new MutationObserver((mutations) => {
      let hasNew = false;
      for (const m of mutations) {
        if (m.type === 'childList' && m.addedNodes.length > 0) {
          for (const node of m.addedNodes) {
            if (node.nodeType === 1 && (node.matches?.(SELECTORS.COMMENT_ITEM) || node.querySelector?.(SELECTORS.COMMENT_ITEM))) {
              hasNew = true; break;
            }
          }
        }
        if (hasNew) break;
      }
      if (hasNew) setTimeout(scanAllVisibleComments, 1000);
    });
    observer.observe(target, { childList: true, subtree: true });
  }

  function startPeriodicScan() {
    const doScan = async () => {
      if (!settings.enabled) return;
      await randomDelay(DELAYS.COMMENT_SCAN_INTERVAL);
      scanAllVisibleComments();
      scanTimeout = setTimeout(doScan, 0);
    };
    scanTimeout = setTimeout(doScan, DELAYS.COMMENT_SCAN_INTERVAL.min);
  }

  function scanAllVisibleComments() {
    const posts = document.querySelectorAll(SELECTORS.POST_CONTAINER);
    let matches = 0;
    for (const post of posts) {
      const urn = post.getAttribute(SELECTORS.POST_URN) || '';
      const comments = post.querySelectorAll(SELECTORS.COMMENT_ITEM);
      for (const comment of comments) {
        if (analyzeComment(comment, urn)) matches++;
      }
    }
    if (matches > 0) log('info', `🎯 ${matches} new keyword match(es)`);
  }

  function analyzeComment(commentEl, postUrn) {
    try {
      const textEl = commentEl.querySelector(SELECTORS.COMMENT_TEXT);
      const authorEl = commentEl.querySelector(SELECTORS.COMMENT_AUTHOR);
      if (!textEl || !authorEl) return false;

      const text = textEl.textContent.trim().toLowerCase();
      const authorName = authorEl.textContent.trim();
      const commentId = getCommentId(postUrn, authorName, text);

      if (processedComments.has(commentId)) return false;

      for (const thematic of thematics) {
        if (thematic.postUrns?.length > 0 && !thematic.postUrns.includes(postUrn)) continue;
        const kw = thematic.keywords.find(k => text.includes(k.toLowerCase()));
        if (kw) {
          processedComments.add(commentId);
          saveProcessedComments();
          const match = { commentId, postUrn, commentText: textEl.textContent.trim(), authorName, matchedKeyword: kw, thematic, commentElement: commentEl, timestamp: Date.now() };
          log('info', `✅ Match: "${kw}" by ${authorName}`);
          enqueueAction(match);
          return true;
        }
      }
      return false;
    } catch (err) {
      log('error', 'Analyze error:', err);
      return false;
    }
  }

  // ── Action Queue ─────────────────────────────────────────

  function enqueueAction(matchData) {
    if (dailyCounters.replies >= LIMITS.MAX_REPLIES_PER_DAY || dailyCounters.dms >= LIMITS.MAX_DMS_PER_DAY) {
      log('warn', '⚠️ Daily limit reached');
      return;
    }
    actionQueue.push(matchData);
    if (!isProcessingQueue) processQueue();
  }

  async function processQueue() {
    if (isProcessingQueue || actionQueue.length === 0) return;
    isProcessingQueue = true;

    while (actionQueue.length > 0) {
      const match = actionQueue.shift();
      try {
        await processMatch(match);
      } catch (err) {
        log('error', `Process error for ${match.authorName}:`, err);
      }
      if (actionQueue.length > 0) await randomDelay(DELAYS.BETWEEN_ACTIONS);
    }

    isProcessingQueue = false;
  }

  async function processMatch(match) {
    const firstName = extractFirstName(match.authorName);
    const vars = {
      firstName,
      fullName: match.authorName,
      link: match.thematic.leadMagnetUrl,
      keyword: match.matchedKeyword,
      thematic: match.thematic.name,
    };

    // Step 1: Reply to comment
    const replyText = fillTemplate(match.thematic.replyTemplate, vars);
    if (settings.dryRun) {
      log('info', `🏜️ [DRY] Reply → ${match.authorName}: "${replyText}"`);
    } else {
      const ok = await replyToComment(match.commentElement, replyText);
      if (ok) {
        dailyCounters.replies++;
        saveDailyCounters();
        logAction(match, 'reply_sent');
        log('info', `💬 Reply sent to ${match.authorName}`);
      } else {
        logAction(match, 'reply_failed');
      }
    }

    // Step 2: Wait then DM
    await randomDelay(DELAYS.BEFORE_DM);
    const dmText = fillTemplate(match.thematic.dmTemplate, vars);
    
    if (settings.dryRun) {
      log('info', `🏜️ [DRY] DM → ${match.authorName}: "${dmText}"`);
    } else {
      const ok = await sendDM(match.authorName, dmText);
      if (ok) {
        dailyCounters.dms++;
        saveDailyCounters();
        logAction(match, 'dm_sent');
        log('info', `📩 DM sent to ${match.authorName}`);
      } else {
        logAction(match, 'dm_failed');
      }
    }

    // Notify
    chrome.runtime.sendMessage({
      type: 'SHOW_NOTIFICATION',
      title: `✅ ${match.thematic.name}`,
      message: `${settings.dryRun ? '[DRY] ' : ''}${match.authorName} → "${match.matchedKeyword}"`,
    });
  }

  // ── Reply to Comment ─────────────────────────────────────

  async function replyToComment(commentEl, text) {
    try {
      const replyBtn = commentEl.querySelector(SELECTORS.COMMENT_REPLY_BTN);
      if (!replyBtn) { log('warn', 'No reply button'); return false; }
      
      await simulateClick(replyBtn);
      await sleep(1500);

      // Find reply input (try within comment context, then fallback to last input on page)
      let input = await waitForElement(SELECTORS.COMMENT_INPUT, 5000, commentEl.closest(SELECTORS.COMMENT_ENTITY) || commentEl.parentElement);
      if (!input) {
        const inputs = document.querySelectorAll(SELECTORS.COMMENT_INPUT);
        input = inputs[inputs.length - 1];
      }
      if (!input) { log('warn', 'No reply input'); return false; }

      await simulateTyping(input, text, DELAYS.TYPING_CHAR);
      await randomDelay(DELAYS.BEFORE_SEND);

      const submit = await waitForElement(SELECTORS.COMMENT_SUBMIT_BTN, 3000);
      if (!submit) { log('warn', 'No submit btn'); return false; }
      
      await simulateClick(submit);
      await sleep(2000);
      return true;
    } catch (err) {
      log('error', 'Reply error:', err);
      return false;
    }
  }

  // ── Send DM ──────────────────────────────────────────────

  async function sendDM(recipientName, text) {
    try {
      // Open compose
      let composeBtn = document.querySelector(SELECTORS.MSG_COMPOSE_BTN);
      if (!composeBtn) {
        const msgIcon = document.querySelector('#messaging-tab-icon, .msg-overlay-list-bubble__btn');
        if (msgIcon) { await simulateClick(msgIcon); await sleep(2000); }
        composeBtn = await waitForElement(SELECTORS.MSG_COMPOSE_BTN, 5000);
      }
      if (!composeBtn) { log('warn', 'No compose btn'); return false; }
      await simulateClick(composeBtn);
      await sleep(2000);

      // Search recipient
      const searchInput = await waitForElement(SELECTORS.MSG_SEARCH_INPUT, 5000);
      if (!searchInput) { log('warn', 'No search input'); return false; }
      await simulateTyping(searchInput, recipientName, DELAYS.TYPING_CHAR);
      await sleep(2000);

      // Select first result
      const result = await waitForElement(SELECTORS.MSG_RECIPIENT_RESULT, 5000);
      if (!result) {
        log('warn', `No result for "${recipientName}"`);
        const closeBtn = document.querySelector(SELECTORS.MSG_CLOSE_BTN);
        if (closeBtn) await simulateClick(closeBtn);
        return false;
      }
      await simulateClick(result);
      await sleep(1500);

      // Type message
      const msgInput = await waitForElement(SELECTORS.MSG_BODY_INPUT, 5000);
      if (!msgInput) { log('warn', 'No msg input'); return false; }
      await simulateTyping(msgInput, text, DELAYS.TYPING_CHAR);
      await randomDelay(DELAYS.BEFORE_SEND);

      // Send
      const sendBtn = await waitForElement(SELECTORS.MSG_SEND_BTN, 3000);
      if (!sendBtn) { log('warn', 'No send btn'); return false; }
      await simulateClick(sendBtn);
      await sleep(2000);

      // Close convo
      const closeBtn = document.querySelector(SELECTORS.MSG_CLOSE_BTN);
      if (closeBtn) { await sleep(1000); await simulateClick(closeBtn); }

      return true;
    } catch (err) {
      log('error', 'DM error:', err);
      return false;
    }
  }

  // ── Storage helpers ──────────────────────────────────────

  async function saveProcessedComments() {
    const arr = [...processedComments].slice(-5000);
    await chrome.storage.local.set({ [STORAGE_KEYS.PROCESSED_COMMENTS]: arr });
  }

  async function saveDailyCounters() {
    await chrome.storage.local.set({ [STORAGE_KEYS.DAILY_COUNTERS]: dailyCounters });
  }

  async function logAction(match, action) {
    const data = await chrome.storage.local.get(STORAGE_KEYS.ACTION_LOG);
    const logs = (data[STORAGE_KEYS.ACTION_LOG] || []).slice(-499);
    logs.push({
      ts: Date.now(),
      action,
      author: match.authorName,
      keyword: match.matchedKeyword,
      thematic: match.thematic.name,
    });
    await chrome.storage.local.set({ [STORAGE_KEYS.ACTION_LOG]: logs });
  }

  // ── Status Badge (floating indicator) ────────────────────

  function injectStatusBadge() {
    const badge = document.createElement('div');
    badge.id = 'scaleme-badge';
    badge.innerHTML = `<span id="scaleme-badge-dot"></span><span id="scaleme-badge-text">ScaleMe</span>`;
    document.body.appendChild(badge);
    updateBadge(settings.enabled);
  }

  function updateBadge(active) {
    const dot = document.getElementById('scaleme-badge-dot');
    if (dot) {
      dot.style.backgroundColor = active ? '#00ff88' : '#ff4444';
    }
  }

  // ── Go! ──────────────────────────────────────────────────
  init();

})();
