'use strict';

require('dotenv').config();

const express = require('express');
const session = require('express-session');
const bcrypt  = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const QRCode      = require('qrcode');
const multer      = require('multer');
const { Resend }  = require('resend');
const axios       = require('axios');
const path    = require('path');
const fs      = require('fs');

const app  = express();
const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------------------------
// JSON "database" — stored in data/db.json
// ---------------------------------------------------------------------------
const dataDir  = path.join(__dirname, 'data');
const dbFile   = path.join(dataDir, 'db.json');
const imagesDir = path.join(__dirname, 'Images');

if (!fs.existsSync(dataDir))   fs.mkdirSync(dataDir,   { recursive: true });
if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });

function readDb() {
  if (!fs.existsSync(dbFile)) return null;
  return JSON.parse(fs.readFileSync(dbFile, 'utf8'));
}

function writeDb(data) {
  fs.writeFileSync(dbFile, JSON.stringify(data, null, 2), 'utf8');
}

function getDb() {
  let db = readDb();
  let changed = false;

  if (!db) {
    const sitePassword  = process.env.SITE_PASSWORD  || 'wedding2025';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    db = {
      settings: {
        rsvp_open:      false,
        site_password:  bcrypt.hashSync(sitePassword,  12),
        admin_password: bcrypt.hashSync(adminPassword, 12)
      },
      rsvps:       [],
      guestTokens: []
    };
    changed = true;
    console.log('Created fresh database at', dbFile);
  }

  // Migrate: add gallery if missing
  if (!db.gallery) {
    db.gallery = [];
    changed = true;
  }

  // Migrate: add weddingParty if missing
  if (!db.weddingParty) {
    db.weddingParty = {
      bridal: [
        { slot: 'moh-1',        role: 'Maid of Honour', name: '', description: '', photo: null },
        { slot: 'moh-2',        role: 'Maid of Honour', name: '', description: '', photo: null },
        { slot: 'bridesmaid-1', role: 'Bridesmaid',     name: '', description: '', photo: null },
        { slot: 'bridesmaid-2', role: 'Bridesmaid',     name: '', description: '', photo: null },
        { slot: 'bridesmaid-3', role: 'Bridesmaid',     name: '', description: '', photo: null },
        { slot: 'bridesmaid-4', role: 'Bridesmaid',     name: '', description: '', photo: null },
        { slot: 'bridesmaid-5', role: 'Bridesmaid',     name: '', description: '', photo: null }
      ],
      groomsmen: [
        { slot: 'bestman-1',   role: 'Best Man',  name: '', description: '', photo: null },
        { slot: 'bestman-2',   role: 'Best Man',  name: '', description: '', photo: null },
        { slot: 'groomsman-1', role: 'Groomsman', name: '', description: '', photo: null },
        { slot: 'groomsman-2', role: 'Groomsman', name: '', description: '', photo: null },
        { slot: 'groomsman-3', role: 'Groomsman', name: '', description: '', photo: null },
        { slot: 'groomsman-4', role: 'Groomsman', name: '', description: '', photo: null },
        { slot: 'groomsman-5', role: 'Groomsman', name: '', description: '', photo: null }
      ]
    };
    changed = true;
  }

  // Migrate: add scheduleEvents if missing
  if (!db.scheduleEvents) {
    db.scheduleEvents = [
      {
        id: 1, slug: 'welcome-reception',
        title: 'Welcome Reception', time: 'Evening',
        dayLabel: 'Day One', dayDate: 'Friday, August 27, 2027', dayOrder: 1, sortOrder: 1,
        description: 'Details coming soon. Stay tuned!',
        venue: 'Location TBD', address: 'Details coming soon.', mapsUrl: '',
        showOnRsvp: true, rsvpLabel: 'Welcome Reception'
      },
      {
        id: 2, slug: 'rehearsal-dinner',
        title: 'Rehearsal Dinner', time: 'Evening',
        dayLabel: 'Day One', dayDate: 'Friday, August 27, 2027', dayOrder: 1, sortOrder: 2,
        description: 'Details coming soon. Stay tuned!',
        venue: 'Location TBD', address: 'Details coming soon.', mapsUrl: '',
        showOnRsvp: true, rsvpLabel: 'Rehearsal Dinner'
      },
      {
        id: 3, slug: 'saturday-activities',
        title: 'Activities & Exploring', time: 'All Day',
        dayLabel: 'Day Two', dayDate: 'Saturday, August 28, 2027', dayOrder: 2, sortOrder: 1,
        description: 'Details coming soon. Stay tuned!',
        venue: 'Location TBD', address: 'Details coming soon.', mapsUrl: '',
        showOnRsvp: true, rsvpLabel: 'Activities & Exploring'
      },
      {
        id: 4, slug: 'doors-open',
        title: 'Doors Open — Guest Arrival', time: '3:30 PM',
        dayLabel: 'Day Three — The Big Day', dayDate: 'Sunday, August 29, 2027', dayOrder: 3, sortOrder: 1,
        description: 'Stewart Creek Golf & Country Club\n4100 Stewart Creek Dr, Canmore, AB\n\nPlease arrive and find your seat before the ceremony begins. Ushers will be on hand to help.',
        venue: 'Stewart Creek Golf & Country Club', address: '4100 Stewart Creek Dr\nCanmore, AB T1W 2V3',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=4100+Stewart+Creek+Dr+Canmore+AB+T1W+2V3',
        showOnRsvp: false, rsvpLabel: ''
      },
      {
        id: 5, slug: 'wedding',
        title: 'Ceremony', time: '4:00 PM',
        dayLabel: 'Day Three — The Big Day', dayDate: 'Sunday, August 29, 2027', dayOrder: 3, sortOrder: 2,
        description: 'Stewart Creek Golf & Country Club\n\nJack and Maja say "I Do." Approximately 30-45 minutes.',
        venue: 'Stewart Creek Golf & Country Club', address: '4100 Stewart Creek Dr\nCanmore, AB T1W 2V3',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=4100+Stewart+Creek+Dr+Canmore+AB+T1W+2V3',
        showOnRsvp: true, rsvpLabel: 'Ceremony & Reception'
      },
      {
        id: 6, slug: 'photos-mingling',
        title: 'Photos & Mingling', time: '5:00 PM',
        dayLabel: 'Day Three — The Big Day', dayDate: 'Sunday, August 29, 2027', dayOrder: 3, sortOrder: 3,
        description: 'Make your way to Bridgette Bar Canmore for the start of the evening. Rideshares and personal vehicles welcome.',
        venue: 'Bridgette Bar Canmore', address: '1030 Spring Creek Dr\nCanmore, AB T1W 0C8',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=1030+Spring+Creek+Dr+Canmore+AB+T1W+0C8',
        showOnRsvp: false, rsvpLabel: ''
      },
      {
        id: 7, slug: 'cocktail-hour',
        title: 'Cocktail Hour', time: '5:30 PM',
        dayLabel: 'Day Three — The Big Day', dayDate: 'Sunday, August 29, 2027', dayOrder: 3, sortOrder: 4,
        description: 'Bridgette Bar Canmore\n1030 Spring Creek Dr, Canmore, AB\n\nDrinks, appetizers, and good company.',
        venue: 'Bridgette Bar Canmore', address: '1030 Spring Creek Dr\nCanmore, AB T1W 0C8',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=1030+Spring+Creek+Dr+Canmore+AB+T1W+0C8',
        showOnRsvp: false, rsvpLabel: ''
      },
      {
        id: 8, slug: 'dinner-speeches',
        title: 'Dinner & Speeches', time: '6:30 PM',
        dayLabel: 'Day Three — The Big Day', dayDate: 'Sunday, August 29, 2027', dayOrder: 3, sortOrder: 5,
        description: 'Bridgette Bar Canmore\n\nSit-down dinner with toasts from the wedding party.',
        venue: 'Bridgette Bar Canmore', address: '1030 Spring Creek Dr\nCanmore, AB T1W 0C8',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=1030+Spring+Creek+Dr+Canmore+AB+T1W+0C8',
        showOnRsvp: false, rsvpLabel: ''
      },
      {
        id: 9, slug: 'dancing',
        title: 'Dancing & Celebration', time: 'Evening',
        dayLabel: 'Day Three — The Big Day', dayDate: 'Sunday, August 29, 2027', dayOrder: 3, sortOrder: 6,
        description: 'Bridgette Bar Canmore\n\nThe dance floor opens. Celebrate with us all night long.',
        venue: 'Bridgette Bar Canmore', address: '1030 Spring Creek Dr\nCanmore, AB T1W 0C8',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=1030+Spring+Creek+Dr+Canmore+AB+T1W+0C8',
        showOnRsvp: false, rsvpLabel: ''
      },
      {
        id: 10, slug: 'last-dance',
        title: 'Last Dance', time: '1:00 AM',
        dayLabel: 'Day Three — The Big Day', dayDate: 'Sunday, August 29, 2027', dayOrder: 3, sortOrder: 7,
        description: 'The night wraps up at 1:00 AM. Thank you for celebrating with us — we cannot wait to dance with you.',
        venue: 'Bridgette Bar Canmore', address: '1030 Spring Creek Dr\nCanmore, AB T1W 0C8',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=1030+Spring+Creek+Dr+Canmore+AB+T1W+0C8',
        showOnRsvp: false, rsvpLabel: ''
      },
      {
        id: 11, slug: 'farewell-brunch',
        title: 'Farewell Brunch', time: 'Morning',
        dayLabel: 'Day Four', dayDate: 'Monday, August 30, 2027', dayOrder: 4, sortOrder: 1,
        description: 'Details coming soon. Stay tuned!',
        venue: 'Location TBD', address: 'Details coming soon.', mapsUrl: '',
        showOnRsvp: true, rsvpLabel: 'Farewell Brunch'
      }
    ];
    changed = true;
  }

  if (changed) writeDb(db);
  return db;
}

