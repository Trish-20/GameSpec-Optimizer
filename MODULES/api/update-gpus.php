<?php

declare(strict_types=1);

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/admin-auth.php';
require_once __DIR__ . '/../benchmark-resolver.php';

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
    echo json_encode(['success' => false, 'message' => 'GPU model is required.']);
    exit;
}

if (!isPlausibleHardwareModel($model)) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'That does not look like a valid GPU model. Use a real model name such as "NVIDIA GeForce RTX 4080".',
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

    // The management form may only submit a model/score pair already present
    // in the benchmark catalogue. It is a no-op when the pair is already valid.
    $check = $database->prepare('SELECT gpu_id, score FROM gpu_benchmarks WHERE normalized_model = :normalized');
    $check->execute(['normalized' => $normalizedModel]);
    $catalogueGpus = $check->fetchAll();
    if (!$catalogueGpus) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'GPU model was not found in the benchmark catalogue.']);
        exit;
    }
    $matchingScore = array_filter($catalogueGpus, static fn (array $row): bool => (float) $rawScore === (float) $row['score']);
    if (!$matchingScore) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'GPU benchmark score does not match the catalogue record.']);
        exit;
    }

    echo json_encode(['success' => true, 'message' => 'GPU model and score match the benchmark catalogue. No changes were needed.']);
} catch (Throwable $error) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Unable to save GPU benchmark.']);
}
