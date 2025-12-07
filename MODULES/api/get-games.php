<?php
$csvFile = __DIR__ . '/../../DATA/game-requirements.csv';
$games = [];

if (($handle = fopen($csvFile, 'r')) !== FALSE) {
    $header = fgetcsv($handle); // skip header
    
    while (($row = fgetcsv($handle)) !== FALSE) {
        $games[] = [
            'title' => str_replace('_', ' ', $row[0]), // processed for display
            'title_raw' => $row[0], // raaaaaaaaaaaaaaaaaw
            'cpu_model' => $row[1],
            'cpu_benchmark' => (int)$row[2],
            'gpu_model' => $row[3],
            'gpu_benchmark' => (int)$row[4],
            'ram_model' => $row[5],
            'ram_benchmark' => (int)$row[6],
            'hasBloom' => (int)$row[7],
            'hasAntiAlias' => (int)$row[8],
            'hasShadows' => (int)$row[9],
            'hasVSync' => (int)$row[10]
        ];
    }
    fclose($handle);
}

echo json_encode($games);
?>
