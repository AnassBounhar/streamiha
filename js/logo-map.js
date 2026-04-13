(function () {
  const platformLogos = {
    netflix: '../assets/logos/netflix.svg',
    'amazon prime video': '../assets/logos/amazon-prime-video.svg',
    'disney plus': '../assets/logos/disney.svg',
    'apple tv plus': '../assets/logos/apple-tv.svg',
    hulu: '../assets/logos/hulu.svg',
    max: '../assets/logos/HBO_Max-Logo.svg',
    crunchyroll: '../assets/logos/crunchyroll.svg'
  };

  const producerLogos = {
    'warner bros': '../assets/logos/warner-bros.svg',
    'universal pictures': '../assets/logos/universal-studios.svg',
    'paramount pictures': '../assets/logos/paramount.svg',
    'columbia pictures': '../assets/logos/columbia-pictures.svg',
    'marvel studios': '../assets/logos/marvel.svg',
    pixar: '../assets/logos/pixar.svg',
    'dreamworks pictures': '../assets/logos/dreamworks-pictures.svg',
    'legendary pictures': '../assets/logos/legendary-pictures.svg',
    lionsgate: '../assets/logos/lionsgate.svg',
    'metro goldwyn mayer': '../assets/logos/metro-goldwyn-mayer.svg',
    'new line cinema': '../assets/logos/new-line-cinema.svg',
    '20th century fox': '../assets/logos/20th-century-fox.svg',
    illumination: '../assets/logos/Illumination.svg'
  };

  const aliases = {
    'prime video': 'amazon prime video',
    disney: 'disney plus',
    'apple tv': 'apple tv plus',
    'apple tv plus': 'apple tv plus',
    'apple tv ': 'apple tv plus',
    'appletv plus': 'apple tv plus',
    'apple tv +': 'apple tv plus',
    'hbo max': 'max',
    'warner bros pictures': 'warner bros',
    'universal studios': 'universal pictures',
    paramount: 'paramount pictures',
    mgm: 'metro goldwyn mayer'
  };

  const allLogos = Object.assign({}, platformLogos, producerLogos);

  function normalize(value) {
    return (value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  function whitenSvgSource(svg) {
    let out = svg;
    out = out.replace(/\sxmlns:undefined\s*=\s*(['"])[\s\S]*?\1/gi, '');
    out = out.replace(/\s+undefined:[^=\s>]+\s*=\s*(['"])[\s\S]*?\1/gi, '');
    out = out.replace(/\sfill\s*=\s*(['"])(.*?)\1/gi, function (m, _, v) {
      const val = String(v || '').trim().toLowerCase();
      if (val === 'none' || val === 'transparent') {
        return m;
      }
      return ' fill="white"';
    });
    out = out.replace(/(fill\s*:\s*)([^;}"']+)/gi, function (m, p, v) {
      const val = String(v || '').trim().toLowerCase();
      if (val === 'none' || val === 'transparent') {
        return m;
      }
      return p + 'white';
    });
    out = out.replace(/\sstroke\s*=\s*(['"])(.*?)\1/gi, function (m, _, v) {
      const val = String(v || '').trim().toLowerCase();
      if (val === 'none' || val === 'transparent') {
        return m;
      }
      return ' stroke="white"';
    });
    out = out.replace(/(stroke\s*:\s*)([^;}"']+)/gi, function (m, p, v) {
      const val = String(v || '').trim().toLowerCase();
      if (val === 'none' || val === 'transparent') {
        return m;
      }
      return p + 'white';
    });
    if (!/\sfill\s*=/i.test(out) && !/fill\s*:/i.test(out)) {
      out = out.replace(/<svg\b([^>]*)>/i, '<svg$1 fill="white">');
    }
    if (!/\sstroke\s*=/i.test(out) && !/stroke\s*:/i.test(out)) {
      out = out.replace(/<svg\b([^>]*)>/i, '<svg$1 stroke="white">');
    }
    return out;
  }

  const whiteSvgCache = new Map();

  window.loadWhiteSvgIntoImg = function (imgEl, svgPath, fallback) {
    if (!svgPath) {
      imgEl.src = fallback || '';
      return;
    }
    const cached = whiteSvgCache.get(svgPath);
    if (cached) {
      imgEl.src = cached;
      return;
    }
    fetch(svgPath).then(function (res) {
      if (!res.ok) {
        throw new Error('svg-load-failed');
      }
      return res.text();
    }).then(function (svgText) {
      const whiteSvg = whitenSvgSource(svgText || '');
      const blob = new Blob([whiteSvg], { type: 'image/svg+xml' });
      const blobUrl = URL.createObjectURL(blob);
      whiteSvgCache.set(svgPath, blobUrl);
      imgEl.src = blobUrl;
    }).catch(function () {
      imgEl.src = fallback || '';
    });
  };

  window.resolveLocalBrandLogo = function (name) {
    const key = normalize(name);
    const canonical = aliases[key] || key;
    return allLogos[canonical] || '';
  };

  window.LOCAL_PLATFORM_LOGOS = platformLogos;
  window.LOCAL_PRODUCER_LOGOS = producerLogos;
})();
