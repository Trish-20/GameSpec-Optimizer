<?php

declare(strict_types=1);

require_once __DIR__ . '/../db.php';

header('Content-Type: application/json; charset=utf-8');

try {
    $database = databaseConnection();
    $search = trim((string) ($_GET['search'] ?? ''));
    $genre = trim((string) ($_GET['genre'] ?? ''));
    $page = max(1, (int) ($_GET['page'] ?? 1));
    $limit = max(1, min(100, (int) ($_GET['limit'] ?? 50)));
    $offset = ($page - 1) * $limit;

    $conditions = [
        'g.is_active = 1',
    ];
    
    $parameters = [];

    if ($search !== '') {
        $conditions[] = 'g.title LIKE :search';
        $parameters['search'] = '%' . $search . '%';
    }

    if ($genre !== '') {
        // JSON_SEARCH is case-sensitive, so lowercase the stored JSON document
        // as well as the requested value. This lets the genre values written by
        // admin Game Management match the Browse Games filter regardless of case.
        $conditions[] = 'JSON_SEARCH(LOWER(g.genres), "one", LOWER(:genre)) IS NOT NULL';
        $parameters['genre'] = $genre;
    }

    $sql = 'SELECT g.* FROM games g WHERE ' . implode(' AND ', $conditions) . ' ORDER BY g.title ASC LIMIT :limit OFFSET :offset';
    $statement = $database->prepare($sql);
    foreach ($parameters as $name => $value) {
        $statement->bindValue(':' . $name, $value, PDO::PARAM_STR);
    }
    $statement->bindValue(':limit', $limit, PDO::PARAM_INT);
    $statement->bindValue(':offset', $offset, PDO::PARAM_INT);
    $statement->execute();

    $requirementsStatement = $database->prepare(
        'SELECT r.*, m.hardware_type, m.required_text, m.matched_model, m.matched_capacity_gb,
                m.matched_speed_mhz, m.benchmark_score, m.match_status, m.benchmark_source_version,
                m.resolved_at
         FROM game_requirements r
         LEFT JOIN game_benchmark_matches m ON m.requirement_id = r.requirement_id
         WHERE r.game_id = :game_id
         ORDER BY FIELD(r.requirement_type, "minimum", "recommended"), m.hardware_type'
    );

    $games = [];
    foreach ($statement->fetchAll() as $row) {
        $requirements = [
            'minimum' => ['os' => null, 'cpu' => null, 'gpu' => null, 'ram' => null, 'storage' => null, 'ram_capacity_gb' => null, 'ram_speed_mhz' => null],
            'recommended' => ['os' => null, 'cpu' => null, 'gpu' => null, 'ram' => null, 'storage' => null, 'ram_capacity_gb' => null, 'ram_speed_mhz' => null],
        ];
        $benchmarks = ['minimum' => ['cpu' => null, 'gpu' => null, 'ram' => null], 'recommended' => ['cpu' => null, 'gpu' => null, 'ram' => null]];

        $requirementsStatement->execute(['game_id' => $row['game_id']]);
        foreach ($requirementsStatement->fetchAll() as $requirement) {
            $type = $requirement['requirement_type'];
            $requirements[$type] = [
                'os' => $requirement['operating_system'],
                'cpu' => $requirement['cpu_text'],
                'gpu' => $requirement['gpu_text'],
                'ram' => $requirement['ram_text'],
                'storage' => $requirement['storage_text'],
                'ram_capacity_gb' => $requirement['ram_capacity_gb'] !== null ? (int) $requirement['ram_capacity_gb'] : null,
                'ram_speed_mhz' => $requirement['ram_speed_mhz'] !== null ? (int) $requirement['ram_speed_mhz'] : null,
            ];

            if ($requirement['hardware_type'] !== null) {
                $hardwareType = $requirement['hardware_type'];
                $benchmarks[$type][$hardwareType] = [
                    'required_text' => $requirement['required_text'],
                    'matched_model' => $requirement['matched_model'],
                    'matched_capacity_gb' => $requirement['matched_capacity_gb'] !== null ? (int) $requirement['matched_capacity_gb'] : null,
                    'matched_speed_mhz' => $requirement['matched_speed_mhz'] !== null ? (int) $requirement['matched_speed_mhz'] : null,
                    'score' => $requirement['benchmark_score'] !== null ? (int) $requirement['benchmark_score'] : null,
                    'match_status' => $requirement['match_status'],
                    'source_version' => $requirement['benchmark_source_version'],
                    'resolved_at' => $requirement['resolved_at'],
                ];
            }
        }

        $games[] = [
            'game_id' => (int) $row['game_id'],
            'rawg_id' => (int) $row['rawg_id'],
            'steam_app_id' => (int) $row['steam_app_id'],
            'title' => $row['title'],
            'title_raw' => $row['slug'] ?: $row['title'],
            'slug' => $row['slug'],
            'description' => $row['description'],
            'image' => $row['cover_url'],
            'release_date' => $row['release_date'],
            'release_year' => $row['release_year'] !== null ? (int) $row['release_year'] : null,
            'genres' => json_decode((string) $row['genres'], true) ?: [],
            'platforms' => json_decode((string) $row['platforms'], true) ?: [],
            'requirements' => $requirements,
            'benchmarks' => $benchmarks,
        ];
    }

    echo json_encode($games, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
} catch (Throwable $error) {
    error_log('get-games failed: ' . $error->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Unable to retrieve games from the database.']);
}