// Initialise on startup
getDb();

// ---------------------------------------------------------------------------
// File upload (multer)
// ---------------------------------------------------------------------------
const upload = multer({
  storage: multer.diskStorage({
    destination: imagesDir,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, `_tmp-${Date.now()}${ext}`);
    }
  }),
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) return cb(null, true);
    cb(new Error('Only image files are allowed'));
  },
  limits: { fileSize: 15 * 1024 * 1024 } // 15 MB
});

// Site photo slot → filename map
const SITE_PHOTO_SLOTS = {
  home:            'photo-home.jpg',
  details:         'photo-details.jpg',
  rsvp:            'photo-rsvp.jpg',
  registry:        'photo-registry.jpg',
  contact:         'photo-contact.jpg',
  dresscode:       'photo-dresscode.jpg',
  'home-mobile':     'photo-home-mobile.jpg',
  'details-mobile':  'photo-details-mobile.jpg',
  'rsvp-mobile':     'photo-rsvp-mobile.jpg',
  'registry-mobile': 'photo-registry-mobile.jpg',
  'contact-mobile':  'photo-contact-mobile.jpg'
};

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret:            process.env.SESSION_SECRET || 'fallback-dev-secret-change-me',
  resave:            false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 1000 * 60 * 60 * 24 }
}));

