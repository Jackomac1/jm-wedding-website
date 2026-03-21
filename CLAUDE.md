# JM Wedding Website — Project Context

## Couple & Event

| Field | Details |
|-------|---------|
| Couple | Jack MacCready & Maja Terzic |
| Wedding date | Sunday, August 29, 2027 |
| Ceremony | Stewart Creek Golf & Country Club, 4100 Stewart Creek Dr, Canmore, AB T1W 2V3 |
| Ceremony time | 4:00 PM |
| Reception | Bridgette Bar Canmore, 1030 Spring Creek Dr, Canmore, AB T1W 0C8 |
| Cocktail hour | 5:30 PM |
| Dinner | 6:30 PM |
| End time | 1:00 AM |
| Dress code | Garden Party Chic |
| RSVP deadline | April 1, 2027 |
| Contact email | majaandjack@gmail.com |
| Accommodation | The Malcolm Hotel — ~500m from ceremony venue |

## Stack & Architecture

- **Runtime:** Node.js + Express (`server.js`) — start with `node server.js` on port 3000
- **Node.js path:** `/usr/local/bin/node` and `/usr/local/bin/npm` (not in shell PATH by default)
- **Database:** JSON flat file (`data/db.json`) — no SQLite, no compilation required
- **Auth:** bcryptjs + express-session. Two passwords: site (guests) and admin
- **Config:** `.env` file — `SITE_PASSWORD`, `ADMIN_PASSWORD`, `SESSION_SECRET`, `PORT`, `SITE_URL`, `RESEND_API_KEY`, `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_PLAYLIST_ID`, `SPOTIFY_REFRESH_TOKEN`
- **Email:** Resend — contact form POSTs to `/api/contact` → email sent via Resend API to `majaandjack@gmail.com`. From address: `noreply@majaandjack.ca`. Domain verified in Resend.
- **Spotify:** Song request on RSVP form — guests search Spotify and pick a song. Song name + URI stored with RSVP. Server attempts to add to playlist `2yGEUvxvBzCpGob3JwgLQB` ("Maja and Jacks Guest Requests") via Spotify Web API. **Note:** Spotify write API returning 403 — suspected new app restriction. Retry after recreating the Spotify Developer app (rate limited — try again after 2026-03-20). Spotify auth done via `/api/spotify/auth` (admin only) → refresh token stored as `SPOTIFY_REFRESH_TOKEN` env var.
- **Fonts:** Playfair Display (headings/section titles), Cormorant Garamond italic (hero script + footer + nav brand + enter monogram — `--font-script`), Lato (body) — Google Fonts
- **No build tools** — plain HTML/CSS/JS served as static files from Express
- **File uploads:** `multer` handles multipart uploads — saved to `/Images/` with auto-generated filenames. Site photos overwrite fixed filenames. Party photos: `party-{slot}.jpg`. Gallery photos: `gallery-{id}.jpg`.
- **Deployment:** Railway — connected to GitHub repo `Jackomac1/jm-wedding-website`, auto-deploys on push to `main`. Live at `https://jm-wedding.up.railway.app`. Custom domain `majaandjack.ca` purchased on Namecheap, CNAME pointing to Railway — DNS propagating.

## File Structure

```
JM_Wedding_Website/
├── server.js              Express server + all API routes
├── package.json
├── .env                   Passwords & config (not committed)
├── data/db.json           All RSVPs, guest tokens, settings
├── enter.html             Password gate (public)
├── index.html             Homepage (site-auth required)
├── details.html           Ceremony, reception, dress code, getting there, hotel
├── registry.html          Cash gift page (no product registry)
├── rsvp.html              RSVP form
├── contact.html           Contact info + message form
├── gallery.html           Photo gallery — hover-zoom + lightbox on click
├── wedding-party.html     Bridal party + groomsmen (7 per side, names/photos TODO)
├── schedule.html          Multi-day timeline: Fri Aug 27 / Sat Aug 28 / Sun Aug 29 (Big Day) / Mon Aug 30 — click-to-flip cards with Google Maps links
├── admin/
│   ├── login.html
│   ├── dashboard.html     RSVP toggle, stats, table, CSV export
│   ├── qr-generator.html  Single QR + bulk CSV import
│   └── photos.html        Photo manager: site backgrounds, gallery, wedding party
├── CSS/style.css          Main stylesheet (~1600 lines)
├── CSS/admin.css          Admin panel styles (~830 lines)
├── JS/main.js             Nav scroll, hamburger, countdown, fade-ins
├── JS/rsvp.js             RSVP form: status check, token pre-fill, submit
├── JS/admin.js            Dashboard: stats, table, toggle, delete, export
└── Images/                All photos (see Photo Filenames below)
```

