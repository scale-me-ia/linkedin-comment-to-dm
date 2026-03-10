// ============================================================
// Popup Script — Config UI for Scale Me LinkedIn Extension
// ============================================================

const STORAGE_KEYS = {
  THEMATICS: 'scaleme_thematics',
  SETTINGS: 'scaleme_settings',
  ACTION_LOG: 'scaleme_action_log',
  DAILY_COUNTERS: 'scaleme_daily_counters',
};

let thematics = [];
let settings = {};
let editingIndex = -1;

// ── Init ───────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  renderThematics();
  renderLogs();
  updateUI();
  pollStatus();

  // Event listeners
  document.getElementById('masterToggle').addEventListener('change', onToggleEnabled);
  document.getElementById('addThematicBtn').addEventListener('click', () => openModal());
  document.getElementById('modalCancel').addEventListener('click', closeModal);
  document.getElementById('modalSave').addEventListener('click', saveThematic);
  document.getElementById('clearLogsBtn').addEventListener('click', clearLogs);
  document.getElementById('dryRunToggle').addEventListener('change', onSettingChange);
  document.getElementById('notifToggle').addEventListener('change', onSettingChange);
  document.getElementById('debugToggle').addEventListener('change', onSettingChange);
  document.getElementById('resetBtn').addEventListener('click', resetAll);

  // Tabs
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });
});

// ── Data Loading ───────────────────────────────────────────

async function loadData() {
  const data = await chrome.storage.local.get([
    STORAGE_KEYS.THEMATICS,
    STORAGE_KEYS.SETTINGS,
    STORAGE_KEYS.DAILY_COUNTERS,
  ]);

  thematics = data[STORAGE_KEYS.THEMATICS] || [];
  settings = data[STORAGE_KEYS.SETTINGS] || {
    enabled: false,
    dryRun: true,
    notificationsEnabled: true,
    debugMode: false,
  };
}

// ── UI Updates ─────────────────────────────────────────────

function updateUI() {
  document.getElementById('masterToggle').checked = settings.enabled;
  document.getElementById('dryRunToggle').checked = settings.dryRun;
  document.getElementById('notifToggle').checked = settings.notificationsEnabled;
  document.getElementById('debugToggle').checked = settings.debugMode;

  const dot = document.getElementById('statusDot');
  const text = document.getElementById('statusText');
  
  if (settings.enabled) {
    dot.classList.add('active');
    text.textContent = settings.dryRun ? '🏜️ Mode test actif' : '🟢 Actif — Scanning';
  } else {
    dot.classList.remove('active');
    text.textContent = 'Inactif';
  }
}

async function pollStatus() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url?.includes('linkedin.com')) {
      chrome.tabs.sendMessage(tab.id, { type: 'GET_STATUS' }, (response) => {
        if (response) {
          document.getElementById('repliesCount').textContent = response.dailyCounters?.replies || 0;
          document.getElementById('dmsCount').textContent = response.dailyCounters?.dms || 0;
          document.getElementById('queueCount').textContent = response.queueLength || 0;
        }
      });
    } else {
      // Load from storage directly
      const data = await chrome.storage.local.get(STORAGE_KEYS.DAILY_COUNTERS);
      const counters = data[STORAGE_KEYS.DAILY_COUNTERS] || {};
      document.getElementById('repliesCount').textContent = counters.replies || 0;
      document.getElementById('dmsCount').textContent = counters.dms || 0;
    }
  } catch (e) {
    // Tab not available
  }
}

// ── Toggle Enabled ─────────────────────────────────────────

async function onToggleEnabled() {
  settings.enabled = document.getElementById('masterToggle').checked;
  await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: settings });
  updateUI();

  // Notify content script
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url?.includes('linkedin.com')) {
      chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_ENABLED', enabled: settings.enabled });
    }
  } catch (e) {}
}

// ── Settings ───────────────────────────────────────────────

async function onSettingChange() {
  settings.dryRun = document.getElementById('dryRunToggle').checked;
  settings.notificationsEnabled = document.getElementById('notifToggle').checked;
  settings.debugMode = document.getElementById('debugToggle').checked;
  
  await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: settings });
  updateUI();

  // Notify content script
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url?.includes('linkedin.com')) {
      chrome.tabs.sendMessage(tab.id, { type: 'UPDATE_SETTINGS', settings });
    }
  } catch (e) {}
}

// ── Tabs ───────────────────────────────────────────────────

function switchTab(tabName) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
  document.getElementById(`tab-${tabName}`).classList.add('active');

  if (tabName === 'logs') renderLogs();
}

// ── Thematics ──────────────────────────────────────────────

function renderThematics() {
  const list = document.getElementById('thematicsList');
  
  if (thematics.length === 0) {
    list.innerHTML = '<div class="empty-state">Aucune thématique configurée.<br>Ajoutez-en une pour commencer !</div>';
    return;
  }

  list.innerHTML = thematics.map((t, i) => `
    <div class="thematic-card ${t.enabled ? '' : 'disabled'}">
      <div class="thematic-header">
        <span class="thematic-name">${escapeHtml(t.name || 'Sans nom')}</span>
        <div class="thematic-actions">
          <button onclick="toggleThematic(${i})" title="${t.enabled ? 'Désactiver' : 'Activer'}">${t.enabled ? '✅' : '⬜'}</button>
          <button onclick="openModal(${i})" title="Modifier">✏️</button>
          <button onclick="deleteThematic(${i})" title="Supprimer">🗑️</button>
        </div>
      </div>
      <div class="thematic-keywords">
        ${t.keywords.map(k => `<span class="keyword-tag">${escapeHtml(k)}</span>`).join('')}
      </div>
      ${t.leadMagnetUrl ? `<div class="thematic-link">🔗 ${escapeHtml(t.leadMagnetUrl)}</div>` : ''}
    </div>
  `).join('');
}