app.use('/CSS',    express.static(path.join(__dirname, 'CSS')));
app.use('/JS',     express.static(path.join(__dirname, 'JS')));
app.use('/Images', express.static(path.join(__dirname, 'Images')));

// ---------------------------------------------------------------------------
// Auth middleware
// ---------------------------------------------------------------------------
function requireSiteAuth(req, res, next) {
  if (req.session && req.session.siteAuthenticated) return next();
  res.redirect('/enter');
}

function requireAdminAuth(req, res, next) {
  if (req.session && req.session.adminAuthenticated) return next();
  res.redirect('/admin/login');
}

// ---------------------------------------------------------------------------
// Page routes
// ---------------------------------------------------------------------------
app.get('/', (req, res) => res.redirect('/enter'));

app.get('/enter', (req, res) => {
  if (req.session && req.session.siteAuthenticated) return res.redirect('/home');
  res.sendFile(path.join(__dirname, 'enter.html'));
});

app.get('/home',         requireSiteAuth, (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/details',      requireSiteAuth, (req, res) => res.sendFile(path.join(__dirname, 'details.html')));
app.get('/registry',     requireSiteAuth, (req, res) => res.sendFile(path.join(__dirname, 'registry.html')));
app.get('/rsvp',         requireSiteAuth, (req, res) => res.sendFile(path.join(__dirname, 'rsvp.html')));
app.get('/contact',      requireSiteAuth, (req, res) => res.sendFile(path.join(__dirname, 'contact.html')));
app.get('/gallery',      requireSiteAuth, (req, res) => res.sendFile(path.join(__dirname, 'gallery.html')));
app.get('/wedding-party',requireSiteAuth, (req, res) => res.sendFile(path.join(__dirname, 'wedding-party.html')));
app.get('/schedule',     requireSiteAuth, (req, res) => res.sendFile(path.join(__dirname, 'schedule.html')));

app.get('/admin/login', (req, res) => {
  if (req.session && req.session.adminAuthenticated) return res.redirect('/admin/dashboard');
  res.sendFile(path.join(__dirname, 'admin', 'login.html'));
});

app.get('/admin',              requireAdminAuth, (req, res) => res.redirect('/admin/dashboard'));
app.get('/admin/dashboard',    requireAdminAuth, (req, res) => res.sendFile(path.join(__dirname, 'admin', 'dashboard.html')));
app.get('/admin/qr-generator', requireAdminAuth, (req, res) => res.sendFile(path.join(__dirname, 'admin', 'qr-generator.html')));
app.get('/admin/photos',       requireAdminAuth, (req, res) => res.sendFile(path.join(__dirname, 'admin', 'photos.html')));
app.get('/admin/schedule',     requireAdminAuth, (req, res) => res.sendFile(path.join(__dirname, 'admin', 'schedule.html')));

// ---------------------------------------------------------------------------
// API — authentication
// ---------------------------------------------------------------------------
app.post('/api/auth/site', (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Password required' });

  const db = getDb();
  if (!bcrypt.compareSync(password, db.settings.site_password)) {
    return res.status(401).json({ error: 'Incorrect password' });
  }

  req.session.siteAuthenticated = true;
  res.json({ success: true });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.siteAuthenticated = false;
  res.json({ success: true });
});

app.post('/api/admin/auth', (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Password required' });

  const db = getDb();
  if (!bcrypt.compareSync(password, db.settings.admin_password)) {
    return res.status(401).json({ error: 'Incorrect password' });
  }

  req.session.adminAuthenticated = true;
  res.json({ success: true });
});

app.post('/api/admin/logout', (req, res) => {
  req.session.adminAuthenticated = false;
  res.json({ success: true });
});

// ---------------------------------------------------------------------------
// Mailer (Resend)
// ---------------------------------------------------------------------------
const resend = new Resend(process.env.RESEND_API_KEY);

// ---------------------------------------------------------------------------
// API — Contact form
// ---------------------------------------------------------------------------
app.post('/api/contact', async (req, res) => {
  const { name, email, message } = req.body;
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Name, email, and message are required.' });
  }

  try {
    await resend.emails.send({
      from:     'Wedding Website <noreply@majaandjack.ca>',
      to:       'majaandjack@gmail.com',
      reply_to: email,
      subject:  `Wedding website message from ${name}`,
      text:     `Name: ${name}\nEmail: ${email}\n\n${message}`
    });
    res.json({ success: true });
  } catch (err) {
    console.error('Contact email failed:', err.message);
    res.status(500).json({ error: 'Failed to send message. Please try emailing us directly.' });
  }
});

// ---------------------------------------------------------------------------
// Spotify
// ---------------------------------------------------------------------------
const SPOTIFY_SCOPES = 'playlist-modify-public playlist-modify-private';

async function getSpotifyAccessToken() {
  const db = getDb();
  const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN || db.settings.spotifyRefreshToken;
  if (!refreshToken) throw new Error('Spotify not authorized');

  const response = await axios.post('https://accounts.spotify.com/api/token',
    new URLSearchParams({
      grant_type:    'refresh_token',
      refresh_token: refreshToken
    }),
    {
      headers: {
        'Content-Type':  'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(
          process.env.SPOTIFY_CLIENT_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET
        ).toString('base64')
      }
    }
  );
  console.log('Spotify token scopes:', response.data.scope);
  return response.data.access_token;
}

