<?php

declare(strict_types=1);

require_once __DIR__ . '/../db.php';
header('Content-Type: application/json; charset=utf-8');

try {
    $rows = databaseConnection()->query('SELECT capacity_gb AS capacity, speed_mhz AS speed, score FROM ram_benchmarks ORDER BY score DESC')->fetchAll();
    echo json_encode(array_map(static fn (array $row): array => [
        'capacity' => (int) $row['capacity'],
        'speed' => (int) $row['speed'],
        'score' => (int) $row['score'],
    ], $rows));
} catch (Throwable $error) {
    http_response_code(500);
    echo json_encode(['error' => 'Unable to retrieve RAM benchmarks.']);
}
