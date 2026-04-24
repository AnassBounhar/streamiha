(function () {
  const frame = document.getElementById('player-frame');
  const shell = document.getElementById('player-shell');
  const backBtn = document.getElementById('back-btn');
  const ALLOWED_EMBED_HOSTS = ['www.vidking.net', 'vidking.net', 'vidsrc.icu', 'www.vidsrc.icu', 'autoembed.cc', 'www.autoembed.cc'];
  let hideTimer = null;
  let popupNotice = null;
  let popupNoticeTimer = null;
  let frameIntentAt = 0;

  function showBackButton() {
    if (!backBtn) {
      return;
    }
    backBtn.classList.remove('hidden');
  }

  function showPopupNotice() {
    if (!shell) {
      return;
    }
    if (!popupNotice) {
      popupNotice = document.createElement('div');
      popupNotice.style.position = 'fixed';
      popupNotice.style.left = '50%';
      popupNotice.style.bottom = '20px';
      popupNotice.style.transform = 'translateX(-50%)';
      popupNotice.style.maxWidth = 'calc(100vw - 24px)';
      popupNotice.style.padding = '10px 14px';
      popupNotice.style.borderRadius = '10px';
      popupNotice.style.background = 'rgba(15, 23, 42, 0.88)';
      popupNotice.style.color = '#e2e8f0';
      popupNotice.style.fontSize = '13px';
      popupNotice.style.lineHeight = '1.35';
      popupNotice.style.zIndex = '13000';
      popupNotice.style.boxShadow = '0 10px 32px rgba(2, 6, 23, 0.45)';
      popupNotice.style.pointerEvents = 'none';
      popupNotice.textContent = 'Potential popup blocked. Tap player again if playback paused.';
      shell.appendChild(popupNotice);
    }
    popupNotice.style.display = 'block';
    if (popupNoticeTimer) {
      clearTimeout(popupNoticeTimer);
    }
    popupNoticeTimer = setTimeout(function () {
      if (popupNotice) {
        popupNotice.style.display = 'none';
      }
    }, 2600);
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
    return !host || host === window.location.hostname || ALLOWED_EMBED_HOSTS.includes(host);
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

  frame.addEventListener('pointerdown', function () {
    frameIntentAt = Date.now();
  }, { passive: true });

  frame.addEventListener('touchstart', function () {
    frameIntentAt = Date.now();
  }, { passive: true });

  window.addEventListener('blur', function () {
    if (!frameIntentAt) {
      return;
    }
    const elapsed = Date.now() - frameIntentAt;
    if (elapsed > 0 && elapsed < 2200) {
      restartBackButtonTimer();
      showPopupNotice();
    }
  });

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
