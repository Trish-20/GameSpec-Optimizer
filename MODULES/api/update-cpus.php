<?php

declare(strict_types=1);

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../benchmark-resolver.php';
require_once __DIR__ . '/admin-auth.php';

header('Content-Type: application/json; charset=utf-8');

function cpuResponse(int $status, array $body): never
{
    http_response_code($status);
    echo json_encode($body);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$modelValue = is_array($input) ? ($input['model'] ?? null) : null;
$model = is_string($modelValue) ? trim($modelValue) : '';
$rawScore = is_array($input) ? ($input['score'] ?? null) : null;

if (!is_array($input)) cpuResponse(400, ['success' => false, 'message' => 'Invalid JSON data.']);
if ($model === '' || !isPlausibleHardwareModel($model)) cpuResponse(400, ['success' => false, 'message' => 'Enter a valid CPU model.']);
if ((!is_string($rawScore) && !is_int($rawScore)) || !preg_match('/^[1-9][0-9]{0,6}$/', (string) $rawScore) || !isValidBenchmarkScore($rawScore)) {
    cpuResponse(400, ['success' => false, 'message' => 'Enter a whole-number benchmark score between 1 and 1,000,000.']);
}

try {
    $database = databaseConnection();
    $normalized = normalizeBenchmarkName($model);
    if ($normalized === '') cpuResponse(400, ['success' => false, 'message' => 'CPU model could not be normalized.']);

    $database->beginTransaction();
    $find = $database->prepare('SELECT cpu_id, model, score FROM cpu_benchmarks WHERE normalized_model = :normalized FOR UPDATE');
    $find->execute(['normalized' => $normalized]);
    $rows = $find->fetchAll(PDO::FETCH_ASSOC);

    $exactRows = array_values(array_filter($rows, static fn (array $row): bool => $row['model'] === $model));
    if ($exactRows) {
        $rows = $exactRows;
    } elseif (count($rows) > 1) {
        $database->rollBack();
        cpuResponse(409, ['success' => false, 'message' => 'Multiple CPU records share this normalized model. Resolve the catalogue ambiguity before updating it.']);
    }

    if ($rows) {
        $row = $rows[0];
        if ((int) $row['score'] === (int) $rawScore) {
            $database->commit();
            cpuResponse(200, ['success' => true, 'message' => 'No changes were needed. This CPU and benchmark score already exist.']);
        }
        $update = $database->prepare('UPDATE cpu_benchmarks SET score = :score WHERE cpu_id = :id');
        $update->execute(['score' => (int) $rawScore, 'id' => (int) $row['cpu_id']]);
        $database->commit();
        cpuResponse(200, ['success' => true, 'message' => 'CPU benchmark score updated successfully.']);
    }

    $insert = $database->prepare('INSERT INTO cpu_benchmarks (model, normalized_model, score, category, source_version) VALUES (:model, :normalized, :score, :category, :source)');
    $insert->execute(['model' => $model, 'normalized' => $normalized, 'score' => (int) $rawScore, 'category' => 'Desktop', 'source' => 'admin']);
    $database->commit();
    cpuResponse(201, ['success' => true, 'message' => 'CPU added successfully.']);
} catch (Throwable $error) {
    if (isset($database) && $database->inTransaction()) $database->rollBack();
    error_log('CPU benchmark could not be saved: ' . $error->getMessage());
    if ($error instanceof PDOException && $error->getCode() === '23000') {
        cpuResponse(409, ['success' => false, 'message' => 'A CPU with this model or normalized identity already exists. Refresh the catalogue and review it before retrying.']);
    }
    cpuResponse(500, ['success' => false, 'message' => 'Unable to save CPU benchmark. The model may already exist under another spelling.']);
}
