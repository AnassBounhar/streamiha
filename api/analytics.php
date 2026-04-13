<?php
header('Content-Type: application/json; charset=utf-8');

$method = (string) ($_SERVER['REQUEST_METHOD'] ?? 'GET');
if ($method !== 'GET' && $method !== 'POST') {
    http_response_code(405);
    header('Allow: GET, POST');
    echo json_encode(['error' => 'Method not allowed']);
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
        last_page TEXT
    )');
    $db->exec('CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        page TEXT,
        movie_id INTEGER,
        movie_title TEXT,
        source TEXT,
        created_at INTEGER NOT NULL
    )');
    $db->exec('CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at)');
    $db->exec('CREATE INDEX IF NOT EXISTS idx_events_movie_id ON events(movie_id)');
    $db->exec('CREATE INDEX IF NOT EXISTS idx_sessions_last_seen ON sessions(last_seen)');
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'SQLite unavailable']);
    exit;
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

    echo json_encode([
        'active_sessions' => $activeSessions,
        'window' => ['active_seconds' => 300, 'stats_days' => 7],
        'top_movies' => $topMovies,
        'top_sources' => $topSources
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
$now = time();

$upsert = $db->prepare('INSERT INTO sessions (session_id, first_seen, last_seen, user_agent, source, last_page)
    VALUES (:session_id, :first_seen, :last_seen, :user_agent, :source, :last_page)
    ON CONFLICT(session_id) DO UPDATE SET
    last_seen = excluded.last_seen,
    user_agent = excluded.user_agent,
    source = CASE WHEN excluded.source <> "" THEN excluded.source ELSE sessions.source END,
    last_page = excluded.last_page');
$upsert->execute([
    ':session_id' => $sessionId,
    ':first_seen' => $now,
    ':last_seen' => $now,
    ':user_agent' => $userAgent,
    ':source' => $source,
    ':last_page' => $page
]);

$insertEvent = $db->prepare('INSERT INTO events (session_id, event_type, page, movie_id, movie_title, source, created_at)
    VALUES (:session_id, :event_type, :page, :movie_id, :movie_title, :source, :created_at)');
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
$insertEvent->bindValue(':created_at', $now, PDO::PARAM_INT);
$insertEvent->execute();

echo json_encode(['ok' => true]);
