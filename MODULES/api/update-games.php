<?php

declare(strict_types=1);

require_once __DIR__ . '/../db.php';

header('Content-Type: application/json; charset=utf-8');

$input = json_decode(file_get_contents('php://input'), true);
$title = trim((string) ($input['title'] ?? ''));
$cpuModel = trim((string) ($input['cpuModel'] ?? ''));
$gpuModel = trim((string) ($input['gpuModel'] ?? ''));
$ramCapacityGb = (int) ($input['ramCapacityGb'] ?? 0);
$ramSpeedMhz = (int) ($input['ramSpeedMhz'] ?? 0);

if ($title === '' || $cpuModel === '' || $gpuModel === '' || $ramCapacityGb <= 0 || $ramSpeedMhz <= 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Title, CPU, GPU, RAM capacity, and RAM speed are required.']);
    exit;
}

try {
    $database = databaseConnection();
    $gameStatement = $database->prepare('SELECT game_id FROM games WHERE title = :title LIMIT 1');
    $gameStatement->execute(['title' => $title]);
    $game = $gameStatement->fetch();

    if (!$game) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Only games already imported from RAWG can be edited.']);
        exit;
    }

    $requirement = $database->prepare(
        'INSERT INTO game_requirements
            (game_id, requirement_type, cpu_text, gpu_text, ram_text, ram_capacity_gb, ram_speed_mhz, source, synced_at)
         VALUES (:game_id, "minimum", :cpu_text, :gpu_text, :ram_text, :ram_capacity_gb, :ram_speed_mhz, "admin", NOW())
         ON DUPLICATE KEY UPDATE cpu_text = VALUES(cpu_text), gpu_text = VALUES(gpu_text), ram_text = VALUES(ram_text), ram_capacity_gb = VALUES(ram_capacity_gb), ram_speed_mhz = VALUES(ram_speed_mhz), source = "admin", synced_at = NOW()'
    );
    $requirement->execute([
        'game_id' => $game['game_id'],
        'cpu_text' => $cpuModel,
        'gpu_text' => $gpuModel,
        'ram_text' => $ramCapacityGb . ' GB RAM',
        'ram_capacity_gb' => $ramCapacityGb,
        'ram_speed_mhz' => $ramSpeedMhz,
    ]);

    $database->prepare(
        'INSERT INTO sync_jobs (game_id, job_type, status, run_after)
         VALUES (:game_id, "benchmark_resolution", "queued", NOW())'
    )->execute(['game_id' => $game['game_id']]);

    echo json_encode(['success' => true, 'message' => 'Game requirements updated. Benchmark resolution queued.']);
} catch (Throwable $error) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Unable to update game requirements.']);
}
