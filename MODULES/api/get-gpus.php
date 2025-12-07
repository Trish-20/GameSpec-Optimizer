<?php
header('Content-Type: application/json');

$csvFile = __DIR__ . '/../../DATA/GPU-benchmarks-v7.csv';
$gpus = [];

if (($handle = fopen($csvFile, 'r')) !== FALSE) {
    $header = fgetcsv($handle);
    
    while (($row = fgetcsv($handle)) !== FALSE) {
        if (!empty($row[0]) && !empty($row[1])) {
            
            $category = isset($row[8]) ? strtolower($row[8]) : '';
            if (strpos($category, 'workstation') !== false || 
                strpos($row[0], 'Quadro') !== false || 
                strpos($row[0], 'Tesla') !== false ||
                strpos($row[0], 'TITAN') !== false ||
                strpos($row[0], 'RTX A') !== false) {
                continue;
            }
            
            $gpus[] = [
                'model' => $row[0],
                'score' => (int)$row[1],
                'tdp' => isset($row[5]) ? (int)$row[5] : 0
            ];
        }
    }
    fclose($handle);
}

// Sort by score descending
usort($gpus, function($a, $b) {
    return $b['score'] - $a['score'];
});

// Limit to top 100 most common gaming GPUs
$gpus = array_slice($gpus, 0, 100);

echo json_encode($gpus);
?>
