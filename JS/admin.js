'use strict';

// ============================================================
// Admin Dashboard JavaScript
// Used by: admin/dashboard.html
// ============================================================

// ----------------------------------------------------------
// 1. Load Stats
// ----------------------------------------------------------
async function loadStats() {
  try {
    const res  = await fetch('/api/admin/stats');
    if (!res.ok) return;
    const data = await res.json();

    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val !== undefined ? val : '—';
    };

    set('statTotal',        data.total);
    set('statAttending',    data.attending);
    set('statNotAttending', data.notAttending);
    set('statTotalGuests',  data.totalGuests);

  } catch (err) {
    console.warn('loadStats error:', err);
  }
}

// ----------------------------------------------------------
// 2. Load RSVP Status
// ----------------------------------------------------------
async function loadRsvpStatus() {
  try {
    const res  = await fetch('/api/admin/rsvp-status');
    if (!res.ok) return;
    const data = await res.json();
    updateToggleUI(data.isOpen);
  } catch (err) {
    console.warn('loadRsvpStatus error:', err);
  }
}

function updateToggleUI(isOpen) {
  const toggle = document.getElementById('rsvpToggle');
  const label  = document.getElementById('toggleLabel');

  if (toggle) {
    toggle.checked = isOpen;
    toggle.setAttribute('aria-checked', String(isOpen));
  }

  if (label) {
    label.textContent = isOpen ? 'OPEN' : 'CLOSED';
    label.className   = 'toggle-status-label ' + (isOpen ? 'open' : 'closed');
  }
}

// ----------------------------------------------------------
// 3. Toggle RSVP open/closed
// ----------------------------------------------------------
async function toggleRsvp() {
  try {
    const res  = await fetch('/api/admin/rsvp/toggle', { method: 'POST' });
    if (!res.ok) throw new Error('Toggle failed');
    const data = await res.json();
    updateToggleUI(data.isOpen);
    showDashboardMessage(`RSVP is now ${data.isOpen ? 'OPEN' : 'CLOSED'}.`, 'success');
    loadStats();
  } catch (err) {
    showDashboardMessage('Failed to toggle RSVP status. Please try again.', 'error');
    // Revert the checkbox
    loadRsvpStatus();
  }
}

// ----------------------------------------------------------
// 4. Load RSVPs Table
// ----------------------------------------------------------
async function loadRsvps() {
  const tbody = document.getElementById('rsvpTableBody');
  if (!tbody) return;

  tbody.innerHTML = `
    <tr>
      <td colspan="8">
        <div class="empty-state">
          <div class="empty-state-icon">⏳</div>
          <p>Loading…</p>
        </div>
      </td>
    </tr>`;

  try {
    const res  = await fetch('/api/admin/rsvps');
    if (!res.ok) throw new Error('Failed to fetch RSVPs');
    const rows = await res.json();

    if (!rows.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8">
            <div class="empty-state">
              <div class="empty-state-icon">📋</div>
              <p>No RSVPs yet.</p>
            </div>
          </td>
        </tr>`;
      return;
    }

    tbody.innerHTML = rows.map(row => {
      const attending = row.attending === 'yes';
      const badge     = attending
        ? '<span class="status-badge badge-attending">✓ Attending</span>'
        : '<span class="status-badge badge-not-attending">✗ Declined</span>';

      const date = new Date(row.submitted_at).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric'
      });

      return `
        <tr>
          <td class="cell-name">${escHtml(row.guest_name)}</td>
          <td class="cell-muted cell-wrap">${escHtml(row.email || '—')}</td>
          <td>${badge}</td>
          <td>${attending ? row.guest_count : '—'}</td>
          <td class="cell-muted cell-wrap" title="${escHtml(row.dietary_restrictions || '')}">${escHtml(truncate(row.dietary_restrictions, 40))}</td>
          <td class="cell-muted cell-wrap" title="${escHtml(row.message || '')}">${escHtml(truncate(row.message, 50))}</td>
          <td class="cell-muted" style="white-space:nowrap;">${date}</td>
          <td>
            <button class="btn btn-danger" onclick="deleteRsvp(${row.id}, '${escHtml(row.guest_name)}')">
              Delete
            </button>
          </td>
        </tr>`;
    }).join('');

  } catch (err) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center;color:#999;padding:2rem;">
          Failed to load RSVPs. Please refresh.
        </td>
      </tr>`;
  }
}

// ----------------------------------------------------------
// 5. Delete RSVP
// ----------------------------------------------------------
async function deleteRsvp(id, name) {
  if (!confirm(`Delete RSVP from "${name}"? This cannot be undone.`)) return;

  try {
    const res = await fetch(`/api/admin/rsvps/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showDashboardMessage(`Deleted RSVP from ${name}.`, 'success');
      loadRsvps();
      loadStats();
    } else {
      showDashboardMessage('Failed to delete RSVP.', 'error');
    }
  } catch {
    showDashboardMessage('Network error. Please try again.', 'error');
  }
}

// ----------------------------------------------------------
// 6. Export CSV
// ----------------------------------------------------------
function exportCsv() {
  window.location.href = '/api/admin/rsvps/export';
}

// ----------------------------------------------------------
// 7. Dashboard messages
// ----------------------------------------------------------
function showDashboardMessage(msg, type = 'success') {
  const successEl = document.getElementById('dashboardSuccess');
  const errorEl   = document.getElementById('dashboardError');

  if (!successEl || !errorEl) return;

  successEl.classList.remove('visible');
  errorEl.classList.remove('visible');

  if (type === 'success') {
    successEl.textContent = msg;
    successEl.classList.add('visible');
    setTimeout(() => successEl.classList.remove('visible'), 4000);
  } else {
    errorEl.textContent = msg;
    errorEl.classList.add('visible');
    setTimeout(() => errorEl.classList.remove('visible'), 6000);
  }
}

// ----------------------------------------------------------
// Utilities
// ----------------------------------------------------------
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function truncate(str, len) {
  if (!str) return '';
  return str.length > len ? str.slice(0, len) + '…' : str;
}
