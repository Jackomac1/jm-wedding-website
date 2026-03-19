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
  const guestCountWrap = document.getElementById('guestCountWrap');
  const dietaryWrap    = document.getElementById('dietaryWrap');
  const guestCountInput = document.getElementById('guestCount');

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
        // Set max guests limit
        if (guestCountInput && tokenData.maxGuests) {
          guestCountInput.max   = tokenData.maxGuests;
          guestCountInput.value = 1;
        }
      }
    } catch (err) {
      console.warn('Could not validate token:', err);
    }
  }

  // ----------------------------------------------------------
  // 3. Attending radio: show/hide guest count, dietary & song
  // ----------------------------------------------------------
  const songRequestWrap = document.getElementById('songRequestWrap');

  function updateAttendingFields() {
    const attendingYes = document.getElementById('attendingYes');
    const isYes = attendingYes && attendingYes.checked;

    if (guestCountWrap)  guestCountWrap.style.display  = isYes ? 'block' : 'none';
    if (dietaryWrap)     dietaryWrap.style.display     = isYes ? 'block' : 'none';
    if (songRequestWrap) songRequestWrap.style.display = isYes ? 'block' : 'none';

    if (!isYes && guestCountInput) {
      guestCountInput.value = 1;
    }
  }

  document.querySelectorAll('input[name="attending"]').forEach(radio => {
    radio.addEventListener('change', updateAttendingFields);
  });

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

    // Build payload
    const payload = {
      guest_name:           guestName,
      email:                document.getElementById('email')?.value.trim() || '',
      phone:                document.getElementById('phone')?.value.trim() || '',
      attending:            attending,
      guest_count:          attending === 'yes' ? (parseInt(guestCountInput?.value, 10) || 1) : 1,
      dietary_restrictions: attending === 'yes' ? (document.getElementById('dietary')?.value.trim() || '') : '',
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
