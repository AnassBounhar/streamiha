const TMDB_CACHE_PREFIX = 'streamiha_tmdb_cache_v1:';
const TMDB_DEFAULT_TTL_MS = 5 * 60 * 1000;
const tmdbMemoryCache = new Map();

function stableQueryString(query) {
  const entries = Object.keys(query || {}).filter(function (k) {
    return query[k] !== undefined && query[k] !== null && query[k] !== '';
  }).sort().map(function (k) {
    return [k, String(query[k])];
  });
  return new URLSearchParams(entries).toString();
}

function cacheKey(path, query) {
  return TMDB_CACHE_PREFIX + path + '?' + stableQueryString(query);
}

function readCached(key) {
  const now = Date.now();
  const mem = tmdbMemoryCache.get(key);
  if (mem && mem.expiresAt > now) {
    return mem.data;
  }
  if (mem) {
    tmdbMemoryCache.delete(key);
  }

  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.expiresAt <= now) {
      localStorage.removeItem(key);
      return null;
    }
    tmdbMemoryCache.set(key, parsed);
    return parsed.data;
  } catch (_) {
    return null;
  }
}

function writeCached(key, data, ttlMs) {
  const payload = { data: data, expiresAt: Date.now() + ttlMs };
  tmdbMemoryCache.set(key, payload);
  try {
    localStorage.setItem(key, JSON.stringify(payload));
  } catch (_) {
  }
}

window.fetchJsonCached = async function fetchJsonCached(path, query, options) {
  const opts = options || {};
  const ttlMs = Number(opts.ttlMs) > 0 ? Number(opts.ttlMs) : TMDB_DEFAULT_TTL_MS;
  const timeoutMs = Number(opts.timeoutMs) > 0 ? Number(opts.timeoutMs) : 0;

  const key = cacheKey(path, query);
  const cached = readCached(key);
  if (cached) {
    return cached;
  }

  const url = new URL('/api/tmdb.php', window.location.origin);
  url.searchParams.set('path', path);
  Object.keys(query || {}).forEach(function (k) {
    if (query[k] !== undefined && query[k] !== null && query[k] !== '') {
      url.searchParams.set(k, String(query[k]));
    }
  });

  let timeoutId = null;
  let response;
  if (timeoutMs && typeof AbortController !== 'undefined') {
    const controller = new AbortController();
    timeoutId = setTimeout(function () {
      controller.abort();
    }, timeoutMs);
    response = await fetch(url.toString(), { headers: { Accept: 'application/json' }, signal: controller.signal });
    clearTimeout(timeoutId);
  } else {
    response = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
  }

  if (!response.ok) {
    throw new Error('TMDB error ' + response.status);
  }
  const data = await response.json();
  writeCached(key, data, ttlMs);
  return data;
};
