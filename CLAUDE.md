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
- **Spotify:** Song request on RSVP form — guests search Spotify and pick a song. Song name + URI stored with RSVP. **Auto-add to playlist is abandoned** — Spotify write API returns 403 despite correct scopes and a recreated app. Songs are shown in the admin dashboard "Song Requests" section with a "Download URIs" button that exports `song-requests.txt` (one URI per line + guest name) for manual playlist building. Spotify auth flow (`/api/spotify/auth`) still works for search. Playlist ID: `2yGEUvxvBzCpGob3JwgLQB`.
- **Fonts:** Playfair Display (headings/section titles), Cormorant Garamond italic (hero script + footer + nav brand + enter monogram — `--font-script`), Lato (body) — Google Fonts
- **No build tools** — plain HTML/CSS/JS served as static files from Express
- **File uploads:** `multer` handles multipart uploads — saved to `/Images/` with auto-generated filenames. Site photos overwrite fixed filenames. Party photos: `party-{slot}.jpg`. Gallery photos: `gallery-{id}.jpg`.
- **Deployment:** Railway — connected to GitHub repo `Jackomac1/jm-wedding-website`, auto-deploys on push to `main`. Live at `https://majaandjack.ca`. Custom domain configured on Railway; `www.majaandjack.ca` is the primary domain. **Note:** Railway filesystem is ephemeral — `db.json` is wiped on each redeploy. A Railway Volume should be set up at `/data` to persist data. This includes in-place content edits (`db.content`, see below) — same exposure as everything else in `db.json`.

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
├── rsvp.html              RSVP form
├── gallery.html           Photo gallery — hover-zoom + lightbox on click
├── schedule.html          Multi-day timeline: Fri Aug 27 / Sat Aug 28 / Sun Aug 29 (Big Day) / Mon Aug 30 — click-to-flip cards with Google Maps links
├── registry.html          REMOVED 2026-08-25 (see note below) — was the cash gift page
├── contact.html           REMOVED 2026-08-25 (see note below) — was contact info + message form
├── wedding-party.html     REMOVED 2026-08-25 (see note below) — was bridal party + groomsmen
├── admin/
│   ├── login.html
│   ├── dashboard.html     RSVP toggle, stats, song requests, table, CSV export
│   ├── qr-generator.html  Single QR + bulk CSV import + printable QR sheet
│   ├── photos.html        Photo manager: site backgrounds + gallery (Wedding Party tab removed 2026-08-25 along with the page; /api/party + /api/admin/party* still work if needed later, just no admin UI for them)
│   ├── schedule.html      Schedule event CRUD (add/edit/delete events + RSVP flags)
│   └── music.html         Background music: Spotify preview search or file upload, enable/disable
├── CSS/style.css          Main stylesheet (~1640 lines)
├── CSS/admin.css          Admin panel styles (~830 lines)
├── JS/main.js             Nav scroll, hamburger, countdown, fade-ins, background music player
├── JS/rsvp.js             RSVP form: status check, token pre-fill, submit
├── JS/admin.js            Dashboard: stats, table, toggle, delete, export
└── Images/                All photos (see Photo Filenames below)
```

**Note:** `our-story.html`, `faq.html`, `registry.html`, `contact.html`, and `wedding-party.html` all exist on disk but their routes are removed from server.js and all nav links (menu + footer + homepage nav-cards) are gone. They are not accessible. For the latter 3 (removed 2026-08-25): `/api/contact` (Resend email), `/api/party` + `/api/admin/party*` (wedding party CRUD), and the Admin → Photos → Wedding Party tab were deliberately left working — nothing guest-facing links to them, but the admin can still manage that data or bring the pages back by re-adding the routes + nav links. `rsvp.html`'s "RSVP is closed" message used to link to `/contact`; it now points to a `mailto:majaandjack@gmail.com` link instead so guests still have a way to reach out.

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
| GET | `/api/schedule` | site | All schedule events sorted by dayOrder/sortOrder |
| GET | `/api/rsvp/events` | — | Events with showOnRsvp=true (used by RSVP form checkboxes) |
| GET | `/api/admin/events` | admin | All schedule events |
| POST | `/api/admin/events` | admin | Create schedule event |
| PUT | `/api/admin/events/:id` | admin | Update schedule event |
| DELETE | `/api/admin/events/:id` | admin | Delete schedule event |
| GET | `/api/admin/qr/print-sheet` | admin | Printable HTML page of all QR codes |
| GET | `/api/spotify/auth` | admin | One-time Spotify OAuth — redirects to Spotify consent screen |
| GET | `/api/spotify/callback` | admin | OAuth callback — saves refresh token, displays it for copying to env |
| GET | `/api/spotify/search` | — | Search Spotify tracks (used by RSVP form + music admin); now includes `preview_url` field |
| GET | `/api/spotify/test` | admin | Diagnostic: tests token, playlist read, and write access |
| GET | `/api/music` | — | Public: returns music enabled state + src URL (used by guest pages) |
| GET | `/api/admin/music` | admin | Full music settings from db |
| POST | `/api/admin/music/upload` | admin | Upload audio file → saved as `audio/site-music.{ext}` |
| POST | `/api/admin/music/spotify` | admin | Save a Spotify preview selection (previewUrl, trackName, artist, albumArt) |
| POST | `/api/admin/music/settings` | admin | Update enabled toggle and/or displayName |
| DELETE | `/api/admin/music` | admin | Remove current song and reset music settings |
| GET | `/api/content` | — | Public: `{ content, isAdmin }` — in-place text overrides + whether the session is an admin session |
| PUT | `/api/admin/content` | admin | Upsert `{key, value}` into `db.content`; `value: null` removes the override (reset to default) |

## Colour Palette

| Name | Hex | CSS Var | Role |
|------|-----|---------|------|
| Forest Green | `#3D6B4D` | `--espresso` / `--brown` / `--grassland` | Primary text, nav bg, footer bg, dark section bg |
| Grape Fizz | `#5C1B3B` | `--grape-fizz` / `--gold` / `--berry` / `--blush` | Accent text, buttons, section labels, CTAs (was Hot Pink `#D91B8F` — changed 2026-08-22) |
| Bluebell | `#A9BEDD` | `--bluebell` / `--sage` / `--accent` | Section stripe colour, accents, backgrounds (was Sage Green `#B8C856` — changed 2026-08-22) |
| Sage Green | `#B8C856` | `--chartreuse` | `.section-alt` focus/outline accent only — kept distinct from `--bluebell`, not part of the 2026-08-22 palette shift |
| Dusty Mauve | `#E9D8E0` | `--light-berry` / `--light-blush` | Light accent tint (was Soft Pink `#F5D5E0`) |
| Pale Blue | `#E3E9F6` | `--light-bluebell` / `--light-sage` | Light accent tint (was pale sage `#E8F0C0`) |
| Cream | `#F5E6D3` | `--cream` | Page background, text on dark backgrounds |