**Note:** `our-story.html` and `faq.html` exist on disk but their routes are removed from server.js and all nav links are gone. They are not accessible.

## API Routes

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/auth/site` | — | Guest site login |
| POST | `/api/auth/logout` | — | Guest logout |
| POST | `/api/admin/auth` | — | Admin login |
| POST | `/api/admin/logout` | — | Admin logout |
| GET | `/api/rsvp/status` | — | Is RSVP open? |
| GET | `/api/rsvp/token/:token` | — | Pre-fill data for token |
| POST | `/api/rsvp` | — | Submit RSVP |
| GET | `/api/admin/rsvps` | admin | All RSVPs |
| GET | `/api/admin/rsvps/export` | admin | CSV download |
| GET | `/api/admin/stats` | admin | Counts |
| GET | `/api/admin/rsvp-status` | admin | Current open/closed |
| POST | `/api/admin/rsvp/toggle` | admin | Open/close RSVP |
| DELETE | `/api/admin/rsvps/:id` | admin | Delete RSVP |
| POST | `/api/admin/qr/generate` | admin | Generate single QR |
| GET | `/api/admin/tokens` | admin | All guest tokens |
| DELETE | `/api/admin/tokens/:id` | admin | Delete token |
| POST | `/api/admin/guests/import` | admin | Bulk CSV import → tokens |
| GET | `/api/gallery` | site | Gallery photo list (for guest page) |
| GET | `/api/party` | site | Wedding party data (for guest page) |
| POST | `/api/admin/photos/site/:slot` | admin | Replace a site background photo |
| GET | `/api/admin/gallery` | admin | Gallery photo list |
| POST | `/api/admin/gallery` | admin | Add gallery photo |
| DELETE | `/api/admin/gallery/:id` | admin | Remove gallery photo |
| GET | `/api/admin/party` | admin | Wedding party data |
| POST | `/api/admin/party/:slot` | admin | Update party member name/description/photo |
| POST | `/api/contact` | — | Contact form → email via Resend to majaandjack@gmail.com |
| GET | `/api/spotify/auth` | admin | One-time Spotify OAuth — redirects to Spotify consent screen |
| GET | `/api/spotify/callback` | admin | OAuth callback — saves refresh token, displays it for copying to env |
| GET | `/api/spotify/search` | — | Search Spotify tracks (used by RSVP form) |
| GET | `/api/spotify/test` | admin | Diagnostic: tests token, playlist read, and write access |

## Colour Palette

| Name | Hex | CSS Var | Role |
|------|-----|---------|------|
| Espresso | `#2e1618` | `--espresso` / `--brown` | Text, nav bg, footer bg, dark section bg |
| Grape Fizz | `#6c1420` | `--grape-fizz` / `--gold` | Primary buttons, section labels, nav-card-1 |
| Berry | `#c15252` | `--berry` / `--blush` | Form focus, decorative accents, nav-card-3 |
| Bluebell | `#a8b4cc` | `--bluebell` / `--sage` | Muted text, light section backgrounds |
| Grassland | `#7b7c2a` | `--grassland` | Green accent, nav-card-2 |
| Chartreuse | `#c8d540` | `--chartreuse` | Hero subtitle, ornament diamonds, section labels on dark bg, footer date |
| Cream | `#faf7f2` | `--cream` | Main page background, text on dark sections |

## Design System

