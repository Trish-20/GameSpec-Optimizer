<?php
header('Content-Type: application/json');

$csvFile = __DIR__ . '/../../DATA/CPU-benchmarks-v4.csv';
$cpus = [];

if (($handle = fopen($csvFile, 'r')) !== FALSE) {
    $header = fgetcsv($handle);
    
    while (($row = fgetcsv($handle)) !== FALSE) {
        if (!empty($row[0])) {
            $category = isset($row[11]) ? strtolower(trim($row[11])) : '';
            if ($category !== 'desktop') {
                continue;
            }

            $cpus[] = [
                'model' => $row[0],
                'score' => (int)$row[2],
                'cores' => isset($row[8]) ? (int)$row[8] : 0,
                'threads' => null
            ];
        }
    }
    fclose($handle);
}

// Sort by score descending
usort($cpus, function($a, $b) {
    return $b['score'] - $a['score'];
});

echo json_encode($cpus);
?>