async function addTrackToPlaylist(trackUri) {
  const token = await getSpotifyAccessToken();
  await axios.post(
    `https://api.spotify.com/v1/playlists/${process.env.SPOTIFY_PLAYLIST_ID}/tracks`,
    { uris: [trackUri] },
    { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
  );
}

// One-time admin auth to authorize Spotify
app.get('/api/spotify/auth', requireAdminAuth, (req, res) => {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id:     process.env.SPOTIFY_CLIENT_ID,
    scope:         SPOTIFY_SCOPES,
    redirect_uri:  `${process.env.SITE_URL}/api/spotify/callback`
  });
  res.redirect(`https://accounts.spotify.com/authorize?${params}`);
});

app.get('/api/spotify/callback', requireAdminAuth, async (req, res) => {
  const { code, error } = req.query;
  if (error) return res.send(`Spotify auth error: ${error}`);

  try {
    const response = await axios.post('https://accounts.spotify.com/api/token',
      new URLSearchParams({
        grant_type:   'authorization_code',
        code,
        redirect_uri: `${process.env.SITE_URL}/api/spotify/callback`
      }),
      {
        headers: {
          'Content-Type':  'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + Buffer.from(
            process.env.SPOTIFY_CLIENT_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET
          ).toString('base64')
        }
      }
    );

    const refreshToken = response.data.refresh_token;

    // Save to db for local use
    const db = getDb();
    db.settings.spotifyRefreshToken = refreshToken;
    writeDb(db);

    res.send(`
      <h2>Spotify authorized!</h2>
      <p>Add this as a Railway environment variable:</p>
      <p><strong>SPOTIFY_REFRESH_TOKEN</strong></p>
      <code style="display:block;padding:1rem;background:#f4f4f4;word-break:break-all;">${refreshToken}</code>
      <p>After adding it in Railway, redeploy and song requests will work.</p>
    `);
  } catch (err) {
    console.error('Spotify callback error:', err.response?.data || err.message);
    res.status(500).send('Failed to authorize Spotify. Check server logs.');
  }
});

