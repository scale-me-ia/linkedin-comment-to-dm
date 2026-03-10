// ============================================================
// Service Worker — Background tasks & notifications
// ============================================================

// Handle notifications from content script
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
  return true;
});

// Daily counter reset alarm
chrome.alarms.create('dailyReset', {
  periodInMinutes: 60, // check every hour
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'dailyReset') {
    const today = new Date().toISOString().split('T')[0];
    const data = await chrome.storage.local.get('scaleme_daily_counters');
    const counters = data.scaleme_daily_counters;
    
    if (counters && counters.date !== today) {
      await chrome.storage.local.set({
        scaleme_daily_counters: { replies: 0, dms: 0, date: today },
      });
      console.log('[ScaleMe] Daily counters reset');
    }
  }
});

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
      },
      scaleme_thematics: [],
      scaleme_action_log: [],
      scaleme_processed_comments: [],
      scaleme_daily_counters: { replies: 0, dms: 0, date: new Date().toISOString().split('T')[0] },
    });
    
    console.log('[ScaleMe] Extension installed with default config');
  }
});
