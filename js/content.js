const TMDB_BASE = '/api/tmdb.php';
const IMG_BASE = 'https://image.tmdb.org/t/p';
const BLOCKED_TV_GENRES = [10763, 10764, 10767];

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
  if (!path) return '';
  return IMG_BASE + '/w342' + path;
}

function logoUrl(path) {
  if (!path) return '../assets/profile.png';
  return IMG_BASE + '/w500' + path;
}

function detailsUrl(id, mediaType) {
  const resolvedType = mediaType === 'tv' ? 'tv' : 'movie';
  return './details.html?type=' + encodeURIComponent(resolvedType) + '&id=' + encodeURIComponent(id);
}

function isSeriesLikeTvItem(item) {
  if (!item || item.media_type !== 'tv') {
    return true;
  }
  const genres = item.genre_ids || [];
  return !BLOCKED_TV_GENRES.some(function (id) {
    return genres.indexOf(id) !== -1;
  });
}

function renderCards(items) {
  const grid = document.getElementById('movies-grid');
  if (!grid) return;

  items.forEach(function (item) {
    const title = item.title || item.name || 'Untitled';
    const card = document.createElement('div');
    card.className = 'card';
    card.onclick = function () {
      window.location.href = detailsUrl(item.id, item.media_type || 'movie');
    };

    const wrap = document.createElement('div');
    wrap.className = 'poster-wrap';

    const img = document.createElement('img');
    img.className = 'poster';
    img.alt = title + ' poster';
    const resolvedPoster = posterUrl(item.poster_path || item.backdrop_path);
    if (resolvedPoster) {
      img.src = resolvedPoster;
    } else {
      img.style.display = 'none';
      const noPoster = document.createElement('div');
      noPoster.className = 'no-poster';
      noPoster.textContent = 'NO POSTER';
      wrap.appendChild(noPoster);
    }

    const dim = document.createElement('div');
    dim.className = 'poster-dim';

    wrap.appendChild(img);
    wrap.appendChild(dim);

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
  if (v === 'artist') return 'artist';
  return 'platform';
}

function normalizeMediaType(value) {
  const v = (value || '').toLowerCase();
  if (v === 'tv') return 'tv';
  if (v === 'all') return 'all';
  return 'movie';
}

function renderMediaFilterTabs(activeMediaType, onChange) {
  const tabs = document.getElementById('media-filter-tabs');
  if (!tabs) {
    return;
  }
  tabs.innerHTML = '';
  [
    { id: 'all', label: 'All' },
    { id: 'movie', label: 'Movies' },
    { id: 'tv', label: 'TV Shows' }
  ].forEach(function (item) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'media-filter-tab' + (activeMediaType === item.id ? ' active' : '');
    btn.textContent = item.label;
    btn.onclick = function () {
      onChange(item.id);
    };
    tabs.appendChild(btn);
  });
}

async function loadBrandLogo(mode, id, name, mediaType) {
  const brandLogo = document.getElementById('brand-logo');
  const heroTitle = document.getElementById('hero-title');
  if (!brandLogo) {
    return;
  }
  if (heroTitle) {
    heroTitle.textContent = '';
    heroTitle.style.display = 'none';
  }

  let fallback = '../assets/profile.png';

  if (mode === 'platform') {
    brandLogo.classList.remove('artist');
    try {
      const providersData = await fetchJson('/watch/providers/' + mediaType, { language: 'en-US', watch_region: 'US' });
      const provider = (providersData.results || []).find(function (x) {
        return String(x.provider_id) === String(id);
      });
      fallback = logoUrl(provider && provider.logo_path ? provider.logo_path : '');
    } catch (_) {
    }

    const localLogo = typeof window.resolveLocalBrandLogo === 'function'
      ? window.resolveLocalBrandLogo(name)
      : '';
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
      return;
    }
    brandLogo.src = fallback;
    return;
  }

  if (mode === 'company') {
    brandLogo.classList.remove('artist');
    try {
      const companyData = await fetchJson('/company/' + id, { language: 'en-US' });
      fallback = logoUrl(companyData && companyData.logo_path ? companyData.logo_path : '');
    } catch (_) {
    }
    const localLogo = typeof window.resolveLocalBrandLogo === 'function'
      ? window.resolveLocalBrandLogo(name)
      : '';
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
      return;
    }
    brandLogo.src = fallback;
    return;
  }

  brandLogo.classList.add('artist');
  if (heroTitle) {
    heroTitle.textContent = name || 'Artist';
    heroTitle.style.display = 'block';
  }
  try {
    const personData = await fetchJson('/person/' + id, { language: 'en-US' });
    fallback = posterUrl(personData && personData.profile_path ? personData.profile_path : '');
  } catch (_) {
  }
  brandLogo.src = fallback || '../assets/profile.png';
}

const artistCreditsCache = {};

async function getArtistCredits(id) {
  if (artistCreditsCache[id]) {
    return artistCreditsCache[id];
  }
  const credits = await fetchJson('/person/' + id + '/combined_credits', { language: 'en-US' });
  const seen = new Set();
  const normalized = (credits.cast || []).filter(function (item) {
    return item && item.id && (item.media_type === 'movie' || item.media_type === 'tv');
  }).map(function (item) {
    return {
      id: item.id,
      media_type: item.media_type,
      title: item.title,
      name: item.name,
      poster_path: item.poster_path,
      backdrop_path: item.backdrop_path,
      popularity: item.popularity,
      vote_average: item.vote_average,
      vote_count: item.vote_count,
      genre_ids: item.genre_ids || []
    };
  }).filter(function (item) {
    const key = item.media_type + ':' + item.id;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  }).sort(function (a, b) {
    if (Number(b.popularity || 0) !== Number(a.popularity || 0)) {
      return Number(b.popularity || 0) - Number(a.popularity || 0);
    }
    if (Number(b.vote_count || 0) !== Number(a.vote_count || 0)) {
      return Number(b.vote_count || 0) - Number(a.vote_count || 0);
    }
    return Number(b.vote_average || 0) - Number(a.vote_average || 0);
  });
  artistCreditsCache[id] = normalized;
  return normalized;
}

