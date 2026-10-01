<?php

require_once __DIR__ . '/MODULES/db.php';

header('Content-Type: text/plain');

try {
    $pdo = databaseConnection();

    echo "DATABASE CONNECTION: SUCCESS\n";

    echo "DATABASE: ";
    echo $pdo->query("SELECT DATABASE()")->fetchColumn();
    echo "\n";

    echo "GAMES: ";
    echo $pdo->query("SELECT COUNT(*) FROM games")->fetchColumn();
    echo "\n";

    echo "CPUS: ";
    echo $pdo->query("SELECT COUNT(*) FROM cpu_benchmarks")->fetchColumn();
    echo "\n";

    echo "GPUS: ";
    echo $pdo->query("SELECT COUNT(*) FROM gpu_benchmarks")->fetchColumn();
    echo "\n";

    echo "RAM: ";
    echo $pdo->query("SELECT COUNT(*) FROM ram_benchmarks")->fetchColumn();
    echo "\n";

} catch (Throwable $e) {

    echo "DATABASE CONNECTION: FAILED\n";
    echo "ERROR: " . $e->getMessage() . "\n";
    echo "FILE: " . $e->getFile() . "\n";
    echo "LINE: " . $e->getLine() . "\n";
}