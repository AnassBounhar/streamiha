const TMDB_BASE = '/api/tmdb.php';
const IMG_BASE = 'https://image.tmdb.org/t/p';
const PROFILE_FALLBACK = '../assets/profile.png';

function q(id) {
  return document.getElementById(id);
}

function showDetailsPage() {
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
    Object.keys(query).forEach((k) => {
      if (query[k] !== undefined && query[k] !== null && query[k] !== '') {
        url.searchParams.set(k, String(query[k]));
      }
    });
  }
  const response = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
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
  return IMG_BASE + '/w500' + path;
}

function profileUrl(path) {
  if (!path) return '';
  return IMG_BASE + '/w185' + path;
}

function companyLogoUrl(path) {
  if (!path) return '';
  return IMG_BASE + '/w300' + path;
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

function saveStarredContent(items) {
  try {
    localStorage.setItem('streamiha_starred_content', JSON.stringify(items));
  } catch (_) {
  }
}

function isStarred(type, id) {
  return readStarredContent().some(function (x) {
    return x && x.media_type === type && Number(x.id) === Number(id);
  });
}

function toggleStarredItem(payload) {
  if (!payload || !payload.id || (payload.media_type !== 'movie' && payload.media_type !== 'tv')) {
    return false;
  }
  const current = readStarredContent();
  const exists = current.some(function (x) {
    return x && x.media_type === payload.media_type && Number(x.id) === Number(payload.id);
  });
  let next;
  if (exists) {
    next = current.filter(function (x) {
      return !(x && x.media_type === payload.media_type && Number(x.id) === Number(payload.id));
    });
  } else {
    next = [payload].concat(current).slice(0, 100);
  }
  saveStarredContent(next);
  return !exists;
}

function setPeopleList(id, people) {
  const el = q(id);
  el.innerHTML = '';
  if (!people.length) {
    const li = document.createElement('li');
    li.textContent = '-';
    el.appendChild(li);
    return;
  }
  people.forEach((p) => {
    const li = document.createElement('li');

    const img = document.createElement('img');
    img.className = 'person-photo';
    img.alt = p.name;
    img.src = p.profile_path ? profileUrl(p.profile_path) : PROFILE_FALLBACK;
    img.onerror = function () {
      img.onerror = null;
      img.src = PROFILE_FALLBACK;
    };

    const name = document.createElement('span');
    name.textContent = p.name;

    li.appendChild(img);
    li.appendChild(name);
    el.appendChild(li);
  });
}

function setCompanyList(id, companies) {
  const el = q(id);
  el.innerHTML = '';
  if (!companies.length) {
    const li = document.createElement('li');
    li.textContent = '-';
    el.appendChild(li);
    return;
  }
  companies.forEach((c) => {
    const li = document.createElement('li');
    li.textContent = c.name;
    el.appendChild(li);
  });
}

function setList(id, values) {
  const el = q(id);
  el.innerHTML = '';
  if (!values.length) {
    const li = document.createElement('li');
    li.textContent = '-';
    el.appendChild(li);
    return;
  }
  values.forEach((v) => {
    const li = document.createElement('li');
    li.textContent = v;
    el.appendChild(li);
  });
}

function openDetails(type, id) {
  window.location.href = './details.html?type=' + encodeURIComponent(type) + '&id=' + encodeURIComponent(id);
}

function renderSimilar(items) {
  const row = q('section-similar');
  if (!row) {
    return;
  }
  row.innerHTML = '';
  (items || []).slice(0, 15).forEach((item) => {
    const td = document.createElement('td');
    td.className = 'similar-cell';

    const img = document.createElement('img');
    img.className = 'similar-poster';
    img.alt = item.title || item.name || 'Poster';
    if (item.poster_path) {
      img.src = IMG_BASE + '/w500' + item.poster_path;
    }

    const title = document.createElement('div');
    title.className = 'similar-title';
    title.textContent = item.title || item.name || 'Untitled';

    td.appendChild(img);
    td.appendChild(title);
    td.onclick = function () {
      openDetails(currentType, item.id);
    };
    row.appendChild(td);
  });
}

function saveContinuePlayingMovie(payload) {
  if (!payload || !payload.id || !(payload.title || payload.name) || !payload.poster_path || (payload.media_type !== 'movie' && payload.media_type !== 'tv')) {
    return;
  }
  try {
    const raw = localStorage.getItem('streamiha_continue_playing');
    const arr = raw ? JSON.parse(raw) : [];
    const list = Array.isArray(arr) ? arr : [];
    const next = [payload].concat(list.filter(function (x) {
      return x && !(x.id === payload.id && x.media_type === payload.media_type);
    })).slice(0, 2);
    localStorage.setItem('streamiha_continue_playing', JSON.stringify(next));
  } catch (_) {
  }
}

let currentType = '';
let currentId = '';
let currentSeason = 1;
let currentEpisode = 1;
let currentTrailerKey = '';
let currentBackdropPath = '';
let activePlayback = 'trailer';
let currentContinuePayload = null;
let ytApiPromise;
let trailerPlayer;
let trailerSwapIntervalId = null;
let trailerFallbackTriggered = false;

function vidkingEmbedUrl(type, id, season, episode) {
  const params = new URLSearchParams({
    color: '3b82f6',
    autoPlay: 'true',
    autoplay: '1',
    muted: '1'
  });
  if (type === 'tv') {
    params.set('nextEpisode', 'true');
    params.set('episodeSelector', 'true');
    return 'https://www.vidking.net/embed/tv/' + encodeURIComponent(id) + '/' + encodeURIComponent(season) + '/' + encodeURIComponent(episode) + '?' + params.toString();
  }
  return 'https://www.vidking.net/embed/movie/' + encodeURIComponent(id) + '?' + params.toString();
}

function attachVidkingLoader(el, beforeNode) {
  const loader = document.createElement('div');
  loader.className = 'trailer-loader';

  const spinner = document.createElement('div');
  spinner.className = 'trailer-loader-spinner';

  const label = document.createElement('div');
  label.textContent = 'Loading stream...';

  loader.appendChild(spinner);
  loader.appendChild(label);
  if (beforeNode) {
    el.insertBefore(loader, beforeNode);
  } else {
    el.appendChild(loader);
  }
  return loader;
}

function getTrailerPlayerSize() {
  const trailer = q('trailer');
  if (!trailer) {
    return { width: window.innerWidth || 1280, height: (window.innerWidth || 1280) * 9 / 16 };
  }
  const wrapW = trailer.clientWidth || window.innerWidth || 1280;
  const wrapH = trailer.clientHeight || Math.round(wrapW * 9 / 16);
  const wrapRatio = wrapW / Math.max(wrapH, 1);
  const videoRatio = 16 / 9;

  if (wrapRatio > videoRatio) {
    return {
      width: wrapW,
      height: Math.ceil(wrapW / videoRatio)
    };
  }
  return {
    width: Math.ceil(wrapH * videoRatio),
    height: wrapH
  };
}

function applyTrailerScale() {
  const trailer = q('trailer');
  if (!trailer) {
    return;
  }
  const holder = q('yt-player');
  if (holder) {
    const size = getTrailerPlayerSize();
    holder.style.width = String(size.width) + 'px';
    holder.style.height = String(size.height) + 'px';
  }
  const streamFrame = trailer.querySelector('iframe.vidking-frame');
  if (streamFrame) {
    const size = getTrailerPlayerSize();
    streamFrame.style.width = String(size.width) + 'px';
    streamFrame.style.height = String(size.height) + 'px';
    streamFrame.style.position = 'absolute';
    streamFrame.style.left = '50%';
    streamFrame.style.top = '50%';
    streamFrame.style.transform = 'translate(-50%, -50%)';
  }
}

function youtubeEmbed(key, withApi) {
  const params = new URLSearchParams({
    autoplay: '1',
    mute: '1',
    controls: '0',
    rel: '0',
    modestbranding: '1',
    playsinline: '1',
    iv_load_policy: '3',
    cc_load_policy: '0',
    disablekb: '1',
    fs: '0'
  });
  if (withApi) {
    params.set('enablejsapi', '1');
    params.set('origin', window.location.origin);
  }
  return 'https://www.youtube.com/embed/' + key + '?' + params.toString();
}

function ensureYouTubeApi() {
  if (window.YT && window.YT.Player) {
    return Promise.resolve();
  }
  if (ytApiPromise) {
    return ytApiPromise;
  }
  ytApiPromise = new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    window.onYouTubeIframeAPIReady = function () {
      resolve();
    };
    document.head.appendChild(script);
  });
  return ytApiPromise;
}

