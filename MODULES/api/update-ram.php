<?php

declare(strict_types=1);

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../benchmark-resolver.php';
require_once __DIR__ . '/admin-auth.php';

header('Content-Type: application/json; charset=utf-8');

$input = json_decode(file_get_contents('php://input'), true);

if (!is_array($input)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid JSON data.']);
    exit;
}

$model = trim((string) ($input['model'] ?? ''));
$rawScore = $input['score'] ?? null;

if ($model === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'RAM model is required.']);
    exit;
}

if (!isPlausibleHardwareModel($model)) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'That does not look like a valid RAM model. Use a format such as "16GB DDR4-3200".',
    ]);
    exit;
}

if (!isValidBenchmarkScore($rawScore)) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Enter a valid benchmark score as a positive number.',
    ]);
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

    // The management form may only submit a capacity/speed/score combination
    // already present in the benchmark catalogue. Matching entries are a no-op.
    $check = $database->prepare('SELECT ram_id, speed_mhz, score FROM ram_benchmarks WHERE capacity_gb = :capacity');
    $check->execute(['capacity' => $capacityGb]);
    $catalogueRams = $check->fetchAll();
    if ($speedMhz > 0) {
        $catalogueRams = array_values(array_filter(
            $catalogueRams,
            static fn (array $row): bool => (int) $row['speed_mhz'] === $speedMhz
        ));
    }
    if (!$catalogueRams) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'RAM capacity and speed were not found in the benchmark catalogue.']);
        exit;
    }
    $matchingScore = array_filter($catalogueRams, static fn (array $row): bool => (float) $rawScore === (float) $row['score']);
    if (!$matchingScore) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'RAM benchmark score does not match the catalogue record.']);
        exit;
    }

    echo json_encode(['success' => true, 'message' => 'RAM capacity, speed, and score match the benchmark catalogue. No changes were needed.']);
} catch (Throwable $error) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Unable to save RAM benchmark.']);
}