## Design System

- **Nav:** Fixed, transparent over the hero on every live page → white `.scrolled` on scroll (as of 2026-08-25, all live pages behave this way — `.nav-solid`, the old "white immediately, no scroll watcher" variant, is now only used by the already-removed contact/registry/our-story/faq/wedding-party HTML files; `JS/main.js`'s `initNavScroll` already skips the scroll watcher when it sees `.nav-solid`, so nothing needed to change there). iOS safe area handled via `--safe-top` CSS variable (set by JS probe in `main.js` section 0) — nav height uses `calc(var(--nav-height) + var(--safe-top, ...))`.
- **Mobile menu:** On ≤768px, hamburger menu uses `visibility: hidden; opacity: 0` when closed (NOT translateY trick — that was unreliable on smaller windows). Opens with `visibility: visible; opacity: 1; transform: translateY(0)`.
- **Fixed background system:** Every page has a `<div class="site-bg-fixed">` as first child of `<body>`, styled `position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: -1; background-size: cover; background-position: center center`. This is the single source of the page's background photo. The photo for each page is set via inline `style="background-image: url('/Images/photo-XX.jpg');"` on that div.
- **Hero full** (`index.html`): `min-height: 100vh`, `background-color: transparent` — shows `.site-bg-fixed` through the `::before` espresso gradient overlay. No inline `style` background-image on the `<section>`.
- **Hero page** (Details, RSVP, Gallery, Schedule): also `min-height: 100vh` as of 2026-08-25 (was `height: 50vh` with a `margin-top` pushing it below a solid nav) — now centers its title in the full viewport and includes the same `.scroll-indicator` markup as the homepage, matching `.hero-full`'s layout exactly. Still keeps its own smaller `.hero-page .hero-script` font-size and its own (slightly different) `::before` gradient — only the sizing/centering/scroll-indicator/nav-transparency behavior was unified, not the typography scale.
- **Photo strips:** `.photo-strip` — `min-height: 340px`, dark espresso overlay at 35% via `::before`. On desktop (>768px, non-iOS): keeps own `background-attachment: fixed` parallax image (inline style on the div). On mobile (≤768px) AND iOS (`@supports`): `background-image: none !important` — shows `.site-bg-fixed` through the overlay instead.
- **Section colors:**
  - Default `.section`: cream bg (`background-color: var(--cream)` — explicitly set, does NOT inherit from body)
  - `.section-alt`: bluebell/cream repeating-stripe bg (not solid — corrected 2026-08-22, was documented as solid espresso), espresso text, grape-fizz section labels (fixed, not page-themed)
  - `.section-blush`: grape-fizz bg, white text
- **Section titles:** Playfair Display bold (NOT Cormorant Garamond — Cormorant is hero script + footer + nav brand only)
- **Section labels:** 0.72rem, uppercase, grape-fizz on cream sections (chartreuse hardcoded on `.section-alt` — NOT affected by page themes)
- **Nav cards** (homepage): 2 colored cards (was 3 — Gifts card removed 2026-08-25 along with the whole Registry page) — 1=Details=grape-fizz, 2=RSVP=bluebell (fixed `#A9BEDD`, dark espresso text since white doesn't read on a light bg)
- **No emojis** anywhere on the site
- **Buttons:** `.btn-primary` (grape-fizz fill), `.btn-secondary` (outlined berry border), `.btn-blush` (berry fill)
- **Ornament dividers:** `.ornament` with `.ornament-diamond` (chartreuse)
- **Fade-in:** `.fade-in` + IntersectionObserver → `.visible` class (stagger via `delay-1` through `delay-4`)
- **Countdown:** targets `2027-08-29T16:00:00` in `JS/main.js`
- **Solid forest-green fills → grape fizz (2026-08-22):** footer bg, homepage "Gifts" nav-card is bluebell instead (Details/RSVP cards stayed grape-fizz), gallery photo placeholder, schedule day-pill label bg, wedding-party flip-card back, floating music button — all switched from forest green to a **fixed** `#5C1B3B` (or `#A9BEDD` for the bluebell card), not `var(--grape-fizz)`, since that variable is page-themed and would've made these inconsistent across pages. Text sitting on top was re-checked for contrast: footer script/date/link-hover moved from grape-fizz-aliased colors (would've matched the new bg) to bluebell; music button's "playing" state moved to bluebell for the same reason. Forest green stays as-is for primary text, nav, and the admin-only inline content-editor toggle/banner (intentionally not touched — changing it would remove its idle-vs-active color distinction, and it's admin tooling, not guest-facing).
- **Timeline cards** (`schedule.html`): **fully dynamic** — rendered from `GET /api/schedule` (requires site auth). Events stored in `db.json` as `scheduleEvents` array, managed via Admin → Schedule. Each event has: `id`, `slug`, `title`, `time`, `dayLabel`, `dayDate`, `dayOrder`, `sortOrder`, `description`, `venue`, `address`, `mapsUrl`, `showOnRsvp`, `rsvpLabel`. Click-to-flip cards; back shows venue + Maps link if `mapsUrl` is set. Schedule is 4 days: Fri Aug 27 / Sat Aug 28 / Sun Aug 29 (Big Day) / Mon Aug 30.