// Diagnostic test endpoint
app.get('/api/spotify/test', requireAdminAuth, async (req, res) => {
  const result = { playlistId: process.env.SPOTIFY_PLAYLIST_ID };
  try {
    const token = await getSpotifyAccessToken();
    result.tokenOk = true;

    // Step 1: get current user
    const meRes = await axios.get('https://api.spotify.com/v1/me',
      { headers: { Authorization: `Bearer ${token}` } });
    result.userId = meRes.data.id;

    // Step 2: get playlist info
    const playlistRes = await axios.get(
      `https://api.spotify.com/v1/playlists/${process.env.SPOTIFY_PLAYLIST_ID}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    result.playlist = { name: playlistRes.data.name, owner: playlistRes.data.owner.id, public: playlistRes.data.public };

    // Step 3: try creating a brand new playlist
    const createRes = await fetch(
      `https://api.spotify.com/v1/users/${meRes.data.id}/playlists`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'API Write Test', public: false })
      }
    );
    const createData = await createRes.json();
    result.createStatus = createRes.status;
    result.createResult = createData.id || createData.error;

    // Step 4: add a track to existing playlist
    const addRes = await fetch(
      `https://api.spotify.com/v1/playlists/${process.env.SPOTIFY_PLAYLIST_ID}/tracks`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ uris: ['spotify:track:7tFiyTwD0nx5a1eklYtX2J'] })
      }
    );
    const addData = await addRes.json();
    result.addStatus = addRes.status;
    result.addResult = addData;

    res.json(result);
  } catch (err) {
    res.status(500).json({ ...result, error: err.message, details: err.response?.data });
  }
});

// Song search — used by RSVP form
app.get('/api/spotify/search', async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 2) return res.json({ tracks: [] });

  try {
    const token = await getSpotifyAccessToken();
    const response = await axios.get('https://api.spotify.com/v1/search', {
      params:  { q, type: 'track', limit: 5 },
      headers: { Authorization: `Bearer ${token}` }
    });

    const tracks = response.data.tracks.items.map(t => ({
      uri:    t.uri,
      name:   t.name,
      artist: t.artists.map(a => a.name).join(', '),
      image:  t.album.images[2]?.url || t.album.images[0]?.url || null
    }));

    res.json({ tracks });
  } catch (err) {
    console.error('Spotify search error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Search failed' });
  }
});

// ---------------------------------------------------------------------------
// API — RSVP (public)
// ---------------------------------------------------------------------------
app.get('/api/rsvp/status', (req, res) => {
  const db = getDb();
  res.json({ isOpen: db.settings.rsvp_open === true });
});

app.get('/api/rsvp/token/:token', (req, res) => {
  const db  = getDb();
  const tok = db.guestTokens.find(t => t.token === req.params.token);
  if (!tok) return res.status(404).json({ error: 'Token not found' });
  res.json({ guestName: tok.guestName, groupName: tok.groupName, maxGuests: tok.maxGuests });
});

app.post('/api/rsvp', async (req, res) => {
  const db = getDb();
  if (!db.settings.rsvp_open) {
    return res.status(403).json({ error: 'RSVP is currently closed' });
  }

  const { guest_name, email, phone, attending, guest_count, dietary_restrictions, events, message, token, song_uri, song_name } = req.body;

  if (!guest_name || !attending) {
    return res.status(400).json({ error: 'Name and attendance are required' });
  }

  const att = attending.toLowerCase();
  if (!['yes', 'no'].includes(att)) {
    return res.status(400).json({ error: 'Invalid attendance value' });
  }

  if (token) {
    const tok = db.guestTokens.find(t => t.token === token);
    if (tok) {
      const count = parseInt(guest_count, 10) || 1;
      if (count > tok.maxGuests) {
        return res.status(400).json({ error: `Maximum ${tok.maxGuests} guest(s) allowed for this invitation` });
      }
    }
  }

  const id = db.rsvps.length ? Math.max(...db.rsvps.map(r => r.id)) + 1 : 1;
  db.rsvps.push({
    id,
    guest_name,
    email:                email || null,
    phone:                phone || null,
    attending:            att,
    guest_count:          parseInt(guest_count, 10) || 1,
    dietary_restrictions: dietary_restrictions || null,
    message:              message || null,
    token:                token || null,
    events:               Array.isArray(events) ? events : [],
    song_uri:             song_uri || null,
    song_name:            song_name || null,
    submitted_at:         new Date().toISOString()
  });
  writeDb(db);

  // Add song to Spotify playlist if provided and guest is attending
  const hasSpotifyToken = process.env.SPOTIFY_REFRESH_TOKEN || db.settings.spotifyRefreshToken;
  if (att === 'yes' && song_uri && hasSpotifyToken) {
    try {
      await addTrackToPlaylist(song_uri);
    } catch (err) {
      console.error('Spotify add track failed:', err.message, err.response?.data);
      // Don't fail the RSVP if Spotify fails
    }
  }

  res.json({ success: true, message: 'RSVP submitted successfully' });
});

