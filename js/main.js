const TMDB_BASE = '/api/tmdb.php';
const IMG_BASE = 'https://image.tmdb.org/t/p';

function setStatus(message, isError) {
  const el = document.getElementById('status');
  if (!el) {
    return;
  }
  if (!message) {
    el.innerHTML = '';
    return;
  }
  el.innerHTML = '';
  const wrap = document.createElement('div');
  if (isError) {
    wrap.className = 'error';
  }
  wrap.textContent = String(message);
  el.appendChild(wrap);
}

function showApp() {
  document.body.classList.add('ready');
}

async function fetchJson(path, query) {
  const cachedFetch = typeof window.fetchJsonCached === 'function' ? window.fetchJsonCached : null;
  if (cachedFetch) {
    return cachedFetch(path, query, { timeoutMs: 9000 });
  }
  const url = new URL(TMDB_BASE, window.location.origin);
  url.searchParams.set('path', path);
  if (query) {
    Object.keys(query).forEach((k) => {
      if (query[k] !== undefined && query[k] !== null && query[k] !== '') {
        url.searchParams.set(k, String(query[k]));
      }
    });
  }

  let timeoutId = null;
  let response;
  if (typeof AbortController !== 'undefined') {
    const controller = new AbortController();
    timeoutId = setTimeout(function () {
      controller.abort();
    }, 9000);
    response = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      signal: controller.signal
    });
    clearTimeout(timeoutId);
  } else {
    response = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error('TMDB error ' + response.status + ': ' + text);
  }
  return response.json();
}

function posterUrl(path, wide) {
  if (!path) return '';
  return IMG_BASE + (wide ? '/w500' : '/w342') + path;
}

function heroBackdropUrl(path) {
  if (!path) return '';
  return IMG_BASE + '/original' + path;
}

function logoUrl(path) {
  if (!path) return '';
  return IMG_BASE + '/w300' + path;
}

function profileLogoUrl(path) {
  if (!path) return '';
  return IMG_BASE + '/w500' + path;
}

function setBrandLogoImage(imgEl, name, fallbackPath) {
  const fallback = profileLogoUrl(fallbackPath || '');
  const localLogo = typeof window.resolveLocalBrandLogo === 'function'
    ? window.resolveLocalBrandLogo(name)
    : '';
  if (localLogo) {
    if (typeof window.loadWhiteSvgIntoImg === 'function' && /\.svg(?:\?.*)?$/i.test(localLogo)) {
      window.loadWhiteSvgIntoImg(imgEl, localLogo, fallback);
      imgEl.onerror = function () {
        imgEl.onerror = null;
        imgEl.src = fallback;
      };
      return;
    }
    imgEl.src = localLogo;
    imgEl.onerror = function () {
      imgEl.onerror = null;
      imgEl.src = fallback;
    };
    return;
  }
  imgEl.src = fallback;
}

function pickLogo(logoMap, id) {
  const arr = logoMap.get(id);
  if (!arr || !arr.length) return '';
  const english = arr.find((x) => x.iso_639_1 === 'en' && x.file_path);
  if (english) return english.file_path;
  const withPath = arr.find((x) => x.file_path);
  return withPath ? withPath.file_path : '';
}

function detailsUrl(item, fallbackType) {
  const type = item.media_type || fallbackType;
  if (type !== 'movie' && type !== 'tv') return '';
  return './details.html?type=' + encodeURIComponent(type) + '&id=' + encodeURIComponent(item.id);
}

function browseByPlatformUrl(providerId, providerName, mediaType) {
  if (!providerId) return '';
  const page = mediaType === 'tv' ? './tvshows.html' : './movies.html';
  let url = page + '?mode=platform&provider=' + encodeURIComponent(providerId);
  if (providerName) {
    url += '&name=' + encodeURIComponent(providerName);
  }
  return url;
}

function browseByCompanyUrl(companyId, companyName, mediaType) {
  if (!companyId) return '';
  const page = mediaType === 'tv' ? './tvshows.html' : './movies.html';
  let url = page + '?mode=company&company=' + encodeURIComponent(companyId);
  if (companyName) {
    url += '&name=' + encodeURIComponent(companyName);
  }
  return url;
}

function continueStreamUrl(item) {
  const type = item && item.media_type;
  if (type !== 'movie' && type !== 'tv') {
    return '';
  }
  const season = Number(item.season_number) || 1;
  const episode = Number(item.episode_number) || 1;
  return homeVidkingUrl(type, item.id, season, episode);
}

