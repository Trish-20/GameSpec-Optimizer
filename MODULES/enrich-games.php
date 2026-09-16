<?php

declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/rawg-steam-client.php';

function enrichGames(PDO $database, int $limit = 10): array
{
    $jobs = $database->prepare(
        'SELECT j.job_id, j.game_id, g.rawg_id, g.title
         FROM sync_jobs j
         INNER JOIN games g ON g.game_id = j.game_id
         WHERE j.job_type = "rawg_metadata" AND j.status = "queued"
         ORDER BY j.created_at ASC
         LIMIT :limit'
    );
    $jobs->bindValue(':limit', max(1, min(50, $limit)), PDO::PARAM_INT);
    $jobs->execute();
    $items = $jobs->fetchAll();

    $claim = $database->prepare('UPDATE sync_jobs SET status = "running", attempts = attempts + 1 WHERE job_id = :job_id AND status = "queued"');
    $updateGame = $database->prepare(
        'UPDATE games
         SET steam_app_id = :steam_app_id, description = :description, cover_url = :cover_url,
             release_date = :release_date, release_year = :release_year, genres = :genres,
             platforms = :platforms, is_active = :is_active, rawg_synced_at = NOW(), steam_synced_at = :steam_synced_at
         WHERE game_id = :game_id'
    );
    $upsertRequirement = $database->prepare(
        'INSERT INTO game_requirements
            (game_id, requirement_type, operating_system, cpu_text, gpu_text, ram_text, storage_text, ram_capacity_gb, ram_speed_mhz, raw_html, synced_at)
         VALUES
            (:game_id, :requirement_type, :operating_system, :cpu_text, :gpu_text, :ram_text, :storage_text, :ram_capacity_gb, :ram_speed_mhz, :raw_html, NOW())
         ON DUPLICATE KEY UPDATE
            operating_system = VALUES(operating_system), cpu_text = VALUES(cpu_text), gpu_text = VALUES(gpu_text),
            ram_text = VALUES(ram_text), storage_text = VALUES(storage_text), ram_capacity_gb = VALUES(ram_capacity_gb),
            ram_speed_mhz = VALUES(ram_speed_mhz), raw_html = VALUES(raw_html), synced_at = NOW()'
    );
    $queueBenchmark = $database->prepare(
        'INSERT INTO sync_jobs (game_id, job_type, status, run_after)
         VALUES (:game_id, "benchmark_resolution", "queued", NOW())'
    );
    $finish = $database->prepare('UPDATE sync_jobs SET status = :status, last_error = :last_error WHERE job_id = :job_id');

    $complete = 0;
    $failed = 0;
    foreach ($items as $item) {
        $claim->execute(['job_id' => $item['job_id']]);
        if ($claim->rowCount() !== 1) {
            continue;
        }

        try {
            $details = rawgRequest('games/' . (int) $item['rawg_id']);
            $title = (string) ($details['name'] ?? $item['title']);
            $steamAppId = findSteamAppId($details) ?? findSteamAppIdByTitle($title);
            $steam = $steamAppId !== null ? steamAppDetailsRequest($steamAppId) : [];
            $steamRequirements = $steam['pc_requirements'] ?? [];

            if ($steamAppId === null) {
                $updateGame->execute([
                    'game_id' => $item['game_id'],
                    'steam_app_id' => null,
                    'description' => $details['description_raw'] ?? strip_tags((string) ($details['description'] ?? '')),
                    'cover_url' => $details['background_image'] ?? null,
                    'release_date' => !empty($details['released']) ? $details['released'] : null,
                    'release_year' => !empty($details['released']) ? (int) substr($details['released'], 0, 4) : null,
                    'genres' => json_encode(array_values(array_map(static fn (array $genre): string => (string) ($genre['name'] ?? ''), $details['genres'] ?? []))),
                    'platforms' => json_encode(array_values(array_map(static fn (array $platform): string => (string) ($platform['platform']['name'] ?? ''), $details['platforms'] ?? []))),
                    'is_active' => 0,
                    'steam_synced_at' => null,
                ]);
                $finish->execute(['status' => 'complete', 'last_error' => null, 'job_id' => $item['job_id']]);
                $complete++;
                continue;
            }

            foreach (['minimum', 'recommended'] as $type) {
                $parsed = normalizeRequirements((string) ($steamRequirements[$type] ?? ''));
                $ram = extractRamSpec($parsed['ram'] ?? null);
                $upsertRequirement->execute([
                    'game_id' => $item['game_id'],
                    'requirement_type' => $type,
                    'operating_system' => $parsed['os'],
                    'cpu_text' => $parsed['cpu'],
                    'gpu_text' => $parsed['gpu'],
                    'ram_text' => $parsed['ram'],
                    'storage_text' => $parsed['storage'],
                    'ram_capacity_gb' => $ram['capacity_gb'] > 0 ? $ram['capacity_gb'] : null,
                    'ram_speed_mhz' => $ram['speed_mhz'] > 0 ? $ram['speed_mhz'] : null,
                    'raw_html' => $parsed['raw'],
                ]);
            }

            $releaseDate = !empty($details['released']) ? $details['released'] : null;
            $updateGame->execute([
                'game_id' => $item['game_id'],
                'steam_app_id' => $steamAppId,
                'description' => $details['description_raw'] ?? strip_tags((string) ($details['description'] ?? '')),
                'cover_url' => $details['background_image'] ?? null,
                'release_date' => $releaseDate,
                'release_year' => $releaseDate ? (int) substr($releaseDate, 0, 4) : null,
                'genres' => json_encode(array_values(array_map(static fn (array $genre): string => (string) ($genre['name'] ?? ''), $details['genres'] ?? []))),
                'platforms' => json_encode(array_values(array_map(static fn (array $platform): string => (string) ($platform['platform']['name'] ?? ''), $details['platforms'] ?? []))),
                'is_active' => 1,
                'steam_synced_at' => $steamAppId !== null ? date('Y-m-d H:i:s') : null,
            ]);
            $queueBenchmark->execute(['game_id' => $item['game_id']]);
            $finish->execute(['status' => 'complete', 'last_error' => null, 'job_id' => $item['job_id']]);
            $complete++;
        } catch (Throwable $error) {
            $finish->execute(['status' => 'failed', 'last_error' => $error->getMessage(), 'job_id' => $item['job_id']]);
            $failed++;
        }
    }

    return ['processed' => count($items), 'complete' => $complete, 'failed' => $failed];
}

if (PHP_SAPI === 'cli') {
    $limit = isset($argv[1]) ? max(1, (int) $argv[1]) : 10;
    echo json_encode(enrichGames(databaseConnection(), $limit)) . PHP_EOL;
}
