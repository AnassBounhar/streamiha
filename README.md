<div align="center">

# Streamiha v3

### TMDB-powered web app for discovery, details, playback, and analytics

<p>
  <img alt="Stack" src="https://img.shields.io/badge/Stack-HTML%20%7C%20CSS%20%7C%20JavaScript%20%7C%20PHP-0f172a?style=for-the-badge" />
  <img alt="Architecture" src="https://img.shields.io/badge/Architecture-pages%20%2F%20js%20%2F%20css%20%2F%20api-334155?style=for-the-badge" />
  <img alt="Security" src="https://img.shields.io/badge/Security-CSP%20%2B%20Rewrite%20Hardening-16a34a?style=for-the-badge" />
</p>

A modern streaming discovery platform built with vanilla JavaScript and PHP, powered by The Movie Database (TMDB) API. Streamiha provides a cinematic experience for browsing movies and TV shows with advanced filtering, personalized recommendations, and integrated analytics.

</div>

---

## Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
- [Requirements](#requirements)
- [Installation](#installation)
- [Configuration](#configuration)
- [Project Structure](#project-structure)
- [Security & Routing](#security--routing)
- [API Reference](#api-reference)
- [Validation](#validation)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

---

## Features

### Home Experience
- **Cinematic Hero Section**: Trailer playback with intelligent fallback image behavior
- **Continue Watching**: Persistent rail stored in localStorage for seamless session resumption
- **Discovery Rails**: Top movies, TV shows, genre-based, cinema releases, and monthly trending content
- **Platform & Creator Rails**: Dedicated sections for streaming platforms, production companies, and artists
- **Global Search**: Debounced search modal with short search history
- **Favorites System**: Star/unstar content with local persistence

### Content Browsing
- **Unified Content Page** (`content.html`): Browse by platform, company, or artist
- **Media Type Tabs**: Filter between All / Movies / TV content
- **Artist Mode**: TMDB person combined credits for accurate filmography
- **Smart TV Filtering**: Excludes live/talk/news genres from TV listings
- **Incremental Pagination**: Load-more behavior for efficient content discovery

### Details Page
- **Rich Metadata**: Full media information with backdrop and poster rendering
- **Trailer Support**: YouTube trailer integration with fallback logic
- **Cast & Crew**: Complete cast, crew, production companies, and similar titles
- **TV Navigation**: Season/episode selector with integrated watch flow
- **Persistent State**: Continue Watching updates and favorites toggle

### Player
- **Secure Streaming**: `player.php` endpoint with server-side URL validation
- **Allowlist Protection**: Vidking host allowlist for approved streams
- **Fullscreen Experience**: Iframe-based player shell with guarded interactions
- **CSP Compliance**: Externalized player script (`js/player.js`) for security headers

### Analytics
- **Event Tracking**: Session and event tracking with source and geo hints
- **SQLite Backend**: Persistent analytics via `api/analytics.php`
- **PIN-Protected Dashboard**: Secure analytics dashboard at `pages/analytics.html`
- **Advanced Charts**: Weekly/monthly statistics, top movies, sources, locations, and IPs

---

## Quick Start

### Prerequisites
- PHP 7.4+ with cURL enabled
- Apache with `mod_rewrite` and `mod_headers`
- TMDB Read Access Token (v4) - [Get one here](https://www.themoviedb.org/settings/api)

### Setup (5 minutes)

1. **Clone the repository**
   ```bash
   git clone https://github.com/AnassBounhar/streamiha.git
   cd streamiha
   ```

2. **Create environment file**
   ```bash
   cp .env.example .env
   ```

3. **Add your TMDB API token**
   ```bash
   # Edit .env and add:
   TMDB_API_READ_TOKEN=your_token_here
   TMDB_CURL_INSECURE=0
   ```

4. **Serve with Apache**
   ```bash
   # Point your Apache DocumentRoot to the project root
   # Then visit: http://localhost (or your configured domain)
   ```

---

## Requirements

| Component | Version | Notes |
|-----------|---------|-------|
| PHP | 7.4+ | cURL extension required |
| Apache | 2.4+ | `mod_rewrite` and `mod_headers` enabled |
| TMDB API | v4 | Read Access Token required |
| Browser | Modern | ES6+ JavaScript support |

---

## Installation

### Step 1: Clone Repository
```bash
git clone https://github.com/AnassBounhar/streamiha.git
cd streamiha
```

### Step 2: Configure Environment
```bash
cp .env.example .env
```

Edit `.env`:
```env
TMDB_API_READ_TOKEN=your_read_access_token_here
TMDB_CURL_INSECURE=0
```

### Step 3: Enable Apache Modules
```bash
# On Ubuntu/Debian
sudo a2enmod rewrite
sudo a2enmod headers
sudo systemctl restart apache2
```

### Step 4: Configure Apache VirtualHost
```apache
<VirtualHost *:80>
    ServerName streamiha.local
    DocumentRoot /path/to/streamiha
    
    <Directory /path/to/streamiha>
        AllowOverride All
        Require all granted
    </Directory>
</VirtualHost>
```

### Step 5: Verify Installation
```bash
# Run validation checks
node --check js/cache.js
node --check js/main.js
php -l api/tmdb.php
```

---

## Configuration

### Environment Variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `TMDB_API_READ_TOKEN` | Yes | - | TMDB API authentication token |
| `TMDB_CURL_INSECURE` | No | 0 | Set to 1 only for local SSL troubleshooting |

### Security Headers (.htaccess)

The project includes hardened security headers:
- **Content Security Policy (CSP)**: Restricts resource loading
- **X-Content-Type-Options**: Prevents MIME sniffing
- **X-Frame-Options**: Prevents clickjacking
- **Referrer-Policy**: Controls referrer information
- **Permissions-Policy**: Restricts browser features
- **COOP/CORP**: Cross-origin isolation

### HTTPS Enforcement

- Automatic redirect to HTTPS (localhost exempt)
- Sensitive files blocked (`.env`, lockfiles, hidden files)

---

## Project Structure

```
streamiha/
├── pages/                    # HTML pages and PHP endpoints
│   ├── index.html           # Home page with hero and discovery rails
│   ├── content.html         # Browse by platform/company/artist
│   ├── details.html         # Media details and metadata
│   ├── analytics.html       # PIN-protected analytics dashboard
│   ├── player.php           # Secure stream player endpoint
│   └── oopsy.html           # Custom 404 error page
├── js/                      # JavaScript modules
│   ├── main.js              # Home page logic
│   ├── content.js           # Content browsing logic
│   ├── details.js           # Details page logic
│   ├── player.js            # Player functionality (CSP-compliant)
│   ├── analytics.js         # Event tracking
│   ├── analytics-page.js    # Dashboard logic
│   ├── cache.js             # Caching utilities
│   └── logo-map.js          # Platform/company logo mappings
├── css/                     # Stylesheets
│   ├── index.css            # Home page styles
│   ├── content.css          # Content page styles
│   ├── details.css          # Details page styles
│   ├── movies.css           # Movie-specific styles
│   └── tvshows.css          # TV show-specific styles
├── api/                     # PHP API endpoints
│   ├── tmdb.php             # TMDB API proxy and caching
│   └── analytics.php        # Analytics data storage and retrieval
├── assets/                  # Static assets (images, fonts, etc.)
├── .htaccess                # Apache rewrite rules and security headers
├── .env.example             # Environment variables template
├── .gitignore               # Git ignore rules
└── README.md                # This file
```

### Key Files

| File | Purpose |
|------|---------|
| `.htaccess` | Apache rewrite rules, security headers, HTTPS enforcement |
| `api/tmdb.php` | TMDB API proxy with caching and error handling |
| `api/analytics.php` | SQLite analytics backend |
| `pages/player.php` | Secure stream URL validation and embedding |
| `js/cache.js` | Client-side caching and storage management |

---

## Security & Routing

### URL Routing
- Apache rewrite rules map public URLs to `/pages/*` (transparent to users)
- Example: `/details/123` → `/pages/details.html?id=123`

### HTTPS & Redirects
- Automatic HTTPS redirect enforced (localhost exempt for development)
- Custom 404 page with auto-return home countdown

### Security Headers
All responses include hardened security headers:

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; ...
X-Content-Type-Options: nosniff
X-Frame-Options: SAMEORIGIN
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin
```

### Protected Resources
- `.env` files (environment variables)
- Lockfiles (`package-lock.json`, `composer.lock`)
- Hidden files and directories (`.git`, `.env`, etc.)

### Stream Validation
- Server-side URL validation for embedded streams
- Vidking host allowlist for approved streaming sources
- Fullscreen iframe with guarded interactions

---

## API Reference

### TMDB Proxy (`api/tmdb.php`)

**Purpose**: Proxy requests to TMDB API with caching and error handling

**Usage**:
```javascript
// From JavaScript
fetch('/api/tmdb.php?endpoint=/movie/550&language=en-US')
  .then(r => r.json())
  .then(data => console.log(data));
```

**Parameters**:
- `endpoint`: TMDB API endpoint (e.g., `/movie/550`)
- `language`: Language code (default: `en-US`)

### Analytics API (`api/analytics.php`)

**Purpose**: Track user events and generate analytics reports

**Endpoints**:
- `POST /api/analytics.php` - Log event
- `GET /api/analytics.php?action=stats` - Get statistics

**Event Tracking**:
```javascript
fetch('/api/analytics.php', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    event: 'play',
    media_id: 550,
    source: 'vidking'
  })
});
```

### Player Endpoint (`pages/player.php`)

**Purpose**: Secure stream embedding with URL validation

**Usage**:
```html
<iframe src="/player?url=https://vidking.com/embed/abc123"></iframe>
```

**Security**: Only whitelisted hosts (vidking) are allowed

---

## Validation

### JavaScript Syntax Check
```bash
node --check js/cache.js
node --check js/logo-map.js
node --check js/main.js
node --check js/content.js
node --check js/details.js
node --check js/player.js
node --check js/analytics.js
node --check js/analytics-page.js
```

### PHP Syntax Check
```bash
php -l api/tmdb.php
php -l api/analytics.php
php -l pages/player.php
```

### Run All Checks
```bash
# Create a validation script
for file in js/*.js; do node --check "$file" || exit 1; done
for file in api/*.php pages/*.php; do php -l "$file" || exit 1; done
echo "All validations passed!"
```

---

## Troubleshooting

### Common Issues

#### 1. "TMDB API Token Invalid"
- **Cause**: Missing or incorrect `TMDB_API_READ_TOKEN` in `.env`
- **Solution**: 
  - Verify token at [TMDB Settings](https://www.themoviedb.org/settings/api)
  - Ensure `.env` file exists and is readable
  - Check token format (should be a long string)

#### 2. "Rewrite Rules Not Working"
- **Cause**: Apache `mod_rewrite` not enabled
- **Solution**:
  ```bash
  sudo a2enmod rewrite
  sudo systemctl restart apache2
  ```
- **Fallback**: Access pages directly: `/pages/index.html`

#### 3. "HTTPS Redirect Loop"
- **Cause**: Incorrect Apache configuration or proxy setup
- **Solution**:
  - Check `.htaccess` HTTPS rules
  - Verify `X-Forwarded-Proto` header if behind proxy
  - Use `TMDB_CURL_INSECURE=1` for local testing only

#### 4. "Analytics Dashboard Not Loading"
- **Cause**: SQLite database permissions or missing PIN
- **Solution**:
  - Ensure `api/` directory is writable: `chmod 755 api/`
  - Check browser console for PIN prompt
  - Verify PHP SQLite extension is enabled

#### 5. "Player Not Displaying"
- **Cause**: CSP blocking or invalid stream URL
- **Solution**:
  - Check browser console for CSP violations
  - Verify stream URL is from whitelisted host (vidking)
  - Ensure `player.php` is accessible

### Debug Mode

Enable detailed logging:
```bash
# In .env
TMDB_CURL_INSECURE=1
```

Check browser console (F12) for JavaScript errors and network requests.

---

## Contributing

### Development Workflow

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Follow existing code style
   - Keep changes focused and minimal
   - Test thoroughly in browser and console

3. **Validate your code**
   ```bash
   # Run all validation checks
   node --check js/*.js
   php -l api/*.php pages/*.php
   ```

4. **Commit with clear messages**
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```

5. **Push and create a Pull Request**
   ```bash
   git push origin feature/your-feature-name
   ```

### Code Style Guidelines

- **JavaScript**: ES6+, vanilla (no frameworks)
- **PHP**: PSR-12 style, secure by default
- **CSS**: BEM naming convention
- **HTML**: Semantic markup, accessibility-first

### Testing Checklist

- [ ] All JavaScript files pass `node --check`
- [ ] All PHP files pass `php -l`
- [ ] Features work in Chrome, Firefox, Safari
- [ ] Mobile responsive design maintained
- [ ] No console errors or warnings
- [ ] Security headers present in responses

---

## Notes

- `skills/` directory is ignored by git (see `.gitignore`)
- `.env` files are ignored except `.env.example`
- Never commit sensitive data (API tokens, credentials)
- Report security issues privately to maintainers

---

## License

This project is maintained by [AnassBounhar](https://github.com/AnassBounhar)

For more information, visit the [GitHub repository](https://github.com/AnassBounhar/streamiha)

---

**Last Updated**: April 2026
