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
let pipelineInterval = null;

const STEP_DISPLAY = {
  queued:          { icon: '📋', label: 'En file' },
  wait_reply:      { icon: '⏳', label: 'Réponse dans' },
  replying:        { icon: '💬', label: 'Réponse...' },
  reply_done:      { icon: '✅', label: 'Réponse OK' },
  reply_failed:    { icon: '❌', label: 'Réponse échouée' },
  wait_dm:         { icon: '⏳', label: 'DM dans' },
  sending_dm:      { icon: '📩', label: 'DM...' },
  dm_done:         { icon: '✅', label: 'DM envoyé' },
  connection_sent: { icon: '🤝', label: 'Connexion envoyée' },
  pending_dm:      { icon: '⏳', label: 'DM en attente' },
  done:            { icon: '✅', label: 'Terminé' },
  failed:          { icon: '❌', label: 'Erreur' },
};

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
  // Close modal on overlay click (outside modal content)
  document.getElementById('thematicModal').addEventListener('click', (e) => {
    if (e.target.id === 'thematicModal') closeModal();
  });
  document.getElementById('modalSave').addEventListener('click', saveThematic);
  document.getElementById('clearLogsBtn').addEventListener('click', clearLogs);
  document.getElementById('dryRunToggle').addEventListener('change', onSettingChange);
  document.getElementById('notifToggle').addEventListener('change', onSettingChange);
  document.getElementById('debugToggle').addEventListener('change', onSettingChange);
  document.getElementById('dynamicMsgToggle').addEventListener('change', onSettingChange);
  document.getElementById('autoCatchupToggle').addEventListener('change', onSettingChange);
  ['globalReplyDelayMin','globalReplyDelayMax','globalDmDelayMin','globalDmDelayMax','globalBetweenMin','globalBetweenMax']
    .forEach(id => document.getElementById(id).addEventListener('change', onSettingChange));
  document.getElementById('resetBtn').addEventListener('click', resetAll);
  document.getElementById('diagnosticBtn').addEventListener('click', runDiagnostic);
  document.getElementById('discoveryBtn').addEventListener('click', runDiscovery);
  loadSelectorHealth();
  
  // Catchup (null-safe in case elements don't exist)
  const catchupFetchBtn = document.getElementById('catchupFetchPostsBtn');
  const catchupRunBtnEl = document.getElementById('catchupRunBtn');
  if (catchupFetchBtn) catchupFetchBtn.addEventListener('click', catchupFetchPosts);
  if (catchupRunBtnEl) catchupRunBtnEl.addEventListener('click', catchupRun);
  const clearProcessedBtn = document.getElementById('clearProcessedBtn');
  if (clearProcessedBtn) clearProcessedBtn.addEventListener('click', clearProcessedComments);

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
  document.getElementById('autoCatchupToggle').checked = settings.autoCatchup || false;

  // Global delay settings
  document.getElementById('globalReplyDelayMin').value = settings.replyDelayMin || 30;
  document.getElementById('globalReplyDelayMax').value = settings.replyDelayMax || 90;
  document.getElementById('globalDmDelayMin').value = settings.dmDelayMin || 60;
  document.getElementById('globalDmDelayMax').value = settings.dmDelayMax || 180;
  document.getElementById('globalBetweenMin').value = settings.betweenActionsMin || 15;
  document.getElementById('globalBetweenMax').value = settings.betweenActionsMax || 60;

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
        // Suppress "Receiving end does not exist" error
        if (chrome.runtime.lastError) return;
        if (response) {
          document.getElementById('repliesCount').textContent = response.dailyCounters?.replies || 0;
          document.getElementById('dmsCount').textContent = response.dailyCounters?.dms || 0;
          document.getElementById('queueCount').textContent = response.queueLength || 0;
          document.getElementById('pendingCount').textContent = response.pendingDMsCount || 0;
          renderPipeline(response.commentSteps);
        }
      });
    } else {
      const data = await chrome.storage.local.get([STORAGE_KEYS.DAILY_COUNTERS, 'scaleme_pending_dms', 'scaleme_action_queue', 'scaleme_comment_steps']);
      const counters = data[STORAGE_KEYS.DAILY_COUNTERS] || {};
      document.getElementById('repliesCount').textContent = counters.replies || 0;
      document.getElementById('dmsCount').textContent = counters.dms || 0;
      document.getElementById('queueCount').textContent = (data.scaleme_action_queue || []).length;
      document.getElementById('pendingCount').textContent = (data.scaleme_pending_dms || []).length;
      renderPipeline(data.scaleme_comment_steps || null);
    }
  } catch (e) {}
}