function renderYouTubeTrailer(el, key) {
  if (!key) {
    return;
  }
  if (window.location.protocol === 'file:') {
    const box = document.createElement('div');
    box.style.padding = '20px';
    box.style.fontSize = '14px';

    const msg = document.createElement('div');
    msg.textContent = 'Trailer embed is blocked on file:// pages by browser security.';

    const link = document.createElement('a');
    link.href = 'https://www.youtube.com/watch?v=' + encodeURIComponent(key);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'Open trailer in YouTube';

    box.appendChild(msg);
    box.appendChild(link);
    el.appendChild(box);
    return;
  }

  const holder = document.createElement('div');
  holder.id = 'yt-player';
  el.appendChild(holder);
  applyTrailerScale();
  trailerFallbackTriggered = false;

  trailerPlayer = new window.YT.Player('yt-player', {
    videoId: key,
    playerVars: {
      autoplay: 1,
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
        if (event.data === window.YT.PlayerState.ENDED && !trailerFallbackTriggered && activePlayback === 'trailer') {
          trailerFallbackTriggered = true;
          trailerPlayer = null;
          if (trailerSwapIntervalId) {
            clearInterval(trailerSwapIntervalId);
            trailerSwapIntervalId = null;
          }
          const overlay = el.querySelector('.trailer-overlay');
          el.innerHTML = '';
          renderTrailerBackdrop(el);
          if (overlay) {
            el.appendChild(overlay);
          }
        }
      }
    }
  });

  let elapsed = 0;
  trailerSwapIntervalId = setInterval(function () {
    if (activePlayback !== 'trailer' || trailerFallbackTriggered) {
      clearInterval(trailerSwapIntervalId);
      trailerSwapIntervalId = null;
      return;
    }
    elapsed += 1;
    if (elapsed < 15) {
      return;
    }
    clearInterval(trailerSwapIntervalId);
    trailerSwapIntervalId = null;
    trailerFallbackTriggered = true;
    try {
      if (trailerPlayer && trailerPlayer.stopVideo) {
        trailerPlayer.stopVideo();
      }
    } catch (_) {
    }
    trailerPlayer = null;
    const overlay = el.querySelector('.trailer-overlay');
    el.innerHTML = '';
    renderTrailerBackdrop(el);
    if (overlay) {
      el.appendChild(overlay);
    }
  }, 1000);
}

