<?php

require_once __DIR__ . '/../benchmark-resolver.php';

$search = trim((string) ($_GET['search'] ?? ''));

if ($search !== '') {
    require_once __DIR__ . '/../rawg-steam-client.php';
    header('Content-Type: application/json; charset=utf-8');

    if (strlen($search) > 100) {
        http_response_code(400);
        echo json_encode(['error' => 'Search term must be 100 characters or fewer.']);
        exit;
    }

    try {
        echo json_encode(getGameFromRawgAndSteam($search), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    } catch (Throwable $error) {
        http_response_code(502);
        echo json_encode(['error' => $error->getMessage()]);
    }
    exit;
}

$csvFile = __DIR__ . '/../../DATA/game-requirements.csv';
$games = [];

if (($handle = fopen($csvFile, 'r')) !== FALSE) {
    $header = fgetcsv($handle); // skip header
    
    while (($row = fgetcsv($handle)) !== FALSE) {
        $cpuModel = trim((string) ($row[1] ?? ''));
        $gpuModel = trim((string) ($row[2] ?? ''));
        $ramCapacityGb = (int) ($row[3] ?? 0);
        $ramSpeedMhz = (int) ($row[4] ?? 0);
        $benchmarks = resolveGameBenchmarks($cpuModel, $gpuModel, $ramCapacityGb, $ramSpeedMhz);

        $games[] = [
            'title' => str_replace('_', ' ', $row[0]), // processed for display
            'title_raw' => $row[0], // raaaaaaaaaaaaaaaaaw
            'cpu_model' => $cpuModel,
            'cpu_benchmark' => $benchmarks['cpu_benchmark'],
            'gpu_model' => $gpuModel,
            'gpu_benchmark' => $benchmarks['gpu_benchmark'],
            'ram_model' => $ramCapacityGb . ' GB DDR4-' . $ramSpeedMhz,
            'ram_capacity_gb' => $ramCapacityGb,
            'ram_speed_mhz' => $ramSpeedMhz,
            'ram_benchmark' => $benchmarks['ram_benchmark'],
            'benchmark_matches' => $benchmarks,
            'hasBloom' => (int)($row[5] ?? 0),
            'hasAntiAlias' => (int)($row[6] ?? 0),
            'hasShadows' => (int)($row[7] ?? 0),
            'hasVSync' => (int)($row[8] ?? 0),
            'image' => isset($row[9]) ? $row[9] : '',
            // Optional description (new column in DATA/game-requirements.csv)
            'description' => isset($row[10]) ? (string) $row[10] : ''
        ];
    }
    fclose($handle);
}

echo json_encode($games);
?>
