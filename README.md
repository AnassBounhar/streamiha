<div align="center">

# Streamiha v3

### TMDB-powered web app for discovery, details, playback, and analytics

<p>
  <img alt="Stack" src="https://img.shields.io/badge/Stack-HTML%20%7C%20CSS%20%7C%20JavaScript%20%7C%20PHP-0f172a?style=for-the-badge" />
  <img alt="Architecture" src="https://img.shields.io/badge/Architecture-pages%20%2F%20js%20%2F%20css%20%2F%20api-334155?style=for-the-badge" />
  <img alt="Security" src="https://img.shields.io/badge/Security-CSP%20%2B%20Rewrite%20Hardening-16a34a?style=for-the-badge" />
</p>

</div>

## Features

### Home experience
- Cinematic hero section with trailer playback and fallback image behavior
- Continue Watching rail persisted in localStorage
- Top and discovery rails (movies, TV, genre, cinema now, monthly releases)
- Dedicated rails for platforms, companies, and artists
- Global search modal with debounce and short search history
- Favorites (starred) system with local persistence

### Content browsing
- Unified content page (`content.html`) for:
  - By platform
  - By company
  - By artist
- Media type tabs: All / Movies / TV
- Artist mode based on TMDB person combined credits for accurate filmography listings
- TV filtering excludes live/talk/news style genres from listings
- Incremental pagination with load-more behavior

### Details page
- Full media metadata and backdrop/poster rendering
- Trailer support (YouTube) with fallback logic
- Cast, crew, companies, and similar titles
- TV season/episode selector and watch flow integration
- Continue Watching update hooks and favorites toggle

### Player
- `player.php` endpoint for embedding approved stream URLs
- Server-side URL validation (vidking host allowlist)
- Fullscreen iframe player shell with guarded interactions
- Externalized player script (`js/player.js`) to comply with CSP

### Analytics
- Event/session tracking with source and geo hints
- SQLite-backed analytics API (`api/analytics.php`)
- PIN-protected analytics dashboard (`pages/analytics.html`)
- Weekly/monthly charts + top movies/sources/locations/IPs

## Security & Routing

- Apache rewrite routes map public URLs to `/pages/*`
- HTTPS redirect enforced (localhost exempt)
- Custom 404 page (`/pages/oopsy.html`) with auto-return home countdown
- Security headers configured in `.htaccess`:
  - CSP
  - X-Content-Type-Options
  - X-Frame-Options
  - Referrer-Policy
  - Permissions-Policy
  - COOP / CORP
- Sensitive files blocked (`.env`, lockfiles, hidden files)

## Project Structure

- `pages/`
  - `index.html`, `content.html`, `details.html`, `analytics.html`, `player.php`, `oopsy.html`
- `js/`
  - `main.js`, `content.js`, `details.js`, `player.js`, `analytics.js`, `analytics-page.js`, `cache.js`, `logo-map.js`
- `css/`
  - `index.css`, `content.css`, `details.css`, `movies.css`, `tvshows.css`
- `api/`
  - `tmdb.php`, `analytics.php`
- `.htaccess`

## Requirements

- PHP with cURL enabled
- Apache with `mod_rewrite` and `mod_headers`
- TMDB Read Access Token (v4)

## Environment

Create `.env` at project root:

- `TMDB_API_READ_TOKEN=...`
- `TMDB_CURL_INSECURE=0`

Use `TMDB_CURL_INSECURE=1` only for local troubleshooting.

## Local Run

Serve repository root with Apache.

- With rewrite rules: open `/`
- Without rewrite rules: open `/pages/index.html`

## Validation

```bash
node --check js/cache.js
node --check js/logo-map.js
node --check js/main.js
node --check js/content.js
node --check js/details.js
node --check js/player.js
node --check js/analytics.js
node --check js/analytics-page.js
php -l api/tmdb.php
php -l api/analytics.php
php -l pages/player.php
```

## Notes

- `skills` and `skills/` are ignored by git (see `.gitignore`).
- `.env` files are ignored except `.env.example`.
