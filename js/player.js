(function () {
  const frame = document.getElementById('player-frame');
  const shell = document.getElementById('player-shell');
  const backBtn = document.getElementById('back-btn');
  const EMBED_HOST = 'www.vidking.net';
  let hideTimer = null;

  function showBackButton() {
    if (!backBtn) {
      return;
    }
    backBtn.classList.remove('hidden');
  }

  function hideBackButton() {
    if (!backBtn) {
      return;
    }
    backBtn.classList.add('hidden');
  }

  function restartBackButtonTimer() {
    showBackButton();
    if (hideTimer) {
      clearTimeout(hideTimer);
    }
    hideTimer = setTimeout(function () {
      hideBackButton();
    }, 5000);
  }

  function getHost(url) {
    try {
      return new URL(url, window.location.href).hostname;
    } catch (_) {
      return '';
    }
  }

  function isAllowedHost(host) {
    return !host || host === window.location.hostname || host === EMBED_HOST;
  }

  function blockPopupsAndEscapes() {
    const nativeOpen = window.open;
    window.open = function (url, target, features) {
      const host = getHost(url);
      if (isAllowedHost(host)) {
        return nativeOpen ? nativeOpen.call(window, url, target, features) : null;
      }
      return null;
    };

    document.addEventListener('click', function (ev) {
      const link = ev.target && ev.target.closest ? ev.target.closest('a[href]') : null;
      if (!link || link.id === 'back-btn') {
        return;
      }
      const host = getHost(link.href);
      if (!isAllowedHost(host)) {
        ev.preventDefault();
        ev.stopPropagation();
      }
    }, true);

    document.addEventListener('submit', function (ev) {
      const form = ev.target;
      if (!form || !form.getAttribute) {
        return;
      }
      const action = form.getAttribute('action') || '';
      const host = getHost(action);
      if (!isAllowedHost(host)) {
        ev.preventDefault();
        ev.stopPropagation();
      }
    }, true);
  }

  function guardOverlays() {
    if (!shell || !frame) {
      return;
    }
    const clean = function () {
      const rect = frame.getBoundingClientRect();
      const nodes = shell.querySelectorAll('a, button, iframe, div, section, aside');
      nodes.forEach(function (node) {
        if (node === frame) {
          return;
        }
        const style = window.getComputedStyle(node);
        if (style.position !== 'fixed' && style.position !== 'absolute') {
          return;
        }
        const z = Number(style.zIndex || '0');
        if (z < 1000) {
          return;
        }
        const r = node.getBoundingClientRect();
        const overlaps = !(r.right < rect.left || r.left > rect.right || r.bottom < rect.top || r.top > rect.bottom);
        if (overlaps) {
          node.remove();
        }
      });
    };
    clean();
    const obs = new MutationObserver(clean);
    obs.observe(shell, { childList: true, subtree: true });
  }

  if (!frame) {
    if (backBtn) {
      backBtn.classList.remove('hidden');
    }
    if (typeof window.analyticsTrack === 'function') {
      window.analyticsTrack('player_view_invalid');
    }
    return;
  }

  if (typeof window.analyticsTrack === 'function') {
    window.analyticsTrack('player_view', {
      page: window.location.pathname
    });
  }

  blockPopupsAndEscapes();
  guardOverlays();

  if (backBtn) {
    backBtn.addEventListener('mouseenter', function () {
      showBackButton();
    });
  }
  document.addEventListener('mousemove', restartBackButtonTimer, { passive: true });
  document.addEventListener('touchstart', restartBackButtonTimer, { passive: true });
  document.addEventListener('keydown', restartBackButtonTimer);
  restartBackButtonTimer();

  frame.addEventListener('load', function () {
    restartBackButtonTimer();
  });
})();
