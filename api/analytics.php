<?php
header('Content-Type: application/json; charset=utf-8');

$method = (string) ($_SERVER['REQUEST_METHOD'] ?? 'GET');
if ($method !== 'GET' && $method !== 'POST') {
    http_response_code(405);
    header('Allow: GET, POST');
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

if (!extension_loaded('pdo_sqlite')) {
    http_response_code(500);
    echo json_encode(['error' => 'Missing pdo_sqlite extension']);
    exit;
}

if (!is_dir(__DIR__) || !is_writable(__DIR__)) {
    http_response_code(500);
    echo json_encode(['error' => 'Analytics directory is not writable']);
    exit;
}

try {
    $db = new PDO('sqlite:' . __DIR__ . '/.analytics.sqlite');
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $db->exec('CREATE TABLE IF NOT EXISTS sessions (
        session_id TEXT PRIMARY KEY,
        first_seen INTEGER NOT NULL,
        last_seen INTEGER NOT NULL,
        user_agent TEXT,
        source TEXT,
        last_page TEXT,
        ip_address TEXT,
        country TEXT,
        region TEXT,
        city TEXT,
        timezone TEXT,
        language TEXT
    )');
    $db->exec('CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        page TEXT,
        movie_id INTEGER,
        movie_title TEXT,
        source TEXT,
        ip_address TEXT,
        country TEXT,
        region TEXT,
        city TEXT,
        timezone TEXT,
        language TEXT,
        created_at INTEGER NOT NULL
    )');
    $db->exec('CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at)');
    $db->exec('CREATE INDEX IF NOT EXISTS idx_events_movie_id ON events(movie_id)');
    $db->exec('CREATE INDEX IF NOT EXISTS idx_sessions_last_seen ON sessions(last_seen)');

    $ensureColumn = function ($table, $column, $definition) use ($db) {
        $stmt = $db->query('PRAGMA table_info(' . $table . ')');
        $cols = $stmt ? $stmt->fetchAll(PDO::FETCH_ASSOC) : [];
        foreach ($cols as $c) {
            if (($c['name'] ?? '') === $column) {
                return;
            }
        }
        $db->exec('ALTER TABLE ' . $table . ' ADD COLUMN ' . $column . ' ' . $definition);
    };

    $ensureColumn('sessions', 'ip_address', 'TEXT');
    $ensureColumn('sessions', 'country', 'TEXT');
    $ensureColumn('sessions', 'region', 'TEXT');
    $ensureColumn('sessions', 'city', 'TEXT');
    $ensureColumn('sessions', 'timezone', 'TEXT');
    $ensureColumn('sessions', 'language', 'TEXT');

    $ensureColumn('events', 'ip_address', 'TEXT');
    $ensureColumn('events', 'country', 'TEXT');
    $ensureColumn('events', 'region', 'TEXT');
    $ensureColumn('events', 'city', 'TEXT');
    $ensureColumn('events', 'timezone', 'TEXT');
    $ensureColumn('events', 'language', 'TEXT');

    $db->exec('CREATE INDEX IF NOT EXISTS idx_events_country ON events(country)');
    $db->exec('CREATE INDEX IF NOT EXISTS idx_events_ip_address ON events(ip_address)');
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'SQLite unavailable', 'reason' => $e->getMessage()]);
    exit;
}

function isPublicIpAddress($ip)
{
    if (!is_string($ip) || $ip === '') {
        return false;
    }
    return filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) !== false;
}

function countryFromLanguage($language)
{
    if (!is_string($language) || $language === '') {
        return '';
    }
    if (preg_match('/^[a-z]{2,3}[-_]([a-z]{2})/i', $language, $m)) {
        return strtoupper((string) $m[1]);
    }
    return '';
}

