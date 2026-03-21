'use strict';

// ============================================================
// Admin Dashboard JavaScript
// Used by: admin/dashboard.html
// ============================================================

// Populated by loadStats() — used by loadRsvps() for the Events column
let eventLabels = {};

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

    // Cache labels for use by loadRsvps
    if (data.eventLabels) eventLabels = data.eventLabels;

    // Event breakdown
    const breakdown = document.getElementById('eventBreakdown');
    if (breakdown) {
      const entries = data.eventLabels ? Object.entries(data.eventLabels) : [];
      if (!entries.length) {
        breakdown.innerHTML = '<span style="color:var(--admin-muted);font-size:0.875rem;">No RSVP events configured.</span>';
      } else {
        breakdown.innerHTML = entries.map(([id, label]) => {
          const count = (data.eventCounts && data.eventCounts[id]) || 0;
          return `
            <div style="background:var(--admin-bg);border:1px solid var(--admin-border);border-radius:var(--radius-sm);padding:0.6rem 0.875rem;display:flex;justify-content:space-between;align-items:center;gap:0.5rem;">
              <span style="font-size:0.82rem;color:var(--admin-text);">${label}</span>
              <span style="font-size:1.1rem;font-weight:700;color:var(--admin-accent);min-width:2ch;text-align:right;">${count}</span>
            </div>`;
        }).join('');
      }
    }

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
      <td colspan="9">
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
          <td colspan="9">
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

      const eventNames = (row.events || []).map(id => eventLabels[id] || id).join(', ');

      return `
        <tr>
          <td class="cell-name">${escHtml(row.guest_name)}</td>
          <td class="cell-muted cell-wrap">${escHtml(row.email || '—')}</td>
          <td>${badge}</td>
          <td>${attending ? row.guest_count : '—'}</td>
          <td class="cell-muted cell-wrap" title="${escHtml(eventNames)}">${attending ? escHtml(truncate(eventNames, 50)) || '—' : '—'}</td>
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
        <td colspan="9" style="text-align:center;color:#999;padding:2rem;">
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
// 6. Song Requests
// ----------------------------------------------------------
async function loadSongRequests() {
  const el = document.getElementById('songRequestsList');
  if (!el) return;

  try {
    const res  = await fetch('/api/admin/rsvps');
    if (!res.ok) throw new Error();
    const rows = await res.json();

    const songs = rows.filter(r => r.attending === 'yes' && r.song_name);

    if (!songs.length) {
      el.innerHTML = '<span style="color:var(--admin-muted);font-size:0.875rem;">No song requests yet.</span>';
      return;
    }

    el.innerHTML = `
      <table class="admin-table" style="min-width:0;">
        <thead>
          <tr>
            <th scope="col">Guest</th>
            <th scope="col">Song</th>
            <th scope="col">Spotify URI</th>
          </tr>
        </thead>
        <tbody>
          ${songs.map(r => `
            <tr>
              <td class="cell-name">${escHtml(r.guest_name)}</td>
              <td>${escHtml(r.song_name)}</td>
              <td class="cell-muted" style="font-size:0.8rem;word-break:break-all;">${escHtml(r.song_uri || '—')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;
  } catch {
    el.innerHTML = '<span style="color:var(--admin-muted);font-size:0.875rem;">Failed to load song requests.</span>';
  }
}

// ----------------------------------------------------------
// 7. Export CSV
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