// ── Modal ──────────────────────────────────────────────────

function openModal(index = -1) {
  editingIndex = index;
  const modal = document.getElementById('thematicModal');
  
  if (index >= 0) {
    const t = thematics[index];
    document.getElementById('modalTitle').textContent = 'Modifier la thématique';
    document.getElementById('thematicName').value = t.name || '';
    document.getElementById('thematicKeywords').value = (t.keywords || []).join(', ');
    document.getElementById('thematicReply').value = t.replyTemplate || '';
    document.getElementById('thematicDM').value = t.dmTemplate || '';
    document.getElementById('thematicLink').value = t.leadMagnetUrl || '';
    document.getElementById('thematicPostUrns').value = (t.postUrns || []).join('\n');
  } else {
    document.getElementById('modalTitle').textContent = 'Nouvelle thématique';
    document.getElementById('thematicName').value = '';
    document.getElementById('thematicKeywords').value = '';
    document.getElementById('thematicReply').value = "C'est envoyé en DM ! 🚀";
    document.getElementById('thematicDM').value = "Salut {{firstName}} ! Suite à ton commentaire, voici le document : {{link}}\n\nBonne lecture ! 📖";
    document.getElementById('thematicLink').value = '';
    document.getElementById('thematicPostUrns').value = '';
  }

  modal.classList.add('active');
}

function closeModal() {
  document.getElementById('thematicModal').classList.remove('active');
  editingIndex = -1;
}

async function saveThematic() {
  const thematic = {
    id: editingIndex >= 0 ? thematics[editingIndex].id : `th_${Date.now()}`,
    name: document.getElementById('thematicName').value.trim(),
    keywords: document.getElementById('thematicKeywords').value
      .split(',')
      .map(k => k.trim())
      .filter(k => k.length > 0),
    replyTemplate: document.getElementById('thematicReply').value.trim(),
    dmTemplate: document.getElementById('thematicDM').value.trim(),
    leadMagnetUrl: document.getElementById('thematicLink').value.trim(),
    postUrns: document.getElementById('thematicPostUrns').value
      .split('\n')
      .map(u => u.trim())
      .filter(u => u.length > 0),
    enabled: editingIndex >= 0 ? thematics[editingIndex].enabled : true,
  };

  if (!thematic.name || thematic.keywords.length === 0) {
    alert('Nom et au moins un mot-clé requis !');
    return;
  }

  if (editingIndex >= 0) {
    thematics[editingIndex] = thematic;
  } else {
    thematics.push(thematic);
  }

  await chrome.storage.local.set({ [STORAGE_KEYS.THEMATICS]: thematics });
  renderThematics();
  closeModal();
  notifyContentScript();
}

// Global functions for inline onclick
window.toggleThematic = async function(index) {
  thematics[index].enabled = !thematics[index].enabled;
  await chrome.storage.local.set({ [STORAGE_KEYS.THEMATICS]: thematics });
  renderThematics();
  notifyContentScript();
};

window.openModal = openModal;

window.deleteThematic = async function(index) {
  if (!confirm(`Supprimer "${thematics[index].name}" ?`)) return;
  thematics.splice(index, 1);
  await chrome.storage.local.set({ [STORAGE_KEYS.THEMATICS]: thematics });
  renderThematics();
  notifyContentScript();
};

async function notifyContentScript() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url?.includes('linkedin.com')) {
      chrome.tabs.sendMessage(tab.id, { type: 'UPDATE_THEMATICS', thematics });
    }
  } catch (e) {}
}

// ── Logs ───────────────────────────────────────────────────

async function renderLogs() {
  const data = await chrome.storage.local.get(STORAGE_KEYS.ACTION_LOG);
  const logs = (data[STORAGE_KEYS.ACTION_LOG] || []).reverse();
  const list = document.getElementById('logsList');

  if (logs.length === 0) {
    list.innerHTML = '<div class="empty-state">Aucun log pour le moment.</div>';
    return;
  }

  list.innerHTML = logs.slice(0, 100).map(l => {
    const time = new Date(l.ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const icon = l.action === 'reply_sent' ? '💬' : l.action === 'dm_sent' ? '📩' : l.action.includes('fail') ? '❌' : '⚡';
    return `
      <div class="log-item">
        <span class="log-time">${time}</span>
        <span class="log-icon">${icon}</span>
        <span class="log-text">
          <span class="author">${escapeHtml(l.author)}</span> 
          — <span class="keyword">"${escapeHtml(l.keyword)}"</span>
          (${escapeHtml(l.thematic)})
        </span>
      </div>
    `;
  }).join('');
}

async function clearLogs() {
  if (!confirm('Vider tous les logs ?')) return;
  await chrome.storage.local.set({ [STORAGE_KEYS.ACTION_LOG]: [] });
  renderLogs();
}

// ── Reset ──────────────────────────────────────────────────

async function resetAll() {
  if (!confirm('⚠️ Reset complet : thématiques, logs, compteurs. Continuer ?')) return;
  await chrome.storage.local.set({
    [STORAGE_KEYS.THEMATICS]: [],
    [STORAGE_KEYS.ACTION_LOG]: [],
    [STORAGE_KEYS.DAILY_COUNTERS]: { replies: 0, dms: 0, date: new Date().toISOString().split('T')[0] },
    scaleme_processed_comments: [],
  });
  thematics = [];
  renderThematics();
  renderLogs();
  pollStatus();
}

// ── Helpers ────────────────────────────────────────────────

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
