<?php

declare(strict_types=1);

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../benchmark-resolver.php';

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
    echo json_encode(['success' => false, 'message' => 'GPU model and a positive benchmark score are required.']);
    exit;
}

try {
    $database = databaseConnection();
    $normalizedModel = normalizeBenchmarkName($model);

    // Check for duplicate by normalized model name
    $check = $database->prepare('SELECT gpu_id FROM gpu_benchmarks WHERE normalized_model = :normalized LIMIT 1');
    $check->execute(['normalized' => $normalizedModel]);
    if ($check->fetch()) {
        http_response_code(409);
        echo json_encode(['success' => false, 'message' => 'A GPU with that model name already exists.']);
        exit;
    }

    $insert = $database->prepare(
        'INSERT INTO gpu_benchmarks (model, normalized_model, score, category, source_version)
         VALUES (:model, :normalized_model, :score, :category, :source_version)'
    );
    $insert->execute([
        'model' => $model,
        'normalized_model' => $normalizedModel,
        'score' => $score,
        'category' => 'Desktop',
        'source_version' => 'admin',
    ]);

    echo json_encode(['success' => true, 'message' => 'GPU added successfully.']);
} catch (Throwable $error) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Unable to save GPU benchmark.']);
}