function renderPipeline(steps) {
  const list = document.getElementById('pipelineList');
  const empty = document.getElementById('pipelineEmpty');
  if (!list || !empty) return;

  const entries = Object.entries(steps || {});

  if (entries.length === 0) {
    list.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  list.innerHTML = entries.map(([id, s]) => {
    const display = STEP_DISPLAY[s.step] || { icon: '⚡', label: s.step };
    let timer = '';
    if (s.timerTargetAt && s.timerTargetAt > Date.now()) {
      const rem = Math.ceil((s.timerTargetAt - Date.now()) / 1000);
      const min = Math.floor(rem / 60);
      const sec = rem % 60;
      timer = ` <span class="pipeline-timer">${min}:${String(sec).padStart(2, '0')}</span>`;
    }
    return `
      <div class="pipeline-item">
        <div class="pipeline-author">${escapeHtml(s.authorName || '')}</div>
        <div class="pipeline-keyword">"${escapeHtml(s.matchedKeyword || '')}"</div>
        <div class="pipeline-step">${display.icon} ${display.label}${timer}</div>
      </div>
    `;
  }).join('');
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
  settings.autoCatchup = document.getElementById('autoCatchupToggle').checked;

  // Global delay settings
  settings.replyDelayMin = parseInt(document.getElementById('globalReplyDelayMin').value) || 30;
  settings.replyDelayMax = parseInt(document.getElementById('globalReplyDelayMax').value) || 90;
  settings.dmDelayMin = parseInt(document.getElementById('globalDmDelayMin').value) || 60;
  settings.dmDelayMax = parseInt(document.getElementById('globalDmDelayMax').value) || 180;
  settings.betweenActionsMin = parseInt(document.getElementById('globalBetweenMin').value) || 15;
  settings.betweenActionsMax = parseInt(document.getElementById('globalBetweenMax').value) || 60;

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

  // Pipeline tab: poll every second for live timer updates
  if (pipelineInterval) {
    clearInterval(pipelineInterval);
    pipelineInterval = null;
  }
  if (tabName === 'pipeline') {
    pollStatus();
    pipelineInterval = setInterval(pollStatus, 1000);
  }
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
  // Show the configured reply delay range (thematic overrides global)
  const min = Math.round((thematic.replyDelayMin || settings.replyDelayMin || 30) / 60);
  const max = Math.round((thematic.replyDelayMax || settings.replyDelayMax || 90) / 60);
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
        replyDelayMin: 0,  // 0 = use global setting
        replyDelayMax: 0,
        dmDelayMin: 0,
        dmDelayMax: 0,
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
    document.getElementById('replyDelayMin').value = t.replyDelayMin || 0;
    document.getElementById('replyDelayMax').value = t.replyDelayMax || 0;
    document.getElementById('dmDelayMin').value = t.dmDelayMin || 0;
    document.getElementById('dmDelayMax').value = t.dmDelayMax || 0;
  } else {
    document.getElementById('modalTitle').textContent = 'Nouvelle thématique';
    document.getElementById('thematicName').value = '';
    document.getElementById('thematicKeywords').value = '';
    document.getElementById('thematicReply').value = "C'est envoyé en DM ! 🚀";
    document.getElementById('thematicDM').value = "Salut {{firstName}} ! Suite à ton commentaire, voici le document : {{link}}\n\nBonne lecture ! 📖";
    document.getElementById('thematicLink').value = '';
    document.getElementById('thematicPostUrns').value = '';
    document.getElementById('replyDelayMin').value = 0;
    document.getElementById('replyDelayMax').value = 0;
    document.getElementById('dmDelayMin').value = 0;
    document.getElementById('dmDelayMax').value = 0;
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
    replyDelayMin: parseInt(document.getElementById('replyDelayMin').value) || 0,
    replyDelayMax: parseInt(document.getElementById('replyDelayMax').value) || 0,
    dmDelayMin: parseInt(document.getElementById('dmDelayMin').value) || 0,
    dmDelayMax: parseInt(document.getElementById('dmDelayMax').value) || 0,
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

// ── Catchup ────────────────────────────────────────────────

let catchupPosts = [];
let selectedCatchupPostUrns = new Set();
let catchupRunning = false;

async function catchupFetchPosts() {
  const btn = document.getElementById('catchupFetchPostsBtn');
  const status = document.getElementById('catchupStatus');
  btn.disabled = true;
  btn.textContent = '⏳ Chargement...';
  status.textContent = '';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url?.includes('linkedin.com')) {
      alert('Ouvrez LinkedIn dans l\'onglet actif.');
      btn.disabled = false;
      btn.textContent = '📡 Charger mes posts';
      return;
    }

    chrome.tabs.sendMessage(tab.id, { type: 'CATCHUP_FETCH_POSTS' }, (response) => {
      btn.disabled = false;
      btn.textContent = '📡 Charger mes posts';

      if (chrome.runtime.lastError || response?.error) {
        status.innerHTML = `<span style="color:#ff4444">❌ Erreur : ${escapeHtml(response?.error || chrome.runtime.lastError?.message || 'Inconnue')}</span>`;
        return;
      }

      catchupPosts = response?.posts || [];
      if (catchupPosts.length === 0) {
        status.textContent = 'Aucun post trouvé.';
        return;
      }

      renderCatchupPosts();
      document.getElementById('catchupRunBtn').style.display = 'block';
      status.textContent = `${catchupPosts.length} posts chargés. Sélectionne ceux à scanner.`;
    });
  } catch (e) {
    btn.disabled = false;
    btn.textContent = '📡 Charger mes posts';
    status.innerHTML = `<span style="color:#ff4444">❌ ${escapeHtml(e.message)}</span>`;
  }
}