let searchDebounce;
let activeGenreId = null;

function readSearchHistory() {
  try {
    const raw = localStorage.getItem('streamiha_search_history');
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch (_) {
    return [];
  }
}

function saveSearchHistory(history) {
  try {
    localStorage.setItem('streamiha_search_history', JSON.stringify(history));
  } catch (_) {
  }
}

function rememberSearchItem(item) {
  if (!item || !item.id || (item.media_type !== 'movie' && item.media_type !== 'tv')) {
    return;
  }
  const entry = {
    id: item.id,
    media_type: item.media_type,
    title: item.title || '',
    name: item.name || '',
    poster_path: item.poster_path || '',
    backdrop_path: item.backdrop_path || '',
    release_date: item.release_date || '',
    first_air_date: item.first_air_date || ''
  };
  const prev = readSearchHistory();
  const next = [entry].concat(prev.filter(function (x) {
    return !(x && Number(x.id) === Number(entry.id) && x.media_type === entry.media_type);
  })).slice(0, 3);
  saveSearchHistory(next);
}

function readStarredContent() {
  try {
    const raw = localStorage.getItem('streamiha_starred_content');
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch (_) {
    return [];
  }
}

function prettyType(type) {
  return type === 'tv' ? 'TV Show' : type === 'movie' ? 'Movie' : 'Unknown';
}

function openSearchModal() {
  const modal = document.getElementById('search-modal');
  const input = document.getElementById('search-input');
  if (!modal || !input) return;
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  setTimeout(function () {
    input.focus();
  }, 0);
}

function closeSearchModal() {
  const modal = document.getElementById('search-modal');
  if (!modal) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
}

function renderSearchResults(items, emptyText) {
  const list = document.getElementById('search-results');
  if (!list) return;
  list.innerHTML = '';

  if (!items || !items.length) {
    const empty = document.createElement('li');
    empty.className = 'search-sub';
    empty.style.padding = '10px 12px';
    empty.textContent = emptyText || 'No results';
    list.appendChild(empty);
    return;
  }

  items.forEach(function (item) {
    const type = item.media_type;
    if (type !== 'movie' && type !== 'tv') return;

    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'search-item';

    const thumb = document.createElement('img');
    thumb.className = 'search-thumb';
    thumb.alt = item.title || item.name || 'poster';
    thumb.src = posterUrl(item.poster_path || item.backdrop_path, false);

    const meta = document.createElement('div');
    meta.className = 'search-meta';

    const title = document.createElement('div');
    title.className = 'search-title';
    title.textContent = item.title || item.name || 'Untitled';

    const sub = document.createElement('div');
    sub.className = 'search-sub';
    const dateText = item.release_date || item.first_air_date || '';
    sub.textContent = prettyType(type) + (dateText ? ' • ' + dateText.slice(0, 4) : '');

    meta.appendChild(title);
    meta.appendChild(sub);
    btn.appendChild(thumb);
    btn.appendChild(meta);

    btn.onclick = function () {
      rememberSearchItem(item);
      const goTo = detailsUrl(item, type);
      if (goTo) {
        window.location.href = goTo;
      }
    };

    li.appendChild(btn);
    list.appendChild(li);
  });
}

function renderSearchHistory() {
  const history = readSearchHistory().filter(function (x) {
    return x && x.id && (x.media_type === 'movie' || x.media_type === 'tv');
  });
  if (!history.length) {
    renderSearchResults([], 'Search history is empty');
    return;
  }
  renderSearchResults(history, 'Search history is empty');
}

function openStarredFromHome() {
  const starred = readStarredContent().filter(function (x) {
    return x && x.id && (x.media_type === 'movie' || x.media_type === 'tv');
  });
  openSearchModal();
  const input = document.getElementById('search-input');
  if (input) {
    input.value = '';
    input.blur();
  }
  renderSearchResults(starred.slice(0, 30), 'No starred content');
}

async function searchContent(query) {
  const q = (query || '').trim();
  if (!q) {
    renderSearchResults([]);
    return;
  }
  try {
    const data = await fetchJson('/search/multi', {
      language: 'en-US',
      query: q,
      include_adult: false,
      page: 1
    });
    const results = (data.results || []).filter(function (x) {
      return x.media_type === 'movie' || x.media_type === 'tv';
    }).slice(0, 20);
    renderSearchResults(results);
  } catch (_) {
    renderSearchResults([]);
  }
}

function bindSearchUi() {
  const openBtn = document.getElementById('search-open');
  const starBtn = document.getElementById('star-open');
  const closeBtn = document.getElementById('search-close');
  const modal = document.getElementById('search-modal');
  const input = document.getElementById('search-input');
  const list = document.getElementById('search-results');

  if (!openBtn || !starBtn || !closeBtn || !modal || !input || !list) return;

  openBtn.onclick = function () {
    openSearchModal();
    input.value = '';
    renderSearchHistory();
  };

  starBtn.onclick = function () {
    openStarredFromHome();
  };

  closeBtn.onclick = closeSearchModal;

  modal.onclick = function (event) {
    if (event.target === modal) {
      closeSearchModal();
    }
  };

  window.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      closeSearchModal();
    }
  });

  input.addEventListener('input', function () {
    const q = input.value;
    if (searchDebounce) {
      clearTimeout(searchDebounce);
    }
    searchDebounce = setTimeout(function () {
      searchContent(q);
    }, 220);
  });
}

