<?php

$input = json_decode(file_get_contents('php://input'), true);

if (!$input) {
    die(json_encode(['success' => false, 'message' => 'Invalid JSON data']));
}
if (empty($input['model']) || !isset($input['score'])) {
    die(json_encode(['success' => false, 'message' => 'Model and score are required']));
}

$model = trim($input['model']);
$score = intval($input['score']);

$csvFile = __DIR__ . '/../../DATA/GPU-benchmarks-v7.csv';

if (!file_exists($csvFile)) {
    die(json_encode(['success' => false, 'message' => 'CSV file not found']));
}

// Check for duplicate GPU model
if (($handle = fopen($csvFile, 'r')) !== false) {
    fgetcsv($handle); // Skip header
    while (($row = fgetcsv($handle)) !== false) {
        if (strtolower($row[0]) === strtolower($model)) {
            fclose($handle);
            die(json_encode(['success' => false, 'message' => 'GPU model already exists']));
        }
    }
    fclose($handle);
}

// CSV columns: gpuName,G3Dmark,G2Dmark,price,gpuValue,TDP,powerPerformance,testDate,category - ignore others 
$newRow = [$model, $score, 0, 0, 0, 0, 0, date('Y'), 'Desktop'];

if (($handle = fopen($csvFile, 'a')) !== false) {
    fputcsv($handle, $newRow);
    fclose($handle);
    die(json_encode(['success' => true, 'message' => 'GPU added successfully']));
} else {
    die(json_encode(['success' => false, 'message' => 'Could not write to CSV file']));
}
?>