- **Nav:** Fixed, transparent over full hero → white `.scrolled` on scroll → `.nav-solid` (white, immediate) on inner pages. iOS safe area handled via `--safe-top` CSS variable (set by JS probe in `main.js` section 0) — nav height and hero margin-top both use `calc(var(--nav-height) + var(--safe-top, ...))`.
- **Mobile menu:** On ≤768px, hamburger menu uses `visibility: hidden; opacity: 0` when closed (NOT translateY trick — that was unreliable on smaller windows). Opens with `visibility: visible; opacity: 1; transform: translateY(0)`.
- **Fixed background system:** Every page has a `<div class="site-bg-fixed">` as first child of `<body>`, styled `position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: -1; background-size: cover; background-position: center center`. This is the single source of the page's background photo. The photo for each page is set via inline `style="background-image: url('/Images/photo-XX.jpg');"` on that div.
- **Hero full** (`index.html`): `min-height: 100vh`, `background-color: transparent` — shows `.site-bg-fixed` through the `::before` espresso gradient overlay. No inline `style` background-image on the `<section>`.
- **Hero page** (inner pages): `height: 50vh`, `background-color: transparent` — shows `.site-bg-fixed` through `::before` espresso overlay. No inline `style` background-image on the `<section>`.
- **Photo strips:** `.photo-strip` — `min-height: 340px`, dark espresso overlay at 35% via `::before`. On desktop (>768px, non-iOS): keeps own `background-attachment: fixed` parallax image (inline style on the div). On mobile (≤768px) AND iOS (`@supports`): `background-image: none !important` — shows `.site-bg-fixed` through the overlay instead.
- **Section colors:**
  - Default `.section`: cream bg (`background-color: var(--cream)` — explicitly set, does NOT inherit from body)
  - `.section-alt`: espresso bg, white text, chartreuse labels
  - `.section-blush`: grape-fizz bg, white text
- **Section titles:** Playfair Display bold (NOT Cormorant Garamond — Cormorant is hero script + footer + nav brand only)
- **Section labels:** 0.72rem, uppercase, grape-fizz on cream sections (chartreuse hardcoded on `.section-alt` — NOT affected by page themes)
- **Nav cards** (homepage): 3 colored cards — 1=grape-fizz, 2=grassland, 3=berry — white text, no emojis
- **No emojis** anywhere on the site
- **Buttons:** `.btn-primary` (grape-fizz fill), `.btn-secondary` (outlined berry border), `.btn-blush` (berry fill)
- **Ornament dividers:** `.ornament` with `.ornament-diamond` (chartreuse)
- **Fade-in:** `.fade-in` + IntersectionObserver → `.visible` class (stagger via `delay-1` through `delay-4`)
- **Countdown:** targets `2027-08-29T16:00:00` in `JS/main.js`
- **Timeline cards** (`schedule.html`): click-to-flip — front shows event info + "Tap for directions" hint, back shows venue name, address, and Google Maps link. All items use uniform HTML order (`content → dot → spacer`); CSS `nth-child(odd/even)` handles alternating left/right layout. `.timeline-content.flipped` triggers `rotateY(180deg)` on `.timeline-card-inner`. Back button unflips. Fri/Sat/Mon items show "Location TBD" (no Maps link yet). `.timeline-day-title` background uses `var(--dark-bg)` so it rotates with page theme. Schedule is 4 days: Fri Aug 27 / Sat Aug 28 / Sun Aug 29 (Big Day — fully populated) / Mon Aug 30.

## Per-Page Colour Themes

Each page overrides `--grape-fizz` (and sometimes `--berry`) via a `<body>` class. This changes section labels on cream sections and primary buttons. Section-alt labels remain chartreuse (hardcoded). Do NOT change these without being asked.

All three variables are defined in a single block in `CSS/style.css` — search for `Page Themes — per-page colour palette overrides` to find and edit them.

| Page(s) | Body class | `--grape-fizz` (labels/buttons) | `--accent` (diamonds/highlights) | `--dark-bg` (footer/dark sections) |
|---------|-----------|----------------|-----------|---------|
| Home, Registry | *(none)* | `#6c1420` grape-fizz | `#c8d540` chartreuse | `#2e1618` espresso |
| Details, RSVP | `theme-chartreuse` | `#c8d540` chartreuse | `#c15252` berry | `#1e2608` dark olive |
| Schedule, Contact | `theme-berry` | `#c15252` berry | `#a8b4cc` bluebell | `#2e1212` dark red |
| Wedding Party | `theme-bluebell` | `#a8b4cc` bluebell | `#7b7c2a` grassland | `#131a2e` dark navy |
| Gallery | `theme-bluebell-grassland` | `#a8b4cc` bluebell | `#c8d540` chartreuse | `#141604` dark forest |

## Photo Filenames (all in `/Images/`)

Photos are referenced in two places per page: the `.site-bg-fixed` div (inline style, always shown) and the `.photo-strip` div (inline style, desktop-only parallax). Hero `<section>` elements have NO inline background-image — they are transparent and show `.site-bg-fixed` through.

