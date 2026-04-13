<div align="center">

# Streamiha v3

### A cinematic TMDB-powered experience for movies and TV shows

<p>
  <img alt="Stack" src="https://img.shields.io/badge/Stack-HTML%20%7C%20CSS%20%7C%20JavaScript%20%7C%20PHP-0f172a?style=for-the-badge" />
  <img alt="Architecture" src="https://img.shields.io/badge/Architecture-pages%20%2F%20js%20%2F%20css-334155?style=for-the-badge" />
  <img alt="Security" src="https://img.shields.io/badge/Security-Hardened%20Defaults-16a34a?style=for-the-badge" />
</p>

Fast browsing, smart caching, and cleaner deployment — powered by TMDB with a lightweight PHP proxy.

</div>

## Highlights

- Browse curated home sections (Top 10, trending, cinema now, monthly releases, genre, companies, platforms)
- Dedicated catalog pages for Movies and TV Shows
- Rich Details page (cast, crew, companies, seasons/episodes, similar titles, trailer)
- Shared client cache (memory + localStorage TTL)
- Apache hardening via `.htaccess`
- Clean split architecture: `pages/`, `js/`, `css/`, `api/`, `assets/`

## Project Structure

- `pages/` — HTML pages
  - `index.html`, `movies.html`, `tvshows.html`, `details.html`
- `js/` — frontend scripts
  - `main.js`, `movies.js`, `tvshows.js`, `details.js`, `cache.js`, `logo-map.js`
- `css/` — page stylesheets
  - `index.css`, `movies.css`, `tvshows.css`, `details.css`
- `api/` — backend proxy
  - `tmdb.php`
- `assets/` — logos/images/icons
- `.htaccess` — routing + security headers
- `index.html` (root) — fallback redirect to `pages/index.html`

## Prerequisites

- PHP with cURL enabled
- A TMDB Read Access Token (v4)
- Apache (recommended for `.htaccess` rewrites and headers)

## Environment Setup

1. Copy env template:

```bash
cp .env.example .env
```

2. Fill values in `.env`:

- `TMDB_API_READ_TOKEN=...`
- `TMDB_CURL_INSECURE=0`

`TMDB_CURL_INSECURE=1` should only be used for local troubleshooting.

## Run Locally

Serve the project root from a local web server (Apache preferred).

If Apache rewrites are active:

- `http://localhost/` loads home page

Without rewrites, open directly:

- `http://localhost/pages/index.html`

## Security Notes

- Sensitive files are blocked by `.htaccess` (including `.env`)
- Security headers are set (CSP, frame protection, nosniff, referrer policy, etc.)
- API proxy only accepts `GET`
- Proxy path input is validated before TMDB forwarding
- Insecure TLS fallback is limited to explicit localhost opt-in

## Caching

`js/cache.js` provides `window.fetchJsonCached(path, query, options)`:

- Memory cache for immediate reuse
- `localStorage` persistence
- Stable query-key normalization
- Default TTL: 5 minutes

Integrated across all main pages to reduce repeated TMDB calls.

## Common Troubleshooting

- **“Missing TMDB_API_READ_TOKEN”**
  - Ensure `.env` exists and token is set
- **Images/logos not loading**
  - Verify path structure and static asset serving
- **Security header/CSP issues**
  - Confirm Apache modules (`mod_headers`, `mod_rewrite`) are enabled
- **404 on root route**
  - Use `pages/index.html` directly if rewrites are unavailable

## Validation Commands

```bash
node --check js/cache.js
node --check js/logo-map.js
node --check js/main.js
node --check js/movies.js
node --check js/tvshows.js
node --check js/details.js
php -l api/tmdb.php
```

## Git Hygiene

Ignored by default:

- `skills/`
- `.env` and `.env.*`

Commit-safe env template:

- `.env.example`

---

Built for performance, cleaner structure, and safer defaults.