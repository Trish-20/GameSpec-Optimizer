<?php

declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/benchmark-resolver.php';

function importBenchmarkData(PDO $database): array
{
    $counts = ['cpu' => 0, 'gpu' => 0, 'ram' => 0];

    $cpuStatement = $database->prepare(
        'INSERT INTO cpu_benchmarks (model, normalized_model, score, cores, category, source_version)
         VALUES (:model, :normalized_model, :score, :cores, :category, :source_version)
         ON DUPLICATE KEY UPDATE normalized_model = VALUES(normalized_model), score = VALUES(score), cores = VALUES(cores), category = VALUES(category), source_version = VALUES(source_version)'
    );
    foreach (readBenchmarkCsv(__DIR__ . '/../DATA/CPU-benchmarks-v4.csv') as $row) {
        if (($row[0] ?? '') === '' || strtolower(trim($row[11] ?? '')) !== 'desktop') {
            continue;
        }
        $cpuStatement->execute([
            'model' => trim($row[0]),
            'normalized_model' => normalizeBenchmarkName($row[0]),
            'score' => (int) ($row[2] ?? 0),
            'cores' => ($row[8] ?? '') === '' ? null : (int) $row[8],
            'category' => trim($row[11]),
            'source_version' => 'CPU-benchmarks-v4',
        ]);
        $counts['cpu']++;
    }

    $gpuStatement = $database->prepare(
        'INSERT INTO gpu_benchmarks (model, normalized_model, score, g2d_score, tdp, category, source_version)
         VALUES (:model, :normalized_model, :score, :g2d_score, :tdp, :category, :source_version)
         ON DUPLICATE KEY UPDATE normalized_model = VALUES(normalized_model), score = VALUES(score), g2d_score = VALUES(g2d_score), tdp = VALUES(tdp), category = VALUES(category), source_version = VALUES(source_version)'
    );
    foreach (readBenchmarkCsv(__DIR__ . '/../DATA/GPU-benchmarks-v7.csv') as $row) {
        $model = trim($row[0] ?? '');
        $category = strtolower(trim($row[8] ?? ''));
        if ($model === '' || !in_array($category, ['desktop', 'mobile', 'unknown'], true) || preg_match('/\b(quadro|tesla|titan|rtx a)\b/i', $model)) {
            continue;
        }
        $gpuStatement->execute([
            'model' => $model,
            'normalized_model' => normalizeBenchmarkName($model),
            'score' => (int) ($row[1] ?? 0),
            'g2d_score' => ($row[2] ?? '') === '' ? null : (int) $row[2],
            'tdp' => ($row[5] ?? '') === '' ? null : (int) $row[5],
            'category' => trim($row[8]),
            'source_version' => 'GPU-benchmarks-v7',
        ]);
        $counts['gpu']++;
    }

    $ramStatement = $database->prepare(
        'INSERT INTO ram_benchmarks (capacity_gb, speed_mhz, score, source_version)
         VALUES (:capacity_gb, :speed_mhz, :score, :source_version)
         ON DUPLICATE KEY UPDATE score = VALUES(score), source_version = VALUES(source_version)'
    );
    foreach (readBenchmarkCsv(__DIR__ . '/../DATA/RAM-benchmarks.csv') as $row) {
        if (($row[0] ?? '') === '') {
            continue;
        }
        $ramStatement->execute([
            'capacity_gb' => (int) $row[0],
            'speed_mhz' => (int) $row[1],
            'score' => (int) $row[2],
            'source_version' => 'RAM-benchmarks',
        ]);
        $counts['ram']++;
    }

    return $counts;
}

if (PHP_SAPI === 'cli') {
    $counts = importBenchmarkData(databaseConnection());
    echo json_encode($counts) . PHP_EOL;
}