| File | Used on |
|------|---------|
| `photo-home.jpg` | Homepage `.site-bg-fixed` + photo strip; also gallery + wedding-party strips |
| `photo-details.jpg` | Details `.site-bg-fixed` + photo strip; also wedding-party `.site-bg-fixed` |
| `photo-rsvp.jpg` | RSVP `.site-bg-fixed` + photo strip; also schedule `.site-bg-fixed` + strip |
| `photo-registry.jpg` | Registry `.site-bg-fixed` + photo strip |
| `photo-contact.jpg` | Contact `.site-bg-fixed` + photo strip |
| `photo-dresscode.jpg` | Dress code card on Details page (displayed as `.dresscode-photo`) |
| `photo-gallery-01.jpg` … | Gallery page — add real engagement photos here (gallery.html uses existing photos as placeholders) |

## Placeholder Content Still Needing Real Info

- **Contact phone**: `+1 (555) 000-0000` — replace when known
- **Wedding planner**: "Jane Planner" / `planner@example.com` — replace or remove if not applicable
- **Malcolm Hotel booking link**: `href="#"` on the Book Now button in `details.html`
- **Spotify write fix**: Delete and recreate the Spotify Developer app (currently rate-limited, try after 2026-03-20) — new app may bypass the 403 write restriction on the current app
- **Wedding party names + photos**: Managed via admin → Photos → Wedding Party tab. Names, descriptions, and photos are stored in `db.json` and rendered dynamically. Party photos saved as `party-{slot}.jpg` in `/Images/`.
- **Gallery photos**: Managed via admin → Photos → Gallery tab. Photos stored in `db.json`, filenames saved as `gallery-{id}.jpg`. Gallery page renders dynamically from `/api/gallery`.
- **Schedule placeholder events**: Friday Aug 27 (welcome reception + rehearsal dinner), Saturday Aug 28 (activities TBD), and Monday Aug 30 (farewell brunch) items in `schedule.html` are placeholder — fill in times, venues, details. Sunday Aug 29 is fully populated (ceremony + reception).

## Parking Note

> "Please park on the far end of the lot to avoid overcrowding near the ceremony tent"

## Mobile Background Photos

Every page has two background divs:
1. `.site-bg-fixed` — always shown (desktop photo)
2. `.site-bg-mobile` — shown only on ≤768px (mobile photo, `display:none` on desktop)

Mobile filenames: `photo-{slot}-mobile.jpg`. If no mobile photo uploaded, the mobile div has no background and the desktop div shows through (natural fallback). Admin → Photos → Site Photos shows both desktop and mobile upload slots per card. Dresscode has no mobile slot.

SITE_PHOTO_SLOTS in server.js includes both `home` and `home-mobile` variants for each page.

## RSVP Form Fields (current)

Name, email, phone, attending yes/no, guest count (shown when attending), events checklist (shown when attending — see below), dietary restrictions (shown when attending), song request — Spotify search + pick (shown when attending), message to Jack & Maja

## RSVP Event Checkboxes

When attending = yes, guests see "Which events will you be joining us for?" with checkboxes grouped by day:

| Value | Label | Day |
|-------|-------|-----|
| `welcome-reception` | Welcome Reception | Friday, Aug 27 |
| `rehearsal-dinner` | Rehearsal Dinner | Friday, Aug 27 |
| `saturday-activities` | Activities & Exploring | Saturday, Aug 28 |
| `wedding` | Ceremony & Reception | Sunday, Aug 29 (pre-checked) |
| `farewell-brunch` | Farewell Brunch | Monday, Aug 30 |

Events stored as an array on each RSVP in `db.json`. Admin dashboard has an "Event Attendance" section with per-event counts. RSVP table has an Events column. CSV export includes Events column.

`EVENT_IDS` constant in `server.js` and `EVENT_LABELS` in `JS/admin.js` define the canonical list. If events become dynamic (admin-managed), these will need to be replaced with db.json lookups.

## Claude Instructions

- **Never change the colour palette without being asked** — it was chosen deliberately
- **Always update CLAUDE.md** when making changes that affect layout, structure, navigation, or real content
- **No emojis** anywhere in the site — this was explicitly requested
- All pages share the same `<nav>` and `<footer>` structure — keep them in sync
- Use semantic HTML: `<section>`, `<article>`, `<header>`, `<nav>`, `<footer>`
- Mobile-first — test at 375px
- When touching JS files, keep `fetch()` calls with proper error handling
- `data/db.json` is the source of truth — never suggest SQLite or other DBs (Node v24 can't compile native modules without extra tooling)
- Tone: warm, romantic, slightly adventurous (Canmore mountain setting)