// ---------------------------------------------------------------------------
// API — Gallery & Party (site-auth — for guest-facing pages)
// ---------------------------------------------------------------------------
app.get('/api/gallery', requireSiteAuth, (req, res) => {
  const db = getDb();
  res.json(db.gallery);
});

app.get('/api/party', requireSiteAuth, (req, res) => {
  const db = getDb();
  res.json(db.weddingParty);
});

// ---------------------------------------------------------------------------
// API — Schedule (public / site-auth)
// ---------------------------------------------------------------------------
app.get('/api/schedule', requireSiteAuth, (req, res) => {
  const db = getDb();
  const sorted = [...db.scheduleEvents].sort((a, b) => a.dayOrder - b.dayOrder || a.sortOrder - b.sortOrder);
  res.json(sorted);
});

// Events that appear on the RSVP form (no auth — needed before form submission)
app.get('/api/rsvp/events', (req, res) => {
  const db = getDb();
  const events = (db.scheduleEvents || [])
    .filter(e => e.showOnRsvp)
    .sort((a, b) => a.dayOrder - b.dayOrder || a.sortOrder - b.sortOrder);
  res.json(events);
});

// ---------------------------------------------------------------------------
// API — Admin: Schedule events CRUD
// ---------------------------------------------------------------------------
app.get('/api/admin/events', requireAdminAuth, (req, res) => {
  const db = getDb();
  const sorted = [...db.scheduleEvents].sort((a, b) => a.dayOrder - b.dayOrder || a.sortOrder - b.sortOrder);
  res.json(sorted);
});

