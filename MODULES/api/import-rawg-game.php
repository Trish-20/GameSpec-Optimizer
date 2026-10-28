<?php

declare(strict_types=1);

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../rawg-steam-client.php';
require_once __DIR__ . '/admin-auth.php';

header('Content-Type: application/json; charset=utf-8');

$input = json_decode((string) file_get_contents('php://input'), true);
$rawgId = filter_var($input['rawg_id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
if ($rawgId === false || $rawgId === null) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Select a valid RAWG game.']);
    exit;
}

try {
    $details = rawgRequest('games/' . $rawgId);
    if ((int) ($details['id'] ?? 0) !== $rawgId || trim((string) ($details['name'] ?? '')) === '') {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'RAWG did not return that game.']);
        exit;
    }

    $platformNames = array_values(array_filter(array_map(
        static fn (array $platform): string => trim((string) ($platform['platform']['name'] ?? '')),
        $details['platforms'] ?? []
    )));
    $isPc = (bool) array_filter($platformNames, static fn (string $platform): bool => strcasecmp($platform, 'PC') === 0);
    if (!$isPc) {
        http_response_code(422);
        echo json_encode(['success' => false, 'message' => 'This title has no RAWG PC platform listing and cannot be evaluated by the PC optimizer.']);
        exit;
    }

    $releaseDate = !empty($details['released']) && preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) $details['released'])
        ? (string) $details['released'] : null;
    $database = databaseConnection();
    $database->beginTransaction();
    $existing = $database->prepare('SELECT game_id, title FROM games WHERE rawg_id = :rawg_id FOR UPDATE');
    $existing->execute(['rawg_id' => $rawgId]);
    $prior = $existing->fetch();

    $upsert = $database->prepare(
        'INSERT INTO games (rawg_id, title, slug, description, cover_url, release_date, release_year, genres, platforms, is_active, rawg_synced_at)
         VALUES (:rawg_id, :title, :slug, :description, :cover_url, :release_date, :release_year, :genres, :platforms, 0, NOW())
         ON DUPLICATE KEY UPDATE title = VALUES(title), slug = VALUES(slug), description = VALUES(description), cover_url = VALUES(cover_url), release_date = VALUES(release_date), release_year = VALUES(release_year), genres = VALUES(genres), platforms = VALUES(platforms), rawg_synced_at = NOW()'
    );
    $upsert->execute([
        'rawg_id' => $rawgId,
        'title' => trim((string) $details['name']),
        'slug' => $details['slug'] ?? null,
        'description' => $details['description_raw'] ?? strip_tags((string) ($details['description'] ?? '')),
        'cover_url' => $details['background_image'] ?? null,
        'release_date' => $releaseDate,
        'release_year' => $releaseDate ? (int) substr($releaseDate, 0, 4) : null,
        'genres' => json_encode(array_values(array_filter(array_map(static fn (array $genre): string => (string) ($genre['name'] ?? ''), $details['genres'] ?? [])))),
        'platforms' => json_encode($platformNames),
    ]);
    $findGame = $database->prepare('SELECT game_id FROM games WHERE rawg_id = :rawg_id');
    $findGame->execute(['rawg_id' => $rawgId]);
    $gameId = (int) $findGame->fetchColumn();

    // Reuse an unfinished metadata job. A failed job is eligible for a safe retry.
    $job = $database->prepare(
        'SELECT job_id, status, last_error FROM sync_jobs WHERE game_id = :game_id AND job_type = "rawg_metadata" ORDER BY job_id DESC LIMIT 1 FOR UPDATE'
    );
    $job->execute(['game_id' => $gameId]);
    $jobRow = $job->fetch();
    $metadataJobError = $jobRow['last_error'] ?? null;
    if ($jobRow && in_array($jobRow['status'], ['queued', 'running', 'complete'], true)) {
        $jobId = (int) $jobRow['job_id'];
        $queued = false;
        $jobStatus = (string) $jobRow['status'];
    } else {
        $queue = $database->prepare(
            'INSERT INTO sync_jobs (game_id, job_type, status, run_after)
             VALUES (:game_id, "rawg_metadata", "queued", NOW())'
        );
        $queue->execute(['game_id' => $gameId]);
        $jobId = (int) $database->lastInsertId();
        $queued = true;
        $jobStatus = 'queued';
    }
    $database->commit();

    echo json_encode([
        'success' => true,
        'game_id' => $gameId,
        'title' => trim((string) $details['name']),
        'already_exists' => (bool) $prior,
        'job_id' => $jobId,
        'queued' => $queued,
        'release_date' => $releaseDate,
        'upcoming' => $releaseDate !== null && $releaseDate > date('Y-m-d'),
        'job_status' => $jobStatus,
        'metadata_job_error' => $metadataJobError,
        'message' => $prior
            ? ($queued ? 'Existing game updated; a safe metadata retry was queued.' : 'Existing game updated without creating a duplicate or repeated enrichment job.')
            : 'Game imported and metadata enrichment queued.',
    ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
} catch (Throwable $error) {
    if (isset($database) && $database->inTransaction()) $database->rollBack();
    error_log('import-rawg-game failed: ' . $error->getMessage());
    $status = $error->getCode();
    http_response_code($status >= 400 && $status < 600 ? $status : 500);
    echo json_encode(['success' => false, 'message' => 'The game could not be imported. Check server logs or retry.']);
}
