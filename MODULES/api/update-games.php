<?php

$input = json_decode(file_get_contents('php://input'), true);

if (!$input) {
    die(json_encode(['success' => false, 'message' => 'Invalid JSON data']));
}
if (empty($input['title'])) {
    die(json_encode(['success' => false, 'message' => 'Game title is required']));
}

// flat strs
$title = str_replace(' ', '_', trim($input['title']));
$cpuModel = isset($input['cpuModel']) ? trim($input['cpuModel']) : '';
$cpuBenchmark = isset($input['cpuBenchmark']) ? intval($input['cpuBenchmark']) : 0;
$gpuModel = isset($input['gpuModel']) ? trim($input['gpuModel']) : '';
$gpuBenchmark = isset($input['gpuBenchmark']) ? intval($input['gpuBenchmark']) : 0;
$ramModel = isset($input['ramModel']) ? trim($input['ramModel']) : '';
$ramBenchmark = isset($input['ramBenchmark']) ? intval($input['ramBenchmark']) : 0;

// toggleables
$hasBloom = isset($input['hasBloom']) && $input['hasBloom'] ? 1 : 0;
$hasAntiAlias = isset($input['hasAntiAlias']) && $input['hasAntiAlias'] ? 1 : 0;
$hasShadows = isset($input['hasShadows']) && $input['hasShadows'] ? 1 : 0;
$hasVSync = isset($input['hasVSync']) && $input['hasVSync'] ? 1 : 0;
$imageFileName = '';

$csvFile = __DIR__ . '/../../DATA/game-requirements.csv';

if (!file_exists($csvFile)) {
    die(json_encode(['success' => false, 'message' => 'CSV file not found']));
}

if (($handle = fopen($csvFile, 'r')) !== false) {
    fgetcsv($handle); // Skip header
    while (($row = fgetcsv($handle)) !== false) {
        if (strtolower($row[0]) === strtolower($title)) {
            fclose($handle);
            die(json_encode(['success' => false, 'message' => 'Game already exists']));
        }
    }
    fclose($handle);
}

if (!empty($input['imageData'])) {
    if (!preg_match('/^data:image\/(jpeg|png|webp|gif|avif);base64,(.+)$/', $input['imageData'], $matches)) {
        die(json_encode(['success' => false, 'message' => 'Unsupported or invalid cover image.']));
    }

    $imageType = strtolower($matches[1]);
    $imageData = base64_decode($matches[2], true);
    if ($imageData === false || strlen($imageData) > 5 * 1024 * 1024) {
        die(json_encode(['success' => false, 'message' => 'Cover image must be smaller than 5 MB.']));
    }

    $imageDirectory = __DIR__ . '/../../FRONT-END/RES';
    if (!is_dir($imageDirectory) || !is_writable($imageDirectory)) {
        die(json_encode(['success' => false, 'message' => 'Cover image directory is not writable.']));
    }

    $extension = $imageType === 'jpeg' ? 'jpg' : $imageType;
    $safeTitle = preg_replace('/[^a-z0-9]+/i', '_', $title);
    $imageFileName = strtolower(trim($safeTitle, '_')) . '_' . uniqid() . '.' . $extension;
    if (file_put_contents($imageDirectory . '/' . $imageFileName, $imageData) === false) {
        die(json_encode(['success' => false, 'message' => 'Could not save cover image.']));
    }
}

// CSV columns: game_title,game_cpu_model,game_cpu_benchmark,game_gpu_model,game_gpu_benchmark,game_ram_model,game_ram_benchmark,hasBloom,hasAnti-Alias,hasShadows,hasVSync,game_image,game_description
$newRow = [
    $title,
    $cpuModel,
    $cpuBenchmark,
    $gpuModel,
    $gpuBenchmark,
    $ramModel,
    $ramBenchmark,
    $hasBloom,
    $hasAntiAlias,
    $hasShadows,
    $hasVSync,
    $imageFileName,
    ''
];

if (($handle = fopen($csvFile, 'a')) !== false) {
    fputcsv($handle, $newRow);
    fclose($handle);
    die(json_encode(['success' => true, 'message' => 'Game added successfully']));
} else {
    die(json_encode(['success' => false, 'message' => 'Could not write to CSV file']));
}
?>
