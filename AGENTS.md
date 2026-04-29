# AGENTS.md

## Scope
This file applies to the entire repository.

## Project summary
- Streamiha v3 is a vanilla JavaScript + PHP app.
- Frontend files are in `pages/`, `js/`, and `css/`.
- Backend endpoints are in `api/`.
- Analytics data is stored in `api/.analytics.sqlite`.

## Working rules
- Keep changes minimal and focused.
- Preserve existing formatting and naming style.
- Do not introduce new frameworks or build tools.
- Keep TMDB calls behind `api/tmdb.php`.
- Keep stream host validation in both `pages/player.php` and `js/player.js` aligned.

## Validation before commit
- `node --check js/cache.js`
- `node --check js/logo-map.js`
- `node --check js/main.js`
- `node --check js/content.js`
- `node --check js/details.js`
- `node --check js/player.js`
- `node --check js/analytics.js`
- `node --check js/analytics-page.js`
- `php -l api/tmdb.php`
- `php -l api/analytics.php`
- `php -l pages/player.php`

## Deployment note
- Follow `skills/deployment_workflow.md` for production deployment steps.