app.post('/api/admin/events', requireAdminAuth, (req, res) => {
  const db = getDb();
  const { slug, title, time, dayLabel, dayDate, dayOrder, sortOrder, description, venue, address, mapsUrl, showOnRsvp, rsvpLabel } = req.body;
  if (!title || !dayDate) return res.status(400).json({ error: 'Title and day date are required' });

  const id = db.scheduleEvents.length ? Math.max(...db.scheduleEvents.map(e => e.id)) + 1 : 1;
  const generatedSlug = (slug || title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const event = {
    id,
    slug:        generatedSlug,
    title,
    time:        time        || '',
    dayLabel:    dayLabel    || '',
    dayDate,
    dayOrder:    parseInt(dayOrder,  10) || 1,
    sortOrder:   parseInt(sortOrder, 10) || 1,
    description: description || '',
    venue:       venue       || '',
    address:     address     || '',
    mapsUrl:     mapsUrl     || '',
    showOnRsvp:  showOnRsvp === true || showOnRsvp === 'true',
    rsvpLabel:   rsvpLabel   || ''
  };
  db.scheduleEvents.push(event);
  writeDb(db);
  res.json({ success: true, event });
});

app.put('/api/admin/events/:id', requireAdminAuth, (req, res) => {
  const db  = getDb();
  const idx = db.scheduleEvents.findIndex(e => e.id === parseInt(req.params.id, 10));
  if (idx === -1) return res.status(404).json({ error: 'Event not found' });

  const evt = db.scheduleEvents[idx];
  const fields = ['slug','title','time','dayLabel','dayDate','description','venue','address','mapsUrl','rsvpLabel'];
  fields.forEach(f => { if (req.body[f] !== undefined) evt[f] = req.body[f]; });

  if (req.body.dayOrder  !== undefined) evt.dayOrder  = parseInt(req.body.dayOrder,  10);
  if (req.body.sortOrder !== undefined) evt.sortOrder = parseInt(req.body.sortOrder, 10);
  if (req.body.showOnRsvp !== undefined) evt.showOnRsvp = req.body.showOnRsvp === true || req.body.showOnRsvp === 'true';

  writeDb(db);
  res.json({ success: true, event: evt });
});

app.delete('/api/admin/events/:id', requireAdminAuth, (req, res) => {
  const db  = getDb();
  const idx = db.scheduleEvents.findIndex(e => e.id === parseInt(req.params.id, 10));
  if (idx === -1) return res.status(404).json({ error: 'Event not found' });
  db.scheduleEvents.splice(idx, 1);
  writeDb(db);
  res.json({ success: true });
});

// ---------------------------------------------------------------------------
// API — Admin: RSVPs
// ---------------------------------------------------------------------------
app.get('/api/admin/rsvps', requireAdminAuth, (req, res) => {
  const db = getDb();
  res.json([...db.rsvps].reverse());
});

app.get('/api/admin/rsvp-status', requireAdminAuth, (req, res) => {
  const db = getDb();
  res.json({ isOpen: db.settings.rsvp_open === true });
});

app.post('/api/admin/rsvp/toggle', requireAdminAuth, (req, res) => {
  const db = getDb();
  db.settings.rsvp_open = !db.settings.rsvp_open;
  writeDb(db);
  res.json({ isOpen: db.settings.rsvp_open });
});

app.delete('/api/admin/rsvps/:id', requireAdminAuth, (req, res) => {
  const db  = getDb();
  const idx = db.rsvps.findIndex(r => r.id === parseInt(req.params.id, 10));
  if (idx === -1) return res.status(404).json({ error: 'RSVP not found' });
  db.rsvps.splice(idx, 1);
  writeDb(db);
  res.json({ success: true });
});

app.get('/api/admin/rsvps/export', requireAdminAuth, (req, res) => {
  const db   = getDb();
  const esc  = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const header = 'ID,Name,Email,Phone,Attending,Guests,Dietary,Events,Message,Token,Submitted\n';
  const rows   = db.rsvps.map(r =>
    [r.id, r.guest_name, r.email, r.phone, r.attending, r.guest_count,
     r.dietary_restrictions, (r.events || []).join('; '), r.message, r.token, r.submitted_at].map(esc).join(',')
  );
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="rsvps.csv"');
  res.send(header + rows.join('\n'));
});

app.get('/api/admin/stats', requireAdminAuth, (req, res) => {
  const db           = getDb();
  const total        = db.rsvps.length;
  const attending    = db.rsvps.filter(r => r.attending === 'yes').length;
  const notAttending = db.rsvps.filter(r => r.attending === 'no').length;
  const totalGuests  = db.rsvps.filter(r => r.attending === 'yes').reduce((s, r) => s + (r.guest_count || 1), 0);

  const rsvpEvents = (db.scheduleEvents || [])
    .filter(e => e.showOnRsvp)
    .sort((a, b) => a.dayOrder - b.dayOrder || a.sortOrder - b.sortOrder);

  const eventCounts = {};
  const eventLabels = {};
  rsvpEvents.forEach(evt => {
    eventCounts[evt.slug] = db.rsvps.filter(r => Array.isArray(r.events) && r.events.includes(evt.slug)).length;
    eventLabels[evt.slug] = evt.rsvpLabel || evt.title;
  });

  res.json({ total, attending, notAttending, totalGuests, eventCounts, eventLabels });
});

// ---------------------------------------------------------------------------
// API — Admin: QR / Tokens
// ---------------------------------------------------------------------------
app.post('/api/admin/qr/generate', requireAdminAuth, async (req, res) => {
  try {
    const { guestName, groupName, email, maxGuests, customUrl } = req.body;
    if (!guestName) return res.status(400).json({ error: 'Guest name is required' });

    const token   = uuidv4();
    const siteUrl = process.env.SITE_URL || `http://localhost:${PORT}`;
    const rsvpUrl = customUrl || `${siteUrl}/rsvp?token=${token}`;

    const db = getDb();
    const id = db.guestTokens.length ? Math.max(...db.guestTokens.map(t => t.id)) + 1 : 1;
    db.guestTokens.push({
      id,
      token,
      guestName,
      groupName:  groupName || null,
      email:      email || null,
      maxGuests:  parseInt(maxGuests, 10) || 1,
      createdAt:  new Date().toISOString()
    });
    writeDb(db);

    const qrCode = await QRCode.toDataURL(rsvpUrl, {
      width: 300, margin: 2,
      color: { dark: '#4a3728', light: '#faf7f2' }
    });

    res.json({ token, url: rsvpUrl, qrCode, guestName });
  } catch (err) {
    console.error('QR generation error:', err);
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

app.get('/api/admin/tokens', requireAdminAuth, (req, res) => {
  const db = getDb();
  res.json([...db.guestTokens].reverse());
});

app.post('/api/admin/guests/import', requireAdminAuth, (req, res) => {
  const { guests } = req.body;
  if (!Array.isArray(guests) || !guests.length) {
    return res.status(400).json({ error: 'guests array is required' });
  }

  const db = getDb();
  let imported = 0;
  let skipped  = 0;
  const results = [];

  for (const g of guests) {
    const name = (g.guestName || '').trim();
    if (!name) { skipped++; continue; }

    const token = uuidv4();
    const id    = db.guestTokens.length ? Math.max(...db.guestTokens.map(t => t.id)) + 1 : 1;
    db.guestTokens.push({
      id,
      token,
      guestName:  name,
      groupName:  (g.groupName || '').trim() || null,
      email:      (g.email     || '').trim() || null,
      maxGuests:  Math.max(1, parseInt(g.maxGuests, 10) || 1),
      createdAt:  new Date().toISOString()
    });
    imported++;
    results.push({ guestName: name, token });
  }

  writeDb(db);
  res.json({ imported, skipped, results });
});

app.delete('/api/admin/tokens/:id', requireAdminAuth, (req, res) => {
  const db  = getDb();
  const idx = db.guestTokens.findIndex(t => t.id === parseInt(req.params.id, 10));
  if (idx === -1) return res.status(404).json({ error: 'Token not found' });
  db.guestTokens.splice(idx, 1);
  writeDb(db);
  res.json({ success: true });
});

// ---------------------------------------------------------------------------
// API — Admin: Photo management
// ---------------------------------------------------------------------------

// Replace a site background photo
app.post('/api/admin/photos/site/:slot', requireAdminAuth, upload.single('photo'), (req, res) => {
  const slot       = req.params.slot;
  const targetFile = SITE_PHOTO_SLOTS[slot];

  if (!targetFile) {
    if (req.file) fs.unlinkSync(path.join(imagesDir, req.file.filename));
    return res.status(400).json({ error: 'Invalid photo slot' });
  }
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const tmpPath    = path.join(imagesDir, req.file.filename);
  const targetPath = path.join(imagesDir, targetFile);
  fs.renameSync(tmpPath, targetPath);
  res.json({ success: true, filename: targetFile });
});

// Get gallery list (admin)
app.get('/api/admin/gallery', requireAdminAuth, (req, res) => {
  const db = getDb();
  res.json(db.gallery);
});

// Add a gallery photo
app.post('/api/admin/gallery', requireAdminAuth, upload.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const db  = getDb();
  const id  = db.gallery.length ? Math.max(...db.gallery.map(g => g.id)) + 1 : 1;
  const ext = path.extname(req.file.filename);
  const filename = `gallery-${id}${ext}`;

  fs.renameSync(
    path.join(imagesDir, req.file.filename),
    path.join(imagesDir, filename)
  );

  const alt = (req.body.alt || '').trim() || 'Jack and Maja';
  db.gallery.push({ id, filename, alt });
  writeDb(db);

  res.json({ success: true, photo: db.gallery[db.gallery.length - 1] });
});

// Remove a gallery photo
app.delete('/api/admin/gallery/:id', requireAdminAuth, (req, res) => {
  const db  = getDb();
  const idx = db.gallery.findIndex(g => g.id === parseInt(req.params.id, 10));
  if (idx === -1) return res.status(404).json({ error: 'Photo not found' });

  const photo    = db.gallery[idx];
  const filePath = path.join(imagesDir, photo.filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  db.gallery.splice(idx, 1);
  writeDb(db);
  res.json({ success: true });
});

// Get wedding party (admin)
app.get('/api/admin/party', requireAdminAuth, (req, res) => {
  const db = getDb();
  res.json(db.weddingParty);
});

// Update a wedding party member (name, description, and/or photo)
app.post('/api/admin/party/:slot', requireAdminAuth, upload.single('photo'), (req, res) => {
  const { slot } = req.params;
  const db       = getDb();

  const member =
    db.weddingParty.bridal.find(m => m.slot === slot) ||
    db.weddingParty.groomsmen.find(m => m.slot === slot);

  if (!member) {
    if (req.file) fs.unlinkSync(path.join(imagesDir, req.file.filename));
    return res.status(404).json({ error: 'Party member slot not found' });
  }

  if (req.body.name        !== undefined) member.name        = req.body.name.trim();
  if (req.body.description !== undefined) member.description = req.body.description.trim();

  if (req.file) {
    const ext      = path.extname(req.file.filename);
    const filename = `party-${slot}${ext}`;

    fs.renameSync(
      path.join(imagesDir, req.file.filename),
      path.join(imagesDir, filename)
    );

    // Remove old photo file if it had a different extension
    if (member.photo && member.photo !== filename) {
      const oldPath = path.join(imagesDir, member.photo);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    member.photo = filename;
  }

  writeDb(db);
  res.json({ success: true, member });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`\n  Wedding website → http://localhost:${PORT}`);
  console.log(`  Admin panel     → http://localhost:${PORT}/admin\n`);
});
