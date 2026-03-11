// ============================================================
// Selector Diagnostic — Tests all ScaleMe selectors against current DOM
// Can be triggered from popup or run manually in console
// ============================================================

(function () {
  'use strict';

  function runDiagnostic() {
    const SELECTORS = window.ScaleMeSelectors;
    if (!SELECTORS) {
      console.error('[ScaleMe] [Diagnostic] ScaleMeSelectors not loaded');
      return { error: 'ScaleMeSelectors not loaded', results: [] };
    }

    const results = [];
    // Use _ALL variants as critical — they contain all fallback selectors
    const critical = [
      'FEED_CONTAINER', 'POST_CONTAINER_ALL', 'COMMENT_ITEM_ALL',
      'COMMENT_TEXT_ALL', 'COMMENT_AUTHOR_ALL',
      'COMMENT_REPLY_BTN_ALL', 'COMMENT_INPUT_ALL', 'COMMENT_SUBMIT_BTN_ALL',
      'MSG_COMPOSE_BTN', 'MSG_BODY_INPUT', 'MSG_SEND_BTN',
    ];

    // Skip individual selectors when an _ALL variant exists (to avoid false failures)
    const allKeys = Object.keys(SELECTORS);
    const skipKeys = new Set();
    for (const key of allKeys) {
      if (allKeys.includes(key + '_ALL')) skipKeys.add(key);
    }

    console.log('%c[ScaleMe] Selector Diagnostic Report', 'font-size:14px;font-weight:bold;color:#00b4d8');
    console.log('─'.repeat(60));

    let passCount = 0;
    let failCount = 0;
    let warnCount = 0;

    for (const [name, selector] of Object.entries(SELECTORS)) {
      // Skip attribute-style selectors (like POST_URN = 'data-urn')
      if (!selector.startsWith('.') && !selector.startsWith('#') && !selector.startsWith('[') && !selector.includes(' ')) {
        results.push({ name, selector, type: 'attribute', count: null, status: 'skip' });
        continue;
      }

      // Skip individual selectors that have an _ALL variant (tested separately)
      if (skipKeys.has(name)) {
        results.push({ name, selector, count: null, status: 'skip' });
        continue;
      }

      try {
        const elements = document.querySelectorAll(selector);
        const count = elements.length;
        const isCritical = critical.includes(name);
        let status;

        if (count > 0) {
          status = 'pass';
          passCount++;
          console.log(`%c  ✅ ${name}%c — ${count} element(s)  %c${selector}`,
            'color:#2ecc71;font-weight:bold', 'color:#ccc', 'color:#888;font-style:italic');
        } else if (isCritical) {
          status = 'fail';
          failCount++;
          console.log(`%c  ❌ ${name}%c — 0 elements (CRITICAL)  %c${selector}`,
            'color:#e74c3c;font-weight:bold', 'color:#e74c3c', 'color:#888;font-style:italic');
        } else {
          status = 'warn';
          warnCount++;
          console.log(`%c  ⚠️ ${name}%c — 0 elements  %c${selector}`,
            'color:#f39c12;font-weight:bold', 'color:#ccc', 'color:#888;font-style:italic');
        }

        // For failed critical selectors, try to find alternatives
        if (count === 0 && isCritical) {
          const suggestions = findAlternatives(name, selector);
          if (suggestions.length > 0) {
            console.log(`%c     💡 Possible alternatives:`, 'color:#3498db');
            for (const s of suggestions) {
              console.log(`%c        → ${s.selector} (${s.count} elements)`, 'color:#3498db');
            }
          }
        }

        results.push({ name, selector, count, status, isCritical });
      } catch (err) {
        failCount++;
        console.log(`%c  ❌ ${name}%c — Invalid selector  %c${selector}`,
          'color:#e74c3c;font-weight:bold', 'color:#e74c3c', 'color:#888;font-style:italic');
        results.push({ name, selector, count: 0, status: 'error', error: err.message });
      }
    }

    console.log('─'.repeat(60));
    console.log(`%c  Summary: ${passCount} ✅  ${failCount} ❌  ${warnCount} ⚠️`,
      'font-size:12px;font-weight:bold;color:#00b4d8');

    if (failCount > 0) {
      console.log('%c  ⚠️ CRITICAL selectors are broken — comments may not be detected!',
        'color:#e74c3c;font-weight:bold;font-size:12px');
    }

    // Page context info
    const path = window.location.pathname;
    const isFeed = path.startsWith('/feed');
    const isPost = path.includes('/posts/') || path.includes('/feed/update/');
    console.log('─'.repeat(60));
    console.log(`%c  Page: ${path}`, 'color:#888');
    if (!isFeed && !isPost) {
      console.log('%c  ℹ️ Note: Feed/comment selectors are not expected to match on this page type.',
        'color:#3498db;font-style:italic');
    }
    console.log(`%c  Date: ${new Date().toLocaleString('fr-FR')}`, 'color:#888');

    const report = {
      timestamp: Date.now(),
      url: window.location.href,
      pass: passCount,
      fail: failCount,
      warn: warnCount,
      results,
    };

    // Save to storage for popup display
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set({ scaleme_diagnostic: report });
    }

    return report;
  }

  /**
   * Try to find alternative selectors for a broken one
   */
  function findAlternatives(name, brokenSelector) {
    const suggestions = [];
    const nameLC = name.toLowerCase();

    // Heuristic patterns based on selector name
    const heuristics = {
      feed_container: ['[role="main"]', 'main', '.scaffold-layout__main'],
      post_container: ['.feed-shared-update-v2', '[data-urn*="activity"]', '.occludable-update', 'article[data-urn]'],
      post_container_all: ['.feed-shared-update-v2', '[data-urn*="activity"]', '.occludable-update', 'article[data-urn]'],
      comment_item: ['.comments-comment-item', '.comments-comment-entity', '[class*="comment-item"]', '[class*="comment-entity"]'],
      comment_item_all: ['.comments-comment-item', '.comments-comment-entity', '[class*="comment-item"]', '[class*="comment-entity"]'],
      comment_text: ['[class*="comment"] [class*="text"]', '[class*="comment"] .break-words', '.comments-comment-item .break-words'],
      comment_text_all: ['[class*="comment"] [class*="text"]', '[class*="comment"] .break-words', '.comments-comment-item .break-words'],
      comment_author: ['[class*="comment"] [class*="name"]', '[class*="comment-meta"] [class*="name"]', '.comments-comment-item [class*="actor"]'],
      comment_author_all: ['[class*="comment"] [class*="name"]', '[class*="comment-meta"] [class*="name"]', '.comments-comment-item [class*="actor"]'],
      comment_reply_btn: ['[class*="comment"] [class*="reply"]', 'button[aria-label*="Reply"]', 'button[aria-label*="Répondre"]'],
      comment_reply_btn_all: ['[class*="comment"] [class*="reply"]', 'button[aria-label*="Reply"]', 'button[aria-label*="Répondre"]', '[class*="comment-social"] button'],
      comment_input: ['[class*="comment"] [contenteditable]', '[class*="comment-box"] [contenteditable]', '.ql-editor'],
      comment_input_all: ['[class*="comment"] [contenteditable]', '[class*="comment-box"] [contenteditable]', '.ql-editor', '[role="textbox"]'],
      comment_submit_btn: ['[class*="comment"] button[type="submit"]', '[class*="comment-box"] button[class*="submit"]'],
      comment_submit_btn_all: ['[class*="comment"] button[type="submit"]', '[class*="comment-box"] button[class*="submit"]', 'button[aria-label*="Post"]', 'button[aria-label*="Publier"]'],
      msg_compose_btn: ['[class*="msg"] [class*="new-convo"]', 'button[aria-label*="New message"]', 'button[aria-label*="Nouveau message"]'],
      msg_body_input: ['[class*="msg-form"] [contenteditable]', '[class*="msg"] [role="textbox"]'],
      msg_send_btn: ['[class*="msg-form"] [class*="send"]', '[class*="msg"] button[type="submit"]'],
    };

    const patterns = heuristics[nameLC] || [];
    for (const pattern of patterns) {
      try {
        // Skip if it's the same as the broken one
        if (brokenSelector.includes(pattern)) continue;
        const count = document.querySelectorAll(pattern).length;
        if (count > 0) {
          suggestions.push({ selector: pattern, count });
        }
      } catch (_) { /* ignore invalid selectors */ }
    }

    // Generic wildcard search based on class name fragments
    const classFragment = brokenSelector.match(/\.([\w-]+)/)?.[1];
    if (classFragment) {
      const parts = classFragment.split('__');
      if (parts.length > 1) {
        // Try parent class only
        try {
          const parentSelector = `.${parts[0]}`;
          const count = document.querySelectorAll(parentSelector).length;
          if (count > 0 && !brokenSelector.includes(parentSelector)) {
            suggestions.push({ selector: `${parentSelector} (parent class)`, count });
          }
        } catch (_) {}
      }
    }

    return suggestions.slice(0, 5);
  }

  /**
   * Deep DOM discovery: analyze actual comment structure on the page
   * Finds the real CSS classes used by LinkedIn for comment elements
   */
  function discoverCommentStructure() {
    console.log('%c[ScaleMe] DOM Structure Discovery', 'font-size:14px;font-weight:bold;color:#e67e22');
    console.log('─'.repeat(60));

    // Step 1: Find any element that looks like a comment
    const commentCandidates = [
      '.comments-comment-item',
      '.comments-comment-entity',
      '[class*="comment-item"]',
      '[class*="comment-entity"]',
      '[class*="comments-comment"]',
      // LinkedIn sometimes wraps comments in articles
      '.comments-comments-list > li',
      '.comments-comments-list > div',
      '.comments-comments-list article',
    ];

    let commentEls = [];
    let usedSelector = '';
    for (const sel of commentCandidates) {
      try {
        const els = document.querySelectorAll(sel);
        if (els.length > 0) {
          commentEls = [...els];
          usedSelector = sel;
          break;
        }
      } catch (_) {}
    }

    if (commentEls.length === 0) {
      console.log('%c  No comments found on this page. Navigate to a post with visible comments.', 'color:#ff9900');
      return { comments: 0 };
    }

    console.log(`%c  Found ${commentEls.length} comments via: ${usedSelector}`, 'color:#2ecc71');

    // Step 2: Analyze the first comment's internal structure
    const sample = commentEls[0];
    console.log('%c  \n  Sample comment structure:', 'color:#3498db;font-weight:bold');
    console.log('  Element:', sample.tagName, sample.className);

    // Find text-like elements inside
    const discovery = {
      commentSelector: usedSelector,
      commentCount: commentEls.length,
      textCandidates: [],
      authorCandidates: [],
      replyCandidates: [],
      linkCandidates: [],
    };

    // Scan all child elements for patterns
    const allChildren = sample.querySelectorAll('*');
    for (const child of allChildren) {
      const cls = child.className;
      if (typeof cls !== 'string') continue;
      const tag = child.tagName.toLowerCase();
      const text = child.textContent?.trim() || '';

      // Text content candidates (likely comment body)
      if ((cls.includes('text') || cls.includes('content') || cls.includes('break-words')) && text.length > 2 && text.length < 500) {
        discovery.textCandidates.push({
          selector: `.${cls.split(' ').filter(c => c.length > 3).join('.')}`,
          tag,
          textPreview: text.substring(0, 60),
        });
      }

      // Author name candidates
      if ((cls.includes('name') || cls.includes('author') || cls.includes('actor') || cls.includes('meta')) && text.length > 1 && text.length < 80) {
        discovery.authorCandidates.push({
          selector: `.${cls.split(' ').filter(c => c.length > 3).join('.')}`,
          tag,
          textPreview: text.substring(0, 40),
        });
      }

      // Links inside comment (profile links)
      if (tag === 'a' && child.href?.includes('linkedin.com/in/')) {
        discovery.linkCandidates.push({
          selector: cls ? `.${cls.split(' ').filter(c => c.length > 3).join('.')} a` : `${tag}[href*="/in/"]`,
          href: child.href,
          text: text.substring(0, 40),
        });
      }

      // Reply button candidates
      if (tag === 'button' && (cls.includes('reply') || text.toLowerCase().includes('répondre') || text.toLowerCase().includes('reply'))) {
        discovery.replyCandidates.push({
          selector: `.${cls.split(' ').filter(c => c.length > 3).join('.')}`,
          text: text.substring(0, 30),
        });
      }
    }

    // Deduplicate and log
    const logCandidates = (label, candidates) => {
      if (candidates.length === 0) {
        console.log(`%c  ${label}: none found`, 'color:#ff4444');
        return;
      }
      // Remove duplicates
      const unique = [];
      const seen = new Set();
      for (const c of candidates) {
        const key = c.selector + c.textPreview;
        if (!seen.has(key)) { seen.add(key); unique.push(c); }
      }
      console.log(`%c  ${label}:`, 'color:#3498db;font-weight:bold');
      for (const c of unique.slice(0, 5)) {
        console.log(`%c    → ${c.selector}  %c"${c.textPreview || c.text || c.href || ''}"`,
          'color:#3498db', 'color:#888');
      }
    };

    logCandidates('Comment text selectors', discovery.textCandidates);
    logCandidates('Author name selectors', discovery.authorCandidates);
    logCandidates('Profile link selectors', discovery.linkCandidates);
    logCandidates('Reply button selectors', discovery.replyCandidates);

    // Step 3: Dump raw HTML of first comment for manual inspection
    console.log('%c  \n  Raw HTML (first comment):', 'color:#e67e22;font-weight:bold');
    console.log(sample.innerHTML.substring(0, 2000));

    console.log('─'.repeat(60));

    // Save discovery for popup
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set({ scaleme_dom_discovery: discovery });
    }

    return discovery;
  }

  // Expose in content script world
  window.ScaleMeDiagnostic = { run: runDiagnostic, discover: discoverCommentStructure };

  // Listen for messages from popup or other components
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (event.data?.type === 'SCALEME_DIAGNOSTIC_RUN') {
      runDiagnostic();
    }
    if (event.data?.type === 'SCALEME_DIAGNOSTIC_DISCOVER') {
      discoverCommentStructure();
    }
  });
})();