## Per-Page Colour Themes

Each page overrides `--grape-fizz` (and sometimes `--berry`) via a `<body>` class. This changes section labels on cream sections and primary buttons. Section-alt labels remain chartreuse (hardcoded). Do NOT change these without being asked.

All three variables are defined in a single block in `CSS/style.css` — search for `Page Themes — per-page colour palette overrides` to find and edit them.

| Page(s) | Body class | `--grape-fizz` (labels/buttons) | `--accent` (diamonds/highlights) | `--dark-bg` (footer/dark sections) |
|---------|-----------|----------------|-----------|---------|
| Home *(Registry removed 2026-08-25, still has this styling but is unreachable)* | *(none)* | `#5C1B3B` grape fizz | `#A9BEDD` bluebell | `#3D6B4D` forest green |
| Details, RSVP | `theme-chartreuse` | `#3D6B4D` forest green | `#5C1B3B` grape fizz | `#2A5038` dark forest |
| Schedule *(Contact removed 2026-08-25, still has this styling but is unreachable)* | `theme-berry` | `#5C1B3B` grape fizz | `#A9BEDD` bluebell | `#3D6B4D` forest green |
| *(Wedding Party removed 2026-08-25 — `theme-bluebell` class now unused)* | `theme-bluebell` | `#A9BEDD` bluebell | `#3D6B4D` forest green | `#2A5038` dark forest |
| Gallery | `theme-bluebell-grassland` | `#A9BEDD` bluebell | `#5C1B3B` grape fizz | `#1E3028` dark forest |

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
- **Spotify write**: Abandoned — auto-add returns 403 despite correct scopes. Songs collected in admin dashboard instead (Download URIs button).
- **Wedding party names + photos**: Managed via admin → Photos → Wedding Party tab. Names, descriptions, and photos are stored in `db.json` and rendered dynamically. Party photos saved as `party-{slot}.jpg` in `/Images/`.
- **Gallery photos**: Managed via admin → Photos → Gallery tab. Photos stored in `db.json`, filenames saved as `gallery-{id}.jpg`. Gallery page renders dynamically from `/api/gallery`.
- **Schedule events**: All events now editable via Admin → Schedule. Fri/Sat/Mon events are placeholder (times/venues TBD). Sun Aug 29 is fully populated.

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

