(function () {
  const ENDPOINT = '/api/analytics.php';
  const SESSION_KEY = 'streamiha_analytics_session_id';

  function randomId() {
    return Math.random().toString(36).slice(2, 10);
  }

  function getSessionId() {
    try {
      const existing = localStorage.getItem(SESSION_KEY);
      if (existing && /^[a-zA-Z0-9_-]{8,80}$/.test(existing)) {
        return existing;
      }
      const created = 's_' + Date.now().toString(36) + '_' + randomId();
      localStorage.setItem(SESSION_KEY, created);
      return created;
    } catch (_) {
      return 's_' + Date.now().toString(36) + '_' + randomId();
    }
  }

  function detectSource() {
    try {
      const params = new URLSearchParams(window.location.search);
      const p = params.get('source') || params.get('utm_source') || '';
      if (p) return p;
    } catch (_) {
    }
    try {
      if (!document.referrer) return 'direct';
      const ref = new URL(document.referrer);
      return ref.hostname || 'direct';
    } catch (_) {
      return 'direct';
    }
  }

  function payload(eventType, extra) {
    const page = (window.location.pathname || '') + (window.location.search || '');
    return Object.assign({
      session_id: getSessionId(),
      event_type: eventType,
      page: page,
      source: detectSource()
    }, extra || {});
  }

  function send(eventType, extra) {
    const body = JSON.stringify(payload(eventType, extra));
    try {
      if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: 'application/json' });
        navigator.sendBeacon(ENDPOINT, blob);
        return;
      }
    } catch (_) {
    }
    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: body,
      keepalive: true
    }).catch(function () {
    });
  }

  window.analyticsTrack = function analyticsTrack(eventType, extra) {
    if (!eventType) return;
    send(eventType, extra);
  };

  window.analyticsGetStats = async function analyticsGetStats() {
    const url = new URL(ENDPOINT, window.location.origin);
    url.searchParams.set('action', 'stats');
    const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
    if (!res.ok) {
      throw new Error('Analytics error ' + res.status);
    }
    return res.json();
  };

  send('page_view');
  setInterval(function () {
    send('session_ping');
  }, 60000);
})();
