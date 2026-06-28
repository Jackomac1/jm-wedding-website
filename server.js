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
const audioDir  = path.join(__dirname, 'audio');

if (!fs.existsSync(dataDir))   fs.mkdirSync(dataDir,   { recursive: true });
if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });
if (!fs.existsSync(audioDir))  fs.mkdirSync(audioDir,  { recursive: true });

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

  // Migrate: add music settings if missing
  if (!db.music) {
    db.music = { enabled: false, source: null, filename: null, previewUrl: null, trackName: '', artist: '', albumArt: '', displayName: '' };
    changed = true;
  }
  // Migrate: ensure spotify fields exist on older records
  if (db.music && db.music.source === undefined) {
    db.music.source     = db.music.filename ? 'upload' : null;
    db.music.previewUrl = db.music.previewUrl || null;
    db.music.trackName  = db.music.trackName  || '';
    db.music.artist     = db.music.artist     || '';
    db.music.albumArt   = db.music.albumArt   || '';
    changed = true;
  }

  // Migrate: add detail sections and cards if missing
  if (!db.detailSections) {
    db.detailSections = [
      { id: 1, label: 'Mark Your Calendar', title: 'The Celebration',    subtitle: '', styleClass: 'section',             sortOrder: 1 },
      { id: 2, label: 'Good to Know',       title: 'Additional Details', subtitle: '', styleClass: 'section',             sortOrder: 2 },
      { id: 3, label: 'Logistics',          title: 'Getting There',      subtitle: '', styleClass: 'section section-alt', sortOrder: 3 }
    ];
    changed = true;
  }

  if (!db.detailCards) {
    db.detailCards = [
      { id: 1,  sectionId: 1, sortOrder: 1, badge: 'Ceremony',        title: 'The Wedding Ceremony',  body: '**Date:** Sunday, August 29, 2027\n**Time:** 4:00 PM\n**Venue:** Stewart Creek Golf & Country Club\n**Address:** 4100 Stewart Creek Dr, Canmore, AB T1W 2V3',                                                                                                                                                          note: 'Please arrive 15–20 minutes before the ceremony begins to be seated comfortably.',                                                                                                                                             showDresscodePhoto: false },
      { id: 2,  sectionId: 1, sortOrder: 2, badge: 'Reception',       title: 'The Reception',         body: '**Date:** Sunday, August 29, 2027\n**Cocktail Hour:** 5:30 PM\n**Dinner & Dancing:** 6:30 PM\n**End Time:** 1:00 AM\n**Venue:** Bridgette Bar Canmore\n**Address:** 1030 Spring Creek Dr, Canmore, AB T1W 0C8',                                                                                                        note: 'Join us after the ceremony for cocktails, dinner, toasts, dancing, and celebrating — we plan to have the best night of our lives!',                                                                                             showDresscodePhoto: false },
      { id: 3,  sectionId: 1, sortOrder: 3, badge: 'Attire',          title: 'Dress Code',            body: '**Colourful Garden Soirée**',                                                                                                                                                                                                                                                                                            note: 'Bright colours, joyful florals, and elevated garden-party looks; garden-inspired outfits with a dressy feel are encouraged.',                                                                                                   showDresscodePhoto: true  },
      { id: 4,  sectionId: 2, sortOrder: 1, badge: 'Drinks',          title: '',                      body: "We're delighted to host you for welcome drinks at the ceremony, followed by wine service with dinner and three additional drinks to enjoy as the celebration continues. A cash bar will be available throughout the evening for any further refreshments.",                                                                note: "We can't wait to raise a glass with you.",                                                                                                                                                                                       showDresscodePhoto: false },
      { id: 5,  sectionId: 2, sortOrder: 2, badge: 'Coming Soon',     title: 'More Details',          body: '',                                                                                                                                                                                                                                                                                                                       note: 'Information coming soon.',                                                                                                                                                                                                       showDresscodePhoto: false },
      { id: 6,  sectionId: 2, sortOrder: 3, badge: 'Coming Soon',     title: 'More Details',          body: '',                                                                                                                                                                                                                                                                                                                       note: 'Information coming soon.',                                                                                                                                                                                                       showDresscodePhoto: false },
      { id: 7,  sectionId: 2, sortOrder: 4, badge: 'Important Notes', title: 'Guests & Children',     body: 'Children are very welcome to join us for Friday night drinks, Saturday brunch, and daytime activities (including golf and the spa, noting that some activities may have age restrictions). Due to venue age restrictions, guests under the age of 16 are unable to attend the Sunday wedding celebrations.',              note: "We kindly ask that attendance be limited to those named on the invitation, as we are unfortunately unable to accommodate additional guests or plus ones. Thank you so much for your understanding, and we can't wait to celebrate with you.", showDresscodePhoto: false },
      { id: 8,  sectionId: 3, sortOrder: 1, badge: 'By Car',          title: 'Parking',               body: 'Parking is available at Stewart Creek Golf & Country Club. Please park on the far end of the lot to avoid overcrowding near the ceremony tent.',                                                                                                                                                                         note: '',                                                                                                                                                                                                                               showDresscodePhoto: false },
      { id: 9,  sectionId: 3, sortOrder: 2, badge: 'Getting Around',  title: 'Rideshare & Taxis',     body: 'Rideshares and taxis are available in Canmore. We encourage guests staying at nearby hotels to rideshare to the ceremony so everyone can enjoy the evening without worrying about driving.',                                                                                                                              note: '',                                                                                                                                                                                                                               showDresscodePhoto: false },
      { id: 10, sectionId: 3, sortOrder: 3, badge: 'The Town',        title: 'Canmore, Alberta',      body: "Nestled in the Rocky Mountains, Canmore is a stunning mountain town just 20 minutes from Banff. Come early and explore — there's no shortage of hiking, scenery, and great restaurants to enjoy before the big day.",                                                                                                    note: '',                                                                                                                                                                                                                               showDresscodePhoto: false }
    ];
    changed = true;
  }

  // Migrate: add accommodations if missing
  if (!db.accommodations) {
    db.accommodations = [
      {
        id: 1, sortOrder: 1,
        name: 'The Malcolm Hotel',
        badge: 'Recommended · ~500m from ceremony',
        description: 'Our top recommendation for guests. Located just a short walk from Stewart Creek Golf & Country Club, right in the heart of Canmore.',
        discountCode: '',
        link: '',
        directionsUrl: ''
      }
    ];
    changed = true;
  }

  // Migrate: add guest list if missing
  if (!db.guestList) { db.guestList = []; changed = true; }
  if (!db.parties)   { db.parties   = []; changed = true; }
  if (db.settings.rsvp_guest_deadline === undefined) {
    db.settings.rsvp_guest_deadline = null;
    changed = true;
  }

  if (changed) writeDb(db);
  return db;
}