function renderTrailerBackdrop(el) {
  const img = document.createElement('img');
  img.className = 'poster32';
  img.alt = 'backdrop';
  img.src = heroBackdropUrl(currentBackdropPath);
  el.appendChild(img);
}

function stopTrailerPlayback() {
  if (trailerSwapIntervalId) {
    clearInterval(trailerSwapIntervalId);
    trailerSwapIntervalId = null;
  }
  if (trailerPlayer && trailerPlayer.destroy) {
    trailerPlayer.destroy();
  }
  trailerPlayer = undefined;
}

function setStreamButtonState() {
  const btn = q('stream-btn');
  if (!btn) {
    return;
  }
  btn.href = vidkingEmbedUrl(currentType, currentId, currentSeason, currentEpisode);
  if (currentContinuePayload) {
    currentContinuePayload.season_number = currentType === 'tv' ? currentSeason : 1;
    currentContinuePayload.episode_number = currentType === 'tv' ? currentEpisode : 1;
  }
}

function renderActivePlayback() {
  const el = q('trailer');
  if (!el) {
    return;
  }

  stopTrailerPlayback();
  const existingFrame = el.querySelector('iframe');
  if (existingFrame) {
    existingFrame.remove();
  }
  const existingYt = el.querySelector('#yt-player');
  if (existingYt) {
    existingYt.remove();
  }

  if (activePlayback === 'stream') {
    renderVidkingFrame(el, currentType, currentId, currentSeason, currentEpisode);
    return;
  }

  if (!currentTrailerKey) {
    const overlay = el.querySelector('.trailer-overlay');
    el.innerHTML = '';
    renderTrailerBackdrop(el);
    if (overlay) {
      el.appendChild(overlay);
    }
    activePlayback = 'stream';
    return;
  }

  renderYouTubeTrailer(el, currentTrailerKey);
}

