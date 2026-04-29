<?php
$postedUrl = isset($_POST['stream_url']) ? trim((string) $_POST['stream_url']) : '';
$embedUrl = '';
$embedHost = '';
$iframeSandbox = '';
$allowedHosts = [
    'www.vidking.net',
    'vidking.net',
    'vidsrc.icu',
    'www.vidsrc.icu',
    'player.autoembed.cc',
    'autoembed.cc',
    'www.autoembed.cc'
];
if ($postedUrl !== '') {
    $parts = parse_url($postedUrl);
    $host = isset($parts['host']) ? strtolower((string) $parts['host']) : '';
    $scheme = isset($parts['scheme']) ? strtolower((string) $parts['scheme']) : '';
    if (in_array($host, $allowedHosts, true) && ($scheme === 'https' || $scheme === 'http')) {
        $embedUrl = $postedUrl;
        $embedHost = $host;
    }
}
if ($embedHost === 'vidsrc.icu' || $embedHost === 'www.vidsrc.icu') {
    $iframeSandbox = 'allow-scripts allow-same-origin allow-forms allow-presentation allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation';
}
if ($embedHost === 'www.vidking.net' || $embedHost === 'vidking.net' || $embedHost === 'player.autoembed.cc' || $embedHost === 'autoembed.cc' || $embedHost === 'www.autoembed.cc') {
    $iframeSandbox = '';
}
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="icon" href="../assets/favicon.ico" type="image/x-icon" />
  <title>Streamiha Player</title>
  <style>
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      width: 100%;
      height: 100%;
      background: #000;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    .back {
      position: fixed;
      top: 12px;
      left: 12px;
      z-index: 12000;
      color: #dbeafe;
      text-decoration: none;
      border: 1px solid rgba(148, 163, 184, 0.55);
      border-radius: 999px;
      width: 44px;
      height: 44px;
      background: rgba(15, 23, 42, 0.45);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      line-height: 1;
      backdrop-filter: blur(6px);
      opacity: 1;
      transition: opacity 220ms ease;
    }
    .back.hidden {
      opacity: 0;
      pointer-events: none;
    }
    .player-shell {
      position: fixed;
      inset: 0;
      width: 100vw;
      height: 100vh;
      background: #000;
      overflow: hidden;
    }
    iframe {
      width: 100%;
      height: 100%;
      border: 0;
      display: block;
      background: #000;
    }
    .empty {
      position: fixed;
      inset: 0;
      display: grid;
      place-items: center;
      color: #e5e7eb;
      background: #0b1220;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <a class="back" id="back-btn" href="./index.html" aria-label="Back">←</a>

  <?php if ($embedUrl === ''): ?>
    <div class="empty">Invalid or missing stream URL.</div>
  <?php else: ?>
    <div class="player-shell" id="player-shell">
      <iframe
        id="player-frame"
        src="<?php echo htmlspecialchars($embedUrl, ENT_QUOTES, 'UTF-8'); ?>"
        referrerpolicy="no-referrer"
        <?php if ($iframeSandbox !== ''): ?>sandbox="<?php echo htmlspecialchars($iframeSandbox, ENT_QUOTES, 'UTF-8'); ?>"<?php endif; ?>
        allow="autoplay; fullscreen; picture-in-picture"
      ></iframe>
    </div>
  <?php endif; ?>

  <script src="../js/analytics.js"></script>
  <script src="../js/player.js"></script>
</body>
</html>