// ---------------------------------------------------------------------------
// Guest-list helpers
// ---------------------------------------------------------------------------
function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase().replace(/['"]/g, '').trim());
  return lines.slice(1)
    .map(line => {
      const vals = parseCsvLine(line);
      const row  = {};
      headers.forEach((h, i) => { row[h] = (vals[i] || '').replace(/^["']|["']$/g, '').trim(); });
      return row;
    })
    .filter(row => Object.values(row).some(v => v));
}

function fuzzyScore(name, query) {
  const n = name.toLowerCase().trim();
  const q = query.toLowerCase().trim();
  if (!q) return 0;
  if (n === q)           return 100;
  if (n.startsWith(q))   return 90;
  if (n.includes(q))     return 70;
  const qWords = q.split(/\s+/);
  const nWords = n.split(/\s+/);
  let score = 0;
  for (const qw of qWords) {
    if (qw.length < 2) continue;
    for (const nw of nWords) {
      if (nw === qw)           { score += 25; break; }
      if (nw.startsWith(qw))   { score += 15; break; }
    }
  }
  return score;
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

const musicUpload = multer({
  storage: multer.diskStorage({
    destination: audioDir,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.mp3';
      cb(null, `site-music${ext}`);
    }
  }),
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) return cb(null, true);
    cb(new Error('Only audio files are allowed'));
  },
  limits: { fileSize: 30 * 1024 * 1024 } // 30 MB
});

const csvUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'text/csv' ||
        file.mimetype === 'application/vnd.ms-excel' ||
        file.originalname.toLowerCase().endsWith('.csv')) return cb(null, true);
    cb(new Error('CSV files only'));
  },
  limits: { fileSize: 5 * 1024 * 1024 }
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
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use('/audio',  express.static(audioDir));

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
app.get('/admin/schedule',         requireAdminAuth, (req, res) => res.sendFile(path.join(__dirname, 'admin', 'schedule.html')));
app.get('/admin/accommodations',   requireAdminAuth, (req, res) => res.sendFile(path.join(__dirname, 'admin', 'accommodations.html')));
app.get('/admin/details',          requireAdminAuth, (req, res) => res.sendFile(path.join(__dirname, 'admin', 'details.html')));
app.get('/admin/guestlist',        requireAdminAuth, (req, res) => res.sendFile(path.join(__dirname, 'admin', 'guestlist.html')));

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
    redirect_uri:  `${process.env.SITE_URL}/api/spotify/callback`,
    show_dialog:   'true'
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
      uri:         t.uri,
      name:        t.name,
      artist:      t.artists.map(a => a.name).join(', '),
      image:       t.album.images[2]?.url || t.album.images[0]?.url || null,
      preview_url: t.preview_url || null
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

  const { guest_name, email, phone, attending, guest_count, guest_names, dietary_restrictions, events, message, token, song_uri, song_name } = req.body;

  if (!guest_name || !attending) {
    return res.status(400).json({ error: 'Name and attendance are required' });
  }

  const att = attending.toLowerCase();
  if (!['yes', 'no'].includes(att)) {
    return res.status(400).json({ error: 'Invalid attendance value' });
  }

  const names = Array.isArray(guest_names) && guest_names.length ? guest_names.filter(Boolean) : null;
  const count = names ? names.length : (parseInt(guest_count, 10) || 1);

  if (token) {
    const tok = db.guestTokens.find(t => t.token === token);
    if (!tok) {
      return res.status(400).json({ error: 'Invalid invitation link. Please contact us for help.' });
    }
    if (count > tok.maxGuests) {
      return res.status(400).json({ error: `Your invitation allows up to ${tok.maxGuests} guest(s).` });
    }
  }

  const id = db.rsvps.length ? Math.max(...db.rsvps.map(r => r.id)) + 1 : 1;
  db.rsvps.push({
    id,
    guest_name,
    email:                email || null,
    phone:                phone || null,
    attending:            att,
    guest_count:          count,
    guest_names:          names || [guest_name],
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

app.put('/api/admin/days/:dayOrder', requireAdminAuth, (req, res) => {
  const db       = getDb();
  const dayOrder = parseInt(req.params.dayOrder, 10);
  const { dayLabel, dayDate } = req.body;
  if (!dayDate) return res.status(400).json({ error: 'Day Date is required' });
  const affected = db.scheduleEvents.filter(e => e.dayOrder === dayOrder);
  if (!affected.length) return res.status(404).json({ error: 'No events found for that day' });
  affected.forEach(e => { e.dayLabel = dayLabel || ''; e.dayDate = dayDate; });
  writeDb(db);
  res.json({ success: true, updated: affected.length });
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
  const header = 'ID,Name,Email,Phone,Attending,Guests,Guest Names,Dietary,Events,Message,Token,Submitted\n';
  const rows   = db.rsvps.map(r =>
    [r.id, r.guest_name, r.email, r.phone, r.attending, r.guest_count,
     (r.guest_names || []).join('; '),
     r.dietary_restrictions, (r.events || []).join('; '), r.message, r.token, r.submitted_at].map(esc).join(',')
  );
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="rsvps.csv"');
  res.send(header + rows.join('\n'));
});

app.get('/api/admin/stats', requireAdminAuth, (req, res) => {
  const db              = getDb();
  const guests          = db.guestList || [];
  const submittedParties = (db.parties || []).filter(p => p.submittedAt);

  // Legacy token-based RSVP counts
  const legacyTotal        = db.rsvps.length;
  const legacyAttending    = db.rsvps.filter(r => r.attending === 'yes').length;
  const legacyNotAttending = db.rsvps.filter(r => r.attending === 'no').length;
  const legacyGuests       = db.rsvps.filter(r => r.attending === 'yes').reduce((s, r) => s + (r.guest_count || 1), 0);

  // Guest-list party RSVP counts
  const partyAttending    = submittedParties.filter(p =>
    guests.filter(g => g.partyId === p.id).some(g => g.rsvpStatus === 'attending' || g.plusOneStatus === 'attending')
  ).length;
  const partyNotAttending = submittedParties.filter(p =>
    guests.filter(g => g.partyId === p.id).every(g =>
      g.rsvpStatus !== 'attending' && (!g.plusOneAllowed || g.plusOneStatus !== 'attending')
    )
  ).length;
  const partyGuests = guests.reduce((sum, g) => {
    if (g.rsvpStatus === 'attending') sum++;
    if (g.plusOneAllowed && g.plusOneStatus === 'attending') sum++;
    return sum;
  }, 0);

  const total        = legacyTotal        + submittedParties.length;
  const attending    = legacyAttending    + partyAttending;
  const notAttending = legacyNotAttending + partyNotAttending;
  const totalGuests  = legacyGuests       + partyGuests;

  const rsvpEvents = (db.scheduleEvents || [])
    .filter(e => e.showOnRsvp)
    .sort((a, b) => a.dayOrder - b.dayOrder || a.sortOrder - b.sortOrder);

  const eventCounts = {};
  const eventLabels = {};
  rsvpEvents.forEach(evt => {
    const legacyCount = db.rsvps.filter(r => Array.isArray(r.events) && r.events.includes(evt.slug)).length;

    let partyPersonCount = 0;
    submittedParties
      .filter(p => Array.isArray(p.events) && p.events.includes(evt.slug))
      .forEach(p => {
        guests.filter(g => g.partyId === p.id).forEach(g => {
          if (g.rsvpStatus === 'attending') partyPersonCount++;
          if (g.plusOneAllowed && g.plusOneStatus === 'attending') partyPersonCount++;
        });
      });

    eventCounts[evt.slug] = legacyCount + partyPersonCount;
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

app.get('/api/admin/qr/print-sheet', requireAdminAuth, async (req, res) => {
  const db      = getDb();
  const tokens  = [...db.guestTokens];
  const siteUrl = process.env.SITE_URL || `http://localhost:${PORT}`;

  const cards = await Promise.all(tokens.map(async tok => {
    const url    = `${siteUrl}/rsvp?token=${tok.token}`;
    const qrData = await QRCode.toDataURL(url, { width: 240, margin: 2, color: { dark: '#2e1618', light: '#ffffff' } });
    const guests = tok.maxGuests > 1 ? `Up to ${tok.maxGuests} guests` : '1 guest';
    return `
      <div class="card">
        <img src="${qrData}" alt="QR code for ${tok.guestName}" width="180" height="180">
        <div class="name">${tok.guestName.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</div>
        <div class="guests">${guests}</div>
      </div>`;
  }));

  res.setHeader('Content-Type', 'text/html');
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>QR Codes — Print Sheet</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Georgia, serif; background: #fff; color: #2e1618; }
    .toolbar { padding: 1rem 1.5rem; background: #f5f0eb; border-bottom: 1px solid #ddd; display: flex; align-items: center; gap: 1rem; }
    .toolbar h1 { font-size: 1rem; font-weight: 600; }
    .toolbar button { padding: 0.5rem 1.25rem; background: #6c1420; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 0.9rem; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; padding: 1.5rem; }
    .card { border: 1px solid #d4c9be; border-radius: 8px; padding: 1rem; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 0.5rem; break-inside: avoid; }
    .card img { display: block; }
    .name { font-size: 0.95rem; font-weight: 600; }
    .guests { font-size: 0.75rem; color: #888; }
    @media print {
      .toolbar { display: none; }
      .grid { padding: 0; gap: 0.5rem; }
      body { font-size: 12px; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <h1>QR Print Sheet — ${tokens.length} invitation${tokens.length !== 1 ? 's' : ''}</h1>
    <button onclick="window.print()">Print / Save as PDF</button>
  </div>
  <div class="grid">${cards.join('')}</div>
</body>
</html>`);
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

// Add a wedding party member
app.post('/api/admin/party', requireAdminAuth, (req, res) => {
  const { side, role } = req.body;
  if (!side || !['bridal', 'groomsmen'].includes(side)) return res.status(400).json({ error: 'side must be bridal or groomsmen' });
  if (!role || !role.trim()) return res.status(400).json({ error: 'role is required' });
  const db     = getDb();
  const slot   = `custom-${Date.now()}`;
  const member = { slot, role: role.trim(), name: '', description: '', photo: null };
  db.weddingParty[side].push(member);
  writeDb(db);
  res.json({ success: true, member });
});

// Delete a wedding party member
app.delete('/api/admin/party/:slot', requireAdminAuth, (req, res) => {
  const { slot } = req.params;
  const db = getDb();
  let removed = null;
  ['bridal', 'groomsmen'].forEach(side => {
    const idx = db.weddingParty[side].findIndex(m => m.slot === slot);
    if (idx !== -1) { [removed] = db.weddingParty[side].splice(idx, 1); }
  });
  if (!removed) return res.status(404).json({ error: 'Member not found' });
  if (removed.photo) {
    const photoPath = path.join(imagesDir, removed.photo);
    if (fs.existsSync(photoPath)) try { fs.unlinkSync(photoPath); } catch {}
  }
  writeDb(db);
  res.json({ success: true });
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
// Admin page — Music
// ---------------------------------------------------------------------------
app.get('/admin/music', requireAdminAuth, (_req, res) => res.sendFile(path.join(__dirname, 'admin', 'music.html')));

// ---------------------------------------------------------------------------
// Music API
// ---------------------------------------------------------------------------

// Public: returns enabled state + src (used by guest pages to show the player)
app.get('/api/music', (_req, res) => {
  const db = getDb();
  const m  = db.music || {};
  if (!m.enabled) return res.json({ enabled: false });
  if (m.source === 'spotify' && m.previewUrl) {
    return res.json({ enabled: true, src: m.previewUrl, displayName: m.displayName || m.trackName || '', albumArt: m.albumArt || '', trackName: m.trackName || '', artist: m.artist || '' });
  }
  if (m.source === 'upload' && m.filename) {
    return res.json({ enabled: true, src: `/audio/${m.filename}`, displayName: m.displayName || '' });
  }
  res.json({ enabled: false });
});

// Admin: full settings
app.get('/api/admin/music', requireAdminAuth, (_req, res) => {
  const db = getDb();
  res.json(db.music || { enabled: false, filename: null, displayName: '' });
});

// Admin: upload audio file
app.post('/api/admin/music/upload', requireAdminAuth, musicUpload.single('audio'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No audio file provided' });
  const db = getDb();
  if (!db.music) db.music = { enabled: false, source: null, filename: null, previewUrl: null, trackName: '', artist: '', albumArt: '', displayName: '' };

  // Delete old file if it had a different name
  if (db.music.filename && db.music.filename !== req.file.filename) {
    const oldPath = path.join(audioDir, db.music.filename);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }

  db.music.source   = 'upload';
  db.music.filename = req.file.filename;
  if (req.body.displayName !== undefined) db.music.displayName = req.body.displayName.trim();
  writeDb(db);
  res.json({ success: true, filename: req.file.filename });
});

// Admin: save a Spotify preview selection
app.post('/api/admin/music/spotify', requireAdminAuth, (req, res) => {
  const { previewUrl, trackName, artist, albumArt } = req.body;
  if (!previewUrl) return res.status(400).json({ error: 'previewUrl is required' });
  const db = getDb();
  if (!db.music) db.music = { enabled: false, source: null, filename: null, previewUrl: null, trackName: '', artist: '', albumArt: '', displayName: '' };
  db.music.source     = 'spotify';
  db.music.previewUrl = previewUrl;
  db.music.trackName  = trackName  || '';
  db.music.artist     = artist     || '';
  db.music.albumArt   = albumArt   || '';
  writeDb(db);
  res.json({ success: true });
});

// Admin: update settings (enabled toggle, displayName)
app.post('/api/admin/music/settings', requireAdminAuth, (req, res) => {
  const db = getDb();
  if (!db.music) db.music = { enabled: false, filename: null, displayName: '' };
  if (req.body.enabled     !== undefined) db.music.enabled     = req.body.enabled === true || req.body.enabled === 'true';
  if (req.body.displayName !== undefined) db.music.displayName = req.body.displayName.trim();
  writeDb(db);
  res.json({ success: true, music: db.music });
});

// Admin: delete song
app.delete('/api/admin/music', requireAdminAuth, (_req, res) => {
  const db = getDb();
  if (db.music && db.music.filename) {
    const filePath = path.join(audioDir, db.music.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  db.music = { enabled: false, filename: null, displayName: '' };
  writeDb(db);
  res.json({ success: true });
});

// ---------------------------------------------------------------------------
// API — detail sections & cards
// ---------------------------------------------------------------------------
app.get('/api/details', (_req, res) => {
  const db = getDb();
  res.json({
    sections: (db.detailSections || []).slice().sort((a, b) => a.sortOrder - b.sortOrder),
    cards:    (db.detailCards    || []).slice().sort((a, b) => a.sortOrder - b.sortOrder)
  });
});

app.get('/api/admin/details', requireAdminAuth, (_req, res) => {
  const db = getDb();
  res.json({
    sections: (db.detailSections || []).slice().sort((a, b) => a.sortOrder - b.sortOrder),
    cards:    (db.detailCards    || []).slice().sort((a, b) => a.sortOrder - b.sortOrder)
  });
});

app.put('/api/admin/details/sections/:id', requireAdminAuth, (req, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  const sec = (db.detailSections || []).find(s => s.id === id);
  if (!sec) return res.status(404).json({ error: 'Section not found' });
  const { label, title, subtitle } = req.body;
  if (label    !== undefined) sec.label    = label.trim();
  if (title    !== undefined) sec.title    = title.trim();
  if (subtitle !== undefined) sec.subtitle = subtitle.trim();
  writeDb(db);
  res.json({ success: true, section: sec });
});

app.post('/api/admin/details/cards', requireAdminAuth, (req, res) => {
  const { sectionId, badge, title, body, note, showDresscodePhoto, sortOrder } = req.body;
  if (!sectionId) return res.status(400).json({ error: 'sectionId is required' });
  const db = getDb();
  if (!db.detailCards) db.detailCards = [];
  const maxId    = db.detailCards.reduce((m, c) => Math.max(m, c.id    || 0), 0);
  const maxOrder = db.detailCards.filter(c => c.sectionId === Number(sectionId)).reduce((m, c) => Math.max(m, c.sortOrder || 0), 0);
  const card = {
    id:                maxId + 1,
    sectionId:         Number(sectionId),
    sortOrder:         sortOrder != null ? Number(sortOrder) : maxOrder + 1,
    badge:             (badge  || '').trim(),
    title:             (title  || '').trim(),
    body:              (body   || '').trim(),
    note:              (note   || '').trim(),
    showDresscodePhoto: showDresscodePhoto === true || showDresscodePhoto === 'true'
  };
  db.detailCards.push(card);
  writeDb(db);
  res.json({ success: true, card });
});

app.put('/api/admin/details/cards/:id', requireAdminAuth, (req, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  const card = (db.detailCards || []).find(c => c.id === id);
  if (!card) return res.status(404).json({ error: 'Card not found' });
  const { badge, title, body, note, showDresscodePhoto, sortOrder, sectionId } = req.body;
  if (badge              !== undefined) card.badge              = badge.trim();
  if (title              !== undefined) card.title              = title.trim();
  if (body               !== undefined) card.body               = body.trim();
  if (note               !== undefined) card.note               = note.trim();
  if (showDresscodePhoto !== undefined) card.showDresscodePhoto = showDresscodePhoto === true || showDresscodePhoto === 'true';
  if (sortOrder          !== undefined) card.sortOrder          = Number(sortOrder);
  if (sectionId          !== undefined) card.sectionId          = Number(sectionId);
  writeDb(db);
  res.json({ success: true, card });
});

app.delete('/api/admin/details/cards/:id', requireAdminAuth, (req, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  const idx = (db.detailCards || []).findIndex(c => c.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Card not found' });
  db.detailCards.splice(idx, 1);
  writeDb(db);
  res.json({ success: true });
});

// ---------------------------------------------------------------------------
// API — accommodations
// ---------------------------------------------------------------------------
app.get('/api/accommodations', (_req, res) => {
  const db = getDb();
  const list = (db.accommodations || []).slice().sort((a, b) => a.sortOrder - b.sortOrder);
  res.json(list);
});

app.get('/api/admin/accommodations', requireAdminAuth, (_req, res) => {
  const db = getDb();
  const list = (db.accommodations || []).slice().sort((a, b) => a.sortOrder - b.sortOrder);
  res.json(list);
});

app.post('/api/admin/accommodations', requireAdminAuth, (req, res) => {
  const { name, badge, description, discountCode, link, directionsUrl, sortOrder } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
  const db = getDb();
  if (!db.accommodations) db.accommodations = [];
  const maxId = db.accommodations.reduce((m, a) => Math.max(m, a.id || 0), 0);
  const maxOrder = db.accommodations.reduce((m, a) => Math.max(m, a.sortOrder || 0), 0);
  const item = {
    id:           maxId + 1,
    sortOrder:    sortOrder != null ? Number(sortOrder) : maxOrder + 1,
    name:         name.trim(),
    badge:        (badge         || '').trim(),
    description:  (description   || '').trim(),
    discountCode: (discountCode  || '').trim(),
    link:         (link          || '').trim(),
    directionsUrl:(directionsUrl || '').trim()
  };
  db.accommodations.push(item);
  writeDb(db);
  res.json({ success: true, accommodation: item });
});

app.put('/api/admin/accommodations/:id', requireAdminAuth, (req, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  const idx = (db.accommodations || []).findIndex(a => a.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const { name, badge, description, discountCode, link, directionsUrl, sortOrder } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
  const item = db.accommodations[idx];
  item.name          = name.trim();
  item.badge         = (badge         || '').trim();
  item.description   = (description   || '').trim();
  item.discountCode  = (discountCode  || '').trim();
  item.link          = (link          || '').trim();
  item.directionsUrl = (directionsUrl || '').trim();
  if (sortOrder != null) item.sortOrder = Number(sortOrder);
  writeDb(db);
  res.json({ success: true, accommodation: item });
});

app.delete('/api/admin/accommodations/:id', requireAdminAuth, (req, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  const idx = (db.accommodations || []).findIndex(a => a.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  db.accommodations.splice(idx, 1);
  writeDb(db);
  res.json({ success: true });
});

// ---------------------------------------------------------------------------
// API — Guest list RSVP (public)
// ---------------------------------------------------------------------------
app.get('/api/rsvp/search', (req, res) => {
  const q = (req.query.q || '').trim();
  if (q.length < 2) return res.json([]);
  const db      = getDb();
  const guests  = db.guestList || [];
  const parties = db.parties   || [];

  const results = guests
    .map(g => ({ g, score: fuzzyScore(g.name, q) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(({ g }) => {
      const party = parties.find(p => p.id === g.partyId);
      return { id: g.id, name: g.name, partyId: g.partyId, partyName: party ? party.name : g.name };
    });

  res.json(results);
});

app.get('/api/rsvp/party/:partyId', (req, res) => {
  const db    = getDb();
  const party = (db.parties || []).find(p => p.id === req.params.partyId);
  if (!party) return res.status(404).json({ error: 'Party not found' });

  const members    = (db.guestList || []).filter(g => g.partyId === party.id);
  const deadline   = db.settings.rsvp_guest_deadline;
  const pastDeadline = deadline && new Date(deadline) < new Date();

  res.json({
    party,
    members,
    alreadySubmitted: !!party.submittedAt,
    canUpdate:        party.submittedAt ? !pastDeadline : true,
    deadline
  });
});

app.post('/api/rsvp/party/:partyId', (req, res) => {
  const db = getDb();
  if (!db.settings.rsvp_open) return res.status(403).json({ error: 'RSVP is currently closed.' });

  const party = (db.parties || []).find(p => p.id === req.params.partyId);
  if (!party) return res.status(404).json({ error: 'Party not found' });

  if (party.submittedAt) {
    const deadline = db.settings.rsvp_guest_deadline;
    if (deadline && new Date(deadline) < new Date()) {
      return res.status(403).json({ error: 'The RSVP deadline has passed.' });
    }
  }

  const { responses, plusOnes, submittedBy, events, dietary, message, songUri, songName, email, phone } = req.body;
  if (!Array.isArray(responses) || !responses.length) {
    return res.status(400).json({ error: 'responses array is required' });
  }

  responses.forEach(r => {
    const guest = (db.guestList || []).find(g => g.id === r.id && g.partyId === party.id);
    if (guest) {
      guest.rsvpStatus = r.attending ? 'attending' : 'declined';
      guest.updatedAt  = new Date().toISOString();
    }
  });

  if (Array.isArray(plusOnes)) {
    plusOnes.forEach(po => {
      const guest = (db.guestList || []).find(g => g.id === po.guestId && g.partyId === party.id);
      if (guest && guest.plusOneAllowed) {
        guest.plusOneName   = (po.name || '').trim() || null;
        guest.plusOneStatus = po.attending ? 'attending' : 'declined';
        guest.updatedAt     = new Date().toISOString();
      }
    });
  }

  party.submittedAt = new Date().toISOString();
  party.submittedBy = submittedBy || null;
  party.events      = Array.isArray(events) ? events : [];
  party.dietary     = (dietary  || '').trim();
  party.message     = (message  || '').trim();
  party.songUri     = (songUri  || '').trim();
  party.songName    = (songName || '').trim();
  party.email       = (email    || '').trim();
  party.phone       = (phone    || '').trim();
  writeDb(db);
  res.json({ success: true });
});

// ---------------------------------------------------------------------------
// API — Guest list admin
// ---------------------------------------------------------------------------
app.get('/api/admin/guestlist', requireAdminAuth, (_req, res) => {
  const db      = getDb();
  const parties = (db.parties   || []).slice().sort((a, b) => a.name.localeCompare(b.name));
  const guests  = db.guestList  || [];
  const result  = parties.map(p => ({
    ...p,
    members: guests.filter(g => g.partyId === p.id).sort((a, b) => a.name.localeCompare(b.name))
  }));
  res.json({ parties: result });
});

app.get('/api/admin/guestlist/stats', requireAdminAuth, (_req, res) => {
  const db     = getDb();
  const guests = db.guestList || [];
  let totalInvited = 0, attending = 0, declined = 0, pending = 0;
  guests.forEach(g => {
    totalInvited++;
    if      (g.rsvpStatus === 'attending') attending++;
    else if (g.rsvpStatus === 'declined')  declined++;
    else                                   pending++;
    if (g.plusOneAllowed) {
      totalInvited++;
      if      (g.plusOneStatus === 'attending') attending++;
      else if (g.plusOneStatus === 'declined')  declined++;
      else                                      pending++;
    }
  });
  res.json({ totalInvited, attending, declined, pending, deadline: db.settings.rsvp_guest_deadline });
});

app.post('/api/admin/guestlist/import', requireAdminAuth, csvUpload.single('csv'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'CSV file required' });
  const text = req.file.buffer.toString('utf8');
  const rows = parseCsv(text);
  if (!rows.length) return res.status(400).json({ error: 'CSV is empty or has no data rows' });

  const db = getDb();
  if (!db.guestList) db.guestList = [];
  if (!db.parties)   db.parties   = [];

  const partyMap = {};
  db.parties.forEach(p => { partyMap[p.name.toLowerCase()] = p.id; });

  let added = 0;
  rows.forEach(row => {
    const name       = (row['name'] || row['guest name'] || row['full name'] || '').trim();
    const partyName  = (row['party'] || row['group'] || row['party name'] || row['party/group'] || name).trim();
    const plusRaw    = (row['plus one'] || row['plus_one'] || row['plusone'] || row['plus 1'] || '').toLowerCase();
    const plusOne    = ['yes', 'true', '1', 'y'].includes(plusRaw);
    if (!name) return;

    const key = partyName.toLowerCase();
    if (!partyMap[key]) {
      const pid = uuidv4();
      db.parties.push({ id: pid, name: partyName, submittedAt: null, submittedBy: null });
      partyMap[key] = pid;
    }

    db.guestList.push({
      id: uuidv4(), name, partyId: partyMap[key],
      plusOneAllowed: plusOne, rsvpStatus: 'pending',
      plusOneName: null, plusOneStatus: null, updatedAt: null, notes: ''
    });
    added++;
  });

  writeDb(db);
  res.json({ success: true, added });
});

app.post('/api/admin/guestlist/guest', requireAdminAuth, (req, res) => {
  const { name, partyId, partyName, plusOneAllowed } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
  const db = getDb();
  if (!db.guestList) db.guestList = [];
  if (!db.parties)   db.parties   = [];

  let pid = partyId;
  if (!pid && partyName && partyName.trim()) {
    pid = uuidv4();
    db.parties.push({ id: pid, name: partyName.trim(), submittedAt: null, submittedBy: null });
  }
  if (!pid) return res.status(400).json({ error: 'Party name or ID is required' });
  const party = db.parties.find(p => p.id === pid);
  if (!party) return res.status(400).json({ error: 'Party not found' });

  const guest = {
    id: uuidv4(), name: name.trim(), partyId: pid,
    plusOneAllowed: plusOneAllowed === true || plusOneAllowed === 'true',
    rsvpStatus: 'pending', plusOneName: null, plusOneStatus: null, updatedAt: null, notes: ''
  };
  db.guestList.push(guest);
  writeDb(db);
  res.json({ success: true, guest, party });
});

app.put('/api/admin/guestlist/guest/:id', requireAdminAuth, (req, res) => {
  const db    = getDb();
  const guest = (db.guestList || []).find(g => g.id === req.params.id);
  if (!guest) return res.status(404).json({ error: 'Guest not found' });
  const { name, plusOneAllowed, notes } = req.body;
  if (name            !== undefined) guest.name           = name.trim();
  if (plusOneAllowed  !== undefined) guest.plusOneAllowed = plusOneAllowed === true || plusOneAllowed === 'true';
  if (notes           !== undefined) guest.notes          = notes.trim();
  writeDb(db);
  res.json({ success: true, guest });
});

app.delete('/api/admin/guestlist/guest/:id', requireAdminAuth, (req, res) => {
  const db  = getDb();
  const idx = (db.guestList || []).findIndex(g => g.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Guest not found' });
  const [removed] = db.guestList.splice(idx, 1);
  if (!(db.guestList || []).some(g => g.partyId === removed.partyId)) {
    db.parties = (db.parties || []).filter(p => p.id !== removed.partyId);
  }
  writeDb(db);
  res.json({ success: true });
});

app.delete('/api/admin/guestlist/party/:partyId', requireAdminAuth, (req, res) => {
  const { partyId } = req.params;
  const db  = getDb();
  const idx = (db.parties || []).findIndex(p => p.id === partyId);
  if (idx === -1) return res.status(404).json({ error: 'Party not found' });
  db.parties.splice(idx, 1);
  db.guestList = (db.guestList || []).filter(g => g.partyId !== partyId);
  writeDb(db);
  res.json({ success: true });
});

app.put('/api/admin/guestlist/guest/:id/rsvp', requireAdminAuth, (req, res) => {
  const db    = getDb();
  const guest = (db.guestList || []).find(g => g.id === req.params.id);
  if (!guest) return res.status(404).json({ error: 'Guest not found' });
  const { rsvpStatus, plusOneStatus, plusOneName } = req.body;
  const validStatuses = ['pending', 'attending', 'declined'];
  if (rsvpStatus && validStatuses.includes(rsvpStatus)) {
    guest.rsvpStatus = rsvpStatus;
    guest.updatedAt  = new Date().toISOString();
  }
  if (plusOneStatus !== undefined) guest.plusOneStatus = validStatuses.includes(plusOneStatus) ? plusOneStatus : null;
  if (plusOneName   !== undefined) guest.plusOneName   = plusOneName || null;
  writeDb(db);
  res.json({ success: true, guest });
});

app.get('/api/admin/guestlist/export', requireAdminAuth, (_req, res) => {
  const db      = getDb();
  const guests  = db.guestList || [];
  const parties = db.parties   || [];
  const q = v => `"${String(v || '').replace(/"/g, '""')}"`;
  const headers = ['Name', 'Party', 'RSVP Status', 'Email', 'Phone', 'Dietary Restrictions', 'Song Choice', 'Submitted At'];
  const rows = [];

  guests.forEach(g => {
    const party       = parties.find(p => p.id === g.partyId);
    const partyName   = party ? party.name          : '';
    const email       = party ? (party.email    || '') : '';
    const phone       = party ? (party.phone    || '') : '';
    const dietary     = party ? (party.dietary  || '') : '';
    const songName    = party ? (party.songName || '') : '';
    const submittedAt = party ? (party.submittedAt || '') : '';

    rows.push([q(g.name), q(partyName), q(g.rsvpStatus), q(email), q(phone), q(dietary), q(songName), q(submittedAt)].join(','));

    if (g.plusOneAllowed && g.plusOneName) {
      rows.push([q(g.plusOneName), q(partyName), q(g.plusOneStatus || 'pending'), q(email), q(phone), q(dietary), q(''), q(submittedAt)].join(','));
    }
  });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="guest-list.csv"');
  res.send([headers.map(h => q(h)).join(','), ...rows].join('\n'));
});

app.get('/api/admin/guestlist/responses', requireAdminAuth, (_req, res) => {
  const db      = getDb();
  const guests  = db.guestList || [];
  const submitted = (db.parties || []).filter(p => p.submittedAt);

  const results = submitted.map(p => ({
    partyId:     p.id,
    partyName:   p.name,
    submittedAt: p.submittedAt,
    email:       p.email    || '',
    phone:       p.phone    || '',
    dietary:     p.dietary  || '',
    songName:    p.songName || '',
    songUri:     p.songUri  || '',
    message:     p.message  || '',
    events:      p.events   || [],
    members:     guests.filter(g => g.partyId === p.id).map(g => ({
      name:           g.name,
      rsvpStatus:     g.rsvpStatus,
      plusOneName:    g.plusOneName    || '',
      plusOneStatus:  g.plusOneStatus  || '',
      plusOneAllowed: g.plusOneAllowed
    }))
  }));

  res.json(results);
});

app.post('/api/admin/guestlist/settings', requireAdminAuth, (req, res) => {
  const db = getDb();
  if (req.body.rsvp_guest_deadline !== undefined) {
    db.settings.rsvp_guest_deadline = req.body.rsvp_guest_deadline || null;
  }
  writeDb(db);
  res.json({ success: true, deadline: db.settings.rsvp_guest_deadline });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`\n  Wedding website → http://localhost:${PORT}`);
  console.log(`  Admin panel     → http://localhost:${PORT}/admin\n`);
});
