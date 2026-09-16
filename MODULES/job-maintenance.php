<?php
declare(strict_types=1);
require_once __DIR__ . "/db.php";

function maintainSyncJobs(PDO $database): array {
    $results = ["recovered" => 0, "retried" => 0];

    // Recover stuck running jobs (older than 2 hours)
    $recover = $database->prepare(
        "UPDATE sync_jobs 
         SET status = 'queued' 
         WHERE status = 'running' AND updated_at < DATE_SUB(NOW(), INTERVAL 2 HOUR)"
    );
    $recover->execute();
    $results["recovered"] = $recover->rowCount();

    // Retry failed jobs with exponential backoff (e.g., attempt^2 * 1 hour)
    // Run after is already updated when job is processed, wait, no, it fails and stays failed.
    // We should set it to queued and update run_after based on attempts.
    // If attempts > 5, leave as failed.
    $retry = $database->prepare(
        "UPDATE sync_jobs 
         SET status = 'queued', 
             run_after = DATE_ADD(NOW(), INTERVAL POW(attempts, 2) HOUR) 
         WHERE status = 'failed' AND attempts <= 5"
    );
    $retry->execute();
    $results["retried"] = $retry->rowCount();

    return $results;
}

if (PHP_SAPI === "cli") {
    echo json_encode(maintainSyncJobs(databaseConnection())) . PHP_EOL;
}