function attachOverlay(el, logoPath, imdbUrl, titleText, synopsis, rating) {
  const overlay = document.createElement('div');
  overlay.className = 'trailer-overlay';

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

  const controls = q('episode-controls');
  if (controls && currentType === 'tv') {
    panel.appendChild(controls);
  }

  const actions = document.createElement('div');
  actions.className = 'overlay-actions';

  const streamBtn = document.createElement('a');
  streamBtn.id = 'stream-btn';
  streamBtn.className = 'overlay-play-btn';
  streamBtn.href = vidkingEmbedUrl(currentType, currentId, currentSeason, currentEpisode);
  streamBtn.target = '_blank';
  streamBtn.rel = 'noopener noreferrer';
  streamBtn.setAttribute('aria-label', 'Play selected stream');
  streamBtn.textContent = '▶';
  streamBtn.onclick = function () {
    if (currentContinuePayload) {
      saveContinuePlayingMovie(currentContinuePayload);
    }
  };

  const imdbBtn = document.createElement('a');
  imdbBtn.className = 'overlay-btn secondary';
  imdbBtn.href = imdbUrl;
  imdbBtn.target = '_blank';
  imdbBtn.rel = 'noopener noreferrer';
  imdbBtn.textContent = 'i';

  const starBtn = document.createElement('button');
  starBtn.type = 'button';
  starBtn.className = 'overlay-star-btn';
  starBtn.setAttribute('aria-label', 'Toggle star');
  const updateStarVisual = function () {
    starBtn.textContent = isStarred(currentType, currentId) ? '★' : '☆';
  };
  updateStarVisual();
  starBtn.onclick = function () {
    if (!currentContinuePayload) {
      return;
    }
    const payload = {
      id: currentContinuePayload.id,
      media_type: currentContinuePayload.media_type,
      title: currentContinuePayload.title,
      name: currentContinuePayload.name,
      poster_path: currentContinuePayload.poster_path,
      backdrop_path: currentContinuePayload.backdrop_path || '',
      logo_path: currentContinuePayload.logo_path || '',
      vote_average: currentContinuePayload.vote_average || 0,
      release_date: currentContinuePayload.release_date || '',
      first_air_date: currentContinuePayload.first_air_date || ''
    };
    toggleStarredItem(payload);
    updateStarVisual();
  };

  actions.appendChild(streamBtn);
  actions.appendChild(imdbBtn);
  actions.appendChild(starBtn);
  panel.appendChild(actions);
  overlay.appendChild(panel);
  el.appendChild(overlay);
}

