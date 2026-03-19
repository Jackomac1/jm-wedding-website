# Jack & Maja — Wedding Website

A complete, production-ready wedding website with password-protected guest pages, an RSVP system, and an admin dashboard.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Create your environment file
cp .env.example .env

# 3. Edit .env with your settings (see below)

# 4. Start the server
node server.js
# or for development with auto-reload:
npm run dev
```

The site will be running at **http://localhost:3000**

---

## Environment Variables (`.env`)

| Variable          | Description                                      | Default          |
|-------------------|--------------------------------------------------|------------------|
| `PORT`            | Port to run the server on                        | `3000`           |
| `SESSION_SECRET`  | Secret string for session encryption (**change this!**) | —         |
| `SITE_PASSWORD`   | Password guests enter to access the site         | `wedding2025`    |
| `ADMIN_PASSWORD`  | Password for the admin panel                     | `admin123`       |
| `SITE_URL`        | Public URL of the site (used in QR code links)   | `http://localhost:3000` |

> **Important:** Change `SESSION_SECRET`, `SITE_PASSWORD`, and `ADMIN_PASSWORD` before going live.

---

## Pages

| URL               | Access       | Description                                 |
|-------------------|--------------|---------------------------------------------|
| `/enter`          | Public       | Password entry page for guests              |
| `/home`           | Site auth    | Homepage with countdown timer               |
| `/our-story`      | Site auth    | Love story timeline                         |
| `/details`        | Site auth    | Ceremony, reception, and travel info        |
| `/registry`       | Site auth    | Gift registry links                         |
| `/rsvp`           | Site auth    | RSVP form                                   |
| `/contact`        | Site auth    | Contact information and message form        |
| `/admin/login`    | Public       | Admin login                                 |
| `/admin/dashboard`| Admin auth   | RSVP management dashboard                  |
| `/admin/qr-generator` | Admin auth | Generate personalised QR codes for guests |

---

## Admin Features

- **Stats dashboard** — total RSVPs, attending, not attending, total guests
- **RSVP toggle** — open or close RSVP submissions with a single click
- **RSVP table** — view, search, and delete individual responses
- **CSV export** — download all RSVPs as a spreadsheet
- **QR code generator** — create personalised, tokenised RSVP links for guests

---

## Placeholder Content

Search for `<!-- TODO: Replace placeholder` comments throughout the HTML files to find all content that needs to be updated with real details:

- Couple names: Jack MacCready & Maja Terzic
- Wedding date: September 20, 2025
- Venue: The Estate at Sunset Gardens, New York
- Contact emails and phone numbers
- Hotel names and booking links
- Registry links
- Story/timeline copy
- RSVP deadline

---

## File Structure

```
JM_Wedding_Website/
├── server.js           — Express server + API
├── package.json
├── .env.example        — Environment variable template
├── enter.html          — Password gate (public)
├── index.html          — Homepage
├── our-story.html      — Story & timeline
├── details.html        — Event details
├── registry.html       — Gift registry
├── rsvp.html           — RSVP form
├── contact.html        — Contact page
├── admin/
│   ├── login.html      — Admin login
│   ├── dashboard.html  — RSVP management
│   └── qr-generator.html
├── data/
│   └── wedding.db      — SQLite database (auto-created)
├── CSS/
│   ├── style.css       — Main stylesheet
│   └── admin.css       — Admin panel styles
├── Images/             — Place your images here
└── JS/
    ├── main.js         — Nav, countdown, animations
    ├── rsvp.js         — RSVP form logic
    └── admin.js        — Admin dashboard logic
```
