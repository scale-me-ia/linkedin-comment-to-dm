// ============================================================
// Service Worker — Background tasks & notifications
// ============================================================

// ── Helpers ──────────────────────────────────────────────

function waitForTabLoad(tabId, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error('Tab load timeout'));
    }, timeout);

    function listener(id, info) {
      if (id === tabId && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        clearTimeout(timer);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

// Handle messages from content script
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'SHOW_NOTIFICATION') {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: '../icons/icon128.png',
      title: msg.title || 'Scale Me LinkedIn',
      message: msg.message || '',
      priority: 1,
    });
    sendResponse({ ok: true });
  }

  if (msg.type === 'SEND_CONNECTION_REQUEST') {
    (async () => {
      let tabId = null;
      try {
        const tab = await chrome.tabs.create({ url: msg.profileUrl, active: false });
        tabId = tab.id;

        // Wait for page to fully load
        await waitForTabLoad(tabId, 30000);

        // Wait for DOM to settle
        await new Promise(r => setTimeout(r, 3000));

        // Ask content script in that tab to click the Connect button
        const resp = await chrome.tabs.sendMessage(tabId, { type: 'CLICK_CONNECT_BTN' });

        // Close tab after a short delay
        setTimeout(() => chrome.tabs.remove(tabId).catch(() => {}), 2000);

        sendResponse({ ok: resp?.ok || false });
      } catch (err) {
        console.error('[ScaleMe] Connection request error:', err);
        if (tabId) chrome.tabs.remove(tabId).catch(() => {});
        sendResponse({ ok: false, error: err.message });
      }
    })();
    return true; // async response
  }

  return true;
});

// Daily counter reset alarm
chrome.alarms.create('dailyReset', {
  periodInMinutes: 60, // check every hour
});

// Pending DMs retry alarm
chrome.alarms.create('retryPendingDMs', {
  periodInMinutes: 120, // every 2 hours
});

// Auto-catchup alarm
chrome.alarms.create('autoCatchup', {
  periodInMinutes: 240, // every 4 hours
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'dailyReset') {
    const today = new Date().toISOString().split('T')[0];
    const data = await chrome.storage.local.get('scaleme_daily_counters');
    const counters = data.scaleme_daily_counters;

    if (counters && counters.date !== today) {
      await chrome.storage.local.set({
        scaleme_daily_counters: { replies: 0, dms: 0, connections: 0, date: today },
      });
      console.log('[ScaleMe] Daily counters reset');
    }
  }

  if (alarm.name === 'retryPendingDMs') {
    try {
      const tabs = await chrome.tabs.query({ url: 'https://www.linkedin.com/*' });
      if (tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'RETRY_PENDING_DMS' }, (resp) => {
          if (resp?.sent > 0) {
            console.log(`[ScaleMe] Pending DMs retry: ${resp.sent} sent, ${resp.expired} expired`);
          }
        });
      }
    } catch (err) {
      console.error('[ScaleMe] Retry pending DMs error:', err);
    }
  }

  if (alarm.name === 'autoCatchup') {
    runAutoCatchup();
  }
});

// ── Auto-Catchup ─────────────────────────────────────────

async function runAutoCatchup() {
  try {
    const data = await chrome.storage.local.get(['scaleme_settings', 'scaleme_thematics']);
    const settings = data.scaleme_settings || {};
    const thematics = data.scaleme_thematics || [];

    if (!settings.enabled || !settings.autoCatchup) return;

    // Collect unique postUrns from enabled thematics
    const postUrns = new Set();
    for (const t of thematics) {
      if (t.enabled === false) continue;
      for (const urn of (t.postUrns || [])) {
        if (urn) postUrns.add(urn);
      }
    }

    if (postUrns.size === 0) {
      console.log('[ScaleMe] Auto-catchup: no postUrns configured, skipping');
      return;
    }

    console.log(`[ScaleMe] Auto-catchup: scanning ${postUrns.size} posts...`);

    let totalMatches = 0;
    let totalComments = 0;

    for (const urn of postUrns) {
      let tabId = null;
      try {
        const url = `https://www.linkedin.com/feed/update/${urn}/`;
        const tab = await chrome.tabs.create({ url, active: false });
        tabId = tab.id;

        await waitForTabLoad(tabId, 30000);
        await new Promise(r => setTimeout(r, 5000)); // Wait for DOM to settle

        const result = await new Promise((resolve) => {
          chrome.tabs.sendMessage(tabId, { type: 'CATCHUP_RUN', postUrns: [] }, (resp) => {
            if (chrome.runtime.lastError) {
              console.error(`[ScaleMe] Auto-catchup message error:`, chrome.runtime.lastError.message);
              resolve(null);
            } else {
              resolve(resp);
            }
          });
        });

        if (result) {
          totalMatches += result.matches || 0;
          totalComments += result.commentsScanned || 0;
        }

        await chrome.tabs.remove(tabId).catch(() => {});
        tabId = null;

        // Delay between posts to be discreet
        await new Promise(r => setTimeout(r, 3000 + Math.random() * 5000));
      } catch (err) {
        console.error(`[ScaleMe] Auto-catchup error for ${urn}:`, err);
        if (tabId) chrome.tabs.remove(tabId).catch(() => {});
      }
    }

    console.log(`[ScaleMe] Auto-catchup done: ${totalMatches} matches from ${totalComments} comments across ${postUrns.size} posts`);

    // Notification summary
    if (totalMatches > 0) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: '../icons/icon128.png',
        title: 'Scale Me — Auto-catchup',
        message: `${totalMatches} nouveaux commentaires détectés sur ${postUrns.size} post(s) (${totalComments} scannés)`,
        priority: 1,
      });
    }

    // Save timestamp
    await chrome.storage.local.set({ scaleme_last_auto_catchup: Date.now() });
  } catch (err) {
    console.error('[ScaleMe] Auto-catchup error:', err);
  }
}

// Extension install/update
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Set default config
    chrome.storage.local.set({
      scaleme_settings: {
        enabled: false,
        dryRun: true, // start in dry run mode for safety
        notificationsEnabled: true,
        debugMode: false,
        autoCatchup: false,
      },
      scaleme_thematics: [],
      scaleme_action_log: [],
      scaleme_processed_comments: [],
      scaleme_daily_counters: { replies: 0, dms: 0, connections: 0, date: new Date().toISOString().split('T')[0] },
      scaleme_pending_dms: [],
    });

    console.log('[ScaleMe] Extension installed with default config');
  }
});