When attending = yes, guests see "Which events will you be joining us for?" with checkboxes loaded dynamically from `GET /api/rsvp/events` (no auth required). Only events with `showOnRsvp: true` appear. Grouped by `dayOrder`. The event with `slug === 'wedding'` is pre-checked by default.

Events stored as an array of slugs on each RSVP in `db.json`. Admin dashboard has an "Event Attendance" section with per-event counts (dynamic from db). RSVP table has an Events column. CSV export includes Events column.

Event list is managed via Admin → Schedule — no hardcoded constants remain.

## Background Music

Music settings stored in `db.music`:
```json
{ "enabled": false, "source": null, "filename": null, "previewUrl": null, "trackName": "", "artist": "", "albumArt": "", "displayName": "" }
```
- `source`: `"spotify"` | `"upload"` | `null`
- Audio files served from `/audio/` (static, no auth). Saved as `audio/site-music.{ext}`.
- `GET /api/music` (public): returns `{ enabled, src, displayName, albumArt?, trackName?, artist? }` or `{ enabled: false }` — used by `JS/main.js` to conditionally show the floating button.
- Guest pages: floating `♪` button (bottom-right, `.music-toggle-btn` in style.css). Click to play/pause. Cross-page continuity via `sessionStorage` (`musicEnabled`, `musicStartedAt` timestamp — elapsed time used to seek on next page load).
- Admin → Music (`/admin/music`): two tabs — **Spotify Preview** (search → pick → save preview URL) and **Upload File** (MP3/M4A up to 30 MB). Enable/disable toggle. Remove button. Optional tooltip text.
- Spotify preview note: Spotify has been removing preview URLs for many tracks since ~2023. Tracks without a preview show as grayed out in search results.

## In-Place Content Editing