function geolocateFromIp($ip)
{
    if (!isPublicIpAddress($ip)) {
        return ['country' => '', 'region' => '', 'city' => ''];
    }
    $urls = [
        'https://ipapi.co/' . rawurlencode($ip) . '/json/',
        'https://ip-api.com/json/' . rawurlencode($ip)
    ];
    $context = stream_context_create([
        'http' => [
            'method' => 'GET',
            'timeout' => 2,
            'ignore_errors' => true,
            'header' => "Accept: application/json\r\nUser-Agent: StreamihaAnalytics/1.0\r\n"
        ]
    ]);
    foreach ($urls as $url) {
        $raw = @file_get_contents($url, false, $context);
        if (!is_string($raw) || $raw === '') {
            continue;
        }
        $json = json_decode($raw, true);
        if (!is_array($json)) {
            continue;
        }
        $country = trim((string) ($json['country_name'] ?? $json['country'] ?? ''));
        $region = trim((string) ($json['region'] ?? $json['regionName'] ?? ''));
        $city = trim((string) ($json['city'] ?? ''));
        if ($country !== '' || $region !== '' || $city !== '') {
            if (strlen($country) === 2) {
                $country = strtoupper($country);
            }
            return ['country' => $country, 'region' => $region, 'city' => $city];
        }
    }
    return ['country' => '', 'region' => '', 'city' => ''];
}