function readContinuePlaying() {
  try {
    const raw = localStorage.getItem('streamiha_continue_playing');
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch (_) {
    return [];
  }
}

async function renderContinuePlaying() {
  const block = document.getElementById('continue-block');
  const row = document.getElementById('section-continue');
  if (!block || !row) return;

  const items = readContinuePlaying();
  if (!items.length) {
    block.style.display = 'none';
    row.innerHTML = '';
    return;
  }

  block.style.display = '';
  const normalized = items.map(function (x) {
    return {
      id: x.id,
      media_type: x.media_type,
      title: x.title,
      name: x.name,
      poster_path: x.poster_path,
      backdrop_path: x.backdrop_path || '',
      logo_path: x.logo_path || '',
      vote_average: x.vote_average || 0,
      release_date: x.release_date || '',
      first_air_date: x.first_air_date || ''
    };
  });
  const needBackdrop = normalized.filter(function (x) {
    return !x.backdrop_path;
  });
  if (needBackdrop.length) {
    await Promise.all(needBackdrop.map(async function (x) {
      try {
        const d = await fetchJson('/' + x.media_type + '/' + x.id, { language: 'en-US' });
        x.backdrop_path = d.backdrop_path || x.backdrop_path || '';
      } catch (_) {
      }
    }));
    try {
      localStorage.setItem('streamiha_continue_playing', JSON.stringify(normalized));
    } catch (_) {
    }
  }

  const continueLogos = new Map();
  normalized.forEach(function (x) {
    if (x.logo_path) {
      continueLogos.set(x.id, [{ file_path: x.logo_path, iso_639_1: 'en' }]);
    }
  });
  const movieIds = normalized.filter(function (x) { return x.media_type === 'movie' && !continueLogos.has(x.id); }).map(function (x) { return x.id; });
  const tvIds = normalized.filter(function (x) { return x.media_type === 'tv' && !continueLogos.has(x.id); }).map(function (x) { return x.id; });
  const [movieLogos, tvLogos] = await Promise.all([
    movieIds.length ? fetchMovieLogos(movieIds) : Promise.resolve(new Map()),
    tvIds.length ? fetchTvLogos(tvIds) : Promise.resolve(new Map())
  ]);
  movieLogos.forEach(function (v, k) { continueLogos.set(k, v); });
  tvLogos.forEach(function (v, k) { continueLogos.set(k, v); });
  renderSection('section-continue', normalized, '3:2', continueLogos, 'all');
}


function renderGenreTabs(genres) {
  const tabs = document.getElementById('genre-tabs');
  if (!tabs) return;
  tabs.innerHTML = '';

  genres.forEach(function (genre) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'genre-tab' + (activeGenreId === genre.id ? ' active' : '');
    btn.textContent = genre.name;
    btn.onclick = async function () {
      activeGenreId = genre.id;
      renderGenreTabs(genres);
      const data = await fetchJson('/discover/movie', {
        language: 'en-US',
        sort_by: 'popularity.desc',
        include_adult: false,
        include_video: false,
        with_genres: genre.id,
        'vote_count.gte': 500,
        page: 1
      });
      const items = (data.results || []).slice(0, 10).map(function (x) {
        return { ...x, media_type: 'movie' };
      });
      const logos = await fetchMovieLogos(items.map(function (x) { return x.id; }));
      renderSection('section-genre-movies', items, '3:2', logos, 'movie');
    };
    tabs.appendChild(btn);
  });
}