Lets the admin browse the real guest-facing pages while logged in and edit hardcoded text directly on the page (click text, edit, it saves) — for the copy that doesn't already have a dedicated structured editor. **Does not** touch `details.html`/`schedule.html` or the gallery/wedding-party grids — those stay on their existing admin editors (`admin/details.html`, `admin/schedule.html`, `admin/photos.html`, `admin/accommodations.html`); this system would create a second source of truth for those fields.

- **Data**: sparse `db.content` map, `{ "key": "text" }`. Empty by default — every tagged HTML element keeps its real current text as the hardcoded fallback, so only fields an admin actually edits get an entry. `GET /api/content` (public) returns `{ content, isAdmin }`; `PUT /api/admin/content` (admin) upserts `{key, value}`, or deletes the override when `value` is `null` (reset to default).
- **Markup convention**: any element with `data-cb="key"` is overlaid/editable. Covered pages: `index.html`, `rsvp.html` (static labels only — not the dynamically-rendered event checkboxes), `gallery.html` (hero/intro text only — not the photo grid), `enter.html`. `contact.html`, `registry.html`, and `wedding-party.html` still have their `data-cb` tags too, but those pages were removed 2026-08-25 (see File Structure note) so the tags are currently dormant.
- **`shared.*` keys** (`shared.coupleNames`, `shared.weddingDate`, `shared.rsvpDeadline`, `shared.contactEmail`, `shared.footerCopyright`) are reused verbatim across every page that shows that value (footer, hero sections, the RSVP deadline embedded in prose on `index.html`/`rsvp.html`) — editing one instance updates all of them. Always wrap just the short atomic token in a nested `<span data-cb="shared.x">`, never the surrounding sentence — a shared key must never be a whole paragraph, or admin edits on one page would silently rewrite unrelated prose on another. Everything else gets its own page-scoped key (e.g. `index.hero.title`) so pages can diverge freely.
- **Never nest two `data-cb` elements** (parent and child both tagged) — nested `contenteditable` regions are unreliable across browsers. If a shared token sits inside a longer sentence, tag only the inner span and leave the surrounding sentence non-editable via this tool.
- **Front end**: `JS/content.js`, included on the 7 pages above (after the other page scripts). Fetches `/api/content` once, overlays matching elements. If `isAdmin`, shows a floating pencil toggle (`.cb-edit-toggle`, bottom-left — mirrors the music button's bottom-right treatment). In edit mode: `contenteditable` + dashed outline, Enter commits (blurs) instead of inserting a newline, paste is forced to plain text. On blur: unchanged or empty text is **not saved** — it silently reverts to the last value (empty never gets persisted, avoids dangling `aria-labelledby` targets and broken layout). Double-click a field in edit mode to reset it to its original hardcoded default.
- **`requireSiteAuth`** (server.js) also accepts `req.session.adminAuthenticated`, so a logged-in admin can browse real guest pages without a separate site-password login. One-directional — `requireAdminAuth` is untouched. `/enter`'s own redirect-if-already-authenticated check intentionally still keys off `siteAuthenticated` only, so an admin-only session can still open `/enter` to view/edit it. `POST /api/auth/logout` still only clears `siteAuthenticated` — an admin who is also site-authenticated will appear to stay logged in after hitting guest logout on a guest page (harmless UX quirk, not a security issue).
- **Known trade-off**: the overlay is pure client-side, so guests may briefly see the pre-edit default text flash before `content.js` applies the override on each page load. Not fixed — would require switching these routes from `res.sendFile()` to server-side templated serving, a real shift from this repo's static-file model.
- **Known desync**: `registry.html`'s e-transfer `mailto:majaandjack@gmail.com` link target does not update if the visible `shared.contactEmail` text is edited — same category as the already-accepted attribute-text-out-of-scope decision (`alt`, `placeholder`, `aria-label` are not covered by this system either).
- JS-driven strings (contact/RSVP/enter success-or-error messages set via `textContent =` inside `<script>` blocks, and submit-button labels that get reset by their own form-handling JS after use) are intentionally **not** tagged — a DOM-text overlay can't safely coexist with JS that overwrites the same element at runtime.
- The homepage countdown's target date is a separate constant in `JS/main.js` (`2027-08-29T16:00:00`) — editing `shared.weddingDate` text does not change it.

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