function renderCatchupPosts(isNewFetch = true) {
  const list = document.getElementById('catchupPostsList');
  // Only reset selection on new fetch, preserve user selection on re-render
  if (isNewFetch) {
    selectedCatchupPostUrns = new Set(catchupPosts.map(p => p.urn));
  }

  list.innerHTML = catchupPosts.map((p, i) => {
    const preview = (p.text || '').substring(0, 80).replace(/\n/g, ' ');
    const comments = p.numComments || '?';
    return `
      <div class="catchup-post-card" data-index="${i}">
        <label class="catchup-post-check">
          <input type="checkbox" data-urn="${escapeHtml(p.urn)}" checked>
          <div class="catchup-post-info">
            <div class="catchup-post-preview">${escapeHtml(preview)}${p.text?.length > 80 ? '…' : ''}</div>
            <div class="catchup-post-meta">💬 ${comments} commentaires</div>
          </div>
        </label>
      </div>
    `;
  }).join('');

  // Delegated checkbox listener
  list.addEventListener('change', (e) => {
    if (e.target.type === 'checkbox') {
      const urn = e.target.dataset.urn;
      if (e.target.checked) selectedCatchupPostUrns.add(urn);
      else selectedCatchupPostUrns.delete(urn);
    }
  });
}

async function catchupRun() {
  if (catchupRunning) return;
  if (selectedCatchupPostUrns.size === 0) {
    alert('Sélectionne au moins un post !');
    return;
  }

  catchupRunning = true;
  const btn = document.getElementById('catchupRunBtn');
  const status = document.getElementById('catchupStatus');
  btn.disabled = true;
  btn.textContent = '⏳ Rattrapage en cours...';
  status.textContent = 'Scan des commentaires...';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url?.includes('linkedin.com')) {
      alert('Ouvrez LinkedIn dans l\'onglet actif.');
      btn.disabled = false;
      btn.textContent = '🚀 Lancer le rattrapage';
      catchupRunning = false;
      return;
    }

    chrome.tabs.sendMessage(tab.id, {
      type: 'CATCHUP_RUN',
      postUrns: [...selectedCatchupPostUrns],
    }, (response) => {
      btn.disabled = false;
      btn.textContent = '🚀 Lancer le rattrapage';
      catchupRunning = false;

      if (chrome.runtime.lastError || response?.error) {
        status.innerHTML = `<span style="color:#ff4444">❌ ${escapeHtml(response?.error || chrome.runtime.lastError?.message || 'Erreur')}</span>`;
        return;
      }

      const r = response || {};
      let statusHtml = `✅ <strong>Rattrapage terminé</strong><br>`;
      statusHtml += `📋 ${r.postsScanned ?? 0} posts scannés<br>`;
      statusHtml += `💬 ${r.commentsScanned ?? 0} commentaires analysés<br>`;
      statusHtml += `🎯 ${r.matches ?? 0} nouveau(x) match(es) → DMs en attente<br>`;
      if (r.alreadyProcessed > 0) {
        statusHtml += `✅ ${r.alreadyProcessed} commentaire(s) déjà traité(s) par le scanner<br>`;
      }
      if (r.errors?.length > 0) {
        statusHtml += `<br>⚠️ ${r.errors.length} erreur(s) :<br>`;
        r.errors.forEach(e => { statusHtml += `<span style="color:#ff9900;font-size:10px">${escapeHtml(e)}</span><br>`; });
      }
      status.innerHTML = statusHtml;
    });
  } catch (e) {
    btn.disabled = false;
    btn.textContent = '🚀 Lancer le rattrapage';
    catchupRunning = false;
    status.innerHTML = `<span style="color:#ff4444">❌ ${escapeHtml(e.message)}</span>`;
  }
}

