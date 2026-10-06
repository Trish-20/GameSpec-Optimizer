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
    echo json_encode(['success' => false, 'message' => 'CPU model is required.']);
    exit;
}

if (!isPlausibleHardwareModel($model)) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'That does not look like a valid CPU model. Use a real model name such as "Intel Core i7-12700K".',
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

try {
    $database = databaseConnection();
    $normalizedModel = normalizeBenchmarkName($model);

    // Only accept a CPU model and score pair that already exists in the
    // benchmark catalogue. Existing entries are treated as idempotent saves.
    $catalogueCheck = $database->prepare(
        'SELECT score FROM cpu_benchmarks WHERE normalized_model = :normalized LIMIT 1'
    );
    $catalogueCheck->execute(['normalized' => $normalizedModel]);
    $catalogueCpu = $catalogueCheck->fetch();
    if (!$catalogueCpu) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'CPU model was not found in the benchmark catalogue.']);
        exit;
    }
    if ((float) $rawScore !== (float) $catalogueCpu['score']) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'CPU benchmark score does not match the catalogue record.']);
        exit;
    }

    echo json_encode(['success' => true, 'message' => 'CPU model and score match the benchmark catalogue. No changes were needed.']);
} catch (Throwable $error) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Unable to save CPU benchmark.']);
}
