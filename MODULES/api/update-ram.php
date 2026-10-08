<?php

declare(strict_types=1);

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../benchmark-resolver.php';
require_once __DIR__ . '/admin-auth.php';

header('Content-Type: application/json; charset=utf-8');

function ramResponse(int $status, array $body): never
{
    http_response_code($status);
    echo json_encode($body);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$modelValue = is_array($input) ? ($input['model'] ?? null) : null;
$model = is_string($modelValue) ? trim($modelValue) : '';
$rawScore = is_array($input) ? ($input['score'] ?? null) : null;

if (!is_array($input)) ramResponse(400, ['success' => false, 'message' => 'Invalid JSON data.']);
if ($model === '' || !isPlausibleHardwareModel($model)) ramResponse(400, ['success' => false, 'message' => 'Enter a valid RAM model.']);
if ((!is_string($rawScore) && !is_int($rawScore)) || !preg_match('/^[1-9][0-9]{0,6}$/', (string) $rawScore) || !isValidBenchmarkScore($rawScore)) {
    ramResponse(400, ['success' => false, 'message' => 'Enter a whole-number benchmark score between 1 and 1,000,000.']);
}

$capacityGb = 0;
$speedMhz = 0;
if (preg_match('/(\d+)\s*GB/i', $model, $capacityMatch)) $capacityGb = (int) $capacityMatch[1];
if (preg_match('/DDR\d?[\s\-]*(\d{3,5})/i', $model, $speedMatch)) $speedMhz = (int) $speedMatch[1];
if ($speedMhz === 0 && preg_match('/(\d{3,5})\s*MHz/i', $model, $speedMatch)) $speedMhz = (int) $speedMatch[1];

if ($capacityGb < 1 || $capacityGb > 65535) ramResponse(400, ['success' => false, 'message' => 'Enter a RAM capacity from 1 to 65,535 GB.']);
if ($speedMhz < 1 || $speedMhz > 65535) ramResponse(400, ['success' => false, 'message' => 'Include a valid RAM speed, for example "32GB DDR5-6000".']);

try {
    $database = databaseConnection();
    $database->beginTransaction();
    $find = $database->prepare('SELECT ram_id, score FROM ram_benchmarks WHERE capacity_gb = :capacity AND speed_mhz = :speed FOR UPDATE');
    $find->execute(['capacity' => $capacityGb, 'speed' => $speedMhz]);
    $row = $find->fetch(PDO::FETCH_ASSOC);

    if ($row) {
        if ((int) $row['score'] === (int) $rawScore) {
            $database->commit();
            ramResponse(200, ['success' => true, 'message' => 'No changes were needed. This RAM configuration and benchmark score already exist.']);
        }
        $update = $database->prepare('UPDATE ram_benchmarks SET score = :score WHERE ram_id = :id');
        $update->execute(['score' => (int) $rawScore, 'id' => (int) $row['ram_id']]);
        $database->commit();
        ramResponse(200, ['success' => true, 'message' => 'RAM benchmark score updated successfully.']);
    }

    $insert = $database->prepare('INSERT INTO ram_benchmarks (capacity_gb, speed_mhz, score, source_version) VALUES (:capacity, :speed, :score, :source)');
    $insert->execute(['capacity' => $capacityGb, 'speed' => $speedMhz, 'score' => (int) $rawScore, 'source' => 'admin']);
    $database->commit();
    ramResponse(201, ['success' => true, 'message' => 'RAM benchmark added successfully.']);
} catch (Throwable $error) {
    if (isset($database) && $database->inTransaction()) $database->rollBack();
    error_log('RAM benchmark could not be saved: ' . $error->getMessage());
    if ($error instanceof PDOException && $error->getCode() === '23000') {
        ramResponse(409, ['success' => false, 'message' => 'A RAM record with this capacity and speed already exists. Refresh the catalogue and retry.']);
    }
    ramResponse(500, ['success' => false, 'message' => 'Unable to save RAM benchmark. This capacity and speed may already exist.']);
}