async function initGenreSection() {
  const tabs = document.getElementById('genre-tabs');
  const row = document.getElementById('section-genre-movies');
  if (!tabs || !row) {
    return;
  }
  const genreData = await fetchJson('/genre/movie/list', { language: 'en-US' });
  const picks = (genreData.genres || []).filter(function (g) {
    return ['Action', 'Drama', 'Comedy', 'Thriller', 'Sci-Fi', 'Animation', 'Horror', 'Adventure'].includes(g.name);
  });
  const genres = (picks.length ? picks : (genreData.genres || []).slice(0, 8)).slice(0, 8);
  if (!genres.length) {
    return;
  }
  activeGenreId = genres[0].id;
  renderGenreTabs(genres);
  const first = await fetchJson('/discover/movie', {
    language: 'en-US',
    sort_by: 'popularity.desc',
    include_adult: false,
    include_video: false,
    with_genres: activeGenreId,
    'vote_count.gte': 500,
    page: 1
  });
  const items = (first.results || []).slice(0, 10).map(function (x) {
    return { ...x, media_type: 'movie' };
  });
  const logos = await fetchMovieLogos(items.map(function (x) { return x.id; }));
  renderSection('section-genre-movies', items, '3:2', logos, 'movie');
}

let ytApiPromise;
let heroPlayer;
let heroFallbackTriggered = false;
let heroSwapIntervalId = null;

function syncBrandOnScroll() {
  const brand = document.querySelector('.app-brand');
  if (!brand) {
    return;
  }
  if ((window.scrollY || 0) > 12) {
    brand.classList.add('is-scrolled');
  } else {
    brand.classList.remove('is-scrolled');
  }
}

function applyScrollReveal() {
  const footer = document.querySelector('.site-footer');
  if (footer) {
    footer.classList.remove('reveal-on-scroll');
    footer.classList.add('is-visible');
  }
  const targets = Array.from(document.querySelectorAll('h2, .scroll, .section-head'));
  targets.forEach(function (el) {
    el.classList.add('reveal-on-scroll');
  });
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion || !('IntersectionObserver' in window)) {
    targets.forEach(function (el) {
      el.classList.add('is-visible');
    });
    return;
  }
  const observer = new IntersectionObserver(function (entries, obs) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
  targets.forEach(function (el) {
    observer.observe(el);
  });
}

function pickTrailerKey(videos) {
  return (videos || []).find((v) => v.site === 'YouTube' && v.type === 'Trailer' && v.official)?.key ||
    (videos || []).find((v) => v.site === 'YouTube' && v.type === 'Trailer')?.key ||
    (videos || []).find((v) => v.site === 'YouTube' && v.type === 'Teaser')?.key ||
    '';
}

function getHeroPlayerSize() {
  const hero = document.getElementById('hero');
  if (!hero) {
    return { width: window.innerWidth || 1280, height: (window.innerWidth || 1280) * 9 / 16 };
  }
  const heroW = hero.clientWidth || window.innerWidth || 1280;
  const heroH = hero.clientHeight || Math.round(heroW * 9 / 16);
  const heroRatio = heroW / Math.max(heroH, 1);
  const videoRatio = 16 / 9;

  if (heroRatio > videoRatio) {
    return {
      width: heroW,
      height: Math.ceil(heroW / videoRatio)
    };
  }
  return {
    width: Math.ceil(heroH * videoRatio),
    height: heroH
  };
}

function applyHeroScale() {
  const hero = document.getElementById('hero');
  if (!hero) {
    return;
  }
  const holder = document.getElementById('hero-player');
  if (!holder) {
    return;
  }
  const size = getHeroPlayerSize();
  holder.style.width = String(size.width) + 'px';
  holder.style.height = String(size.height) + 'px';
}

