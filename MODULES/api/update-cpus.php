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

$score = (int) $rawScore;

try {
    $database = databaseConnection();
    $normalizedModel = normalizeBenchmarkName($model);

    // Check for duplicate by normalized model name
    $check = $database->prepare('SELECT cpu_id FROM cpu_benchmarks WHERE normalized_model = :normalized LIMIT 1');
    $check->execute(['normalized' => $normalizedModel]);
    if ($check->fetch()) {
        http_response_code(409);
        echo json_encode(['success' => false, 'message' => 'A CPU with that model name already exists.']);
        exit;
    }

    $insert = $database->prepare(
        'INSERT INTO cpu_benchmarks (model, normalized_model, score, category, source_version)
         VALUES (:model, :normalized_model, :score, :category, :source_version)'
    );
    $insert->execute([
        'model' => $model,
        'normalized_model' => $normalizedModel,
        'score' => $score,
        'category' => 'Desktop',
        'source_version' => 'admin',
    ]);

    echo json_encode(['success' => true, 'message' => 'CPU added successfully.']);
} catch (Throwable $error) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Unable to save CPU benchmark.']);
}
