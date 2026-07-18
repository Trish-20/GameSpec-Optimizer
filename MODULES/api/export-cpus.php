<?php
header('Content-Type: text/csv');
header('Content-Disposition: attachment; filename="cpu-benchmarks-report.csv"');

$csvFile = __DIR__ . '/../../DATA/CPU-benchmarks-v4.csv';

if (!file_exists($csvFile)) {
    die('File not found');
}

readfile($csvFile);
?>
