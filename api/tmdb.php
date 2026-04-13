<?php
$readEnvValue = function ($key) {
    $val = getenv($key);
    if ($val !== false && $val !== '') {
        return $val;
    }

    $envPaths = [
        dirname(__DIR__) . '/.env',
        __DIR__ . '/.env'
    ];

    foreach ($envPaths as $envPath) {
        if (!is_file($envPath)) {
            continue;
        }
        $lines = @file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        if (!$lines) {
            continue;
        }
        foreach ($lines as $line) {
            $line = trim($line);
            if ($line === '' || $line[0] === '#') {
                continue;
            }
            $pos = strpos($line, '=');
            if ($pos === false) {
                continue;
            }
            $k = trim(substr($line, 0, $pos));
            if ($k !== $key) {
                continue;
            }
            $v = trim(substr($line, $pos + 1));
            return trim($v, "\"'");
        }
    }

    return '';
};

$token = $readEnvValue('TMDB_API_READ_TOKEN');
if (!$token) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'Missing TMDB_API_READ_TOKEN']);
    exit;
}

if ((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    http_response_code(405);
    header('Allow: GET');
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$path = isset($_GET['path']) ? (string) $_GET['path'] : '';
if ($path === '') {
    $pathInfo = isset($_SERVER['PATH_INFO']) ? (string) $_SERVER['PATH_INFO'] : '';
    if ($pathInfo !== '') {
        $path = $pathInfo;
    }
}
if ($path === '') {
    $uriPath = parse_url((string) ($_SERVER['REQUEST_URI'] ?? ''), PHP_URL_PATH) ?: '';
    $prefix = '/api/tmdb/';
    if (strpos($uriPath, $prefix) === 0) {
        $path = '/' . ltrim(substr($uriPath, strlen($prefix)), '/');
    }
}
if ($path === '' || $path[0] !== '/' || !preg_match('#^/[a-z0-9_\-/]+$#i', $path)) {
    http_response_code(400);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'Invalid path']);
    exit;
}

$qs = $_GET;
unset($qs['path']);
$query = http_build_query($qs);
$url = 'https://api.themoviedb.org/3' . $path . ($query ? ('?' . $query) : '');

$execTmdbRequest = function ($insecure) use ($url, $token) {
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Accept: application/json',
        'Authorization: Bearer ' . $token
    ]);
    curl_setopt($ch, CURLOPT_TIMEOUT, 20);
    if ($insecure) {
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0);
    }
    $body = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);
    return [$body, $status, $error];
};

$allowInsecure = $readEnvValue('TMDB_CURL_INSECURE') === '1';
$isLocalHost = in_array((string) ($_SERVER['HTTP_HOST'] ?? ''), ['localhost', '127.0.0.1', 'localhost:8080', '127.0.0.1:8080'], true);
$allowInsecureFallback = $allowInsecure && $isLocalHost;
[$body, $status, $error] = $execTmdbRequest(false);
if ($body === false && $allowInsecureFallback && stripos((string) $error, 'certificate') !== false) {
    [$body, $status, $error] = $execTmdbRequest(true);
}

if ($body === false) {
    http_response_code(502);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => $error ?: 'Upstream request failed']);
    exit;
}

http_response_code($status > 0 ? $status : 200);
header('Content-Type: application/json; charset=utf-8');
echo $body;