function renderVidkingFrame(el, type, id, season, episode) {
  const existingOverlay = el.querySelector('.trailer-overlay');
  const loader = attachVidkingLoader(el, existingOverlay || null);
  const vidkingFrame = document.createElement('iframe');
  vidkingFrame.className = 'vidking-frame';
  vidkingFrame.src = vidkingEmbedUrl(type, id, season, episode);
  vidkingFrame.loading = 'lazy';
  vidkingFrame.referrerPolicy = 'origin';
  vidkingFrame.allowFullscreen = true;
  vidkingFrame.addEventListener('load', function () {
    if (loader && loader.parentNode) {
      loader.parentNode.removeChild(loader);
    }
  });
  if (existingOverlay) {
    el.insertBefore(vidkingFrame, existingOverlay);
  } else {
    el.appendChild(vidkingFrame);
  }
  applyTrailerScale();
}

function updateStreamSelection() {
  setStreamButtonState();
}

function bindEpisodeControls(details) {
  const controls = q('episode-controls');
  const seasonSelect = q('season-select');
  const episodeSelect = q('episode-select');
  if (!controls || !seasonSelect || !episodeSelect) {
    return;
  }

  if (currentType !== 'tv') {
    controls.style.display = 'none';
    const parent = controls.parentNode;
    if (parent) {
      parent.removeChild(controls);
    }
    return;
  }

  const seasons = (details.seasons || []).filter((s) => s && s.season_number > 0);
  if (!seasons.length) {
    controls.style.display = 'none';
    return;
  }
  seasonSelect.innerHTML = '';
  seasons.forEach((s) => {
    const option = document.createElement('option');
    option.value = String(s.season_number);
    option.textContent = 'S' + s.season_number;
    seasonSelect.appendChild(option);
  });

  const renderEpisodeOptions = function (seasonNumber) {
    const season = seasons.find((s) => s.season_number === seasonNumber);
    const count = Math.max(1, Number(season?.episode_count || 1));
    episodeSelect.innerHTML = '';
    for (let i = 1; i <= count; i += 1) {
      const option = document.createElement('option');
      option.value = String(i);
      option.textContent = 'E' + i;
      episodeSelect.appendChild(option);
    }
    if (currentEpisode > count) {
      currentEpisode = 1;
    }
    episodeSelect.value = String(currentEpisode);
  };

  currentSeason = seasons[0]?.season_number || 1;
  currentEpisode = 1;
  seasonSelect.value = String(currentSeason);
  renderEpisodeOptions(currentSeason);

  seasonSelect.onchange = function () {
    currentSeason = Number(seasonSelect.value) || 1;
    currentEpisode = 1;
    renderEpisodeOptions(currentSeason);
    updateStreamSelection();
  };

  episodeSelect.onchange = function () {
    currentEpisode = Number(episodeSelect.value) || 1;
    updateStreamSelection();
  };

  controls.style.display = 'flex';
}

async function renderTrailer(key, titleText, logoPath, imdbUrl, synopsis, rating, type, id, details) {
  const el = q('trailer');
  el.innerHTML = '';
  applyTrailerScale();

  currentType = type;
  currentId = id;
  currentSeason = 1;
  currentEpisode = 1;
  currentTrailerKey = key || '';
  currentBackdropPath = details && (details.backdrop_path || details.poster_path) ? (details.backdrop_path || details.poster_path) : '';
  activePlayback = 'trailer';

  if (currentTrailerKey && window.location.protocol !== 'file:') {
    await ensureYouTubeApi();
  }

  attachOverlay(el, logoPath, imdbUrl, titleText, synopsis, rating);
  bindEpisodeControls(details);
  setStreamButtonState();
  renderActivePlayback();
}

function pickTrailerKey(videos) {
  return (videos || []).find((v) => v.site === 'YouTube' && v.type === 'Trailer' && v.official)?.key ||
    (videos || []).find((v) => v.site === 'YouTube' && v.type === 'Trailer')?.key ||
    (videos || []).find((v) => v.site === 'YouTube' && v.type === 'Teaser')?.key ||
    '';
}

window.addEventListener('resize', applyTrailerScale);

