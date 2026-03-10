// ============================================================
// Popup Script — Config UI for Scale Me LinkedIn Extension
// ============================================================

const STORAGE_KEYS = {
  THEMATICS: 'scaleme_thematics',
  SETTINGS: 'scaleme_settings',
  ACTION_LOG: 'scaleme_action_log',
  DAILY_COUNTERS: 'scaleme_daily_counters',
  PROFILE_POSTS: 'scaleme_profile_posts',
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
  document.getElementById('scanProfileBtn').addEventListener('click', scanProfile);
  document.getElementById('modalCancel').addEventListener('click', closeModal);
  document.getElementById('modalSave').addEventListener('click', saveThematic);
  document.getElementById('clearLogsBtn').addEventListener('click', clearLogs);
  document.getElementById('dryRunToggle').addEventListener('change', onSettingChange);
  document.getElementById('notifToggle').addEventListener('change', onSettingChange);
  document.getElementById('debugToggle').addEventListener('change', onSettingChange);
  document.getElementById('dynamicMsgToggle').addEventListener('change', onSettingChange);
  document.getElementById('resetBtn').addEventListener('click', resetAll);

  // Tabs
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  // Delegated event listeners for thematic cards (fixes CSP inline onclick issue)
  document.getElementById('thematicsList').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const index = parseInt(btn.dataset.index, 10);
    if (isNaN(index)) return;

    if (action === 'toggle') toggleThematic(index);
    else if (action === 'edit') openModal(index);
    else if (action === 'delete') deleteThematic(index);
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
    dynamicMessages: false,
  };
}

// ── UI Updates ─────────────────────────────────────────────

function updateUI() {
  document.getElementById('masterToggle').checked = settings.enabled;
  document.getElementById('dryRunToggle').checked = settings.dryRun;
  document.getElementById('notifToggle').checked = settings.notificationsEnabled;
  document.getElementById('debugToggle').checked = settings.debugMode;
  document.getElementById('dynamicMsgToggle').checked = settings.dynamicMessages || false;

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
      const data = await chrome.storage.local.get(STORAGE_KEYS.DAILY_COUNTERS);
      const counters = data[STORAGE_KEYS.DAILY_COUNTERS] || {};
      document.getElementById('repliesCount').textContent = counters.replies || 0;
      document.getElementById('dmsCount').textContent = counters.dms || 0;
    }
  } catch (e) {}
}

// ── Toggle Enabled ─────────────────────────────────────────

async function onToggleEnabled() {
  settings.enabled = document.getElementById('masterToggle').checked;
  await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: settings });
  updateUI();
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
  settings.dynamicMessages = document.getElementById('dynamicMsgToggle').checked;
  
  await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: settings });
  updateUI();
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

// ── Thematics Rendering (CSP-safe, no inline onclick) ──────

function renderThematics() {
  const list = document.getElementById('thematicsList');
  
  if (thematics.length === 0) {
    list.innerHTML = '<div class="empty-state">Aucune thématique configurée.<br>Scannez votre profil ou ajoutez-en une !</div>';
    return;
  }

  list.innerHTML = thematics.map((t, i) => `
    <div class="thematic-card ${t.enabled ? '' : 'disabled'}" data-index="${i}">
      <div class="thematic-header">
        <span class="thematic-name">${escapeHtml(t.name || 'Sans nom')}</span>
        <div class="thematic-actions">
          <button data-action="toggle" data-index="${i}" title="${t.enabled ? 'Désactiver' : 'Activer'}">${t.enabled ? '✅' : '⬜'}</button>
          <button data-action="edit" data-index="${i}" title="Modifier">✏️</button>
          <button data-action="delete" data-index="${i}" title="Supprimer">🗑️</button>
        </div>
      </div>
      ${t.isDraft ? '<span class="draft-badge">DRAFT</span>' : ''}
      <div class="thematic-keywords">
        ${(t.keywords || []).map(k => `<span class="keyword-tag">${escapeHtml(k)}</span>`).join('')}
      </div>
      ${t.leadMagnetUrl ? `<div class="thematic-link">🔗 ${escapeHtml(t.leadMagnetUrl)}</div>` : '<div class="thematic-link" style="color:#ff9900">⚠️ Lien lead magnet manquant</div>'}
      <div class="thematic-meta">
        <span>Réponse : ~${estimateDelay(t)} avant envoi</span>
      </div>
    </div>
  `).join('');
}

function estimateDelay(thematic) {
  // Show the configured reply delay range
  const min = Math.round((thematic.replyDelayMin || 120) / 60);
  const max = Math.round((thematic.replyDelayMax || 300) / 60);
  return `${min}-${max} min`;
}

// ── Thematic Actions ───────────────────────────────────────

async function toggleThematic(index) {
  thematics[index].enabled = !thematics[index].enabled;
  await chrome.storage.local.set({ [STORAGE_KEYS.THEMATICS]: thematics });
  renderThematics();
  notifyContentScript();
}

async function deleteThematic(index) {
  if (!confirm(`Supprimer "${thematics[index].name}" ?`)) return;
  thematics.splice(index, 1);
  await chrome.storage.local.set({ [STORAGE_KEYS.THEMATICS]: thematics });
  renderThematics();
  notifyContentScript();
}

async function notifyContentScript() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url?.includes('linkedin.com')) {
      chrome.tabs.sendMessage(tab.id, { type: 'UPDATE_THEMATICS', thematics });
    }
  } catch (e) {}
}

// ── Profile Scanner ────────────────────────────────────────

