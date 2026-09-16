<?php

declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/rawg-steam-client.php';

function importRawgCatalog(PDO $database, int $page = 1, int $pageSize = 40, ?int $maxPages = 1): array
{
    $environment = loadEnvironment();
    $apiKey = $environment['RAW_API_KEY'] ?? $environment['RAWG_API_KEY'] ?? '';
    if ($apiKey === '') {
        throw new RuntimeException('RAWG API key is not configured.');
    }

    $upsert = $database->prepare(
        'INSERT INTO games (rawg_id, title, slug, description, cover_url, release_date, release_year, genres, platforms, rawg_synced_at)
         VALUES (:rawg_id, :title, :slug, :description, :cover_url, :release_date, :release_year, :genres, :platforms, NOW())
         ON DUPLICATE KEY UPDATE title = VALUES(title), slug = VALUES(slug), description = VALUES(description), cover_url = VALUES(cover_url), release_date = VALUES(release_date), release_year = VALUES(release_year), genres = VALUES(genres), platforms = VALUES(platforms), rawg_synced_at = NOW()'
    );
    $queue = $database->prepare(
        'INSERT INTO sync_jobs (game_id, job_type, status, run_after)
         SELECT game_id, "rawg_metadata", "queued", NOW()
         FROM games WHERE rawg_id = :rawg_id
         AND NOT EXISTS (SELECT 1 FROM sync_jobs WHERE game_id = games.game_id AND job_type = "rawg_metadata" AND status IN ("queued", "running", "complete"))'
    );

    $stateSelect = $database->prepare('SELECT last_cursor FROM game_sync_state WHERE source = "rawg" AND sync_scope = "catalog"');
    $stateSelect->execute();
    $savedState = $stateSelect->fetchColumn();
    
    // Use saved state if start page not explicitly provided via args
    if ($page === 1 && $savedState) {
        $page = (int) $savedState;
    }

    $stateUpdate = $database->prepare(
        'INSERT INTO game_sync_state (source, sync_scope, last_cursor, last_success_at)
         VALUES ("rawg", "catalog", :cursor, NOW())
         ON DUPLICATE KEY UPDATE last_cursor = VALUES(last_cursor), last_success_at = VALUES(last_success_at)'
    );

    $imported = 0;
    $pages = 0;
    do {
        $response = rawgRequest('games', [
            'page' => $page,
            'page_size' => max(1, min(40, $pageSize)),
            'ordering' => '-added',
            'platforms' => '4',
        ]);
        
        $results = $response['results'] ?? [];
        if (empty($results)) {
            break; // No more results
        }

        foreach ($results as $game) {
            $rawgId = (int) ($game['id'] ?? 0);
            if ($rawgId <= 0 || empty($game['name'])) {
                continue;
            }

            $releaseDate = !empty($game['released']) ? $game['released'] : null;
            $upsert->execute([
                'rawg_id' => $rawgId,
                'title' => $game['name'],
                'slug' => $game['slug'] ?? null,
                'description' => null,
                'cover_url' => $game['background_image'] ?? null,
                'release_date' => $releaseDate,
                'release_year' => $releaseDate ? (int) substr($releaseDate, 0, 4) : null,
                'genres' => json_encode(array_values(array_map(static fn (array $genre): string => (string) ($genre['name'] ?? ''), $game['genres'] ?? []))),
                'platforms' => json_encode(array_values(array_map(static fn (array $platform): string => (string) ($platform['platform']['name'] ?? ''), $game['platforms'] ?? []))),
            ]);
            $queue->execute(['rawg_id' => $rawgId]);
            $imported++;
        }
        $pages++;
        $page++;
        $hasNext = !empty($response['next']);
        
        // Save state after each successful page
        $stateUpdate->execute(['cursor' => (string)$page]);
        
    } while ($hasNext && ($maxPages === null || $pages < $maxPages));

    return ['pages' => $pages, 'games' => $imported, 'next_page' => $page];
}

if (PHP_SAPI === 'cli') {
    $page = isset($argv[1]) ? max(1, (int) $argv[1]) : 1;
    $maxPages = isset($argv[2]) ? max(1, (int) $argv[2]) : 1;
    echo json_encode(importRawgCatalog(databaseConnection(), $page, 40, $maxPages)) . PHP_EOL;
}