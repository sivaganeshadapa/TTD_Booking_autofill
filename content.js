// TTD Darshan Auto-Fill Pro - Content Script v2.0
// Handles: pilgrim fill → Continue → Pay Now
// Works with Angular/dynamic rendering, slow loads, partial renders

(function () {
  'use strict';

  console.log('[TTD Pro] Content script loaded on:', window.location.href);

  // ─── UTILITIES ────────────────────────────────────────────────────────────

  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  // Wait for a DOM element to appear, with timeout
  function waitForElement(selector, timeout = 15000, root = document) {
    return new Promise((resolve, reject) => {
      const existing = root.querySelector(selector);
      if (existing) return resolve(existing);

      const observer = new MutationObserver(() => {
        const el = root.querySelector(selector);
        if (el) {
          observer.disconnect();
          resolve(el);
        }
      });
      observer.observe(root.body || root, { childList: true, subtree: true });

      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Timeout waiting for: ${selector}`));
      }, timeout);
    });
  }

  // Wait for multiple elements
  async function waitForElements(selector, minCount = 1, timeout = 15000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const els = document.querySelectorAll(selector);
      if (els.length >= minCount) return Array.from(els);
      await sleep(200);
    }
    throw new Error(`Timeout: expected ${minCount}+ of "${selector}"`);
  }

  // Wait for element to be clickable (visible + not disabled)
  async function waitForClickable(selector, timeout = 10000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const el = document.querySelector(selector);
      if (el && !el.disabled && el.offsetParent !== null) return el;
      await sleep(150);
    }
    throw new Error(`Timeout waiting for clickable: ${selector}`);
  }

  // Trigger Angular/React-compatible input event
  function triggerInputEvents(el, value) {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value'
    );
    if (nativeInputValueSetter && nativeInputValueSetter.set) {
      nativeInputValueSetter.set.call(el, value);
    } else {
      el.value = value;
    }
    ['input', 'change', 'blur', 'keyup'].forEach(evtName => {
      el.dispatchEvent(new Event(evtName, { bubbles: true, cancelable: true }));
    });
    // Angular-specific
    el.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: value }));
  }

  // ─── FIELD DETECTION ──────────────────────────────────────────────────────

  // The TTD site uses Angular with inputs identified by name+id attributes
  // Selectors discovered from the old extension and screenshots

  function getPilgrimRows() {
    // Each pilgrim row has an input with name="fname" and incrementing id
    // Try multiple selector strategies
    const byFname = Array.from(document.querySelectorAll('input[name="fname"]'));
    if (byFname.length > 0) return { strategy: 'byName', inputs: byFname };

    // Fallback: rows of inputs inside the pilgrim details section
    const rows = Array.from(document.querySelectorAll('.pilgrim-details input[type="text"], .pilgrim-details input[type="number"]'));
    return { strategy: 'fallback', inputs: rows };
  }

  // ─── FILL A SINGLE PILGRIM ────────────────────────────────────────────────

  async function fillPilgrimByIndex(index, pilgrim) {
    console.log(`[TTD Pro] Filling pilgrim ${index + 1}:`, pilgrim.name);

    // ── Name ──
    await fillNameField(index, pilgrim.name);
    await sleep(30);

    // ── Age ──
    await fillAgeField(index, String(pilgrim.age));
    await sleep(30);

    // ── Gender ──
    if (pilgrim.gender) {
      await selectDropdown(index, 'gender', pilgrim.gender);
      await sleep(60);
    }

    // ── Photo ID Type ──
    if (pilgrim.idType) {
      await selectDropdown(index, 'photoIdType', pilgrim.idType);
      await sleep(100); // ID number field may enable after this
    }

    // ── Photo ID Number ──
    if (pilgrim.idNumber) {
      await fillIdNumber(index, String(pilgrim.idNumber));
      await sleep(30);
    }

    console.log(`[TTD Pro] ✓ Pilgrim ${index + 1} filled`);
  }

  async function fillNameField(index, value) {
    // Try id-based first, then positional
    let input = document.querySelector(`input[name="fname"][id="${index}"]`)
      || document.querySelector(`input[name="fname"][id="${index + 1}"]`);

    if (!input) {
      const all = document.querySelectorAll('input[name="fname"]');
      input = all[index];
    }
    if (!input) throw new Error(`Name field for pilgrim ${index + 1} not found`);

    input.focus();
    input.select();
    triggerInputEvents(input, value);
  }

  async function fillAgeField(index, value) {
    let input = document.querySelector(`input[name="age"][id="${index}"]`)
      || document.querySelector(`input[name="age"][id="${index + 1}"]`);

    if (!input) {
      const all = document.querySelectorAll('input[name="age"]');
      input = all[index];
    }
    if (!input) throw new Error(`Age field for pilgrim ${index + 1} not found`);

    input.focus();
    triggerInputEvents(input, value);
  }

  async function fillIdNumber(index, value) {
    // Try multiple possible field names used by TTD
    const selectors = [
      `input[name="idProofNumber"][id="${index}"]`,
      `input[name="idProofNumber"][id="${index + 1}"]`,
      `input[name="photoIdNumber"][id="${index}"]`,
      `input[name="photoIdNumber"][id="${index + 1}"]`,
      `input[name="idNumber"][id="${index}"]`,
    ];

    let input = null;
    for (const sel of selectors) {
      input = document.querySelector(sel);
      if (input) break;
    }

    if (!input) {
      // Positional fallback — find all id number inputs
      const all = document.querySelectorAll('input[name="idProofNumber"], input[name="photoIdNumber"], input[name="idNumber"]');
      input = all[index];
    }

    if (!input) {
      console.warn(`[TTD Pro] ID number field for pilgrim ${index + 1} not found`);
      return;
    }

    if (input.disabled) {
      input.removeAttribute('disabled');
      await sleep(50);
    }

    input.focus();
    triggerInputEvents(input, value);
  }

  // ─── DROPDOWN SELECTION ───────────────────────────────────────────────────

  async function selectDropdown(index, fieldName, value) {
    // Possible selectors for the trigger input
    const selectors = [
      `input[name="${fieldName}"][id="${index}"]`,
      `input[name="${fieldName}"][id="${index + 1}"]`,
      `input[name="${fieldName}"]`,
    ];

    let triggerInput = null;
    for (const sel of selectors) {
      const els = document.querySelectorAll(sel);
      triggerInput = fieldName === 'gender' || fieldName === 'photoIdType'
        ? els[index] || els[0]
        : document.querySelector(sel);
      if (triggerInput) break;
    }

    // Also try mat-select or ng-select style
    if (!triggerInput) {
      const allInputs = document.querySelectorAll(`input[name="${fieldName}"]`);
      triggerInput = allInputs[index];
    }

    if (!triggerInput) {
      // Try clicking the parent wrapper to open dropdown
      console.warn(`[TTD Pro] Dropdown trigger for ${fieldName}[${index}] not found, trying wrapper`);
      await selectDropdownByWrapper(index, fieldName, value);
      return;
    }

    // Click to open
    triggerInput.click();
    triggerInput.focus();
    await sleep(80);

    // Try finding and clicking the li option
    const clicked = await clickDropdownOption(value);
    if (!clicked) {
      // Retry once after longer wait
      await sleep(200);
      await clickDropdownOption(value);
    }
  }

  async function selectDropdownByWrapper(index, fieldName, value) {
    // The TTD site may use custom Angular dropdowns with mat-select or custom components
    // Try mat-select
    const matSelects = document.querySelectorAll('mat-select, .mat-select');
    if (matSelects.length > 0) {
      const dropdownIndex = fieldName === 'gender' ? (index * 2) : (index * 2 + 1);
      const target = matSelects[dropdownIndex] || matSelects[index];
      if (target) {
        target.click();
        await sleep(100);
        const options = document.querySelectorAll('mat-option, .mat-option');
        for (const opt of options) {
          if (opt.textContent.trim() === value) {
            opt.click();
            return;
          }
        }
      }
    }

    // Try custom dropdown divs
    const dropdownWrappers = document.querySelectorAll('[class*="dropdown"], [class*="select"]');
    for (const wrapper of dropdownWrappers) {
      const inputs = wrapper.querySelectorAll('input');
      if (inputs[index]) {
        inputs[index].click();
        await sleep(100);
        const options = document.querySelectorAll('li, [role="option"]');
        for (const opt of options) {
          if (opt.textContent.trim() === value) {
            opt.click();
            return;
          }
        }
      }
    }
  }

  async function clickDropdownOption(value) {
    // TTD uses li.floatingDropdown_listItem__* pattern (from old extension)
    const allLis = document.querySelectorAll('li');
    for (const li of allLis) {
      const text = li.textContent.trim();
      if (text === value) {
        li.click();
        await sleep(30);
        console.log(`[TTD Pro] ✓ Selected dropdown option: "${value}"`);
        return true;
      }
    }

    // Also try mat-option, ng-option, etc.
    const optionSelectors = ['mat-option', '[role="option"]', '.dropdown-item', '.select-option'];
    for (const sel of optionSelectors) {
      const opts = document.querySelectorAll(sel);
      for (const opt of opts) {
        if (opt.textContent.trim() === value) {
          opt.click();
          await sleep(30);
          return true;
        }
      }
    }

    console.warn(`[TTD Pro] Option "${value}" not found in any visible dropdown`);
    return false;
  }

  // ─── BUTTON HELPERS ───────────────────────────────────────────────────────

  function findButtonByText(texts) {
    const allButtons = Array.from(document.querySelectorAll('button, [role="button"], input[type="submit"], a.btn'));
    for (const btn of allButtons) {
      const t = (btn.textContent || btn.value || '').trim().toLowerCase();
      if (texts.some(text => t.includes(text.toLowerCase()))) {
        return btn;
      }
    }
    return null;
  }

  async function clickContinue() {
    console.log('[TTD Pro] Looking for Continue button...');
    const btn = findButtonByText(['continue', 'proceed', 'next']);
    if (!btn) throw new Error('Continue button not found');
    btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await sleep(300);
    btn.click();
    console.log('[TTD Pro] ✓ Clicked Continue');
  }

  async function clickPayNow() {
    console.log('[TTD Pro] Looking for Pay Now button...');
    // Wait for page transition first
    await sleep(1500);
    const btn = findButtonByText(['pay now', 'pay', 'paynow']);
    if (!btn) throw new Error('Pay Now button not found');
    btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await sleep(400);
    btn.click();
    console.log('[TTD Pro] ✓ Clicked Pay Now');
  }

  // ─── PAGE STATE DETECTION ─────────────────────────────────────────────────

  function isOnPilgrimFillPage() {
    const url = window.location.href;
    if (!url.includes('ttdevasthanams.ap.gov.in')) return false;
    // We assume it's a pilgrim form if we find the fname input, or if the URL has booking/pilgrim/seva keywords
    const hasForm = document.querySelectorAll('input[name="fname"]').length > 0;
    return hasForm || url.includes('pilgrim') || url.includes('booking') || url.includes('seva');
  }

  function isOnReviewPage() {
    const url = window.location.href;
    if (!url.includes('ttdevasthanams.ap.gov.in')) return false;
    return url.includes('review') || url.includes('payment') || url.includes('pay') || url.includes('summary');
  }

  function isOnPaymentPage() {
    const url = window.location.href;
    return url.includes('TTDApp') || url.includes('payment') || url.includes('pay');
  }

  // ─── MAIN ORCHESTRATION ───────────────────────────────────────────────────

  async function runAutomation(pilgrims, options = {}) {
    const { autoClickContinue = true, autoClickPayNow = true } = options;

    console.log('[TTD Pro] Starting automation...', { pilgrims: pilgrims.length });
    sendStatus('running', '⏳ Starting automation...');

    // ── STEP 1: Wait for pilgrim fill page ──────────────────────────────────
    sendStatus('running', '⏳ Waiting for pilgrim form to load...');

    // Wait for at least one name input field
    let nameFields;
    try {
      nameFields = await waitForElements('input[name="fname"]', 1, 20000);
    } catch (e) {
      // Try waiting longer and checking URL
      await sleep(2000);
      nameFields = document.querySelectorAll('input[name="fname"]');
      if (nameFields.length === 0) {
        sendStatus('error', '❌ Pilgrim form not found. Make sure you clicked Continue on the slot page.');
        return { success: false, error: 'Pilgrim form not found' };
      }
      nameFields = Array.from(nameFields);
    }

    const formCount = nameFields.length;
    console.log(`[TTD Pro] Found ${formCount} pilgrim form(s)`);
    sendStatus('running', `⏳ Found ${formCount} pilgrim row(s). Filling...`);

    // ── STEP 2: Fill each pilgrim ────────────────────────────────────────────
    const toFill = pilgrims.slice(0, formCount);
    let filled = 0;
    const errors = [];

    for (let i = 0; i < toFill.length; i++) {
      try {
        await fillPilgrimByIndex(i, toFill[i]);
        filled++;
        sendStatus('running', `⏳ Filled ${filled}/${toFill.length} pilgrim(s)...`);
        await sleep(50);
      } catch (err) {
        console.error(`[TTD Pro] Error filling pilgrim ${i + 1}:`, err);
        errors.push(`Pilgrim ${i + 1}: ${err.message}`);
      }
    }

    if (filled === 0) {
      sendStatus('error', '❌ Could not fill any pilgrim fields');
      return { success: false, error: 'No fields filled' };
    }

    sendStatus('running', `✅ Filled ${filled}/${toFill.length} pilgrim(s). Scrolling...`);
    await sleep(400);

    // ── STEP 3: Scroll to bottom and click Continue ──────────────────────────
    if (!autoClickContinue) {
      sendStatus('success', `✅ Filled ${filled} pilgrim(s). Click Continue manually.`);
      return { success: true, filled };
    }

    try {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      await sleep(600);
      await clickContinue();
      sendStatus('running', '⏳ Clicked Continue. Waiting for review page...');
    } catch (err) {
      sendStatus('error', `❌ Could not click Continue: ${err.message}`);
      return { success: false, error: err.message };
    }

    // ── STEP 4: Wait for review page, then click Pay Now ────────────────────
    if (!autoClickPayNow) {
      sendStatus('success', `✅ Done! Review page loading...`);
      return { success: true, filled };
    }

    // Poll for Pay Now button (appears after review page loads)
    let payNowAttempts = 0;
    const maxAttempts = 20;
    while (payNowAttempts < maxAttempts) {
      await sleep(800);
      const payBtn = findButtonByText(['pay now', 'pay', 'paynow']);
      if (payBtn) {
        sendStatus('running', '⏳ Found Pay Now! Clicking...');
        await sleep(400);
        payBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await sleep(300);
        payBtn.click();
        sendStatus('success', '✅ Clicked Pay Now! Complete payment on the page.');
        return { success: true, filled };
      }
      payNowAttempts++;
      console.log(`[TTD Pro] Waiting for Pay Now... attempt ${payNowAttempts}`);
    }

    sendStatus('error', '⚠️ Pay Now button not found. Please click it manually.');
    return { success: true, filled, warning: 'Pay Now not auto-clicked' };
  }

  // ─── STATUS MESSAGING ─────────────────────────────────────────────────────

  function sendStatus(type, message) {
    try {
      chrome.runtime.sendMessage({ action: 'statusUpdate', type, message });
    } catch (e) {
      // Extension context may be invalidated, ignore
    }
  }

  // ─── MESSAGE LISTENER ─────────────────────────────────────────────────────

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'ping') {
      sendResponse({ alive: true });
      return true;
    }

    if (request.action === 'autoFill') {
      const { pilgrims, options } = request;
      runAutomation(pilgrims, options || {})
        .then(result => sendResponse(result))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true; // Keep channel open for async
    }

    if (request.action === 'getPageState') {
      sendResponse({
        url: window.location.href,
        isPilgrimPage: isOnPilgrimFillPage(),
        isReviewPage: isOnReviewPage(),
        isPaymentPage: isOnPaymentPage(),
        formCount: document.querySelectorAll('input[name="fname"]').length
      });
      return true;
    }
  });

})();
