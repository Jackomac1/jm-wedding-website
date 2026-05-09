'use strict';

// ============================================================
// RSVP Page Logic
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {

  const rsvpClosed    = document.getElementById('rsvpClosed');
  const rsvpFormWrap  = document.getElementById('rsvpFormWrap');
  const rsvpForm      = document.getElementById('rsvpForm');
  const rsvpError     = document.getElementById('rsvpError');
  const rsvpSuccess   = document.getElementById('rsvpSuccess');
  const rsvpSubmitBtn = document.getElementById('rsvpSubmitBtn');
  const guestNameInput = document.getElementById('guestName');
  const guestNamesWrap = document.getElementById('guestNamesWrap');
  const dietaryWrap    = document.getElementById('dietaryWrap');
  const addGuestBtn    = document.getElementById('addGuestBtn');

  let tokenData = null;

  // ----------------------------------------------------------
  // 1. Check RSVP open/closed status
  // ----------------------------------------------------------
  try {
    const statusRes  = await fetch('/api/rsvp/status');
    const statusData = await statusRes.json();

    if (statusData.isOpen) {
      if (rsvpClosed)   rsvpClosed.classList.remove('visible');
      if (rsvpFormWrap) rsvpFormWrap.style.display = 'block';
    } else {
      if (rsvpClosed)   rsvpClosed.classList.add('visible');
      if (rsvpFormWrap) rsvpFormWrap.style.display = 'none';
      return; // Stop here — form not needed
    }
  } catch (err) {
    // On error, show the form anyway (fail open is safer for guests)
    console.warn('Could not fetch RSVP status:', err);
    if (rsvpFormWrap) rsvpFormWrap.style.display = 'block';
  }

  // ----------------------------------------------------------
  // 2. Check for token in URL params
  // ----------------------------------------------------------
  const urlParams = new URLSearchParams(window.location.search);
  const token     = urlParams.get('token');

  if (token) {
    try {
      const tokenRes = await fetch(`/api/rsvp/token/${encodeURIComponent(token)}`);
      if (tokenRes.ok) {
        tokenData = await tokenRes.json();
        // Pre-fill guest name
        if (guestNameInput && tokenData.guestName) {
          guestNameInput.value = tokenData.guestName;
        }
        // maxGuests from tokenData is used by renderGuestNames()
      }
    } catch (err) {
      console.warn('Could not validate token:', err);
    }
  }

  // ----------------------------------------------------------
  // 3. Load RSVP events from API and render checkboxes
  // ----------------------------------------------------------
  const songRequestWrap    = document.getElementById('songRequestWrap');
  const eventsWrap         = document.getElementById('eventsWrap');
  const eventsCheckboxes   = document.getElementById('eventsCheckboxes');
  let   rsvpEvents         = [];   // populated after API call
  let   defaultCheckedSlug = null; // first event with dayOrder === highest among wedding-day

  async function loadRsvpEvents() {
    try {
      const res    = await fetch('/api/rsvp/events');
      if (!res.ok) throw new Error();
      rsvpEvents = await res.json();
    } catch {
      rsvpEvents = [];
    }

    if (!rsvpEvents.length) {
      if (eventsCheckboxes) eventsCheckboxes.innerHTML = '<span style="color:#aaa;font-size:0.9rem;">No events configured yet.</span>';
      return;
    }

    const weddingEvent = rsvpEvents.find(e => e.slug === 'wedding');
    defaultCheckedSlug = weddingEvent ? weddingEvent.slug : null;

    // Group by dayOrder
    const groups = [];
    const map    = {};
    rsvpEvents.forEach(evt => {
      if (!map[evt.dayOrder]) {
        map[evt.dayOrder] = { dayDate: evt.dayDate, dayOrder: evt.dayOrder, events: [] };
        groups.push(map[evt.dayOrder]);
      }
      map[evt.dayOrder].events.push(evt);
    });
    groups.sort((a, b) => a.dayOrder - b.dayOrder);

    let html = '';
    groups.forEach(group => {
      html += '<div class="events-day">';
      html += '<div class="events-day-label">' + escText(group.dayDate) + '</div>';
      group.events.forEach(evt => {
        const checked = evt.slug === defaultCheckedSlug ? ' checked' : '';
        html += '<label class="check-label">';
        html += '<input type="checkbox" name="events" value="' + escText(evt.slug) + '" id="evt-' + escText(evt.slug) + '"' + checked + '>';
        html += ' ' + escText(evt.rsvpLabel || evt.title);
        html += '</label>';
      });
      html += '</div>';
    });

    if (eventsCheckboxes) eventsCheckboxes.innerHTML = html;
  }

  function escText(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Load events immediately (runs in parallel with rest of page setup)
  loadRsvpEvents();

  function updateAttendingFields() {
    const attendingYes = document.getElementById('attendingYes');
    const isYes = attendingYes && attendingYes.checked;

    if (guestNamesWrap) {
      guestNamesWrap.style.display = isYes ? 'block' : 'none';
      if (isYes) renderGuestNames();
    }
    if (eventsWrap)      eventsWrap.style.display      = isYes ? 'block' : 'none';
    if (dietaryWrap)     dietaryWrap.style.display     = isYes ? 'block' : 'none';
    if (songRequestWrap) songRequestWrap.style.display = isYes ? 'block' : 'none';

    if (!isYes) additionalGuests = [];

    // Reset all event checkboxes when switching to No; restore defaults for Yes
    if (!isYes) {
      document.querySelectorAll('input[name="events"]').forEach(cb => { cb.checked = false; });
    } else if (defaultCheckedSlug) {
      const defaultCb = document.getElementById('evt-' + defaultCheckedSlug);
      if (defaultCb) defaultCb.checked = true;
    }
  }

  document.querySelectorAll('input[name="attending"]').forEach(radio => {
    radio.addEventListener('change', updateAttendingFields);
  });

  // ── Guest names ──────────────────────────────────────────────
  let additionalGuests = [];

  function renderGuestNames() {
    const list = document.getElementById('guestNamesList');
    if (!list) return;
    const maxGuests = tokenData ? tokenData.maxGuests : 20;
    list.innerHTML = '';

    // Primary (read-only, mirrors the main name field)
    const primaryRow = document.createElement('div');
    primaryRow.style.cssText = 'display:flex;align-items:center;gap:0.5rem;';
    const primaryInput = document.createElement('input');
    primaryInput.type = 'text';
    primaryInput.className = 'form-input';
    primaryInput.value = guestNameInput ? guestNameInput.value.trim() : '';
    primaryInput.placeholder = 'Your name';
    primaryInput.readOnly = true;
    primaryInput.id = 'guestNameRow-primary';
    primaryInput.style.cssText = 'flex:1;cursor:default;opacity:0.75;';
    const youTag = document.createElement('span');
    youTag.textContent = 'You';
    youTag.style.cssText = 'font-size:0.8rem;color:var(--bluebell);min-width:30px;text-align:right;flex-shrink:0;';
    primaryRow.appendChild(primaryInput);
    primaryRow.appendChild(youTag);
    list.appendChild(primaryRow);

    // Additional guests
    additionalGuests.forEach((name, idx) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:0.5rem;';

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'form-input';
      input.value = name;
      input.placeholder = `Guest ${idx + 2} name`;
      input.style.flex = '1';
      input.addEventListener('input', () => { additionalGuests[idx] = input.value; });

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.innerHTML = '&times;';
      removeBtn.style.cssText = 'background:none;border:none;cursor:pointer;color:var(--berry);font-size:1.4rem;line-height:1;padding:0 0.25rem;flex-shrink:0;';
      removeBtn.setAttribute('aria-label', 'Remove guest');
      removeBtn.addEventListener('click', () => {
        additionalGuests.splice(idx, 1);
        renderGuestNames();
      });

      row.appendChild(input);
      row.appendChild(removeBtn);
      list.appendChild(row);
    });

    // Add-button visibility
    const total = 1 + additionalGuests.length;
    if (addGuestBtn) addGuestBtn.style.display = total >= maxGuests ? 'none' : '';

    // Max-guests message
    const limitEl = document.getElementById('guestNamesLimit');
    if (limitEl) {
      if (tokenData && tokenData.maxGuests && total >= tokenData.maxGuests) {
        limitEl.textContent = `Your invitation allows up to ${tokenData.maxGuests} guest(s).`;
        limitEl.style.display = '';
      } else {
        limitEl.style.display = 'none';
      }
    }
  }

  if (addGuestBtn) {
    addGuestBtn.addEventListener('click', () => {
      const maxGuests = tokenData ? tokenData.maxGuests : 20;
      if (1 + additionalGuests.length >= maxGuests) return;
      additionalGuests.push('');
      renderGuestNames();
      const inputs = document.querySelectorAll('#guestNamesList input[type="text"]:not([readonly])');
      if (inputs.length) inputs[inputs.length - 1].focus();
    });
  }

  if (guestNameInput) {
    guestNameInput.addEventListener('input', () => {
      const primaryInput = document.getElementById('guestNameRow-primary');
      if (primaryInput) primaryInput.value = guestNameInput.value.trim();
    });
  }

  // ----------------------------------------------------------
  // 3b. Song search
  // ----------------------------------------------------------
  const songSearch       = document.getElementById('songSearch');
  const songResults      = document.getElementById('songResults');
  const songSelected     = document.getElementById('songSelected');
  const songSelectedImg  = document.getElementById('songSelectedImg');
  const songSelectedName = document.getElementById('songSelectedName');
  const songSelectedArtist = document.getElementById('songSelectedArtist');
  const songClearBtn     = document.getElementById('songClearBtn');
  const songUriInput     = document.getElementById('songUri');
  const songNameInput    = document.getElementById('songName');

  let searchTimeout = null;

  function selectSong(track) {
    songUriInput.value  = track.uri;
    songNameInput.value = track.name + ' — ' + track.artist;
    songSelectedName.textContent   = track.name;
    songSelectedArtist.textContent = track.artist;
    songSelectedImg.src = track.image || '';
    songSelectedImg.style.display = track.image ? 'block' : 'none';
    songSelected.style.display = 'flex';
    songSearch.style.display   = 'none';
    songResults.innerHTML      = '';
    songResults.classList.remove('visible');
  }

  function clearSong() {
    songUriInput.value  = '';
    songNameInput.value = '';
    songSearch.value    = '';
    songSelected.style.display = 'none';
    songSearch.style.display   = 'block';
    songSearch.focus();
  }

  if (songClearBtn) songClearBtn.addEventListener('click', clearSong);

  if (songSearch) {
    songSearch.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      const q = songSearch.value.trim();
      if (q.length < 2) {
        songResults.innerHTML = '';
        songResults.classList.remove('visible');
        return;
      }
      searchTimeout = setTimeout(async () => {
        try {
          const res  = await fetch(`/api/spotify/search?q=${encodeURIComponent(q)}`);
          const data = await res.json();
          songResults.innerHTML = '';
          if (!data.tracks || !data.tracks.length) {
            songResults.classList.remove('visible');
            return;
          }
          data.tracks.forEach(track => {
            const li = document.createElement('li');
            li.setAttribute('role', 'option');
            li.className = 'song-result-item';
            li.innerHTML = `
              ${track.image ? `<img src="${track.image}" alt="" width="36" height="36">` : ''}
              <div class="song-result-info">
                <span class="song-result-name">${track.name}</span>
                <span class="song-result-artist">${track.artist}</span>
              </div>
            `;
            li.addEventListener('click', () => selectSong(track));
            songResults.appendChild(li);
          });
          songResults.classList.add('visible');
        } catch (err) {
          console.warn('Song search failed:', err);
        }
      }, 350);
    });

    // Close results when clicking outside
    document.addEventListener('click', (e) => {
      if (!songSearch.contains(e.target) && !songResults.contains(e.target)) {
        songResults.classList.remove('visible');
      }
    });
  }

  // ----------------------------------------------------------
  // 4. Form submission
  // ----------------------------------------------------------
  if (!rsvpForm) return;

  rsvpForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    rsvpError.classList.remove('visible');
    rsvpError.textContent = '';

    // Validate required fields
    const guestName = guestNameInput ? guestNameInput.value.trim() : '';
    const attendingRadio = document.querySelector('input[name="attending"]:checked');

    if (!guestName) {
      showError('Please enter your full name.');
      guestNameInput && guestNameInput.focus();
      return;
    }

    if (!attendingRadio) {
      showError('Please let us know if you will be attending.');
      return;
    }

    const attending = attendingRadio.value;

    // Collect checked events
    const checkedEvents = attending === 'yes'
      ? [...document.querySelectorAll('input[name="events"]:checked')].map(cb => cb.value)
      : [];

    // Build payload
    const payload = {
      guest_name:           guestName,
      email:                document.getElementById('email')?.value.trim() || '',
      phone:                document.getElementById('phone')?.value.trim() || '',
      attending:            attending,
      guest_names:          attending === 'yes' ? [guestName, ...additionalGuests.map(n => n.trim()).filter(Boolean)] : [],
      guest_count:          attending === 'yes' ? 1 + additionalGuests.filter(n => n.trim()).length : 1,
      dietary_restrictions: attending === 'yes' ? (document.getElementById('dietary')?.value.trim() || '') : '',
      events:               checkedEvents,
      message:              document.getElementById('message')?.value.trim() || '',
      token:                token || '',
      song_uri:             attending === 'yes' ? (document.getElementById('songUri')?.value || '') : '',
      song_name:            attending === 'yes' ? (document.getElementById('songName')?.value || '') : ''
    };

    // Validate guest count against token limit
    if (tokenData && tokenData.maxGuests && payload.guest_count > tokenData.maxGuests) {
      showError(`Your invitation allows up to ${tokenData.maxGuests} guest(s).`);
      return;
    }

    // Disable button while submitting
    if (rsvpSubmitBtn) {
      rsvpSubmitBtn.disabled    = true;
      rsvpSubmitBtn.textContent = 'Submitting…';
    }

    try {
      const res  = await fetch('/api/rsvp', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload)
      });

      const data = await res.json();

      if (res.ok && data.success) {
        // Show success, hide form
        if (rsvpForm)    rsvpForm.style.display    = 'none';
        if (rsvpSuccess) rsvpSuccess.classList.add('visible');
        window.scrollTo({ top: rsvpSuccess.getBoundingClientRect().top + window.scrollY - 100, behavior: 'smooth' });
      } else {
        showError(data.error || 'Something went wrong. Please try again.');
      }
    } catch (err) {
      showError('Network error. Please check your connection and try again.');
    } finally {
      if (rsvpSubmitBtn) {
        rsvpSubmitBtn.disabled    = false;
        rsvpSubmitBtn.textContent = 'Send My RSVP';
      }
    }
  });

  // ----------------------------------------------------------
  // Helpers
  // ----------------------------------------------------------
  function showError(msg) {
    if (!rsvpError) return;
    rsvpError.textContent = msg;
    rsvpError.classList.add('visible');
    rsvpError.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
});