async function load() {
  const params = new URLSearchParams(window.location.search);
  const type = params.get('type');
  const id = params.get('id');

  if (!type || !id || (type !== 'movie' && type !== 'tv')) {
    q('title').textContent = 'Invalid item';
    return;
  }

  try {
    const [details, credits, videos, images, recommendations] = await Promise.all([
      fetchJson('/' + type + '/' + id, { language: 'en-US' }),
      fetchJson('/' + type + '/' + id + '/credits', { language: 'en-US' }),
      fetchJson('/' + type + '/' + id + '/videos', { language: 'en-US' }),
      fetchJson('/' + type + '/' + id + '/images', { include_image_language: 'en,null' }),
      fetchJson('/' + type + '/' + id + '/recommendations', { language: 'en-US', page: 1 })
    ]);

    const logoPath = (images.logos || []).find((x) => x.iso_639_1 === 'en' && x.file_path)?.file_path ||
      (images.logos || []).find((x) => x.file_path)?.file_path ||
      '';

    const titleText = details.title || details.name || 'Untitled';
    if (typeof window.analyticsTrack === 'function') {
      window.analyticsTrack('movie_view', {
        movie_id: Number(details.id) || Number(id) || null,
        movie_title: titleText
      });
    }
    const synopsis = details.overview || 'No synopsis available.';
    const rating = typeof details.vote_average === 'number' ? details.vote_average.toFixed(1) + '/10' : 'N/A';
    const imdbId = details.imdb_id || details.external_ids?.imdb_id || '';
    const imdbUrl = imdbId ? 'https://www.imdb.com/title/' + imdbId + '/' : 'https://www.imdb.com/find/?q=' + encodeURIComponent(titleText);
    currentContinuePayload = {
      id: details.id,
      media_type: type,
      title: details.title || '',
      name: details.name || '',
      poster_path: details.poster_path || '',
      backdrop_path: details.backdrop_path || '',
      logo_path: logoPath || '',
      season_number: type === 'tv' ? 1 : 1,
      episode_number: type === 'tv' ? 1 : 1,
      vote_average: details.vote_average || 0,
      release_date: details.release_date || '',
      first_air_date: details.first_air_date || ''
    };
    await renderTrailer(pickTrailerKey(videos.results), titleText, logoPath, imdbUrl, synopsis, rating, type, id, details);

    q('title').textContent = titleText;
    const genreText = (details.genres || []).map(function (g) {
      return g && g.name ? g.name : '';
    }).filter(Boolean).join(', ');
    q('type').textContent = 'Genres: ' + (genreText || '-');
    q('overview').textContent = details.overview || '';

    const crew = credits.crew || [];
    const cast = (credits.cast || []).slice(0, 15);

    const director = crew.filter((c) => c.job === 'Director');

    const writerJobs = new Set(['Writer', 'Screenplay', 'Story', 'Teleplay', 'Characters', 'Novel']);
    const writerMap = new Map();
    crew.forEach((c) => {
      if (writerJobs.has(c.job) && !writerMap.has(c.id)) {
        writerMap.set(c.id, { id: c.id, name: c.name, profile_path: c.profile_path || '' });
      }
    });

    const companies = (details.production_companies || []).map((c) => ({ name: c.name, logo_path: c.logo_path || '' }));

    setPeopleList('director', director);
    setPeopleList('writers', Array.from(writerMap.values()));
    setPeopleList('cast', cast);
    setCompanyList('companies', companies);
    const mergedSimilar = [];
    const seen = new Set();
    const pushUnique = function (arr) {
      (arr || []).forEach((x) => {
        if (!x || !x.id || !x.poster_path || x.id === Number(id)) {
          return;
        }
        if (seen.has(x.id)) {
          return;
        }
        seen.add(x.id);
        mergedSimilar.push(x);
      });
    };
    pushUnique(recommendations.results || []);
    renderSimilar(mergedSimilar);
    showDetailsPage();
  } catch (err) {
    q('title').textContent = 'Failed to load details';
    q('overview').textContent = err.message || '';
    q('trailer').innerHTML = '';
    showDetailsPage();
  }
}

load();