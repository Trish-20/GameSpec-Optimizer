<?php
header('Content-Type: application/json');

$csvFile = __DIR__ . '/../../DATA/RAM-benchmarks.csv';
$ram = [];

// ram_capacity_gb,ram_speed_mhz,ram_score
if (($handle = fopen($csvFile, 'r')) !== FALSE) {
    $header = fgetcsv($handle);
    
    while (($row = fgetcsv($handle)) !== FALSE) {
        if (!empty($row[0])) {
            $ram[] = [
                'capacity' => (int)$row[0],
                'speed' => (int)$row[1],
                'score' => (int)$row[2]
            ];
        }
    }
    fclose($handle);
}

// Sort by score descending
usort($ram, function($a, $b) {
    return $b['score'] - $a['score'];
});

echo json_encode($ram);
?>
