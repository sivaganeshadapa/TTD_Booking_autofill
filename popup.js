// TTD Darshan Auto-Fill Pro - Popup Script v2.0
'use strict';

const MAX_PILGRIMS = 6;

// ── INIT ──────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  setupTabs();
  buildPilgrimCards();
  await loadAllData();
  attachListeners();
});

// ── TABS ──────────────────────────────────────────────────────────────────

function setupTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
    });
  });
}

// ── PILGRIM CARD BUILDER ──────────────────────────────────────────────────

function buildPilgrimCards() {
  const list = document.getElementById('pilgrimList');
  list.innerHTML = '';
  for (let i = 0; i < MAX_PILGRIMS; i++) {
    list.appendChild(createCard(i));
  }
}

function createCard(i) {
  const card = document.createElement('div');
  card.className = 'pilgrim-card' + (i > 0 ? ' collapsed' : '');
  card.id = `card_${i}`;

  card.innerHTML = `
    <div class="pilgrim-card-header" data-index="${i}">
      <div class="pilgrim-card-title">
        <span class="filled-dot" id="dot_${i}"></span>
        Pilgrim ${i + 1}
      </div>
      <div class="pilgrim-card-actions">
        <button class="btn-clear-pilgrim" data-clear="${i}">Clear</button>
        <span class="collapse-arrow">▼</span>
      </div>
    </div>
    <div class="pilgrim-card-body">
      <div class="field-group field-full">
        <label for="name_${i}">Full Name *</label>
        <input type="text" id="name_${i}" placeholder="As on Aadhaar / Passport" maxlength="80" autocomplete="off" />
      </div>
      <div class="field-group">
        <label for="age_${i}">Age *</label>
        <input type="number" id="age_${i}" placeholder="Age" min="1" max="120" />
      </div>
      <div class="field-group">
        <label for="gender_${i}">Gender *</label>
        <select id="gender_${i}">
          <option value="">Select</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
          <option value="Transgender">Transgender</option>
        </select>
      </div>
      <div class="field-group">
        <label for="idType_${i}">Photo ID Type *</label>
        <select id="idType_${i}">
          <option value="">Select</option>
          <option value="Aadhaar Card">Aadhaar Card</option>
          <option value="Passport">Passport</option>
        </select>
      </div>
      <div class="field-group">
        <label for="idNumber_${i}">Photo ID Number *</label>
        <input type="text" id="idNumber_${i}" placeholder="ID Number" maxlength="20" autocomplete="off" />
      </div>
    </div>
  `;

  // Collapse toggle (Accordion style)
  card.querySelector('.pilgrim-card-header').addEventListener('click', (e) => {
    if (e.target.classList.contains('btn-clear-pilgrim')) return;
    
    const isCurrentlyCollapsed = card.classList.contains('collapsed');
    
    // First, collapse all cards
    document.querySelectorAll('.pilgrim-card').forEach(c => {
      c.classList.add('collapsed');
    });
    
    // Then, if the clicked card was collapsed, expand it
    if (isCurrentlyCollapsed) {
      card.classList.remove('collapsed');
    }
  });

  // Live dot update
  ['name', 'age', 'gender', 'idType', 'idNumber'].forEach(field => {
    const el = card.querySelector(`#${field}_${i}`);
    el.addEventListener('input', () => updateDot(i));
    el.addEventListener('change', () => updateDot(i));
  });

  return card;
}

function updateDot(i) {
  const name = document.getElementById(`name_${i}`)?.value?.trim();
  const dot = document.getElementById(`dot_${i}`);
  if (dot) dot.classList.toggle('active', !!name);
}

// ── DATA PERSISTENCE ──────────────────────────────────────────────────────

async function loadAllData() {
  const result = await chrome.storage.local.get(['pilgrims', 'settings']);
  const pilgrims = result.pilgrims || [];
  const settings = result.settings || { autoClickContinue: true, autoClickPayNow: true };

  // Fill pilgrim forms
  for (let i = 0; i < MAX_PILGRIMS; i++) {
    const p = pilgrims[i];
    if (!p) continue;
    setField(`name_${i}`, p.name);
    setField(`age_${i}`, p.age);
    setField(`gender_${i}`, p.gender);
    setField(`idType_${i}`, p.idType);
    setField(`idNumber_${i}`, p.idNumber);
    updateDot(i);

    // Do not auto-expand all cards with data to prevent UI breakout
  }

  // Settings
  document.getElementById('optContinue').checked = settings.autoClickContinue !== false;
  document.getElementById('optPayNow').checked = settings.autoClickPayNow !== false;
}

function setField(id, value) {
  const el = document.getElementById(id);
  if (el && value !== undefined && value !== null) el.value = value;
}

async function saveAllData() {
  const pilgrims = [];
  for (let i = 0; i < MAX_PILGRIMS; i++) {
    const name = document.getElementById(`name_${i}`)?.value?.trim() || '';
    pilgrims.push(name ? {
      name,
      age: document.getElementById(`age_${i}`)?.value?.trim() || '',
      gender: document.getElementById(`gender_${i}`)?.value || '',
      idType: document.getElementById(`idType_${i}`)?.value || '',
      idNumber: document.getElementById(`idNumber_${i}`)?.value?.trim() || '',
    } : null);
  }

  const settings = {
    autoClickContinue: document.getElementById('optContinue').checked,
    autoClickPayNow: document.getElementById('optPayNow').checked,
  };

  await chrome.storage.local.set({ pilgrims, settings });
}

