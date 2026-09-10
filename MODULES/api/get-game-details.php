<?php

declare(strict_types=1);

require_once __DIR__ . '/../rawg-steam-client.php';

header('Content-Type: application/json; charset=utf-8');

$search = trim((string) ($_GET['search'] ?? ''));

if ($search === '' || strlen($search) > 100) {
    http_response_code(400);
    echo json_encode(['error' => 'Provide a game search term up to 100 characters.']);
    exit;
}

try {
    echo json_encode(getGameFromRawgAndSteam($search), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
} catch (Throwable $error) {
    $status = $error->getCode();
    http_response_code($status >= 400 && $status < 600 ? $status : 502);
    echo json_encode(['error' => $error->getMessage()]);
}