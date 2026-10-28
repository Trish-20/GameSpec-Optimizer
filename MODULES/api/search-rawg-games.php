<?php

declare(strict_types=1);

require_once __DIR__ . '/../rawg-steam-client.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/admin-auth.php';

header('Content-Type: application/json; charset=utf-8');

$search = trim((string) ($_GET['search'] ?? ''));
if ($search === '' || mb_strlen($search) > 100) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Enter a game title up to 100 characters.']);
    exit;
}

try {
    $results = searchRawgGames($search);
    $database = databaseConnection();
    $find = $database->prepare('SELECT game_id, title, is_active FROM games WHERE rawg_id = :rawg_id LIMIT 1');
    foreach ($results as &$game) {
        $find->execute(['rawg_id' => $game['rawg_id']]);
        $existing = $find->fetch();
        $game['existing'] = $existing ? ['game_id' => (int) $existing['game_id'], 'title' => $existing['title'], 'is_active' => (int) $existing['is_active']] : null;
        $game['upcoming'] = !empty($game['release_date']) && $game['release_date'] > date('Y-m-d');
    }
    unset($game);
    echo json_encode(['success' => true, 'results' => $results], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
} catch (Throwable $error) {
    error_log('search-rawg-games failed: ' . $error->getMessage());
    $status = $error->getCode();
    http_response_code($status >= 400 && $status < 600 ? $status : 502);
    echo json_encode(['success' => false, 'message' => 'RAWG search failed. Check the API configuration or try again shortly.']);
}
