<?php
declare(strict_types=1);
require_once __DIR__ . "/../db.php";
header("Content-Type: text/csv; charset=utf-8");
header("Content-Disposition: attachment; filename=\"game-requirements-report.csv\"");
try {
    $pdo = databaseConnection();
    $stmt = $pdo->query("SELECT g.title, g.steam_app_id, g.is_active, r.cpu_text, r.gpu_text, r.ram_text FROM games g LEFT JOIN game_requirements r ON r.game_id = g.game_id AND r.requirement_type = 'minimum'");
    $fp = fopen("php://output", "w");
    fputcsv($fp, ["Title", "Steam App ID", "Is Active", "CPU Requirement", "GPU Requirement", "RAM Requirement"]);
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        fputcsv($fp, $row);
    }
    fclose($fp);
} catch (Throwable $e) {
    http_response_code(500);
    echo "Error generating CSV";
}

