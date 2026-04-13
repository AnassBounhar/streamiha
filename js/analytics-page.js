function q(id) {
  return document.getElementById(id);
}

const PIN_HASH = 'd98fea4bf956cac6f07f05d147473fdc8e375952c9717ca32f6c3b5f7dbfed3a';
const PIN_OK_KEY = 'streamiha_analytics_pin_ok';

function sha256Sync(ascii) {
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let result = '';
  const words = [];
  const asciiBitLength = ascii.length * 8;
  let hash = [];
  let k = [];
  let primeCounter = 0;
  const isComposite = {};
  const rightRotate = function (value, amount) {
    return (value >>> amount) | (value << (32 - amount));
  };

  for (let candidate = 2; primeCounter < 64; candidate += 1) {
    if (!isComposite[candidate]) {
      for (let i = 0; i < 313; i += candidate) {
        isComposite[i] = candidate;
      }
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
      primeCounter += 1;
    }
  }

  ascii += '\x80';
  while ((ascii.length % 64) - 56) {
    ascii += '\x00';
  }
  for (let i = 0; i < ascii.length; i += 1) {
    const j = ascii.charCodeAt(i);
    if (j >> 8) {
      return '';
    }
    words[i >> 2] |= j << ((3 - i) % 4) * 8;
  }
  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength;

  for (let j = 0; j < words.length;) {
    const w = words.slice(j, j += 16);
    const oldHash = hash.slice(0);
    for (let i = 0; i < 64; i += 1) {
      const w15 = w[i - 15];
      const w2 = w[i - 2];
      const a = hash[0];
      const e = hash[4];
      const temp1 = hash[7] + (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) + ((e & hash[5]) ^ ((~e) & hash[6])) + k[i] + (w[i] = i < 16 ? w[i] : (w[i - 16] + (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) + w[i - 7] + (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) | 0);
      const temp2 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
      hash = [(temp1 + temp2) | 0].concat(hash);
      hash[4] = (hash[4] + temp1) | 0;
      hash.pop();
    }
    for (let i = 0; i < 8; i += 1) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  for (let i = 0; i < 8; i += 1) {
    for (let j = 3; j + 1; j -= 1) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += ((b < 16) ? '0' : '') + b.toString(16);
    }
  }
  return result;
}

async function sha256Hex(text) {
  const value = String(text || '');
  if (window.crypto && window.crypto.subtle && typeof TextEncoder !== 'undefined') {
    const bytes = new TextEncoder().encode(value);
    const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(function (b) {
      return b.toString(16).padStart(2, '0');
    }).join('');
  }
  return sha256Sync(value);
}

function unlockApp() {
  const gate = q('pin-gate');
  const app = q('app');
  if (gate) {
    gate.style.display = 'none';
  }
  if (app) {
    app.classList.remove('app-locked');
  }
}

async function guardPage() {
  try {
    if (sessionStorage.getItem(PIN_OK_KEY) === '1') {
      unlockApp();
      return true;
    }
  } catch (_) {
  }

  const form = q('pin-form');
  const input = q('pin-input');
  const error = q('pin-error');
  if (!form || !input || !error) {
    return false;
  }

  return new Promise(function (resolve) {
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      error.textContent = '';
      const pin = String(input.value || '').trim();
      if (!pin) {
        error.textContent = 'PIN is required.';
        return;
      }
      const hash = await sha256Hex(pin);
      if (!hash || hash !== PIN_HASH) {
        error.textContent = 'Invalid PIN.';
        input.value = '';
        input.focus();
        return;
      }
      try {
        sessionStorage.setItem(PIN_OK_KEY, '1');
      } catch (_) {
      }
      unlockApp();
      resolve(true);
    });
    input.focus();
  });
}

function setStatus(text, isError) {
  const node = q('status');
  if (!node) return;
  node.textContent = text || '';
  node.style.color = isError ? '#fca5a5' : '#94a3b8';
}

function renderRows(targetId, rows, fields) {
  const body = q(targetId);
  if (!body) return;
  body.innerHTML = '';
  if (!Array.isArray(rows) || rows.length === 0) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 3;
    td.textContent = 'No data available yet.';
    tr.appendChild(td);
    body.appendChild(tr);
    return;
  }
  rows.forEach(function (item, index) {
    const tr = document.createElement('tr');
    const tdRank = document.createElement('td');
    tdRank.textContent = String(index + 1);
    const tdName = document.createElement('td');
    tdName.textContent = String(item[fields.name] || '-');
    const tdCount = document.createElement('td');
    tdCount.textContent = String(item[fields.count] || 0);
    tr.appendChild(tdRank);
    tr.appendChild(tdName);
    tr.appendChild(tdCount);
    body.appendChild(tr);
  });
}

function timeText() {
  const d = new Date();
  return d.toLocaleTimeString();
}

async function loadAnalytics() {
  try {
    setStatus('Loading analytics...');
    const data = await window.analyticsGetStats();
    q('active-sessions').textContent = String(data.active_sessions || 0);
    q('active-window').textContent = 'Active in last ' + String(Math.round((data.window?.active_seconds || 300) / 60)) + ' minutes';
    q('stats-window').textContent = String(data.window?.stats_days || 7) + ' days';
    q('last-updated').textContent = timeText();

    renderRows('top-movies-body', data.top_movies || [], { name: 'movie_title', count: 'views' });
    renderRows('top-sources-body', data.top_sources || [], { name: 'source', count: 'hits' });

    setStatus('Analytics loaded.');
  } catch (err) {
    setStatus((err && err.message) ? err.message : 'Failed to load analytics.', true);
  }
}

q('refresh-btn').addEventListener('click', function () {
  loadAnalytics();
});

(async function initPage() {
  const ok = await guardPage();
  if (!ok) {
    return;
  }
  loadAnalytics();
  setInterval(loadAnalytics, 30000);
})();
