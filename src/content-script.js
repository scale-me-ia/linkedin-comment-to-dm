// ============================================================
// Content Script — Main entry point on LinkedIn pages
// ============================================================

// Note: Can't use ES modules in content scripts (Manifest V3 limitation)
// All imports are bundled or inlined. Using IIFE pattern.

(async function ScaleMeLinkedIn() {
  'use strict';

  // ── Config ───────────────────────────────────────────────
  const SELECTORS = {
    FEED_CONTAINER: '.scaffold-finite-scroll__content',
    POST_CONTAINER: '.feed-shared-update-v2',
    POST_URN: 'data-urn',
    POST_TEXT: '.feed-shared-update-v2__description .update-components-text',
    POST_AUTHOR: '.update-components-actor__name',
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

  // ── Dynamic Message Variations ───────────────────────────
  // When "dynamicMessages" is ON, the base template is randomly varied
  const REPLY_VARIATIONS = [
    "C'est envoyé en DM ! 🚀",
    "Envoyé en message privé ✅",
    "C'est parti en DM 📩",
    "Je t'envoie ça en privé ! 🎯",
    "Check tes DMs ! 📬",
    "Message privé envoyé 👍",
    "C'est dans ta boîte de messages ! ✉️",
    "Hop, envoyé en DM ⚡",
    "Je te fais passer ça en privé 🤝",
  ];

  const DM_OPENERS = [
    "Salut {{firstName}} !",
    "Hey {{firstName}} 👋",
    "Hello {{firstName}} !",
    "{{firstName}}, voilà !",
    "Salut {{firstName}} 🙂",
  ];

  const DM_BODIES = [
    "Suite à ton commentaire, voici le contenu : {{link}}",
    "Comme promis, voici le document : {{link}}",
    "Voilà le lien vers le contenu : {{link}}",
    "Tu trouveras tout ici : {{link}}",
    "Comme demandé, le voici : {{link}}",
    "Le contenu est dispo ici : {{link}}",
  ];

  const DM_CLOSERS = [
    "Bonne lecture ! 📖",
    "Hésite pas si t'as des questions 💬",
    "Dis-moi ce que t'en penses !",
    "Bonne lecture, et hésite pas à revenir vers moi 🤝",
    "J'espère que ça t'aidera ! 🚀",
    "Enjoy ! ⚡",
  ];

  // ── Utilities ────────────────────────────────────────────

  function randomDelay(range) {
    const ms = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function randomDelaySeconds(minSec, maxSec) {
    const ms = Math.floor(Math.random() * ((maxSec - minSec) * 1000 + 1)) + minSec * 1000;
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
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

  /**
   * Generate a dynamic reply (varied each time)
   */
  function generateDynamicReply(baseTemplate, vars) {
    if (!settings.dynamicMessages) return fillTemplate(baseTemplate, vars);
    return fillTemplate(pick(REPLY_VARIATIONS), vars);
  }

  /**
   * Generate a dynamic DM (varied each time but coherent)
   */
  function generateDynamicDM(baseTemplate, vars) {
    if (!settings.dynamicMessages) return fillTemplate(baseTemplate, vars);
    const opener = fillTemplate(pick(DM_OPENERS), vars);
    const body = fillTemplate(pick(DM_BODIES), vars);
    const closer = fillTemplate(pick(DM_CLOSERS), vars);
    return `${opener}\n\n${body}\n\n${closer}`;
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

  let settings = { enabled: false, dryRun: false, notificationsEnabled: true, debugMode: false, dynamicMessages: false };
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

    log('info', `Config: ${thematics.length} thematics, ${processedComments.size} processed, enabled=${settings.enabled}, dynamic=${settings.dynamicMessages}`);

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
      if (msg.type === 'SCAN_PROFILE_POSTS') {
        const posts = scanProfilePosts();
        sendResponse({ posts });
      }
      return true;
    });

    injectStatusBadge();
  }

  // ── Profile Post Scanner ─────────────────────────────────

  function scanProfilePosts() {
    const posts = [];

    // Multiple selector strategies to cover feed, profile activity, and post pages
    const POST_SELECTORS = [
      '.feed-shared-update-v2',                           // Feed
      '.profile-creator-shared-feed-update__container',    // Profile activity
      '.occludable-update',                                // Generic update wrapper
      '[data-urn*="activity"]',                            // URN-based fallback
      'article',                                           // Semantic fallback
    ];

    const TEXT_SELECTORS = [
      '.feed-shared-update-v2__description .update-components-text',
      '.update-components-text',
      '.feed-shared-text',
      '.break-words',
      '[dir="ltr"] span[aria-hidden="true"]',
    ];

    // Try each post selector until we find posts
    let postElements = [];
    for (const sel of POST_SELECTORS) {
      postElements = document.querySelectorAll(sel);
      if (postElements.length > 0) {
        log('debug', `Found ${postElements.length} posts with selector: ${sel}`);
        break;
      }
    }

    // Fallback: just grab all visible text blocks that look like posts
    if (postElements.length === 0) {
      log('debug', 'No posts found with standard selectors, trying broad scan...');
      postElements = document.querySelectorAll('[data-urn]');
    }

    for (const postEl of postElements) {
      const urn = postEl.getAttribute('data-urn') || '';
      
      // Try each text selector
      let textContent = '';
      for (const textSel of TEXT_SELECTORS) {
        const textEl = postEl.querySelector(textSel);
        if (textEl && textEl.textContent.trim().length > 20) {
          textContent = textEl.textContent.trim();
          break;
        }
      }
      
      // If still no text, grab the element's own text (trimmed, first 500 chars)
      if (!textContent) {
        const rawText = postEl.textContent.trim();
        if (rawText.length > 50) {
          textContent = rawText.substring(0, 500);
        }
      }

      if (textContent) {
        const authorEl = postEl.querySelector('.update-components-actor__name, .feed-shared-actor__name');
        posts.push({
          urn,
          text: textContent,
          author: authorEl ? authorEl.textContent.trim() : '',
        });
      }
    }
    
    log('info', `📋 Scanned ${posts.length} posts from current page (URL: ${window.location.pathname})`);
    return posts;
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
    const SCAN_INTERVAL = { min: 30000, max: 60000 };
    const doScan = async () => {
      if (!settings.enabled) return;
      await randomDelay(SCAN_INTERVAL);
      scanAllVisibleComments();
      scanTimeout = setTimeout(doScan, 0);
    };
    scanTimeout = setTimeout(doScan, SCAN_INTERVAL.min);
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
    log('info', `📋 Queued: ${matchData.authorName} (${actionQueue.length} in queue)`);
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
      // Between-action delay: use thematic config or default 2-5 min
      if (actionQueue.length > 0) {
        const nextMatch = actionQueue[0];
        const minDelay = (nextMatch.thematic.replyDelayMin || 120) * 1000;
        const maxDelay = (nextMatch.thematic.replyDelayMax || 300) * 1000;
        log('debug', `Waiting ${Math.round(minDelay/1000)}-${Math.round(maxDelay/1000)}s before next action...`);
        await randomDelay({ min: minDelay, max: maxDelay });
      }
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

    // ── Step 1: Wait before reply (configurable delay) ──
    const replyDelayMin = (match.thematic.replyDelayMin || 120) * 1000;
    const replyDelayMax = (match.thematic.replyDelayMax || 300) * 1000;
    log('info', `⏳ Waiting ${Math.round(replyDelayMin/1000)}-${Math.round(replyDelayMax/1000)}s before replying to ${match.authorName}...`);
    await randomDelay({ min: replyDelayMin, max: replyDelayMax });

    // ── Step 2: Reply to comment ──
    const replyText = generateDynamicReply(match.thematic.replyTemplate, vars);
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

    // ── Step 3: Wait before DM (configurable delay) ──
    const dmDelayMin = (match.thematic.dmDelayMin || 180) * 1000;
    const dmDelayMax = (match.thematic.dmDelayMax || 600) * 1000;
    log('info', `⏳ Waiting ${Math.round(dmDelayMin/1000)}-${Math.round(dmDelayMax/1000)}s before DM to ${match.authorName}...`);
    await randomDelay({ min: dmDelayMin, max: dmDelayMax });

    // ── Step 4: Send DM ──
    const dmText = generateDynamicDM(match.thematic.dmTemplate, vars);
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

      let input = await waitForElement(SELECTORS.COMMENT_INPUT, 5000, commentEl.closest(SELECTORS.COMMENT_ENTITY) || commentEl.parentElement);
      if (!input) {
        const inputs = document.querySelectorAll(SELECTORS.COMMENT_INPUT);
        input = inputs[inputs.length - 1];
      }
      if (!input) { log('warn', 'No reply input'); return false; }

      await simulateTyping(input, text, { min: 30, max: 80 });
      await randomDelay({ min: 2000, max: 5000 });

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
      let composeBtn = document.querySelector(SELECTORS.MSG_COMPOSE_BTN);
      if (!composeBtn) {
        const msgIcon = document.querySelector('#messaging-tab-icon, .msg-overlay-list-bubble__btn');
        if (msgIcon) { await simulateClick(msgIcon); await sleep(2000); }
        composeBtn = await waitForElement(SELECTORS.MSG_COMPOSE_BTN, 5000);
      }
      if (!composeBtn) { log('warn', 'No compose btn'); return false; }
      await simulateClick(composeBtn);
      await sleep(2000);

      const searchInput = await waitForElement(SELECTORS.MSG_SEARCH_INPUT, 5000);
      if (!searchInput) { log('warn', 'No search input'); return false; }
      await simulateTyping(searchInput, recipientName, { min: 30, max: 80 });
      await sleep(2000);

      const result = await waitForElement(SELECTORS.MSG_RECIPIENT_RESULT, 5000);
      if (!result) {
        log('warn', `No result for "${recipientName}"`);
        const closeBtn = document.querySelector(SELECTORS.MSG_CLOSE_BTN);
        if (closeBtn) await simulateClick(closeBtn);
        return false;
      }
      await simulateClick(result);
      await sleep(1500);

      const msgInput = await waitForElement(SELECTORS.MSG_BODY_INPUT, 5000);
      if (!msgInput) { log('warn', 'No msg input'); return false; }
      await simulateTyping(msgInput, text, { min: 30, max: 80 });
      await randomDelay({ min: 2000, max: 5000 });

      const sendBtn = await waitForElement(SELECTORS.MSG_SEND_BTN, 3000);
      if (!sendBtn) { log('warn', 'No send btn'); return false; }
      await simulateClick(sendBtn);
      await sleep(2000);

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

  // ── Status Badge ─────────────────────────────────────────

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
