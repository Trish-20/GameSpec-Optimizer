<?php
header('Content-Type: text/csv');
header('Content-Disposition: attachment; filename="game-requirements-report.csv"');

$csvFile = __DIR__ . '/../../DATA/game-requirements.csv';

if (!file_exists($csvFile)) {
    die('File not found');
}

readfile($csvFile);
?>
