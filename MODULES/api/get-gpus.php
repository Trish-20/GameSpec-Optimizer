<?php

declare(strict_types=1);

require_once __DIR__ . '/../db.php';
header('Content-Type: application/json; charset=utf-8');

try {
    $rows = databaseConnection()->query('SELECT model, score, tdp FROM gpu_benchmarks WHERE category = "Desktop" ORDER BY score DESC')->fetchAll();
    echo json_encode(array_map(static fn (array $row): array => [
        'model' => $row['model'],
        'score' => (int) $row['score'],
        'tdp' => $row['tdp'] !== null ? (int) $row['tdp'] : 0,
    ], $rows));
} catch (Throwable $error) {
    http_response_code(500);
    echo json_encode(['error' => 'Unable to retrieve GPU benchmarks.']);
}
