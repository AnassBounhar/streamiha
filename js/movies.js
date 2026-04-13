const TMDB_BASE = '/api/tmdb.php';
const IMG_BASE = 'https://image.tmdb.org/t/p';
const MEDIA_TYPE = 'movie';
const MEDIA_LABEL = 'Movies';

function showApp() {
  document.body.classList.add('ready');
}

async function fetchJson(path, query) {
  const cachedFetch = typeof window.fetchJsonCached === 'function' ? window.fetchJsonCached : null;
  if (cachedFetch) {
    return cachedFetch(path, query);
  }
  const url = new URL(TMDB_BASE, window.location.origin);
  url.searchParams.set('path', path);
  if (query) {
    Object.keys(query).forEach(function (k) {
      if (query[k] !== undefined && query[k] !== null && query[k] !== '') {
        url.searchParams.set(k, String(query[k]));
      }
    });
  }
  const response = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new Error('TMDB error ' + response.status);
  }
  return response.json();
}

function posterUrl(path) {
  if (!path) return '../assets/profile.png';
  return IMG_BASE + '/w342' + path;
}

function logoUrl(path) {
  if (!path) return '../assets/profile.png';
  return IMG_BASE + '/w500' + path;
}

function titleLogoUrl(path) {
  if (!path) return '';
  return IMG_BASE + '/w300' + path;
}

function detailsUrl(id) {
  return './details.html?type=' + encodeURIComponent(MEDIA_TYPE) + '&id=' + encodeURIComponent(id);
}

async function fetchTitleLogos(ids) {
  const map = new Map();
  await Promise.all(ids.map(async function (id) {
    try {
      const images = await fetchJson('/' + MEDIA_TYPE + '/' + id + '/images');
      map.set(id, images.logos || []);
    } catch (_) {
      map.set(id, []);
    }
  }));
  return map;
}

function pickLogo(logoMap, id) {
  const arr = logoMap.get(id);
  if (!arr || !arr.length) return '';
  const en = arr.find(function (x) { return x.iso_639_1 === 'en' && x.file_path; });
  if (en) return en.file_path;
  const any = arr.find(function (x) { return x.file_path; });
  return any ? any.file_path : '';
}

function renderCards(items, logoMap) {
  const grid = document.getElementById('movies-grid');
  if (!grid) return;

  items.forEach(function (item) {
    const title = item.title || item.name || 'Untitled';
    const card = document.createElement('div');
    card.className = 'card';
    card.onclick = function () {
      window.location.href = detailsUrl(item.id);
    };

    const wrap = document.createElement('div');
    wrap.className = 'poster-wrap';

    const img = document.createElement('img');
    img.className = 'poster';
    img.alt = title + ' poster';
    img.src = posterUrl(item.poster_path || item.backdrop_path);

    const dim = document.createElement('div');
    dim.className = 'poster-dim';

    const logoPath = pickLogo(logoMap, item.id);
    const logo = document.createElement('img');
    logo.className = 'logo';
    logo.alt = title + ' logo';
    if (logoPath) {
      logo.src = titleLogoUrl(logoPath);
    } else {
      logo.style.display = 'none';
    }

    wrap.appendChild(img);
    wrap.appendChild(dim);
    wrap.appendChild(logo);

    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = title;

    card.appendChild(wrap);
    card.appendChild(meta);
    grid.appendChild(card);
  });
}

function normalizeMode(value) {
  const v = (value || '').toLowerCase();
  if (v === 'company') return 'company';
  return 'platform';
}

async function loadBrandLogo(mode, id, name) {
  const brandLogo = document.getElementById('brand-logo');
  if (!brandLogo) {
    return;
  }

  const localLogo = typeof window.resolveLocalBrandLogo === 'function'
    ? window.resolveLocalBrandLogo(name)
    : '';

  let fallback = '../assets/profile.png';

  if (mode === 'platform') {
    try {
      const providersData = await fetchJson('/watch/providers/' + MEDIA_TYPE, { language: 'en-US', watch_region: 'US' });
      const provider = (providersData.results || []).find(function (x) {
        return String(x.provider_id) === String(id);
      });
      fallback = logoUrl(provider && provider.logo_path ? provider.logo_path : '');
    } catch (_) {
    }
  } else {
    try {
      const companyData = await fetchJson('/company/' + id, { language: 'en-US' });
      fallback = logoUrl(companyData && companyData.logo_path ? companyData.logo_path : '');
    } catch (_) {
    }
  }

  if (localLogo) {
    if (typeof window.loadWhiteSvgIntoImg === 'function' && /\.svg(?:\?.*)?$/i.test(localLogo)) {
      window.loadWhiteSvgIntoImg(brandLogo, localLogo, fallback);
    } else {
      brandLogo.src = localLogo;
    }
    brandLogo.onerror = function () {
      brandLogo.onerror = null;
      brandLogo.src = fallback;
    };
  } else {
    brandLogo.src = fallback;
  }
}

async function load() {
  const params = new URLSearchParams(window.location.search);
  const mode = normalizeMode(params.get('mode'));
  let id = params.get('id');
  if (!id) {
    id = mode === 'company' ? params.get('company') : params.get('provider');
  }
  const name = params.get('name') || (mode === 'company' ? 'Company' : 'Platform');

  let page = 1;
  let loading = false;
  let hasMore = true;

  const titleEl = document.getElementById('page-title');
  if (titleEl) {
    titleEl.textContent = MEDIA_LABEL + ' by ' + name;
  }

  await loadBrandLogo(mode, id, name);

  async function loadPage() {
    if (!id || loading || !hasMore) {
      return;
    }
    loading = true;
    const btn = document.getElementById('load-more');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Loading...';
    }

    try {
      const query = {
        language: 'en-US',
        sort_by: 'popularity.desc',
        include_adult: false,
        include_video: false,
        page: page
      };
      if (mode === 'platform') {
        query.watch_region = 'US';
        query.with_watch_providers = id;
      } else {
        query.with_companies = id;
      }

      const data = await fetchJson('/discover/' + MEDIA_TYPE, query);
      const items = (data.results || []).slice(0, 10);
      const logoMap = await fetchTitleLogos(items.map(function (x) { return x.id; }));
      renderCards(items, logoMap);
      page += 1;
      hasMore = page <= (data.total_pages || 1);
      if (btn) {
        btn.disabled = false;
        btn.textContent = hasMore ? 'Load More' : 'No More Titles';
      }
    } catch (_) {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Load More';
      }
    }

    loading = false;
  }

  const btn = document.getElementById('load-more');
  if (btn) {
    btn.onclick = loadPage;
  }

  await loadPage();
  showApp();
}

load();