if ($method === 'GET') {
    $action = isset($_GET['action']) ? (string) $_GET['action'] : '';
    if ($action !== 'stats') {
        echo json_encode(['ok' => true]);
        exit;
    }

    $now = time();
    $activeSince = $now - 300;
    $periodSince = $now - 7 * 24 * 60 * 60;

    $activeStmt = $db->prepare('SELECT COUNT(*) AS c FROM sessions WHERE last_seen >= :since');
    $activeStmt->execute([':since' => $activeSince]);
    $activeSessions = (int) $activeStmt->fetchColumn();

    $moviesStmt = $db->prepare('SELECT movie_id, COALESCE(NULLIF(movie_title, ""), "Unknown") AS movie_title, COUNT(*) AS views
        FROM events
        WHERE event_type = "movie_view" AND created_at >= :since AND movie_id IS NOT NULL
        GROUP BY movie_id, movie_title
        ORDER BY views DESC
        LIMIT 10');
    $moviesStmt->execute([':since' => $periodSince]);
    $topMovies = $moviesStmt->fetchAll(PDO::FETCH_ASSOC);

    $sourceStmt = $db->prepare('SELECT COALESCE(NULLIF(source, ""), "direct") AS source, COUNT(*) AS hits
        FROM events
        WHERE created_at >= :since
        GROUP BY source
        ORDER BY hits DESC
        LIMIT 10');
    $sourceStmt->execute([':since' => $periodSince]);
    $topSources = $sourceStmt->fetchAll(PDO::FETCH_ASSOC);

    $locationStmt = $db->prepare('SELECT
            COALESCE(NULLIF(country, ""), "Unknown") AS country,
            COALESCE(NULLIF(region, ""), "-") AS region,
            COALESCE(NULLIF(city, ""), "-") AS city,
            COUNT(*) AS hits
        FROM events
        WHERE created_at >= :since
        GROUP BY country, region, city
        ORDER BY hits DESC
        LIMIT 10');
    $locationStmt->execute([':since' => $periodSince]);
    $topLocations = $locationStmt->fetchAll(PDO::FETCH_ASSOC);

    $ipStmt = $db->prepare('SELECT COALESCE(NULLIF(ip_address, ""), "unknown") AS ip_address, COUNT(*) AS hits
        FROM events
        WHERE created_at >= :since
        GROUP BY ip_address
        ORDER BY hits DESC
        LIMIT 10');
    $ipStmt->execute([':since' => $periodSince]);
    $topIps = $ipStmt->fetchAll(PDO::FETCH_ASSOC);

    $weeklySince = $now - 6 * 24 * 60 * 60;
    $weeklyMap = [];
    for ($i = 6; $i >= 0; $i--) {
        $dayTs = $now - $i * 24 * 60 * 60;
        $dayKey = gmdate('Y-m-d', $dayTs);
        $weeklyMap[$dayKey] = 0;
    }
    $weeklyStmt = $db->prepare('SELECT strftime("%Y-%m-%d", created_at, "unixepoch") AS d, COUNT(*) AS hits
        FROM events
        WHERE created_at >= :since
        GROUP BY d');
    $weeklyStmt->execute([':since' => $weeklySince]);
    foreach ($weeklyStmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $key = (string) ($row['d'] ?? '');
        if (isset($weeklyMap[$key])) {
            $weeklyMap[$key] = (int) ($row['hits'] ?? 0);
        }
    }
    $usageWeekly = [];
    foreach ($weeklyMap as $date => $hits) {
        $usageWeekly[] = ['date' => $date, 'label' => gmdate('D', strtotime($date . ' UTC')), 'hits' => (int) $hits];
    }

    $monthlySince = $now - 29 * 24 * 60 * 60;
    $monthlyMap = [];
    for ($i = 29; $i >= 0; $i--) {
        $dayTs = $now - $i * 24 * 60 * 60;
        $dayKey = gmdate('Y-m-d', $dayTs);
        $monthlyMap[$dayKey] = 0;
    }
    $monthlyStmt = $db->prepare('SELECT strftime("%Y-%m-%d", created_at, "unixepoch") AS d, COUNT(*) AS hits
        FROM events
        WHERE created_at >= :since
        GROUP BY d');
    $monthlyStmt->execute([':since' => $monthlySince]);
    foreach ($monthlyStmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $key = (string) ($row['d'] ?? '');
        if (isset($monthlyMap[$key])) {
            $monthlyMap[$key] = (int) ($row['hits'] ?? 0);
        }
    }
    $usageMonthly = [];
    foreach ($monthlyMap as $date => $hits) {
        $usageMonthly[] = ['date' => $date, 'label' => gmdate('m/d', strtotime($date . ' UTC')), 'hits' => (int) $hits];
    }

    echo json_encode([
        'active_sessions' => $activeSessions,
        'window' => ['active_seconds' => 300, 'stats_days' => 7],
        'top_movies' => $topMovies,
        'top_sources' => $topSources,
        'top_locations' => $topLocations,
        'top_ips' => $topIps,
        'usage_weekly' => $usageWeekly,
        'usage_monthly' => $usageMonthly
    ]);
    exit;
}

$raw = file_get_contents('php://input');
$data = json_decode((string) $raw, true);
if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid payload']);
    exit;
}

$sessionId = isset($data['session_id']) ? trim((string) $data['session_id']) : '';
$eventType = isset($data['event_type']) ? trim((string) $data['event_type']) : '';
$page = isset($data['page']) ? trim((string) $data['page']) : '';
$source = isset($data['source']) ? trim((string) $data['source']) : '';
$movieId = isset($data['movie_id']) ? (int) $data['movie_id'] : null;
$movieTitle = isset($data['movie_title']) ? trim((string) $data['movie_title']) : '';
$country = isset($data['country']) ? trim((string) $data['country']) : '';
$region = isset($data['region']) ? trim((string) $data['region']) : '';
$city = isset($data['city']) ? trim((string) $data['city']) : '';
$timezone = isset($data['timezone']) ? trim((string) $data['timezone']) : '';
$language = isset($data['language']) ? trim((string) $data['language']) : '';
$forwarded = isset($_SERVER['HTTP_X_FORWARDED_FOR']) ? trim((string) $_SERVER['HTTP_X_FORWARDED_FOR']) : '';
$clientIp = '';
if ($forwarded !== '') {
    $parts = explode(',', $forwarded);
    $clientIp = trim((string) ($parts[0] ?? ''));
}
if ($clientIp === '') {
    $clientIp = trim((string) ($_SERVER['REMOTE_ADDR'] ?? ''));
}
$clientIp = substr($clientIp, 0, 64);
$userAgent = substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 255);

if (!preg_match('/^[a-zA-Z0-9_-]{8,80}$/', $sessionId)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid session']);
    exit;
}
if (!preg_match('/^[a-z_]{3,40}$/', $eventType)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid event']);
    exit;
}

$page = substr($page, 0, 180);
$source = substr($source, 0, 120);
$movieTitle = substr($movieTitle, 0, 200);
$country = substr($country, 0, 80);
$region = substr($region, 0, 120);
$city = substr($city, 0, 120);
$timezone = substr($timezone, 0, 80);
$language = substr($language, 0, 40);

$geo = ['country' => '', 'region' => '', 'city' => ''];
if ($country === '' || $region === '' || $city === '') {
    $geo = geolocateFromIp($clientIp);
}
if ($country === '') {
    $country = (string) ($geo['country'] ?? '');
}
if ($region === '') {
    $region = (string) ($geo['region'] ?? '');
}
if ($city === '') {
    $city = (string) ($geo['city'] ?? '');
}
if ($country === '') {
    $country = countryFromLanguage($language);
}

$country = substr($country, 0, 80);
$region = substr($region, 0, 120);
$city = substr($city, 0, 120);
$now = time();

$upsert = $db->prepare('INSERT INTO sessions (session_id, first_seen, last_seen, user_agent, source, last_page, ip_address, country, region, city, timezone, language)
    VALUES (:session_id, :first_seen, :last_seen, :user_agent, :source, :last_page, :ip_address, :country, :region, :city, :timezone, :language)
    ON CONFLICT(session_id) DO UPDATE SET
    last_seen = excluded.last_seen,
    user_agent = excluded.user_agent,
    source = CASE WHEN excluded.source <> "" THEN excluded.source ELSE sessions.source END,
    last_page = excluded.last_page,
    ip_address = excluded.ip_address,
    country = CASE WHEN excluded.country <> "" THEN excluded.country ELSE sessions.country END,
    region = CASE WHEN excluded.region <> "" THEN excluded.region ELSE sessions.region END,
    city = CASE WHEN excluded.city <> "" THEN excluded.city ELSE sessions.city END,
    timezone = CASE WHEN excluded.timezone <> "" THEN excluded.timezone ELSE sessions.timezone END,
    language = CASE WHEN excluded.language <> "" THEN excluded.language ELSE sessions.language END');
$upsert->execute([
    ':session_id' => $sessionId,
    ':first_seen' => $now,
    ':last_seen' => $now,
    ':user_agent' => $userAgent,
    ':source' => $source,
    ':last_page' => $page,
    ':ip_address' => $clientIp,
    ':country' => $country,
    ':region' => $region,
    ':city' => $city,
    ':timezone' => $timezone,
    ':language' => $language
]);

$insertEvent = $db->prepare('INSERT INTO events (session_id, event_type, page, movie_id, movie_title, source, ip_address, country, region, city, timezone, language, created_at)
    VALUES (:session_id, :event_type, :page, :movie_id, :movie_title, :source, :ip_address, :country, :region, :city, :timezone, :language, :created_at)');
$insertEvent->bindValue(':session_id', $sessionId, PDO::PARAM_STR);
$insertEvent->bindValue(':event_type', $eventType, PDO::PARAM_STR);
$insertEvent->bindValue(':page', $page, PDO::PARAM_STR);
if ($movieId === null || $movieId <= 0) {
    $insertEvent->bindValue(':movie_id', null, PDO::PARAM_NULL);
} else {
    $insertEvent->bindValue(':movie_id', $movieId, PDO::PARAM_INT);
}
$insertEvent->bindValue(':movie_title', $movieTitle, PDO::PARAM_STR);
$insertEvent->bindValue(':source', $source, PDO::PARAM_STR);
$insertEvent->bindValue(':ip_address', $clientIp, PDO::PARAM_STR);
$insertEvent->bindValue(':country', $country, PDO::PARAM_STR);
$insertEvent->bindValue(':region', $region, PDO::PARAM_STR);
$insertEvent->bindValue(':city', $city, PDO::PARAM_STR);
$insertEvent->bindValue(':timezone', $timezone, PDO::PARAM_STR);
$insertEvent->bindValue(':language', $language, PDO::PARAM_STR);
$insertEvent->bindValue(':created_at', $now, PDO::PARAM_INT);
$insertEvent->execute();

echo json_encode(['ok' => true]);
