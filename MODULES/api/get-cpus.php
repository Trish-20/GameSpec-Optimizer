<?php
header('Content-Type: application/json');

$csvFile = __DIR__ . '/../../DATA/CPU-benchmarks.csv';
$cpus = [];

if (($handle = fopen($csvFile, 'r')) !== FALSE) {
    $header = fgetcsv($handle);
    
    while (($row = fgetcsv($handle)) !== FALSE) {
        if (!empty($row[0])) {
            $cpus[] = [
                'model' => $row[0],
                'score' => (int)$row[1],
                'cores' => (int)$row[2],
                'threads' => (int)$row[3]
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
