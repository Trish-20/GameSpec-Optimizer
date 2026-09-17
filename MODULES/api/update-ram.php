<?php

declare(strict_types=1);

require_once __DIR__ . '/../db.php';

header('Content-Type: application/json; charset=utf-8');

$input = json_decode(file_get_contents('php://input'), true);

if (!is_array($input)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid JSON data.']);
    exit;
}

$model = trim((string) ($input['model'] ?? ''));
$score = (int) ($input['score'] ?? 0);

if ($model === '' || $score <= 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'RAM model and a positive benchmark score are required.']);
    exit;
}

// Parse capacity (GB) and optional speed (MHz) from the model string.
// Accepted formats: "16GB DDR4-3200", "32 GB DDR5-6000", "8GB", "16 GB 3200MHz", etc.
$capacityGb = 0;
$speedMhz = 0;

if (preg_match('/(\d+)\s*GB/i', $model, $capMatch)) {
    $capacityGb = (int) $capMatch[1];
}

// Try DDR-style speed first: "DDR4-3200" or "DDR5-6000"
if (preg_match('/DDR\d?[\s\-]*(\d{3,5})/i', $model, $spdMatch)) {
    $speedMhz = (int) $spdMatch[1];
}
// Fallback: look for a bare MHz value like "3200MHz" or "3200 MHz"
if ($speedMhz === 0 && preg_match('/(\d{3,5})\s*MHz/i', $model, $spdMatch2)) {
    $speedMhz = (int) $spdMatch2[1];
}

if ($capacityGb <= 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Could not parse a valid capacity (GB) from the model string. Use a format like "16GB DDR4-3200" or "8GB".']);
    exit;
}

try {
    $database = databaseConnection();

    // Check for duplicate by capacity + speed combination (the unique key)
    $check = $database->prepare('SELECT ram_id FROM ram_benchmarks WHERE capacity_gb = :capacity AND speed_mhz = :speed LIMIT 1');
    $check->execute(['capacity' => $capacityGb, 'speed' => $speedMhz]);
    if ($check->fetch()) {
        http_response_code(409);
        $label = $capacityGb . 'GB' . ($speedMhz > 0 ? ' @ ' . $speedMhz . 'MHz' : '');
        echo json_encode(['success' => false, 'message' => "A RAM benchmark for {$label} already exists."]);
        exit;
    }

    $insert = $database->prepare(
        'INSERT INTO ram_benchmarks (capacity_gb, speed_mhz, score, source_version)
         VALUES (:capacity_gb, :speed_mhz, :score, :source_version)'
    );
    $insert->execute([
        'capacity_gb' => $capacityGb,
        'speed_mhz' => $speedMhz,
        'score' => $score,
        'source_version' => 'admin',
    ]);

    echo json_encode(['success' => true, 'message' => 'RAM benchmark added successfully.']);
} catch (Throwable $error) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Unable to save RAM benchmark.']);
}