async function scanProfile() {
  const btn = document.getElementById('scanProfileBtn');
  btn.disabled = true;
  btn.textContent = '⏳ Scan en cours...';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url?.includes('linkedin.com')) {
      alert('Ouvrez LinkedIn dans l\'onglet actif pour scanner votre profil.');
      return;
    }

    // Ask content script to scan posts on the current page
    chrome.tabs.sendMessage(tab.id, { type: 'SCAN_PROFILE_POSTS' }, (response) => {
      if (chrome.runtime.lastError || !response?.posts) {
        alert('Impossible de scanner. Assurez-vous d\'être sur votre profil LinkedIn ou sur le feed.');
        btn.disabled = false;
        btn.textContent = '🔍 Scanner mon profil';
        return;
      }

      const posts = response.posts;
      if (posts.length === 0) {
        alert('Aucun post trouvé sur cette page.');
        btn.disabled = false;
        btn.textContent = '🔍 Scanner mon profil';
        return;
      }

      // Generate draft thematics from posts
      const drafts = generateDraftsFromPosts(posts);
      
      if (drafts.length === 0) {
        alert('Posts trouvés mais aucune thématique détectable. Ajoutez-en manuellement.');
      } else {
        // Add drafts that don't already exist
        let added = 0;
        for (const draft of drafts) {
          const exists = thematics.some(t => t.name === draft.name);
          if (!exists) {
            thematics.push(draft);
            added++;
          }
        }
        
        if (added > 0) {
          chrome.storage.local.set({ [STORAGE_KEYS.THEMATICS]: thematics });
          renderThematics();
          notifyContentScript();
          alert(`${added} thématique(s) draft ajoutée(s) ! Configurez les liens et activez-les.`);
        } else {
          alert('Toutes les thématiques détectées existent déjà.');
        }
      }

      btn.disabled = false;
      btn.textContent = '🔍 Scanner mon profil';
    });
  } catch (e) {
    console.error('Scan error:', e);
    btn.disabled = false;
    btn.textContent = '🔍 Scanner mon profil';
  }
}

/**
 * Analyze scanned posts and generate draft thematics.
 * Detects CTA patterns like "commente X", "écris X", "tape X", "DM", etc.
 */
function generateDraftsFromPosts(posts) {
  const drafts = [];
  
  // Common CTA patterns in LinkedIn posts (FR + EN)
  const ctaPatterns = [
    // FR patterns
    /(?:commente|écris|tape|envoie|réponds?|mets?|laisse)\s+[«"']?(\w+)[»"']?/gi,
    /(?:mot[- ]clé|keyword)\s*[:=]?\s*[«"']?(\w+)[»"']?/gi,
    /[«"'](\w{2,15})[»"']\s+(?:en commentaire|pour recevoir|pour obtenir|dans les comments?)/gi,
    // EN patterns
    /(?:comment|type|drop|write|reply)\s+[«"']?(\w+)[»"']?/gi,
    /[«"'](\w{2,15})[»"']\s+(?:in the comments?|to get|to receive|below)/gi,
  ];

  for (const post of posts) {
    const text = post.text || '';
    const detectedKeywords = new Set();

    for (const pattern of ctaPatterns) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const kw = match[1].toUpperCase();
        // Filter out common false positives
        if (kw.length >= 2 && kw.length <= 20 && !['LE', 'LA', 'LES', 'UN', 'UNE', 'DES', 'THE', 'AND', 'FOR', 'MON', 'TON', 'SON', 'VOUS', 'NOUS'].includes(kw)) {
          detectedKeywords.add(kw);
        }
      }
    }

    if (detectedKeywords.size > 0) {
      // Extract topic from first ~80 chars of post
      const topic = text.substring(0, 80).replace(/\n/g, ' ').trim();
      
      drafts.push({
        id: `th_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: `📋 ${topic.length > 50 ? topic.substring(0, 50) + '…' : topic}`,
        keywords: [...detectedKeywords],
        replyTemplate: "C'est envoyé en DM ! 🚀",
        dmTemplate: "Salut {{firstName}} !\n\nSuite à ton commentaire sur mon post, voici le contenu : {{link}}\n\nBonne lecture ! 📖",
        leadMagnetUrl: '',
        postUrns: post.urn ? [post.urn] : [],
        enabled: false, // Draft = disabled by default
        isDraft: true,
        replyDelayMin: 120,  // 2 min
        replyDelayMax: 300,  // 5 min
        dmDelayMin: 180,     // 3 min
        dmDelayMax: 600,     // 10 min
      });
    }
  }

  return drafts;
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
    document.getElementById('replyDelayMin').value = t.replyDelayMin || 120;
    document.getElementById('replyDelayMax').value = t.replyDelayMax || 300;
    document.getElementById('dmDelayMin').value = t.dmDelayMin || 180;
    document.getElementById('dmDelayMax').value = t.dmDelayMax || 600;
  } else {
    document.getElementById('modalTitle').textContent = 'Nouvelle thématique';
    document.getElementById('thematicName').value = '';
    document.getElementById('thematicKeywords').value = '';
    document.getElementById('thematicReply').value = "C'est envoyé en DM ! 🚀";
    document.getElementById('thematicDM').value = "Salut {{firstName}} ! Suite à ton commentaire, voici le document : {{link}}\n\nBonne lecture ! 📖";
    document.getElementById('thematicLink').value = '';
    document.getElementById('thematicPostUrns').value = '';
    document.getElementById('replyDelayMin').value = 120;
    document.getElementById('replyDelayMax').value = 300;
    document.getElementById('dmDelayMin').value = 180;
    document.getElementById('dmDelayMax').value = 600;
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
    isDraft: false,
    replyDelayMin: parseInt(document.getElementById('replyDelayMin').value) || 120,
    replyDelayMax: parseInt(document.getElementById('replyDelayMax').value) || 300,
    dmDelayMin: parseInt(document.getElementById('dmDelayMin').value) || 180,
    dmDelayMax: parseInt(document.getElementById('dmDelayMax').value) || 600,
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
