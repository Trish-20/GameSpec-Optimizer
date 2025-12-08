<?php
header('Content-Type: text/csv');
header('Content-Disposition: attachment; filename="gpu-benchmarks-report.csv"');

$csvFile = __DIR__ . '/../../DATA/GPU-benchmarks-v7.csv';

if (!file_exists($csvFile)) {
    die('File not found');
}

readfile($csvFile);
?>