// ── Clear Processed Comments ─────────────────────────────

async function clearProcessedComments() {
  if (!confirm('Effacer tous les commentaires traités ? Ils pourront être re-détectés au prochain scan.')) return;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    chrome.tabs.sendMessage(tab.id, { type: 'CLEAR_PROCESSED' }, (resp) => {
      if (chrome.runtime.lastError) {
        alert('Erreur : ' + (chrome.runtime.lastError.message || 'onglet non disponible'));
        return;
      }
      if (resp?.ok) {
        alert(`${resp.cleared} commentaire(s) effacé(s). Relancez le rattrapage.`);
      }
    });
  } catch (e) {
    alert('Erreur : ' + e.message);
  }
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
    const icon = l.action === 'reply_sent' ? '💬'
      : l.action === 'dm_sent' || l.action === 'catchup_dm_sent' ? '📩'
      : l.action === 'connection_request_sent' ? '🤝'
      : l.action === 'pending_dm_sent' ? '✅'
      : l.action === 'pending_dm_expired' ? '⏰'
      : l.action.includes('fail') ? '❌' : '⚡';
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
    scaleme_action_queue: [],
    scaleme_comment_steps: {},
  });
  thematics = [];
  renderThematics();
  renderLogs();
  pollStatus();
}

// ── Selector Diagnostic ──────────────────────────────────

async function loadSelectorHealth() {
  const data = await chrome.storage.local.get('scaleme_selector_health');
  const health = data.scaleme_selector_health;
  const el = document.getElementById('selectorHealth');

  if (!health) {
    el.innerHTML = '<span style="color:#888">Aucun diagnostic effectué</span>';
    return;
  }

  const age = Math.round((Date.now() - health.timestamp) / 60000);
  if (health.broken && health.broken.length > 0) {
    el.innerHTML = `<span style="color:#ff4444">❌ ${health.broken.length} sélecteur(s) cassé(s) : ${health.broken.join(', ')}</span><br><span style="color:#888;font-size:10px">Il y a ${age} min</span>`;
  } else {
    el.innerHTML = `<span style="color:#2ecc71">✅ Tous les sélecteurs OK</span><br><span style="color:#888;font-size:10px">Il y a ${age} min</span>`;
  }
}

