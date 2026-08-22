'use strict';

// ============================================================
// In-place content overlay + admin inline text editing.
// Loads text overrides from /api/content and applies them to any
// [data-cb="key"] element. If the session is an admin session, adds
// a floating "Edit Page" toggle that makes those elements editable
// in place, saving on blur. Double-click an element in edit mode to
// reset it back to its original hardcoded default.
// ============================================================
(function initContentOverlay() {
  const lastSaved  = new WeakMap(); // el -> last-saved text (or default if no override)
  let editMode      = false;
  let toastTimer    = null;
  let toastEl       = null;
  let bannerEl      = null;

  function showToast(message) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'cb-toast';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = message;
    toastEl.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('visible'), 1800);
  }

  function flash(el, kind) {
    const cls = kind === 'reset' ? 'cb-flash-reset' : 'cb-flash-saved';
    el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), 500);
  }

  async function saveValue(el, key, value) {
    try {
      const res = await fetch('/api/admin/content', {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ key, value })
      });
      if (!res.ok) throw new Error('save failed');
      lastSaved.set(el, value);
      flash(el, 'saved');
      showToast('Saved');
    } catch (err) {
      el.textContent = lastSaved.get(el) || '';
      showToast('Error saving — reverted');
    }
  }

  async function resetValue(el, key) {
    const original = el.dataset.cbDefault || '';
    el.textContent = original;
    lastSaved.set(el, original);
    flash(el, 'reset');
    showToast('Reset to default');
    try {
      await fetch('/api/admin/content', {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ key, value: null })
      });
    } catch (err) {
      // Local state already reverted; the override will just linger server-side
      // until the next successful save/reset — not worth surfacing an error for.
    }
  }

  function forcePlainTextPaste(e) {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text/plain');
    document.execCommand('insertText', false, text);
  }

  function commitOnEnter(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.target.blur();
    }
  }

  function onBlur(e) {
    const el    = e.target;
    const key   = el.dataset.cb;
    const value = el.textContent.trim();
    const prior = lastSaved.get(el) || '';

    if (!value || value === prior) {
      el.textContent = prior;
      return;
    }
    saveValue(el, key, value);
  }

  function onDblClick(e) {
    if (!editMode) return;
    e.preventDefault();
    resetValue(e.target, e.target.dataset.cb);
  }

  function setEditable(el, on) {
    el.contentEditable = on ? 'true' : 'false';
    el.classList.toggle('cb-editing', on);
    if (on) {
      el.addEventListener('paste', forcePlainTextPaste);
      el.addEventListener('keydown', commitOnEnter);
      el.addEventListener('blur', onBlur);
      el.addEventListener('dblclick', onDblClick);
    } else {
      el.removeEventListener('paste', forcePlainTextPaste);
      el.removeEventListener('keydown', commitOnEnter);
      el.removeEventListener('blur', onBlur);
      el.removeEventListener('dblclick', onDblClick);
    }
  }

  function toggleEditMode() {
    editMode = !editMode;
    document.querySelectorAll('[data-cb]').forEach(el => setEditable(el, editMode));

    if (editMode) {
      bannerEl = document.createElement('div');
      bannerEl.className = 'cb-mode-banner';
      bannerEl.textContent = 'Edit mode — click text to edit, double-click to reset a field to its default.';
      document.body.appendChild(bannerEl);
    } else if (bannerEl) {
      bannerEl.remove();
      bannerEl = null;
    }

    const toggleBtn = document.querySelector('.cb-edit-toggle');
    if (toggleBtn) {
      toggleBtn.classList.toggle('active', editMode);
      toggleBtn.setAttribute('aria-label', editMode ? 'Exit edit mode' : 'Edit page text');
      toggleBtn.title = editMode ? 'Exit edit mode' : 'Edit page text';
    }
  }

  function addEditToggle() {
    const btn = document.createElement('button');
    btn.className = 'cb-edit-toggle';
    btn.setAttribute('aria-label', 'Edit page text');
    btn.title = 'Edit page text';
    btn.innerHTML = '&#9998;'; // pencil
    btn.addEventListener('click', toggleEditMode);
    document.body.appendChild(btn);
  }

  function applyOverlay(content) {
    document.querySelectorAll('[data-cb]').forEach(el => {
      const key = el.dataset.cb;
      el.dataset.cbDefault = el.textContent;
      const override = Object.prototype.hasOwnProperty.call(content, key) ? content[key] : el.textContent;
      el.textContent = override;
      lastSaved.set(el, override);
    });
  }

  function init() {
    fetch('/api/content')
      .then(r => r.json())
      .then(({ content, isAdmin }) => {
        applyOverlay(content || {});
        if (isAdmin) addEditToggle();
      })
      .catch(() => {}); // no overrides configured yet / offline — hardcoded defaults stand
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
