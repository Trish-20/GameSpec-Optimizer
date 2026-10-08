<?php

declare(strict_types=1);

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../benchmark-resolver.php';
require_once __DIR__ . '/admin-auth.php';

header('Content-Type: application/json; charset=utf-8');

function gpuResponse(int $status, array $body): never
{
    http_response_code($status);
    echo json_encode($body);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$modelValue = is_array($input) ? ($input['model'] ?? null) : null;
$model = is_string($modelValue) ? trim($modelValue) : '';
$rawScore = is_array($input) ? ($input['score'] ?? null) : null;

if (!is_array($input)) gpuResponse(400, ['success' => false, 'message' => 'Invalid JSON data.']);
if ($model === '' || !isPlausibleHardwareModel($model)) gpuResponse(400, ['success' => false, 'message' => 'Enter a valid GPU model.']);
if ((!is_string($rawScore) && !is_int($rawScore)) || !preg_match('/^[1-9][0-9]{0,6}$/', (string) $rawScore) || !isValidBenchmarkScore($rawScore)) {
    gpuResponse(400, ['success' => false, 'message' => 'Enter a whole-number benchmark score between 1 and 1,000,000.']);
}

try {
    $database = databaseConnection();
    $normalized = normalizeBenchmarkName($model);
    if ($normalized === '') gpuResponse(400, ['success' => false, 'message' => 'GPU model could not be normalized.']);

    $database->beginTransaction();
    $find = $database->prepare('SELECT gpu_id, model, score FROM gpu_benchmarks WHERE normalized_model = :normalized FOR UPDATE');
    $find->execute(['normalized' => $normalized]);
    $rows = $find->fetchAll(PDO::FETCH_ASSOC);

    $exactRows = array_values(array_filter($rows, static fn (array $row): bool => $row['model'] === $model));
    if ($exactRows) {
        $rows = $exactRows;
    } elseif (count($rows) > 1) {
        $database->rollBack();
        gpuResponse(409, ['success' => false, 'message' => 'Multiple GPU records share this normalized model. Resolve the catalogue ambiguity before updating it.']);
    }

    if ($rows) {
        $row = $rows[0];
        if ((int) $row['score'] === (int) $rawScore) {
            $database->commit();
            gpuResponse(200, ['success' => true, 'message' => 'No changes were needed. This GPU and benchmark score already exist.']);
        }
        $update = $database->prepare('UPDATE gpu_benchmarks SET score = :score WHERE gpu_id = :id');
        $update->execute(['score' => (int) $rawScore, 'id' => (int) $row['gpu_id']]);
        $database->commit();
        gpuResponse(200, ['success' => true, 'message' => 'GPU benchmark score updated successfully.']);
    }

    $insert = $database->prepare('INSERT INTO gpu_benchmarks (model, normalized_model, score, category, source_version) VALUES (:model, :normalized, :score, :category, :source)');
    $insert->execute(['model' => $model, 'normalized' => $normalized, 'score' => (int) $rawScore, 'category' => 'Desktop', 'source' => 'admin']);
    $database->commit();
    gpuResponse(201, ['success' => true, 'message' => 'GPU added successfully.']);
} catch (Throwable $error) {
    if (isset($database) && $database->inTransaction()) $database->rollBack();
    error_log('GPU benchmark could not be saved: ' . $error->getMessage());
    if ($error instanceof PDOException && $error->getCode() === '23000') {
        gpuResponse(409, ['success' => false, 'message' => 'A GPU with this model or normalized identity already exists. Refresh the catalogue and review it before retrying.']);
    }
    gpuResponse(500, ['success' => false, 'message' => 'Unable to save GPU benchmark. The model may already exist under another spelling.']);
}