async function discoverByMode(mode, id, mediaType, page) {
  if (mode === 'artist') {
    const all = await getArtistCredits(id);
    const seriesOnly = all.filter(isSeriesLikeTvItem);
    const filtered = mediaType === 'all'
      ? seriesOnly
      : seriesOnly.filter(function (item) { return item.media_type === mediaType; });
    const pageSize = 10;
    const start = (page - 1) * pageSize;
    return {
      items: filtered.slice(start, start + pageSize),
      totalPages: Math.max(1, Math.ceil(filtered.length / pageSize))
    };
  }

  const queryBase = {
    language: 'en-US',
    sort_by: 'popularity.desc',
    include_adult: false,
    include_video: false
  };

  if (mode === 'platform') {
    queryBase.watch_region = 'US';
    queryBase.with_watch_providers = id;
  }
  if (mode === 'company') {
    queryBase.with_companies = id;
  }

  if (mediaType === 'all') {
    const apiPage = Math.floor((page - 1) / 4) + 1;
    const chunkIndex = (page - 1) % 4;
    const chunkStart = chunkIndex * 10;

    const moviePromise = fetchJson('/discover/movie', Object.assign({}, queryBase, { page: apiPage }));
    const tvPromise = fetchJson('/discover/tv', Object.assign({}, queryBase, {
      page: apiPage,
      without_genres: BLOCKED_TV_GENRES.join(',')
    }));
    const settled = await Promise.allSettled([moviePromise, tvPromise]);
    const movieRes = settled[0].status === 'fulfilled' ? settled[0].value : { results: [], total_results: 0 };
    const tvRes = settled[1].status === 'fulfilled' ? settled[1].value : { results: [], total_results: 0 };
    const movieItems = (movieRes.results || []).map(function (x) { return Object.assign({}, x, { media_type: 'movie' }); });
    const tvItems = (tvRes.results || []).map(function (x) { return Object.assign({}, x, { media_type: 'tv' }); }).filter(isSeriesLikeTvItem);
    const merged = movieItems.concat(tvItems).sort(function (a, b) {
      return Number(b.popularity || 0) - Number(a.popularity || 0);
    });
    const totalResults = Number(movieRes.total_results || 0) + Number(tvRes.total_results || 0);
    return {
      items: merged.slice(chunkStart, chunkStart + 10),
      totalPages: Math.max(1, Math.ceil(totalResults / 10))
    };
  }

  const apiPage = Math.floor((page - 1) / 2) + 1;
  const chunkStart = ((page - 1) % 2) * 10;
  const data = await fetchJson('/discover/' + mediaType, Object.assign({}, queryBase, mediaType === 'tv'
    ? { page: apiPage, without_genres: BLOCKED_TV_GENRES.join(',') }
    : { page: apiPage }));
  const normalized = (data.results || []).map(function (x) {
    return Object.assign({}, x, { media_type: mediaType });
  });
  const filtered = mediaType === 'tv' ? normalized.filter(isSeriesLikeTvItem) : normalized;
  return {
    items: filtered.slice(chunkStart, chunkStart + 10),
    totalPages: Math.max(1, Math.ceil(Number(data.total_results || 0) / 10))
  };
}

async function load() {
  const params = new URLSearchParams(window.location.search);
  const mode = normalizeMode(params.get('mode'));
  let id = params.get('id');
  if (!id) {
    if (mode === 'company') {
      id = params.get('company');
    } else if (mode === 'artist') {
      id = params.get('artist');
    } else {
      id = params.get('provider');
    }
  }
  const name = params.get('name') || (mode === 'company' ? 'Company' : mode === 'artist' ? 'Artist' : 'Platform');
  let selectedMediaType = normalizeMediaType(params.get('media_type'));

  let page = 1;
  let loading = false;
  let hasMore = true;

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
      const result = await discoverByMode(mode, id, selectedMediaType, page);
      renderCards(result.items);
      page += 1;
      hasMore = page <= result.totalPages;
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

  const reload = async function () {
    const grid = document.getElementById('movies-grid');
    if (grid) {
      grid.innerHTML = '';
    }
    page = 1;
    loading = false;
    hasMore = true;
    await loadBrandLogo(mode, id, name, selectedMediaType === 'all' ? 'movie' : selectedMediaType);
    await loadPage();
  };

  const btn = document.getElementById('load-more');
  if (btn) {
    btn.onclick = loadPage;
  }

  const handleMediaTypeChange = function (nextType) {
    if (nextType === selectedMediaType) {
      return;
    }
    selectedMediaType = nextType;
    renderMediaFilterTabs(selectedMediaType, handleMediaTypeChange);
    const tabs = document.getElementById('media-filter-tabs');
    if (tabs) {
      const activeTab = tabs.querySelector('.media-filter-tab.active');
      if (activeTab && typeof activeTab.focus === 'function') {
        activeTab.focus();
      }
    }
    reload();
  };

  renderMediaFilterTabs(selectedMediaType, handleMediaTypeChange);

  await reload();
  showApp();
}

load();
