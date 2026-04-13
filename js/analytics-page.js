function q(id) {
  return document.getElementById(id);
}

const PIN_HASH = 'd98fea4bf956cac6f07f05d147473fdc8e375952c9717ca32f6c3b5f7dbfed3a';
const PIN_OK_KEY = 'streamiha_analytics_pin_ok';

async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(function (b) {
    return b.toString(16).padStart(2, '0');
  }).join('');
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
      if (hash !== PIN_HASH) {
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