function ensureYouTubeApi() {
  if (window.YT && window.YT.Player) {
    return Promise.resolve(true);
  }
  if (ytApiPromise) {
    return ytApiPromise;
  }
  ytApiPromise = new Promise((resolve) => {
    let settled = false;
    const finish = function (ok) {
      if (settled) {
        return;
      }
      settled = true;
      resolve(ok);
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.onerror = function () {
      finish(false);
    };
    const timer = setTimeout(function () {
      finish(false);
    }, 4500);
    window.onYouTubeIframeAPIReady = function () {
      clearTimeout(timer);
      finish(true);
    };
    document.head.appendChild(script);
  });
  return ytApiPromise;
}

function homeVidkingUrl(type, id, season, episode) {
  const params = new URLSearchParams({
    color: '3b82f6',
    autoPlay: 'true',
    autoplay: '1',
    muted: '1'
  });
  if (type === 'tv') {
    params.set('nextEpisode', 'true');
    params.set('episodeSelector', 'true');
    return 'https://www.vidking.net/embed/tv/' + encodeURIComponent(id) + '/' + encodeURIComponent(season || 1) + '/' + encodeURIComponent(episode || 1) + '?' + params.toString();
  }
  return 'https://www.vidking.net/embed/movie/' + encodeURIComponent(id) + '?' + params.toString();
}

function renderHeroBackdrop(el, item, titleText) {
  el.innerHTML = '';
  const fallback = document.createElement('img');
  fallback.className = 'poster32';
  fallback.style.width = '100%';
  fallback.style.height = '100%';
  fallback.src = heroBackdropUrl(item.backdrop_path || item.poster_path);
  fallback.alt = titleText;
  el.appendChild(fallback);
}

function attachHeroOverlay(el, logoPath, streamUrl, imdbUrl, synopsis, rating, titleText) {
  const overlay = document.createElement('div');
  overlay.className = 'home-hero-overlay';

  const panel = document.createElement('div');
  panel.className = 'overlay-panel';

  if (logoPath) {
    const logo = document.createElement('img');
    logo.className = 'overlay-logo';
    logo.alt = titleText + ' logo';
    logo.src = logoUrl(logoPath);
    panel.appendChild(logo);
  }

  const ratingLine = document.createElement('div');
  ratingLine.className = 'overlay-rating';
  ratingLine.textContent = 'Rating: ' + rating;
  panel.appendChild(ratingLine);

  const synopsisEl = document.createElement('p');
  synopsisEl.className = 'overlay-synopsis';
  synopsisEl.textContent = synopsis;
  panel.appendChild(synopsisEl);

  const actions = document.createElement('div');
  actions.className = 'overlay-actions';

  const streamBtn = document.createElement('a');
  streamBtn.className = 'overlay-play-btn';
  streamBtn.href = streamUrl;
  streamBtn.target = '_blank';
  streamBtn.rel = 'noopener noreferrer';
  streamBtn.setAttribute('aria-label', 'Open stream');
  streamBtn.textContent = '▶';

  const imdbBtn = document.createElement('a');
  imdbBtn.className = 'overlay-btn secondary';
  imdbBtn.href = imdbUrl;
  imdbBtn.target = '_blank';
  imdbBtn.rel = 'noopener noreferrer';
  imdbBtn.textContent = 'i';

  actions.appendChild(streamBtn);
  actions.appendChild(imdbBtn);
  panel.appendChild(actions);
  overlay.appendChild(panel);
  el.appendChild(overlay);
}

async function renderHero(item, logoPath, trailerKey) {
  const el = document.getElementById('hero');
  if (!el || !item) {
    return;
  }
  if (heroSwapIntervalId) {
    clearInterval(heroSwapIntervalId);
    heroSwapIntervalId = null;
  }
  el.innerHTML = '';
  applyHeroScale();

  const type = item.media_type;
  const titleText = item.title || item.name || 'Untitled';
  const synopsis = item.overview || 'No synopsis available.';
  const rating = typeof item.vote_average === 'number' ? item.vote_average.toFixed(1) + '/10' : 'N/A';
  const streamUrl = homeVidkingUrl(type, item.id);
  const imdbUrl = 'https://www.imdb.com/find/?q=' + encodeURIComponent(titleText);

  try {
    const key = trailerKey || '';
    if (key && window.location.protocol !== 'file:') {
      const apiReady = await ensureYouTubeApi();
      if (!apiReady) {
        throw new Error('YouTube API unavailable');
      }
      heroFallbackTriggered = false;

      const holder = document.createElement('div');
      holder.id = 'hero-player';
      el.appendChild(holder);
      applyHeroScale();

      heroPlayer = new window.YT.Player('hero-player', {
        videoId: key,
        playerVars: {
          autoplay: 1,
          mute: 1,
          controls: 0,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          iv_load_policy: 3,
          cc_load_policy: 0,
          disablekb: 1,
          fs: 0,
          enablejsapi: 1,
          origin: window.location.origin,
          annotations: 0
        },
        events: {
          onReady: function (event) {
            event.target.mute();
            event.target.playVideo();
          },
          onStateChange: function (event) {
            if (!heroPlayer || heroFallbackTriggered) {
              return;
            }
            if (event.data === window.YT.PlayerState.ENDED) {
              heroFallbackTriggered = true;
              heroPlayer = null;
              renderHeroBackdrop(el, item, titleText);
              attachHeroOverlay(el, logoPath, streamUrl, imdbUrl, synopsis, rating, titleText);
            }
          }
        }
      });

      let elapsed = 0;
      heroSwapIntervalId = setInterval(function () {
        if (heroFallbackTriggered) {
          clearInterval(heroSwapIntervalId);
          heroSwapIntervalId = null;
          return;
        }
        elapsed += 1;
        if (elapsed < 15) {
          return;
        }
        clearInterval(heroSwapIntervalId);
        heroSwapIntervalId = null;
        heroFallbackTriggered = true;
        try {
          if (heroPlayer && heroPlayer.stopVideo) {
            heroPlayer.stopVideo();
          }
        } catch (_) {
        }
        heroPlayer = null;
        renderHeroBackdrop(el, item, titleText);
        attachHeroOverlay(el, logoPath, streamUrl, imdbUrl, synopsis, rating, titleText);
      }, 1000);
    } else {
      renderHeroBackdrop(el, item, titleText);
    }
  } catch (_) {
    renderHeroBackdrop(el, item, titleText);
  }

  if (!el.querySelector('.home-hero-overlay')) {
    attachHeroOverlay(el, logoPath, streamUrl, imdbUrl, synopsis, rating, titleText);
  }
}

window.addEventListener('resize', applyHeroScale);

function hasLocalBrandLogo(name) {
  if (typeof window.resolveLocalBrandLogo !== 'function') {
    return false;
  }
  return !!window.resolveLocalBrandLogo(name || '');
}

function uniqueItemsByLocalLogo(items, getName) {
  const seen = new Set();
  const out = [];
  items.forEach(function (item) {
    const name = getName(item);
    const logo = typeof window.resolveLocalBrandLogo === 'function'
      ? window.resolveLocalBrandLogo(name || '')
      : '';
    if (!logo || seen.has(logo)) {
      return;
    }
    seen.add(logo);
    out.push(item);
  });
  return out;
}

function renderLogoSection(rowId, items, type) {
  const row = document.getElementById(rowId);
  if (!row) {
    return;
  }
  row.innerHTML = '';

  items.slice(0, type === 'company' ? items.length : 10).forEach(function (item) {
    const td = document.createElement('td');
    td.className = 'clickable';

    const tile = document.createElement('div');
    tile.className = 'logo-tile';

    const img = document.createElement('img');
    img.className = 'logo-tile-img';
    img.alt = (item.provider_name || item.name || 'logo') + ' logo';
    setBrandLogoImage(img, item.provider_name || item.name || '', item.logo_path || item.profile_path || '');

    tile.appendChild(img);
    td.appendChild(tile);

    td.onclick = function () {
      const goTo = type === 'platform'
        ? browseByPlatformUrl(item.provider_id, item.provider_name, 'movie')
        : browseByCompanyUrl(item.id, item.name, 'movie');
      if (goTo) {
        window.location.href = goTo;
      }
    };

    row.appendChild(td);
  });
}

async function fetchMappedProducerCompanies() {
  const map = window.LOCAL_PRODUCER_LOGOS || {};
  const names = Object.keys(map);
  const normalize = function (value) {
    return (value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  };

  const items = await Promise.all(names.map(async function (name) {
    try {
      const res = await fetchJson('/search/company', { query: name, page: 1 });
      const results = res && res.results ? res.results : [];
      const exact = results.find(function (x) {
        return x && x.name && normalize(x.name) === normalize(name);
      });
      const pick = exact || results[0] || null;
      return {
        id: pick && pick.id ? pick.id : null,
        name: name,
        logo_path: pick && pick.logo_path ? pick.logo_path : ''
      };
    } catch (_) {
      return { id: null, name: name, logo_path: '' };
    }
  }));

  return items.filter(function (x) { return x && x.name; });
}

async function loadDiscoverGroups() {
  let platformItems = [];
  let companyItems = [];

  try {
    const watchProviders = await fetchJson('/watch/providers/movie', { language: 'en-US', watch_region: 'US' });
    platformItems = uniqueItemsByLocalLogo(
      (watchProviders.results || []).filter(function (x) {
        return x && x.provider_id && x.provider_name && hasLocalBrandLogo(x.provider_name);
      }),
      function (x) { return x.provider_name; }
    ).slice(0, 10);
  } catch (_) {
  }

  try {
    companyItems = await fetchMappedProducerCompanies();
  } catch (_) {
  }

  renderLogoSection('section-platforms', platformItems, 'platform');
  renderLogoSection('section-companies', companyItems, 'company');
}

function renderSection(rowId, items, ratioType, logoMap, fallbackType) {
  const row = document.getElementById(rowId);
  row.innerHTML = '';

  items.slice(0, 10).forEach((item, idx) => {
    const td = document.createElement('td');
    let goTo = detailsUrl(item, fallbackType);
    if (rowId === 'section-continue') {
      goTo = continueStreamUrl(item) || goTo;
    }
    if (goTo) {
      td.className = 'clickable';
      td.onclick = function () {
        window.location.href = goTo;
      };
    }

    const showRank = rowId === 'section-today';
    const rank = document.createElement('div');
    rank.className = 'rank';
    rank.textContent = String(idx + 1);

    const img = document.createElement('img');
    img.className = (ratioType === '9:16' || ratioType === '2:3') ? 'poster916' : 'poster32';
    if (ratioType === '2:3') {
      img.classList.add('top10-poster');
    }
    img.alt = item.title || item.name || 'poster';
    const imagePath = (ratioType === '9:16' || ratioType === '2:3')
      ? (item.poster_path || item.backdrop_path)
      : (item.backdrop_path || item.poster_path);
    img.src = posterUrl(imagePath, !(ratioType === '9:16' || ratioType === '2:3'));

    const posterWrap = document.createElement('div');
    posterWrap.className = 'poster-wrap';

    const dim = document.createElement('div');
    dim.className = 'poster-dim';

    const showLogo = ratioType === '3:2';
    const logoPath = showLogo ? pickLogo(logoMap, item.id) : '';

    const logo = document.createElement('img');
    logo.className = 'logo';
    logo.alt = (item.title || item.name || 'logo') + ' logo';
    if (logoPath) {
      logo.src = logoUrl(logoPath);
    } else {
      logo.style.display = 'none';
    }

    const badges = document.createElement('div');
    badges.className = 'poster-badges';

    const typeBadge = document.createElement('span');
    typeBadge.className = 'poster-badge type';
    typeBadge.textContent = (item.media_type || fallbackType || '').toUpperCase();

    const imdbBadge = document.createElement('span');
    imdbBadge.className = 'poster-badge imdb';
    imdbBadge.textContent = 'IMDb ' + (typeof item.vote_average === 'number' ? item.vote_average.toFixed(1) : 'N/A');

    badges.appendChild(typeBadge);
    badges.appendChild(imdbBadge);

    posterWrap.appendChild(img);
    posterWrap.appendChild(dim);
    if (!showRank) {
      posterWrap.appendChild(badges);
    }
    posterWrap.appendChild(logo);
    if (showRank) {
      posterWrap.appendChild(rank);
    }
    if (rowId === 'section-continue') {
      const infoBtn = document.createElement('a');
      infoBtn.className = 'continue-info-btn';
      infoBtn.href = detailsUrl(item, fallbackType) || '#';
      infoBtn.setAttribute('aria-label', 'Open details');
      infoBtn.textContent = 'i';
      infoBtn.onclick = function (e) {
        e.stopPropagation();
      };
      posterWrap.appendChild(infoBtn);
    }

    td.appendChild(posterWrap);
    row.appendChild(td);
  });
}

async function fetchMovieLogos(movieIds) {
  const map = new Map();
  await Promise.all(
    movieIds.map(async (id) => {
      try {
        const data = await fetchJson('/movie/' + id + '/images');
        map.set(id, data.logos || []);
      } catch (_) {
        map.set(id, []);
      }
    })
  );
  return map;
}

async function fetchTvLogos(tvIds) {
  const map = new Map();
  await Promise.all(
    tvIds.map(async (id) => {
      try {
        const data = await fetchJson('/tv/' + id + '/images');
        map.set(id, data.logos || []);
      } catch (_) {
        map.set(id, []);
      }
    })
  );
  return map;
}

function monthDateRange() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const first = new Date(Date.UTC(y, m, 1));
  const last = new Date(Date.UTC(y, m + 1, 0));
  const toStr = (d) => d.toISOString().slice(0, 10);
  return { gte: toStr(first), lte: toStr(last) };
}

async function findFirstTodayWithTrailer(items) {
  for (const item of items) {
    try {
      const videos = await fetchJson('/' + item.media_type + '/' + item.id + '/videos', { language: 'en-US' });
      const key = pickTrailerKey(videos.results);
      if (key) {
        return { item, key };
      }
    } catch (_) {
    }
  }
  return { item: items[0] || null, key: '' };
}

async function load() {
  //setStatus('Loading...');
  bindSearchUi();

  try {
    await renderContinuePlaying();
  } catch (_) {
  }

  try {
    const today = await fetchJson('/trending/all/day');
    const cinema = await fetchJson('/movie/now_playing', { language: 'en-US', page: 1, region: 'US' });

    const range = monthDateRange();
    const month = await fetchJson('/discover/movie', {
      language: 'en-US',
      sort_by: 'popularity.desc',
      include_adult: false,
      include_video: false,
      page: 1,
      'primary_release_date.gte': range.gte,
      'primary_release_date.lte': range.lte
    });

    const tvAllTime = await fetchJson('/tv/top_rated', {
      language: 'en-US',
      page: 1
    });

    const moviesAllTime = await fetchJson('/movie/top_rated', {
      language: 'en-US',
      page: 1
    });

    const todayTop = (today.results || []).filter((x) => x.media_type === 'movie' || x.media_type === 'tv').slice(0, 10);
    const cinemaTop = (cinema.results || []).slice(0, 10).map((x) => ({ ...x, media_type: 'movie' }));
    const monthTop = (month.results || []).slice(0, 10).map((x) => ({ ...x, media_type: 'movie' }));
    const tvTop = (tvAllTime.results || []).slice(0, 10).map((x) => ({ ...x, media_type: 'tv' }));
    const movieTop = (moviesAllTime.results || []).slice(0, 10).map((x) => ({ ...x, media_type: 'movie' }));

    const movieIds = Array.from(new Set(
      [...cinemaTop, ...monthTop, ...movieTop, ...todayTop.filter((x) => x.media_type === 'movie')]
        .map((x) => x.id)
        .filter(Boolean)
    ));

    const tvIds = Array.from(new Set(
      [...tvTop, ...todayTop.filter((x) => x.media_type === 'tv')]
        .map((x) => x.id)
        .filter(Boolean)
    ));

    const [movieLogos, tvLogos] = await Promise.all([
      fetchMovieLogos(movieIds),
      fetchTvLogos(tvIds)
    ]);

    const todayLogoMap = new Map();
    for (const item of todayTop) {
      if (item.media_type === 'movie') {
        todayLogoMap.set(item.id, movieLogos.get(item.id) || []);
      } else {
        todayLogoMap.set(item.id, tvLogos.get(item.id) || []);
      }
    }

    const heroPick = await findFirstTodayWithTrailer(todayTop);
    const heroItem = heroPick.item;
    const heroLogoPath = heroItem
      ? pickLogo(heroItem.media_type === 'movie' ? movieLogos : tvLogos, heroItem.id)
      : '';
    await renderHero(heroItem, heroLogoPath, heroPick.key);

    renderSection('section-today', todayTop, '2:3', todayLogoMap, 'all');
    renderSection('section-cinema', cinemaTop, '3:2', movieLogos, 'movie');
    renderSection('section-month', monthTop, '3:2', movieLogos, 'movie');
    renderSection('section-tv', tvTop, '3:2', tvLogos, 'tv');
    renderSection('section-movies', movieTop, '3:2', movieLogos, 'movie');
    await initGenreSection();
    await loadDiscoverGroups();

    applyScrollReveal();
    syncBrandOnScroll();
    window.addEventListener('scroll', syncBrandOnScroll, { passive: true });

    //setStatus('Loaded. Scroll each section horizontally to see items 6-10. Click any card for details.');
    showApp();
  } catch (err) {
    //setStatus(err.message || 'Failed to load TMDB data.', true);
    applyScrollReveal();
    syncBrandOnScroll();
    window.addEventListener('scroll', syncBrandOnScroll, { passive: true });
    showApp();
  }
}

load();