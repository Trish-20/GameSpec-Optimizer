<?php

$input = json_decode(file_get_contents('php://input'), true);

// validation
if (!$input) {
    die(json_encode(['success' => false, 'message' => 'Invalid JSON data']));
}
if (empty($input['model']) || !isset($input['score'])) {
    die(json_encode(['success' => false, 'message' => 'Model and score are required']));
}

// process
$model = trim($input['model']);
$score = intval($input['score']);

$csvFile = __DIR__ . '/../../DATA/CPU-benchmarks.csv';
// simple validation baka maligaw yung file
if (!file_exists($csvFile)) {
    die(json_encode(['success' => false, 'message' => 'CSV file not found']));
}

// dupe checker
if (($handle = fopen($csvFile, 'r')) !== false) {
    fgetcsv($handle); // Skip header
    while (($row = fgetcsv($handle)) !== false) {
        if (strtolower($row[0]) === strtolower($model)) {
            fclose($handle);
            die(json_encode(['success' => false, 'message' => 'CPU model already exists']));
        }
    }
    fclose($handle);
}

// app new data
$newRow = [$model, $score, 0, 0];

if (($handle = fopen($csvFile, 'a')) !== false) {
    fputcsv($handle, $newRow);
    fclose($handle);
    die(json_encode(['success' => true, 'message' => 'CPU added successfully']));
} else {
    die(json_encode(['success' => false, 'message' => 'Could not write to CSV file']));
}
?>