async function runDiagnostic() {
  const btn = document.getElementById('diagnosticBtn');
  const result = document.getElementById('diagnosticResult');
  btn.disabled = true;
  btn.textContent = '⏳ Diagnostic...';
  result.textContent = '';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url?.includes('linkedin.com')) {
      result.innerHTML = '<span style="color:#ff9900">⚠️ Ouvrez LinkedIn pour lancer le diagnostic</span>';
      btn.disabled = false;
      btn.textContent = '🩺 Diagnostiquer les sélecteurs';
      return;
    }

    chrome.tabs.sendMessage(tab.id, { type: 'RUN_DIAGNOSTIC' }, (response) => {
      btn.disabled = false;
      btn.textContent = '🩺 Diagnostiquer les sélecteurs';

      if (chrome.runtime.lastError || !response) {
        result.innerHTML = `<span style="color:#ff4444">❌ ${chrome.runtime.lastError?.message || 'Erreur'}</span>`;
        return;
      }

      if (response.error) {
        result.innerHTML = `<span style="color:#ff4444">❌ ${escapeHtml(response.error)}</span>`;
        return;
      }

      let html = `<div style="margin-top:8px">`;
      html += `<strong>✅ ${response.pass}</strong> OK — `;
      html += `<strong style="color:#ff4444">❌ ${response.fail}</strong> cassés — `;
      html += `<strong style="color:#f39c12">⚠️ ${response.warn}</strong> absents<br>`;
      html += `<span style="color:#888;font-size:10px">Voir console F12 pour le rapport détaillé</span>`;
      html += `</div>`;
      result.innerHTML = html;

      // Refresh health indicator
      loadSelectorHealth();
    });
  } catch (e) {
    btn.disabled = false;
    btn.textContent = '🩺 Diagnostic';
    result.innerHTML = `<span style="color:#ff4444">❌ ${escapeHtml(e.message)}</span>`;
  }
}

async function runDiscovery() {
  const btn = document.getElementById('discoveryBtn');
  const result = document.getElementById('diagnosticResult');
  btn.disabled = true;
  btn.textContent = '⏳ Discovery...';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url?.includes('linkedin.com')) {
      result.innerHTML = '<span style="color:#ff9900">⚠️ Ouvrez LinkedIn avec des commentaires visibles</span>';
      btn.disabled = false;
      btn.textContent = '🔬 Discovery DOM';
      return;
    }

    chrome.tabs.sendMessage(tab.id, { type: 'DISCOVER_DOM' }, (response) => {
      btn.disabled = false;
      btn.textContent = '🔬 Discovery DOM';

      if (chrome.runtime.lastError || !response) {
        result.innerHTML = `<span style="color:#ff4444">❌ ${chrome.runtime.lastError?.message || 'Erreur'}</span>`;
        return;
      }

      if (response.error) {
        result.innerHTML = `<span style="color:#ff4444">❌ ${escapeHtml(response.error)}</span>`;
        return;
      }

      if (response.comments === 0) {
        result.innerHTML = '<span style="color:#ff9900">⚠️ Aucun commentaire trouvé sur cette page</span>';
        return;
      }

      let html = `<div style="margin-top:8px">`;
      html += `<strong style="color:#2ecc71">${response.commentCount}</strong> commentaires trouvés via <code>${escapeHtml(response.commentSelector)}</code><br>`;

      if (response.authorCandidates?.length > 0) {
        html += `<br><strong>Auteurs :</strong><br>`;
        for (const c of response.authorCandidates.slice(0, 3)) {
          html += `<span style="color:#3498db;font-size:10px">→ ${escapeHtml(c.selector)} "${escapeHtml(c.textPreview)}"</span><br>`;
        }
      } else {
        html += `<span style="color:#ff4444">❌ Aucun sélecteur auteur trouvé</span><br>`;
      }

      if (response.textCandidates?.length > 0) {
        html += `<br><strong>Texte :</strong><br>`;
        for (const c of response.textCandidates.slice(0, 3)) {
          html += `<span style="color:#3498db;font-size:10px">→ ${escapeHtml(c.selector)} "${escapeHtml(c.textPreview)}"</span><br>`;
        }
      }

      html += `<br><span style="color:#888;font-size:10px">Rapport complet : console F12 (retirer le filtre [ScaleMe])</span>`;
      html += `</div>`;
      result.innerHTML = html;
    });
  } catch (e) {
    btn.disabled = false;
    btn.textContent = '🔬 Discovery DOM';
    result.innerHTML = `<span style="color:#ff4444">❌ ${escapeHtml(e.message)}</span>`;
  }
}

// ── Helpers ────────────────────────────────────────────────

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
