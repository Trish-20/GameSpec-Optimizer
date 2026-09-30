<?php
declare(strict_types=1);
require_once __DIR__ . "/../db.php";
require_once __DIR__ . "/admin-auth.php";
header("Content-Type: text/csv; charset=utf-8");
header("Content-Disposition: attachment; filename=\"cpu-benchmarks-report.csv\"");
try {
    $pdo = databaseConnection();
    $stmt = $pdo->query("SELECT model, score, cores, category FROM cpu_benchmarks ORDER BY score DESC");
    $fp = fopen("php://output", "w");
    fputcsv($fp, ["Model", "Score", "Cores", "Category"]);
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        fputcsv($fp, $row);
    }
    fclose($fp);
} catch (Throwable $e) {
    http_response_code(500);
    echo "Error generating CSV";
}
