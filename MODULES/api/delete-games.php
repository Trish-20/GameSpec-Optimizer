<?php

declare(strict_types=1);

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/admin-auth.php';

header('Content-Type: application/json; charset=utf-8');

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
    $input = [];
}

// Accept gameId from JSON body, form POST, or query string.
$gameId = 0;
foreach (['gameId', 'game_id', 'id'] as $key) {
    if (isset($input[$key])) {
        $gameId = (int) $input[$key];
        break;
    }
}
if ($gameId <= 0) {
    foreach (['gameId', 'game_id', 'id'] as $key) {
        if (isset($_POST[$key])) {
            $gameId = (int) $_POST[$key];
            break;
        }
    }
}
if ($gameId <= 0) {
    foreach (['gameId', 'game_id', 'id'] as $key) {
        if (isset($_GET[$key])) {
            $gameId = (int) $_GET[$key];
            break;
        }
    }
}

if ($gameId <= 0) {
    http_response_code(400);

    echo json_encode([
        'success' => false,
        'message' => 'A valid gameId is required to delete a game.'
    ]);

    exit;
}

try {
    $database = databaseConnection();

    $gameStatement = $database->prepare(
        'SELECT game_id, title, cover_url
         FROM games
         WHERE game_id = :game_id
         LIMIT 1'
    );

    $gameStatement->execute([
        'game_id' => $gameId
    ]);

    $game = $gameStatement->fetch();

    if (!$game) {
        http_response_code(404);

        echo json_encode([
            'success' => false,
            'message' => 'The game you are trying to delete does not exist.'
        ]);

        exit;
    }

    $coverUrl = (string) ($game['cover_url'] ?? '');

    /*
     * Hard delete by game_id.
     *
     * Related records do NOT need manual cleanup:
     * - game_requirements.game_id -> games.game_id ON DELETE CASCADE
     * - game_benchmark_matches.requirement_id -> game_requirements.requirement_id ON DELETE CASCADE
     * - sync_jobs.game_id -> games.game_id ON DELETE CASCADE
     *
     * This works for both RAWG-imported and manually added (rawg_id/steam_app_id NULL) games.
     */
    $deleteGame = $database->prepare(
        'DELETE FROM games
         WHERE game_id = :game_id'
    );

    $deleteGame->execute([
        'game_id' => $gameId
    ]);

    if ($deleteGame->rowCount() === 0) {
        http_response_code(404);

        echo json_encode([
            'success' => false,
            'message' => 'The game you are trying to delete does not exist.'
        ]);

        exit;
    }

    // Remove a locally uploaded cover file, if any. Never delete remote (http) covers.
    if ($coverUrl !== '' && !preg_match('/^https?:\/\//i', $coverUrl) && strpos($coverUrl, 'uploads/game-covers/') === 0) {
        $coverPath = realpath(__DIR__ . '/../../' . $coverUrl);
        $uploadDirectory = realpath(__DIR__ . '/../../uploads/game-covers');

        if (
            $coverPath !== false &&
            $uploadDirectory !== false &&
            strpos($coverPath, $uploadDirectory) === 0 &&
            is_file($coverPath)
        ) {
            @unlink($coverPath);
        }
    }

    echo json_encode([
        'success' => true,
        'game_id' => $gameId,
        'message' => 'Game deleted successfully.'
    ]);
} catch (Throwable $error) {
    error_log(
        'delete-games.php error: ' . $error->getMessage()
    );

    http_response_code(500);

    echo json_encode([
        'success' => false,
        'message' => 'Unable to delete game.'
    ]);
}