// ── ATTACH LISTENERS ──────────────────────────────────────────────────────

function attachListeners() {
  document.getElementById('btnSave').addEventListener('click', async () => {
    await saveAllData();
    showBanner('success', 'Pilgrim details saved!');
  });

  document.getElementById('btnAutoFill').addEventListener('click', triggerAutoFill);

  document.getElementById('btnClearAll').addEventListener('click', async () => {
    if (!confirm('Clear all pilgrim data?')) return;
    await chrome.storage.local.remove('pilgrims');
    buildPilgrimCards();
    showBanner('success', 'All data cleared');
  });

  // Clear individual buttons
  document.getElementById('pilgrimList').addEventListener('click', (e) => {
    const idx = e.target.dataset.clear;
    if (idx === undefined) return;
    const i = parseInt(idx);
    ['name', 'age', 'gender', 'idType', 'idNumber'].forEach(f => {
      const el = document.getElementById(`${f}_${i}`);
      if (el) el.value = '';
    });
    updateDot(i);
    showBanner('success', `Pilgrim ${i + 1} cleared`);
  });

  // Settings auto-save on toggle
  ['optContinue', 'optPayNow'].forEach(id => {
    document.getElementById(id).addEventListener('change', saveAllData);
  });

  // Listen for status messages from content script
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'statusUpdate') {
      showBanner(msg.type, msg.message, msg.type === 'success' || msg.type === 'error' ? 6000 : 0);
    }
  });
}

// ── TRIGGER AUTO-FILL ─────────────────────────────────────────────────────

async function triggerAutoFill() {
  // Save current data first
  await saveAllData();

  const result = await chrome.storage.local.get(['pilgrims', 'settings']);
  const pilgrims = (result.pilgrims || []).filter(p => p && p.name);
  const settings = result.settings || {};

  if (pilgrims.length === 0) {
    showBanner('error', 'No pilgrim data saved. Enter details and save first.');
    return;
  }

  // Get active tab
  let tabs;
  try {
    tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  } catch (e) {
    showBanner('error', 'Cannot access browser tabs');
    return;
  }

  const tab = tabs[0];
  if (!tab || !tab.url) {
    showBanner('error', 'No active tab found');
    return;
  }

  // Check URL
  const isTTD = tab.url.includes('ttdevasthanams.ap.gov.in');
  if (!isTTD) {
    showBanner('error', 'Please open the TTD booking website first');
    return;
  }

  showBanner('running', 'Connecting to page...');

  // Inject content script if needed
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });
    await new Promise(r => setTimeout(r, 300));
  } catch (injectErr) {
    // May already be injected — continue
  }

  // Ping content script
  try {
    await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
  } catch (e) {
    showBanner('error', 'Could not connect to page. Refresh the TTD page and try again.');
    return;
  }

  showBanner('running', `Starting auto-fill for ${pilgrims.length} pilgrim(s)...`);

  // Check page state
  let pageState;
  try {
    pageState = await chrome.tabs.sendMessage(tab.id, { action: 'getPageState' });
  } catch (e) {
    pageState = {};
  }

  const url = tab.url;
  const isPilgrimPage = pageState.isPilgrimPage;
  const isReviewPage = pageState.isReviewPage;

  if (!isPilgrimPage && !isReviewPage) {
    // Check if the user is on the main slot-booking page — remind them to click Continue first
    if (url.includes('slot-booking') || url.includes('booking') || url.includes('seva')) {
      showBanner('warning', 'Select your date & slot, then click Continue on the website. Then click Start Auto-Fill again.');
    } else {
      showBanner('warning', 'Navigate to the TTD booking page and complete slot selection first.');
    }
    return;
  }

  if (isReviewPage) {
    // Try Pay Now directly
    showBanner('running', 'On review page — clicking Pay Now...');
    try {
      const resp = await chrome.tabs.sendMessage(tab.id, {
        action: 'autoFill',
        pilgrims,
        options: { autoClickContinue: false, autoClickPayNow: true }
      });
      handleResponse(resp);
    } catch (e) {
      showBanner('error', 'Error: ' + e.message);
    }
    return;
  }

  // Normal flow: fill pilgrims → Continue → Pay Now
  try {
    const resp = await chrome.tabs.sendMessage(tab.id, {
      action: 'autoFill',
      pilgrims,
      options: {
        autoClickContinue: settings.autoClickContinue !== false,
        autoClickPayNow: settings.autoClickPayNow !== false,
      }
    });
    handleResponse(resp);
  } catch (e) {
    showBanner('error', 'Error: ' + e.message);
  }
}

function handleResponse(resp) {
  if (!resp) {
    showBanner('error', 'No response from page. Try refreshing and re-running.');
    return;
  }
  if (resp.success) {
    if (resp.warning) {
      showBanner('warning', `${resp.warning}`);
    } else {
      showBanner('success', `Done! ${resp.filled || '?'} pilgrim(s) filled. Complete payment on the page.`);
    }
  } else {
    showBanner('error', `${resp.error || 'Auto-fill failed'}`);
  }
}

// ── BANNER HELPER ─────────────────────────────────────────────────────────

let bannerTimer = null;

function showBanner(type, message, duration = 5000) {
  const banner = document.getElementById('statusBanner');
  banner.textContent = message;
  banner.className = `status-banner ${type}`;
  banner.classList.remove('hidden');

  if (bannerTimer) clearTimeout(bannerTimer);
  if (duration > 0) {
    bannerTimer = setTimeout(() => {
      banner.classList.add('hidden');
    }, duration);
  }
}
