// ============================================================
// Content Script — Main entry point on LinkedIn pages
// ============================================================

// Note: Can't use ES modules in content scripts (Manifest V3 limitation)
// All imports are bundled or inlined. Using IIFE pattern.

(async function ScaleMeLinkedIn() {
  'use strict';

  // ── Config ───────────────────────────────────────────────
  // Use shared selectors (loaded from selectors.js via manifest)
  const _shared = window.ScaleMeSelectors || {};
  const SELECTORS = {
    FEED_CONTAINER: _shared.FEED_CONTAINER || '.scaffold-finite-scroll__content',
    POST_CONTAINER: _shared.POST_CONTAINER_ALL || _shared.POST_CONTAINER || '.feed-shared-update-v2, .profile-creator-shared-feed-update__container, [data-urn*="activity"], article',
    POST_URN: _shared.POST_URN || 'data-urn',
    POST_TEXT: _shared.POST_TEXT || '.feed-shared-update-v2__description .update-components-text',
    POST_AUTHOR: _shared.POST_AUTHOR || '.update-components-actor__name',
    COMMENTS_SECTION: _shared.COMMENTS_SECTION || '.comments-comments-list',
    COMMENT_ITEM: _shared.COMMENT_ITEM_ALL || _shared.COMMENT_ITEM || '.comments-comment-item, .comments-comment-entity',
    COMMENT_ENTITY: _shared.COMMENT_ENTITY || '.comments-comment-entity',
    COMMENT_TEXT: _shared.COMMENT_TEXT_ALL || _shared.COMMENT_TEXT || '.comments-comment-item__main-content .update-components-text, .feed-shared-main-content .update-components-text',
    COMMENT_AUTHOR: _shared.COMMENT_AUTHOR_ALL || _shared.COMMENT_AUTHOR || '.comments-post-meta__name-text, .comment-item__inline-show-more-text',
    COMMENT_AUTHOR_LINK: _shared.COMMENT_AUTHOR_LINK_ALL || _shared.COMMENT_AUTHOR_LINK || '.comments-post-meta__name-text a, .comments-post-meta__profile-link',
    COMMENT_REPLY_BTN: _shared.COMMENT_REPLY_BTN_ALL || _shared.COMMENT_REPLY_BTN || '.comments-comment-social-bar__reply-btn, button[aria-label*="Reply"], button[aria-label*="Répondre"]',
    COMMENT_INPUT: _shared.COMMENT_INPUT_ALL || _shared.COMMENT_INPUT || '.comments-comment-box__form .ql-editor, [class*="comment-box"] [contenteditable="true"], [role="textbox"][aria-label*="comment"]',
    COMMENT_SUBMIT_BTN: _shared.COMMENT_SUBMIT_BTN_ALL || _shared.COMMENT_SUBMIT_BTN || '.comments-comment-box__submit-button, [class*="comment-box"] button[type="submit"], [class*="comment-box"] button[class*="submit"]',
    LOAD_MORE_COMMENTS: _shared.LOAD_MORE_COMMENTS || '.comments-comments-list__load-more-comments-button',
    MSG_COMPOSE_BTN: _shared.MSG_COMPOSE_BTN || '.msg-overlay-bubble-header__control--new-convo-btn',
    MSG_SEARCH_INPUT: _shared.MSG_SEARCH_INPUT || '.msg-connections-typeahead__search-field',
    MSG_RECIPIENT_RESULT: _shared.MSG_RECIPIENT_RESULT || '.msg-connections-typeahead__result-item',
    MSG_BODY_INPUT: _shared.MSG_BODY_INPUT || '.msg-form__contenteditable',
    MSG_SEND_BTN: _shared.MSG_SEND_BTN || '.msg-form__send-button',
    MSG_CLOSE_BTN: _shared.MSG_CLOSE_BTN || '.msg-overlay-bubble-header__control--close-btn',
    MSG_PROFILE_BTN: _shared.MSG_PROFILE_BTN || 'button[aria-label*="Message"], button[aria-label*="Envoyer un message"], .pvs-profile-actions button[aria-label*="Message"]',
    COMMENT_AUTHOR_LINK: _shared.COMMENT_AUTHOR_LINK_ALL || _shared.COMMENT_AUTHOR_LINK || '.comments-post-meta__name-text a, .comments-post-meta__profile-link',
    CONNECT_BTN: _shared.CONNECT_BTN || 'button[aria-label*="Invite"][aria-label*="connect"], .pvs-profile-actions button[aria-label*="Connect"], .pvs-profile-actions button[aria-label*="Se connecter"]',
    CONNECT_BTN_MORE: _shared.CONNECT_BTN_MORE || '.artdeco-dropdown__content button[aria-label*="Connect"], .artdeco-dropdown__content button[aria-label*="Se connecter"]',
    MORE_ACTIONS_BTN: _shared.MORE_ACTIONS_BTN || '.pvs-profile-actions .artdeco-dropdown__trigger',
    CONNECT_MODAL_SEND: _shared.CONNECT_MODAL_SEND || 'button[aria-label="Send without a note"], button[aria-label="Envoyer sans note"], button[aria-label="Send now"], button[aria-label="Envoyer"]',
  };

  const LIMITS = {
    MAX_REPLIES_PER_DAY: 25,
    MAX_DMS_PER_DAY: 20,
    MAX_CONNECTIONS_PER_DAY: 10,
    MAX_PENDING_DMS: 50,
  };

  const STORAGE_KEYS = {
    THEMATICS: 'scaleme_thematics',
    SETTINGS: 'scaleme_settings',
    ACTION_LOG: 'scaleme_action_log',
    PROCESSED_COMMENTS: 'scaleme_processed_comments',
    DAILY_COUNTERS: 'scaleme_daily_counters',
    PENDING_DMS: 'scaleme_pending_dms',
    ACTION_QUEUE: 'scaleme_action_queue',
    COMMENT_STEPS: 'scaleme_comment_steps',
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
  let dailyCounters = { replies: 0, dms: 0, connections: 0, date: getTodayKey() };
  let pendingDMs = [];
  let actionQueue = [];
  let pendingActionComments = new Set(); // In-memory only: prevents re-detection while action is queued/executing
  let commentQueueAttempts = new Map(); // commentId → number of times queued (anti-loop)
  let isProcessingQueue = false;
  let isCatchupRunning = false;
  let observer = null;
  let scanTimeout = null;

  // ── Queue & Steps Persistence (debounced) ──────────────
  let _saveQueueTimer = null;
  function saveActionQueue() {
    if (_saveQueueTimer) clearTimeout(_saveQueueTimer);
    _saveQueueTimer = setTimeout(() => {
      const serializable = actionQueue.map(a => ({ ...a, commentElement: null }));
      chrome.storage.local.set({ [STORAGE_KEYS.ACTION_QUEUE]: serializable });
    }, 300);
  }

  let _saveStepsTimer = null;
  function saveCommentSteps() {
    if (_saveStepsTimer) clearTimeout(_saveStepsTimer);
    _saveStepsTimer = setTimeout(() => {
      chrome.storage.local.set({ [STORAGE_KEYS.COMMENT_STEPS]: Object.fromEntries(commentSteps) });
    }, 500);
  }

  function findCommentElement(commentId) {
    return document.querySelector(`[data-scaleme-id="${commentId}"]`) || null;
  }

  // ── Pipeline Step Tracking ──────────────────────────────
  const STEP = {
    QUEUED:          'queued',
    WAIT_REPLY:      'wait_reply',
    REPLYING:        'replying',
    REPLY_DONE:      'reply_done',
    REPLY_FAILED:    'reply_failed',
    WAIT_DM:         'wait_dm',
    SENDING_DM:      'sending_dm',
    DM_DONE:         'dm_done',
    CONNECTION_SENT: 'connection_sent',
    PENDING_DM:      'pending_dm',
    DONE:            'done',
    FAILED:          'failed',
  };

  const STEP_DISPLAY = {
    [STEP.QUEUED]:          { icon: '📋', label: 'En file' },
    [STEP.WAIT_REPLY]:      { icon: '⏳', label: 'Réponse dans' },
    [STEP.REPLYING]:        { icon: '💬', label: 'Réponse...' },
    [STEP.REPLY_DONE]:      { icon: '✅', label: 'Réponse OK' },
    [STEP.REPLY_FAILED]:    { icon: '❌', label: 'Réponse échouée' },
    [STEP.WAIT_DM]:         { icon: '⏳', label: 'DM dans' },
    [STEP.SENDING_DM]:      { icon: '📩', label: 'DM...' },
    [STEP.DM_DONE]:         { icon: '✅', label: 'DM envoyé' },
    [STEP.CONNECTION_SENT]: { icon: '🤝', label: 'Connexion envoyée' },
    [STEP.PENDING_DM]:      { icon: '⏳', label: 'DM en attente' },
    [STEP.DONE]:            { icon: '✅', label: 'Terminé' },
    [STEP.FAILED]:          { icon: '❌', label: 'Erreur' },
  };

  let commentSteps = new Map(); // commentId → { step, stepStartedAt, timerTargetAt, authorName, matchedKeyword, thematicName }

  function updateStep(commentId, step, timerDurationMs) {
    const entry = commentSteps.get(commentId);
    if (!entry) return;
    entry.step = step;
    entry.stepStartedAt = Date.now();
    entry.timerTargetAt = timerDurationMs ? Date.now() + timerDurationMs : null;
    updateCommentOverlay(commentId);
    saveCommentSteps();
  }

  function updateCommentOverlay(commentId) {
    const entry = commentSteps.get(commentId);
    if (!entry) return;

    let el = document.querySelector(`[data-scaleme-id="${commentId}"] .scaleme-step-badge`);
    const container = document.querySelector(`[data-scaleme-id="${commentId}"]`);

    if (!el && container) {
      el = document.createElement('div');
      el.className = 'scaleme-step-badge';
      container.appendChild(el);
    }
    if (!el) return;

    const display = STEP_DISPLAY[entry.step] || { icon: '⚡', label: entry.step };

    if (entry.timerTargetAt && entry.timerTargetAt > Date.now()) {
      const remaining = Math.ceil((entry.timerTargetAt - Date.now()) / 1000);
      const min = Math.floor(remaining / 60);
      const sec = remaining % 60;
      el.textContent = `${display.icon} ${display.label} ${min}:${String(sec).padStart(2, '0')}`;
      el.classList.add('scaleme-step-timer');
    } else {
      el.textContent = `${display.icon} ${display.label}`;
      el.classList.remove('scaleme-step-timer');
    }
  }

  function cleanupCommentSteps() {
    const now = Date.now();
    let changed = false;
    for (const [id, entry] of commentSteps) {
      if ((entry.step === STEP.DONE || entry.step === STEP.FAILED) && now - entry.stepStartedAt > 60000) {
        const badge = document.querySelector(`[data-scaleme-id="${id}"] .scaleme-step-badge`);
        if (badge) badge.remove();
        commentSteps.delete(id);
        changed = true;
      } else if (now - entry.stepStartedAt > 7200000) {
        const badge = document.querySelector(`[data-scaleme-id="${id}"] .scaleme-step-badge`);
        if (badge) badge.remove();
        commentSteps.delete(id);
        changed = true;
      }
    }
    if (changed) saveCommentSteps();
  }

  // ── Init ─────────────────────────────────────────────────

  async function init() {
    log('info', '⚡ Scale Me LinkedIn extension loaded');

    const data = await chrome.storage.local.get([
      STORAGE_KEYS.SETTINGS,
      STORAGE_KEYS.THEMATICS,
      STORAGE_KEYS.PROCESSED_COMMENTS,
      STORAGE_KEYS.DAILY_COUNTERS,
      STORAGE_KEYS.PENDING_DMS,
      STORAGE_KEYS.ACTION_QUEUE,
      STORAGE_KEYS.COMMENT_STEPS,
    ]);

    settings = data[STORAGE_KEYS.SETTINGS] || settings;
    thematics = (data[STORAGE_KEYS.THEMATICS] || []).filter(t => t.enabled);
    
    const savedComments = data[STORAGE_KEYS.PROCESSED_COMMENTS] || [];
    processedComments = new Set(savedComments);
    
    const savedCounters = data[STORAGE_KEYS.DAILY_COUNTERS];
    if (savedCounters && savedCounters.date === getTodayKey()) {
      dailyCounters = savedCounters;
    }

    pendingDMs = data[STORAGE_KEYS.PENDING_DMS] || [];

    // Restore action queue (filter stale items > 2h)
    const savedQueue = data[STORAGE_KEYS.ACTION_QUEUE] || [];
    actionQueue = savedQueue.filter(a => {
      if (a.enqueuedAt && Date.now() - a.enqueuedAt > 7200000) return false;
      return true;
    });

    // Restore comment steps
    const savedSteps = data[STORAGE_KEYS.COMMENT_STEPS] || {};
    commentSteps = new Map(Object.entries(savedSteps));

    // Rebuild pendingActionComments from queue + active steps
    for (const item of actionQueue) {
      pendingActionComments.add(item.commentId);
    }
    for (const [commentId, entry] of commentSteps) {
      if (entry.step !== STEP.DONE && entry.step !== STEP.FAILED) {
        pendingActionComments.add(commentId);
      }
    }

    if (actionQueue.length > 0) {
      log('info', `Restored ${actionQueue.length} queued actions, ${commentSteps.size} pipeline steps`);
    }

    log('info', `Config: ${thematics.length} thematics, ${processedComments.size} processed, enabled=${settings.enabled}, dynamic=${settings.dynamicMessages}`);

    if (settings.enabled) {
      startScanning();
      // Resume queue processing if items were restored
      if (actionQueue.length > 0 && !isProcessingQueue) {
        setTimeout(() => processQueue(), 3000);
      }
    }

    // Run selector health check after DOM stabilizes
    setTimeout(runSelectorHealthCheck, 5000);

    // Listen for messages from popup/service-worker
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (msg.type === 'TOGGLE_ENABLED') {
        settings.enabled = msg.enabled;
        if (settings.enabled) startScanning();
        else stopScanning();
        sendResponse({ ok: true });
      } else if (msg.type === 'UPDATE_THEMATICS') {
        thematics = (msg.thematics || []).filter(t => t.enabled);
        log('info', `Thematics updated: ${thematics.length} active`);
        sendResponse({ ok: true });
      } else if (msg.type === 'UPDATE_SETTINGS') {
        settings = msg.settings;
        sendResponse({ ok: true });
      } else if (msg.type === 'GET_STATUS') {
        sendResponse({
          enabled: settings.enabled,
          queueLength: actionQueue.length,
          dailyCounters,
          processedCount: processedComments.size,
          isProcessing: isProcessingQueue,
          pendingDMsCount: pendingDMs.length,
          commentSteps: Object.fromEntries(commentSteps),
        });
      } else if (msg.type === 'SCAN_PROFILE_POSTS') {
        const posts = scanProfilePosts();
        sendResponse({ posts });
      } else if (msg.type === 'CATCHUP_FETCH_POSTS') {
        catchupFetchPosts().then(posts => sendResponse({ posts })).catch(err => sendResponse({ error: err.message }));
      } else if (msg.type === 'CATCHUP_RUN') {
        catchupRun(msg.postUrns).then(result => sendResponse(result)).catch(err => sendResponse({ error: err.message }));
      } else if (msg.type === 'RUN_DIAGNOSTIC') {
        const report = window.ScaleMeDiagnostic ? window.ScaleMeDiagnostic.run() : { error: 'Diagnostic not loaded' };
        sendResponse(report);
      } else if (msg.type === 'DISCOVER_DOM') {
        const discovery = window.ScaleMeDiagnostic ? window.ScaleMeDiagnostic.discover() : { error: 'Diagnostic not loaded' };
        sendResponse(discovery);
      } else if (msg.type === 'CLICK_CONNECT_BTN') {
        clickConnectButton().then(ok => sendResponse({ ok }));
      } else if (msg.type === 'RETRY_PENDING_DMS') {
        retryPendingDMs().then(result => sendResponse(result)).catch(err => sendResponse({ error: err.message }));
      } else if (msg.type === 'GET_PENDING_DMS') {
        sendResponse({ pendingDMs: pendingDMs.map(p => ({
          authorName: p.authorName,
          thematicName: p.thematicName,
          keyword: p.keyword,
          timestamp: p.timestamp,
          retryCount: p.retryCount,
        })) });
      } else if (msg.type === 'CLEAR_PROCESSED') {
        const count = processedComments.size;
        processedComments.clear();
        pendingActionComments.clear();
        actionQueue.length = 0;
        commentSteps.clear();
        saveProcessedComments();
        chrome.storage.local.remove([STORAGE_KEYS.ACTION_QUEUE, STORAGE_KEYS.COMMENT_STEPS]);
        document.querySelectorAll('.scaleme-processed').forEach(el => {
          el.classList.remove('scaleme-processed');
        });
        document.querySelectorAll('.scaleme-step-badge').forEach(el => el.remove());
        log('info', `Cleared ${count} processed comments + queue + pipeline`);
        sendResponse({ ok: true, cleared: count });
      }
      return true;
    });

    injectStatusBadge();

    // Pipeline step timer tick — update countdowns every second
    setInterval(() => {
      for (const [commentId, entry] of commentSteps) {
        if (entry.timerTargetAt && entry.timerTargetAt > Date.now()) {
          updateCommentOverlay(commentId);
        }
      }
      cleanupCommentSteps();
    }, 1000);
  }

  // ── Profile Post Scanner ─────────────────────────────────

  function scanProfilePosts() {
    const posts = [];

    const TEXT_SELECTORS = [
      '.feed-shared-update-v2__description .update-components-text',
      '.update-components-text',
      '.feed-shared-text',
      '.break-words',
      '[dir="ltr"] span[aria-hidden="true"]',
    ];

    // Use shared selectors (already includes multiple fallbacks)
    let postElements = document.querySelectorAll(SELECTORS.POST_CONTAINER);
    if (postElements.length > 0) {
      log('debug', `Found ${postElements.length} posts with shared selectors`);
    }

    // Fallback: just grab all visible elements with a data-urn
    if (postElements.length === 0) {
      log('debug', 'No posts found with standard selectors, trying broad [data-urn] scan...');
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

  // ── Selector Health Check ────────────────────────────────

  function runSelectorHealthCheck() {
    const path = window.location.pathname;
    const isFeed = path.startsWith('/feed');
    const isPost = path.includes('/posts/') || path.includes('/feed/update/');

    // Only check feed/comment selectors on pages where they're expected
    if (!isFeed && !isPost) {
      const pageType = path.startsWith('/in/') ? 'profile' : 'other';
      log('info', `✅ Selector health check skipped (page type: ${pageType})`);
      chrome.storage.local.set({
        scaleme_selector_health: { broken: [], timestamp: Date.now(), url: window.location.href, skipped: true },
      });
      return;
    }

    const critical = {
      FEED_CONTAINER: SELECTORS.FEED_CONTAINER,
      POST_CONTAINER: SELECTORS.POST_CONTAINER,
      COMMENT_ITEM: SELECTORS.COMMENT_ITEM,  // Already uses _ALL fallback selectors
    };

    const broken = [];
    for (const [name, selector] of Object.entries(critical)) {
      const count = document.querySelectorAll(selector).length;
      if (count === 0) broken.push(name);
    }

    if (broken.length > 0) {
      log('warn', `⚠️ Selector health check: ${broken.join(', ')} matched 0 elements. Comments may not be detected!`);
      // Update badge to warn
      const badge = document.getElementById('scaleme-badge');
      if (badge) {
        badge.style.background = '#ff9900';
        badge.title = `ScaleMe: sélecteurs cassés (${broken.join(', ')})`;
      }
      // Notify via Chrome notification
      try {
        chrome.runtime.sendMessage({
          type: 'SHOW_NOTIFICATION',
          title: 'ScaleMe — Sélecteurs cassés',
          message: `${broken.length} sélecteur(s) ne matchent rien : ${broken.join(', ')}. LinkedIn a peut-être changé son DOM.`,
        });
      } catch (_) {}
      // Save health status for popup
      chrome.storage.local.set({
        scaleme_selector_health: { broken, timestamp: Date.now(), url: window.location.href },
      });
    } else {
      log('info', '✅ Selector health check passed');
      chrome.storage.local.set({
        scaleme_selector_health: { broken: [], timestamp: Date.now(), url: window.location.href },
      });
    }
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
    if (isCatchupRunning) return; // Don't compete with catchup
    let posts = document.querySelectorAll(SELECTORS.POST_CONTAINER);

    // Activity page fallback: if no posts found, try broader selectors
    if (posts.length === 0 && window.location.pathname.includes('/recent-activity/')) {
      log('debug', 'Activity page: trying broad selectors');
      posts = document.querySelectorAll('[data-urn], .scaffold-finite-scroll__content > div');
    }

    let matches = 0;
    for (const post of posts) {
      const urn = post.getAttribute(SELECTORS.POST_URN) || '';
      const authorReplied = findCommentsWithAuthorReplies(post);
      const comments = post.querySelectorAll(SELECTORS.COMMENT_ITEM);
      for (const comment of comments) {
        if (analyzeComment(comment, urn, authorReplied)) matches++;
        else markIfProcessed(comment, urn);
      }
    }
    if (matches > 0) log('info', `🎯 ${matches} new keyword match(es)`);
  }

  /**
   * Extract author info from a comment element with multiple fallback strategies
   */
  function extractAuthorFromComment(commentEl) {
    let authorName = '';
    let authorProfileUrl = '';

    // Strategy 1: Primary selector
    const authorEl = commentEl.querySelector(SELECTORS.COMMENT_AUTHOR);
    if (authorEl) authorName = authorEl.textContent.trim();

    // Strategy 2: Author link text
    if (!authorName) {
      const linkEl = commentEl.querySelector(SELECTORS.COMMENT_AUTHOR_LINK);
      if (linkEl) {
        authorName = linkEl.textContent.trim();
        if (linkEl.href) authorProfileUrl = linkEl.href;
      }
    }

    // Strategy 3: aria-label on profile links
    if (!authorName) {
      const profileLink = commentEl.querySelector('a[href*="/in/"]');
      if (profileLink) {
        if (!authorProfileUrl && profileLink.href) authorProfileUrl = profileLink.href;
        const aria = profileLink.getAttribute('aria-label') || '';
        const ariaMatch = aria.match(/(?:profil\s+(?:de\s+)?|profile\s+(?:of\s+)?)(.+)/i);
        if (ariaMatch) {
          authorName = ariaMatch[1].trim();
        } else if (profileLink.textContent.trim()) {
          authorName = profileLink.textContent.trim();
        }
      }
    }

    // Strategy 4: Wildcard class patterns
    if (!authorName) {
      const wildcard = commentEl.querySelector('[class*="name-text"], [class*="actor__name"], [class*="comment-meta"] [class*="name"]');
      if (wildcard) authorName = wildcard.textContent.trim();
    }

    // Strategy 5: Parse name from profile URL slug
    if (!authorName && authorProfileUrl) {
      const slugMatch = authorProfileUrl.match(/\/in\/([^/?#]+)/);
      if (slugMatch) {
        authorName = slugMatch[1]
          .replace(/-[a-f0-9]{4,}$/i, '')
          .replace(/-/g, ' ')
          .replace(/\b\w/g, c => c.toUpperCase())
          .trim();
      }
    }

    // Extract profile URL if still missing
    if (!authorProfileUrl) {
      const anyProfileLink = commentEl.querySelector('a[href*="/in/"]');
      if (anyProfileLink) authorProfileUrl = anyProfileLink.href;
    }

    return { authorName: authorName || 'Unknown', authorProfileUrl };
  }

  function markIfProcessed(commentEl, postUrn) {
    if (commentEl.classList.contains('scaleme-processed')) return;
    try {
      const textEl = commentEl.querySelector(SELECTORS.COMMENT_TEXT);
      if (!textEl) return;
      const { authorName } = extractAuthorFromComment(commentEl);
      const text = textEl.textContent.trim().toLowerCase();
      const commentId = getCommentId(postUrn, authorName, text);
      if (processedComments.has(commentId)) {
        commentEl.classList.add('scaleme-processed');
      }
    } catch (_) {}
  }

  /**
   * Check if an element contains the "Auteur"/"Author" badge.
   */
  function hasAuthorBadge(el) {
    const badge = el.querySelector(SELECTORS.AUTHOR_BADGE);
    if (badge) return true;
    const metaArea = el.querySelector('.comments-post-meta, [class*="comment-meta"], [class*="post-meta"]');
    if (metaArea) {
      const metaText = metaArea.textContent.toLowerCase();
      if (metaText.includes('auteur') || metaText.includes('author') || metaText.includes('creator')) {
        return true;
      }
    }
    return false;
  }

  /**
   * Build a Set of comment elements that already have an author reply.
   * Works at the post level to handle any DOM nesting structure.
   */
  function findCommentsWithAuthorReplies(postEl) {
    const result = new Set();
    try {
      // Find all comment elements with the author badge in this post
      const allComments = postEl.querySelectorAll(SELECTORS.COMMENT_ITEM);
      for (const comment of allComments) {
        if (!hasAuthorBadge(comment)) continue;

        // This comment IS by the author. Find its parent comment.
        // Strategy 1: Walk up DOM — the parent .comments-comment-item is the thread parent
        const parentComment = comment.parentElement?.closest(SELECTORS.COMMENT_ITEM);
        if (parentComment && parentComment !== comment) {
          result.add(parentComment);
          continue;
        }

        // Strategy 2: Previous sibling — flat DOM where replies follow parent
        let prev = comment.previousElementSibling;
        while (prev) {
          if (prev.matches?.(SELECTORS.COMMENT_ITEM) && !hasAuthorBadge(prev)) {
            result.add(prev);
            break;
          }
          prev = prev.previousElementSibling;
        }
      }
    } catch (_) {}
    return result;
  }

  function analyzeComment(commentEl, postUrn, authorReplied) {
    try {
      const textEl = commentEl.querySelector(SELECTORS.COMMENT_TEXT);
      if (!textEl) return false;

      const { authorName, authorProfileUrl } = extractAuthorFromComment(commentEl);
      const text = textEl.textContent.trim().toLowerCase();
      const commentId = getCommentId(postUrn, authorName, text);

      if (processedComments.has(commentId) || pendingActionComments.has(commentId)) return false;

      // Anti-loop: skip comments queued too many times without success
      const attempts = commentQueueAttempts.get(commentId) || 0;
      if (attempts >= 2) {
        log('info', `⏭️ Skip: ${authorName} already queued ${attempts}x, marking as processed`);
        markCommentProcessed(commentId, commentEl);
        return false;
      }

      // Skip if post author already replied to this comment
      if (authorReplied && authorReplied.has(commentEl)) {
        log('info', `⏭️ Skip: author already replied to ${authorName}`);
        markCommentProcessed(commentId, commentEl);
        return false;
      }

      // Skip comments that are BY the post author (they have the author badge)
      if (hasAuthorBadge(commentEl)) return false;

      for (const thematic of thematics) {
        if (thematic.postUrns?.length > 0 && !thematic.postUrns.includes(postUrn)) continue;
        const kw = thematic.keywords.find(k => text.includes(k.toLowerCase()));
        if (kw) {
          pendingActionComments.add(commentId);
          commentQueueAttempts.set(commentId, (commentQueueAttempts.get(commentId) || 0) + 1);
          commentEl.style.position = 'relative';
          commentEl.setAttribute('data-scaleme-id', commentId);
          const match = { commentId, postUrn, commentText: textEl.textContent.trim(), authorName, authorProfileUrl, matchedKeyword: kw, thematic, commentElement: commentEl, timestamp: Date.now() };
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
      log('warn', '⚠️ Daily limit reached, dropping action for ' + matchData.authorName);
      pendingActionComments.delete(matchData.commentId);
      return;
    }
    matchData.enqueuedAt = Date.now();
    actionQueue.push(matchData);
    commentSteps.set(matchData.commentId, {
      step: STEP.QUEUED,
      stepStartedAt: Date.now(),
      timerTargetAt: null,
      authorName: matchData.authorName,
      matchedKeyword: matchData.matchedKeyword,
      thematicName: matchData.thematic.name,
    });
    updateCommentOverlay(matchData.commentId);
    saveActionQueue();
    saveCommentSteps();
    log('info', `📋 Queued: ${matchData.authorName} (${actionQueue.length} in queue)`);
    if (!isProcessingQueue) processQueue();
  }

  async function processQueue() {
    if (isProcessingQueue || actionQueue.length === 0) return;
    isProcessingQueue = true;

    while (actionQueue.length > 0) {
      const match = actionQueue.shift();
      saveActionQueue();
      try {
        if (match.fromCatchup) {
          await processMatchWrapped(match);
        } else {
          await processMatch(match);
        }
      } catch (err) {
        log('error', `Process error for ${match.authorName}:`, err);
        pendingActionComments.delete(match.commentId);
      }
      // Between-action delay: use global settings
      if (actionQueue.length > 0) {
        const minDelay = (settings.betweenActionsMin || 15) * 1000;
        const maxDelay = (settings.betweenActionsMax || 60) * 1000;
        log('debug', `Waiting ${Math.round(minDelay/1000)}-${Math.round(maxDelay/1000)}s before next action...`);
        await randomDelay({ min: minDelay, max: maxDelay });
      }
    }

    isProcessingQueue = false;
    saveActionQueue();
  }

  async function processMatch(match) {
    // Re-find comment element if lost (e.g. after page reload)
    if (!match.commentElement && match.commentId) {
      match.commentElement = findCommentElement(match.commentId);
      if (!match.commentElement) {
        log('warn', `Comment DOM not found for ${match.authorName}, skipping reply → DM only`);
      }
    }

    const firstName = extractFirstName(match.authorName);
    const vars = {
      firstName,
      fullName: match.authorName,
      link: match.thematic.leadMagnetUrl,
      keyword: match.matchedKeyword,
      thematic: match.thematic.name,
    };
    let replyOk = false;
    let dmOk = false;

    // ── Step 1: Wait before reply (thematic override → global → default) ──
    const replyDelayMin = (match.thematic.replyDelayMin || settings.replyDelayMin || 30) * 1000;
    const replyDelayMax = (match.thematic.replyDelayMax || settings.replyDelayMax || 90) * 1000;
    const replyWaitMs = Math.floor(Math.random() * (replyDelayMax - replyDelayMin + 1)) + replyDelayMin;
    updateStep(match.commentId, STEP.WAIT_REPLY, replyWaitMs);
    log('info', `⏳ Waiting ${Math.round(replyWaitMs/1000)}s before replying to ${match.authorName}...`);
    await sleep(replyWaitMs);

    // ── Step 2: Reply to comment ──
    updateStep(match.commentId, STEP.REPLYING);
    const replyText = generateDynamicReply(match.thematic.replyTemplate, vars);
    if (settings.dryRun) {
      log('info', `🏜️ [DRY] Reply → ${match.authorName}: "${replyText}"`);
      updateStep(match.commentId, STEP.REPLY_DONE);
      replyOk = true;
    } else {
      const ok = await replyToComment(match.commentElement, replyText);
      if (ok) {
        dailyCounters.replies++;
        saveDailyCounters();
        logAction(match, 'reply_sent');
        log('info', `💬 Reply sent to ${match.authorName}`);
        updateStep(match.commentId, STEP.REPLY_DONE);
        replyOk = true;
      } else {
        logAction(match, 'reply_failed');
        updateStep(match.commentId, STEP.REPLY_FAILED);
      }
    }

    // ── Step 3: Wait before DM (thematic override → global → default) ──
    const dmDelayMin = (match.thematic.dmDelayMin || settings.dmDelayMin || 60) * 1000;
    const dmDelayMax = (match.thematic.dmDelayMax || settings.dmDelayMax || 180) * 1000;
    const dmWaitMs = Math.floor(Math.random() * (dmDelayMax - dmDelayMin + 1)) + dmDelayMin;
    updateStep(match.commentId, STEP.WAIT_DM, dmWaitMs);
    log('info', `⏳ Waiting ${Math.round(dmWaitMs/1000)}s before DM to ${match.authorName}...`);
    await sleep(dmWaitMs);

    // ── Step 4: Send DM ──
    updateStep(match.commentId, STEP.SENDING_DM);
    const dmText = generateDynamicDM(match.thematic.dmTemplate, vars);
    if (settings.dryRun) {
      log('info', `🏜️ [DRY] DM → ${match.authorName}: "${dmText}"`);
      updateStep(match.commentId, STEP.DM_DONE);
      setTimeout(() => updateStep(match.commentId, STEP.DONE), 10000);
      dmOk = true;
    } else {
      let ok = await sendDM(match.authorName, dmText);
      if (!ok && match.authorProfileUrl) {
        log('info', `[DM] Retrying via profile for ${match.authorName}...`);
        ok = await sendDMViaProfile(match.authorProfileUrl, dmText);
      }
      if (ok) {
        dailyCounters.dms++;
        saveDailyCounters();
        logAction(match, 'dm_sent');
        log('info', `📩 DM sent to ${match.authorName}`);
        updateStep(match.commentId, STEP.DM_DONE);
        setTimeout(() => updateStep(match.commentId, STEP.DONE), 10000);
        dmOk = true;
      } else {
        await handleDMFailure(match, dmText);
        dmOk = true; // DM queued as pending, not lost
      }
    }

    // ── Mark as processed only after actions complete ──
    if (replyOk || dmOk) {
      markCommentProcessed(match.commentId, match.commentElement);
    } else {
      pendingActionComments.delete(match.commentId);
      log('warn', `All actions failed for ${match.authorName}, comment eligible for retry`);
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
      // Step 1: Find reply button
      log('debug', `[Reply] Step 1: Looking for reply btn with: ${SELECTORS.COMMENT_REPLY_BTN}`);
      let replyBtn = commentEl.querySelector(SELECTORS.COMMENT_REPLY_BTN);
      if (!replyBtn) {
        // Aria-label fallback directly on the comment element
        replyBtn = commentEl.querySelector('button[aria-label*="Reply"], button[aria-label*="Répondre"]');
        if (replyBtn) {
          log('info', '[Reply] Found reply btn via aria-label fallback');
        } else {
          log('warn', `[Reply] No reply button found. Comment classes: ${commentEl.className}`);
          log('debug', `[Reply] Comment HTML preview: ${commentEl.innerHTML.substring(0, 500)}`);
          return false;
        }
      }

      await simulateClick(replyBtn);
      await sleep(1500);

      // Step 2: Find reply input
      const parentScope = commentEl.closest(SELECTORS.COMMENT_ENTITY) || commentEl.parentElement;
      log('debug', `[Reply] Step 2: Looking for input in scope: ${parentScope?.className?.substring(0, 80)}`);
      let input = await waitForElement(SELECTORS.COMMENT_INPUT, 5000, parentScope);
      if (!input) {
        // Fallback: contenteditable in parent scope
        input = parentScope?.querySelector('[contenteditable="true"]');
        if (input) log('info', '[Reply] Found input via contenteditable fallback (scoped)');
      }
      if (!input) {
        // Fallback: last matching input on page (reply box just opened)
        const inputs = document.querySelectorAll(SELECTORS.COMMENT_INPUT);
        input = inputs[inputs.length - 1];
        if (input) log('info', '[Reply] Found input via page-wide fallback');
      }
      if (!input) {
        // Last resort: any contenteditable that just appeared
        const allEditable = document.querySelectorAll('[contenteditable="true"]');
        input = allEditable[allEditable.length - 1];
        if (input) log('info', '[Reply] Found input via global contenteditable fallback');
      }
      if (!input) {
        log('warn', '[Reply] No reply input found anywhere');
        return false;
      }

      // Step 3: Type reply text
      log('debug', `[Reply] Step 3: Typing ${text.length} chars`);
      await simulateTyping(input, text, { min: 30, max: 80 });
      await randomDelay({ min: 2000, max: 5000 });

      // Step 4: Find and click submit — scoped to input container
      const inputContainer = input.closest('[class*="comment-box"]') || input.closest('form') || input.parentElement;
      log('debug', `[Reply] Step 4: Looking for submit btn in: ${inputContainer?.className?.substring(0, 80)}`);
      let submit = await waitForElement(SELECTORS.COMMENT_SUBMIT_BTN, 3000, inputContainer);
      if (!submit) {
        // Fallback: any submit-like button in the container
        submit = inputContainer?.querySelector('button[type="submit"], button[class*="submit"]');
        if (submit) log('info', '[Reply] Found submit via button[type=submit] fallback');
      }
      if (!submit) {
        // Fallback: aria-label patterns (Post/Publier/Submit)
        submit = inputContainer?.querySelector('button[aria-label*="Post"], button[aria-label*="Publier"], button[aria-label*="Submit"], button[aria-label*="Soumettre"], button[aria-label*="Envoyer"]');
        if (!submit) {
          // Broader: any enabled button in the comment box (if only one, it's likely submit)
          const btns = inputContainer?.querySelectorAll('button:not([disabled])');
          if (btns?.length === 1) submit = btns[0];
        }
        if (submit) log('info', '[Reply] Found submit via aria-label/single-button fallback');
      }
      if (!submit) {
        // Fallback: page-wide search
        submit = await waitForElement(SELECTORS.COMMENT_SUBMIT_BTN, 2000);
        if (submit) log('info', '[Reply] Found submit via page-wide fallback');
      }
      if (!submit) {
        log('warn', '[Reply] No submit button found');
        return false;
      }

      await simulateClick(submit);
      await sleep(2000);
      log('info', '[Reply] Successfully submitted reply');
      return true;
    } catch (err) {
      log('error', '[Reply] Exception:', err.message || err);
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

      // Try firstName first (more likely to match in LinkedIn search)
      const firstName = extractFirstName(recipientName);
      log('debug', `[DM] Searching by firstName: "${firstName}"`);
      await simulateTyping(searchInput, firstName, { min: 30, max: 80 });
      await sleep(2000);

      let result = await waitForElement(SELECTORS.MSG_RECIPIENT_RESULT, 5000);
      if (!result && firstName !== recipientName) {
        // Fallback: clear and retry with full name
        log('debug', `[DM] No result for "${firstName}", retrying with full name: "${recipientName}"`);
        searchInput.textContent = '';
        searchInput.innerHTML = '';
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        await sleep(1000);
        await simulateTyping(searchInput, recipientName, { min: 30, max: 80 });
        await sleep(2000);
        result = await waitForElement(SELECTORS.MSG_RECIPIENT_RESULT, 5000);
      }

      if (!result) {
        log('warn', `[DM] No result for "${recipientName}" (tried firstName + fullName)`);
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

  // ── Send DM via Profile Page ────────────────────────────

  async function sendDMViaProfile(profileUrl, text) {
    if (!profileUrl) return false;
    try {
      log('info', `[DM/Profile] Navigating to ${profileUrl}`);
      const currentUrl = window.location.href;
      window.location.href = profileUrl;
      // Wait for profile page to load
      await sleep(4000);

      // Find "Message" button on profile
      const msgBtnSelector = SELECTORS.MSG_PROFILE_BTN || 'button[aria-label*="Message"], button[aria-label*="Envoyer un message"]';
      let msgBtn = document.querySelector(msgBtnSelector);
      if (!msgBtn) {
        // Broader fallback: look for any button with "Message" text
        const allBtns = document.querySelectorAll('.pvs-profile-actions button, .pv-top-card-v2-ctas button');
        for (const btn of allBtns) {
          if (btn.textContent.trim().toLowerCase().includes('message')) {
            msgBtn = btn;
            break;
          }
        }
      }
      if (!msgBtn) {
        log('warn', '[DM/Profile] No Message button found on profile');
        window.location.href = currentUrl;
        await sleep(3000);
        return false;
      }

      await simulateClick(msgBtn);
      await sleep(2500);

      // Messaging overlay should now be open with recipient pre-selected
      const msgInput = await waitForElement(SELECTORS.MSG_BODY_INPUT, 5000);
      if (!msgInput) {
        log('warn', '[DM/Profile] No message input after clicking Message btn');
        window.location.href = currentUrl;
        await sleep(3000);
        return false;
      }

      await simulateTyping(msgInput, text, { min: 30, max: 80 });
      await randomDelay({ min: 2000, max: 5000 });

      const sendBtn = await waitForElement(SELECTORS.MSG_SEND_BTN, 3000);
      if (!sendBtn) {
        log('warn', '[DM/Profile] No send btn');
        window.location.href = currentUrl;
        await sleep(3000);
        return false;
      }
      await simulateClick(sendBtn);
      await sleep(2000);

      const closeBtn = document.querySelector(SELECTORS.MSG_CLOSE_BTN);
      if (closeBtn) { await sleep(1000); await simulateClick(closeBtn); }

      log('info', '[DM/Profile] DM sent successfully via profile');
      // Navigate back to original page
      window.location.href = currentUrl;
      await sleep(3000);
      return true;
    } catch (err) {
      log('error', '[DM/Profile] Exception:', err.message || err);
      return false;
    }
  }

  // ── Connection Request ──────────────────────────────────

  async function clickConnectButton() {
    await sleep(2000);

    let connectBtn = document.querySelector(SELECTORS.CONNECT_BTN);

    if (!connectBtn) {
      const moreBtn = document.querySelector(SELECTORS.MORE_ACTIONS_BTN);
      if (moreBtn) {
        await simulateClick(moreBtn);
        await sleep(1500);
        connectBtn = document.querySelector(SELECTORS.CONNECT_BTN_MORE);
      }
    }

    if (!connectBtn) {
      log('warn', 'No Connect button found on profile page');
      return false;
    }

    await simulateClick(connectBtn);
    await sleep(2000);

    const sendBtn = await waitForElement(SELECTORS.CONNECT_MODAL_SEND, 5000);
    if (sendBtn) {
      await simulateClick(sendBtn);
      await sleep(1500);
    }

    log('info', '🤝 Connection request sent');
    return true;
  }

  async function sendConnectionRequest(authorProfileUrl, authorName) {
    if (!authorProfileUrl) {
      log('warn', `No profile URL for ${authorName}, cannot send connection request`);
      return false;
    }

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'SEND_CONNECTION_REQUEST',
        profileUrl: authorProfileUrl,
        authorName: authorName,
      });
      return response?.ok || false;
    } catch (err) {
      log('error', 'Connection request error:', err);
      return false;
    }
  }

  // ── Pending DMs ────────────────────────────────────────

  async function savePendingDMs() {
    await chrome.storage.local.set({ [STORAGE_KEYS.PENDING_DMS]: pendingDMs });
  }

  async function handleDMFailure(match, dmText) {
    if (dailyCounters.connections >= LIMITS.MAX_CONNECTIONS_PER_DAY) {
      log('warn', '⚠️ Daily connection request limit reached');
      logAction(match, 'dm_failed');
      updateStep(match.commentId, STEP.FAILED);
      return;
    }
    if (pendingDMs.length >= LIMITS.MAX_PENDING_DMS) {
      log('warn', '⚠️ Max pending DMs reached');
      logAction(match, 'dm_failed');
      updateStep(match.commentId, STEP.FAILED);
      return;
    }

    log('info', `DM failed for ${match.authorName}, attempting connection request...`);

    let connectionSent = false;
    if (settings.dryRun) {
      log('info', `🏜️ [DRY] Connection request → ${match.authorName} (${match.authorProfileUrl})`);
      connectionSent = true;
    } else {
      connectionSent = await sendConnectionRequest(match.authorProfileUrl, match.authorName);
    }

    if (connectionSent) {
      pendingDMs.push({
        authorName: match.authorName,
        authorProfileUrl: match.authorProfileUrl || '',
        dmText,
        thematicName: match.thematic.name,
        keyword: match.matchedKeyword,
        timestamp: Date.now(),
        retryCount: 0,
      });
      await savePendingDMs();
      dailyCounters.connections++;
      saveDailyCounters();
      logAction(match, 'connection_request_sent');
      log('info', `🤝 Connection request sent to ${match.authorName}, DM stored as pending`);
      updateStep(match.commentId, STEP.CONNECTION_SENT);
      setTimeout(() => updateStep(match.commentId, STEP.PENDING_DM), 5000);
    } else {
      logAction(match, 'dm_failed_no_connection');
      log('warn', `Could not send connection request to ${match.authorName}`);
      updateStep(match.commentId, STEP.FAILED);
    }
  }

  async function retryPendingDMs() {
    if (pendingDMs.length === 0) return { retried: 0, sent: 0, expired: 0 };

    log('info', `🔄 Retrying ${pendingDMs.length} pending DM(s)...`);
    const results = { retried: 0, sent: 0, expired: 0 };
    const remaining = [];
    const EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
    const MAX_RETRIES = 14;

    for (const pending of pendingDMs) {
      const ageMs = Date.now() - pending.timestamp;
      if (pending.retryCount >= MAX_RETRIES || ageMs > EXPIRY_MS) {
        results.expired++;
        log('info', `⏰ Pending DM expired for ${pending.authorName}`);
        logAction({ authorName: pending.authorName, matchedKeyword: pending.keyword, thematic: { name: pending.thematicName } }, 'pending_dm_expired');
        continue;
      }

      if (dailyCounters.dms >= LIMITS.MAX_DMS_PER_DAY) {
        remaining.push(pending);
        continue;
      }

      results.retried++;
      pending.retryCount++;

      if (settings.dryRun) {
        log('info', `🏜️ [DRY] Retry DM → ${pending.authorName}`);
        remaining.push(pending);
        continue;
      }

      const ok = await sendDM(pending.authorName, pending.dmText);
      if (ok) {
        dailyCounters.dms++;
        saveDailyCounters();
        results.sent++;
        log('info', `📩 Pending DM sent to ${pending.authorName}`);
        logAction({ authorName: pending.authorName, matchedKeyword: pending.keyword, thematic: { name: pending.thematicName } }, 'pending_dm_sent');
      } else {
        remaining.push(pending);
      }

      await randomDelaySeconds(30, 90);
    }

    pendingDMs = remaining;
    await savePendingDMs();
    log('info', `Pending DMs: ${results.sent} sent, ${results.expired} expired, ${remaining.length} still pending`);
    return results;
  }

  // ── Storage helpers ──────────────────────────────────────

  async function saveProcessedComments() {
    const arr = [...processedComments].slice(-5000);
    await chrome.storage.local.set({ [STORAGE_KEYS.PROCESSED_COMMENTS]: arr });
  }

  function markCommentProcessed(commentId, commentElement) {
    processedComments.add(commentId);
    pendingActionComments.delete(commentId);
    if (commentElement) commentElement.classList.add('scaleme-processed');
    saveProcessedComments();
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

  // ── Catchup (Fetch old comments via API) ──────────────────

  const catchup = new (window.ScaleMeLinkedInCatchup || class { 
    scanVisiblePosts() { return []; } 
    async runCatchup() { return { postsScanned: 0, commentsScanned: 0, postResults: [] }; }
  })();

  /**
   * Fetch posts visible on current page (DOM only — 100% reliable)
   */
  async function catchupFetchPosts() {
    const posts = catchup.scanVisiblePosts();
    if (posts.length > 0) {
      return posts.map(p => ({ urn: p.urn, text: p.text, numComments: p.numComments }));
    }

    // Fallback: try the other DOM scanner
    const domPosts = scanProfilePosts();
    if (domPosts.length > 0) {
      return domPosts.map(p => ({ urn: p.urn, text: p.text, numComments: 0 }));
    }

    throw new Error('Aucun post trouvé. Va sur ton profil LinkedIn > Activité > Posts');
  }

  /**
   * Run full catchup: expand comments on each post via DOM, scrape, match keywords
   */
  async function catchupRun(postUrns) {
    if (isCatchupRunning) {
      log('warn', 'Catchup already running, ignoring duplicate request');
      return { postsScanned: 0, commentsScanned: 0, matches: 0, errors: ['Catchup déjà en cours'] };
    }
    isCatchupRunning = true;
    const results = { postsScanned: 0, commentsScanned: 0, matches: 0, alreadyProcessed: 0, errors: [] };

    try {
      // Run DOM-based catchup
      const catchupResults = await catchup.runCatchup(postUrns?.length > 0 ? postUrns : null);
      results.postsScanned = catchupResults.postsScanned;
      results.commentsScanned = catchupResults.commentsScanned;

      // Process each post's comments for keyword matches
      for (const postResult of catchupResults.postResults) {
        // Pre-compute author replies at post level
        const postEl = postResult.comments[0]?.element?.closest('[data-urn]') || null;
        const authorReplied = postEl ? findCommentsWithAuthorReplies(postEl) : new Set();

        for (const comment of postResult.comments) {
          const commentId = getCommentId(postResult.urn, comment.authorName, comment.text.toLowerCase());
          if (processedComments.has(commentId) || pendingActionComments.has(commentId)) {
            if (processedComments.has(commentId)) {
              results.alreadyProcessed++;
            }
            continue;
          }

          // Skip if post author already replied to this comment
          if (comment.element && authorReplied.has(comment.element)) {
            log('info', `⏭️ Catchup skip: author already replied to ${comment.authorName}`);
            continue;
          }

          // Skip comments BY the post author
          if (comment.element && hasAuthorBadge(comment.element)) continue;

          for (const thematic of thematics) {
            if (thematic.postUrns?.length > 0 && !thematic.postUrns.includes(postResult.urn)) continue;

            const kw = thematic.keywords.find(k => comment.text.toLowerCase().includes(k.toLowerCase()));
            if (kw) {
              pendingActionComments.add(commentId);
              if (comment.element) {
                comment.element.style.position = 'relative';
                comment.element.setAttribute('data-scaleme-id', commentId);
              }
              results.matches++;

              const match = {
                commentId,
                postUrn: postResult.urn,
                commentText: comment.text,
                authorName: comment.authorName,
                authorProfileUrl: comment.authorProfileUrl || '',
                matchedKeyword: kw,
                thematic,
                commentElement: comment.element || null,
                timestamp: Date.now(),
                fromCatchup: true,
              };

              log('info', `🎯 Catchup match: "${kw}" by ${comment.authorName}`);
              enqueueAction(match);
              break;
            }
          }
        }
      }

      log('info', `✅ Catchup: ${results.postsScanned} posts, ${results.commentsScanned} comments, ${results.matches} matches`);
    } catch (err) {
      log('error', 'Catchup error:', err);
      results.errors.push(err.message);
    } finally {
      isCatchupRunning = false;
    }

    return results;
  }

  /**
   * Process catchup matches: reply (if element available) + DM
   */
  async function processMatchWrapped(match) {
    const firstName = extractFirstName(match.authorName);
    const vars = {
      firstName,
      fullName: match.authorName,
      link: match.thematic.leadMagnetUrl,
      keyword: match.matchedKeyword,
      thematic: match.thematic.name,
    };
    let replyOk = false;
    let dmOk = false;

    // Step 1: Reply to comment if we have the DOM element
    if (match.commentElement) {
      const replyDelayMin = (match.thematic.replyDelayMin || settings.replyDelayMin || 30) * 1000;
      const replyDelayMax = (match.thematic.replyDelayMax || settings.replyDelayMax || 90) * 1000;
      const replyWaitMs = Math.floor(Math.random() * (replyDelayMax - replyDelayMin + 1)) + replyDelayMin;
      updateStep(match.commentId, STEP.WAIT_REPLY, replyWaitMs);
      await sleep(replyWaitMs);

      updateStep(match.commentId, STEP.REPLYING);
      const replyText = generateDynamicReply(match.thematic.replyTemplate, vars);
      if (settings.dryRun) {
        log('info', `🏜️ [DRY/Catchup] Reply → ${match.authorName}: "${replyText}"`);
        updateStep(match.commentId, STEP.REPLY_DONE);
        replyOk = true;
      } else {
        const ok = await replyToComment(match.commentElement, replyText);
        if (ok) {
          dailyCounters.replies++;
          saveDailyCounters();
          logAction(match, 'catchup_reply_sent');
          updateStep(match.commentId, STEP.REPLY_DONE);
          replyOk = true;
        } else {
          updateStep(match.commentId, STEP.REPLY_FAILED);
        }
      }
    }

    // Step 2: DM
    const dmDelayMin = (match.thematic.dmDelayMin || settings.dmDelayMin || 60) * 1000;
    const dmDelayMax = (match.thematic.dmDelayMax || settings.dmDelayMax || 180) * 1000;
    const dmWaitMs = Math.floor(Math.random() * (dmDelayMax - dmDelayMin + 1)) + dmDelayMin;
    updateStep(match.commentId, STEP.WAIT_DM, dmWaitMs);
    log('info', `⏳ [Catchup] Waiting ${Math.round(dmWaitMs/1000)}s before DM to ${match.authorName}...`);
    await sleep(dmWaitMs);

    updateStep(match.commentId, STEP.SENDING_DM);
    const dmText = generateDynamicDM(match.thematic.dmTemplate, vars);
    if (settings.dryRun) {
      log('info', `🏜️ [DRY/Catchup] DM → ${match.authorName}: "${dmText}"`);
      updateStep(match.commentId, STEP.DM_DONE);
      setTimeout(() => updateStep(match.commentId, STEP.DONE), 10000);
      dmOk = true;
    } else {
      let ok = await sendDM(match.authorName, dmText);
      if (!ok && match.authorProfileUrl) {
        log('info', `[DM/Catchup] Retrying via profile for ${match.authorName}...`);
        ok = await sendDMViaProfile(match.authorProfileUrl, dmText);
      }
      if (ok) {
        dailyCounters.dms++;
        saveDailyCounters();
        logAction(match, 'catchup_dm_sent');
        log('info', `📩 [Catchup] DM sent to ${match.authorName}`);
        updateStep(match.commentId, STEP.DM_DONE);
        setTimeout(() => updateStep(match.commentId, STEP.DONE), 10000);
        dmOk = true;
      } else {
        await handleDMFailure(match, dmText);
        dmOk = true; // DM queued as pending, not lost
      }
    }

    // ── Mark as processed only after actions complete ──
    if (replyOk || dmOk) {
      markCommentProcessed(match.commentId, match.commentElement);
    } else {
      pendingActionComments.delete(match.commentId);
      log('warn', `[Catchup] All actions failed for ${match.authorName}, comment eligible for retry`);
    }

    chrome.runtime.sendMessage({
      type: 'SHOW_NOTIFICATION',
      title: `🔄 Rattrapage — ${match.thematic.name}`,
      message: `${settings.dryRun ? '[DRY] ' : ''}${match.authorName} ("${match.matchedKeyword}")`,
    });
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
