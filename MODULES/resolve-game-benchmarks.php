<?php

declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/benchmark-resolver.php';

function resolveDatabaseModel(PDO $database, string $table, string $requiredText): array
{
    $parts = preg_split('/\b(?:or|and)\b|[,\|\/]/i', $requiredText);
    $bestMatch = null;

    $modelMarkers = $table === 'gpu_benchmarks'
        ? ['gt', 'gtx', 'rtx', 'rx', 'arc', 'quadro', 'tesla', 'titan', 'radeon', 'geforce', 'intel', 'hd']
        : ['core', 'ryzen', 'threadripper', 'athlon', 'phenom', 'fx', 'xeon', 'pentium', 'celeron'];

    $rows = $database->query("SELECT model, normalized_model, score, source_version FROM {$table}")->fetchAll();

    foreach ($parts as $part) {
        $required = normalizeBenchmarkName($part);
        if ($required === '') {
            continue;
        }

        $hasModelMarker = false;
        foreach ($modelMarkers as $marker) {
            if (preg_match('/\b' . preg_quote($marker, '/') . '\b/', $required)) {
                $hasModelMarker = true;
                break;
            }
        }
        if (!$hasModelMarker) {
            continue;
        }

        $statement = $database->prepare("SELECT model, score, source_version FROM {$table} WHERE normalized_model = :normalized LIMIT 1");
        $statement->execute(['normalized' => $required]);
        $exact = $statement->fetch();
        if ($exact) {
            return ['matched_model' => $exact['model'], 'score' => (int) $exact['score'], 'match_status' => 'exact', 'source_version' => $exact['source_version']];
        }

        $requiredTokens = array_values(array_filter(explode(' ', $required), static fn (string $token): bool => strlen($token) > 1));
        $candidates = [];
        foreach ($rows as $row) {
            $candidateTokens = array_values(array_filter(explode(' ', (string) $row['normalized_model']), static fn (string $token): bool => strlen($token) > 1));
            
            $hits = 0;
            foreach ($candidateTokens as $cToken) {
                if (in_array($cToken, $requiredTokens, true)) {
                    $hits++;
                }
            }
            
            // Calculate coverage based on candidate tokens to allow matching specific models inside verbose strings
            $candidateCoverage = count($candidateTokens) > 0 ? $hits / count($candidateTokens) : 0;
            
            if ($candidateCoverage >= 0.99) { // Candidate is fully present in the string
                $candidates[] = ['row' => $row, 'coverage' => $candidateCoverage, 'hits' => $hits];
            }
        }

        if ($candidates !== []) {
            usort($candidates, static function (array $left, array $right): int {
                if ($left['hits'] === $right['hits']) {
                    return (int) $left['row']['score'] <=> (int) $right['row']['score'];
                }
                return $right['hits'] <=> $left['hits'];
            });

            $match = $candidates[0]['row'];
            $result = ['matched_model' => $match['model'], 'score' => (int) $match['score'], 'match_status' => 'nearest', 'source_version' => $match['source_version']];
            if ($bestMatch === null || $result['score'] < $bestMatch['score']) {
                $bestMatch = $result;
            }
        }
    }

    if ($bestMatch !== null) {
        return $bestMatch;
    }

    return ['matched_model' => null, 'score' => null, 'match_status' => 'unresolved', 'source_version' => null];
}

function resolveDatabaseRam(PDO $database, ?int $capacityGb, ?int $speedMhz): array
{
    if (!$capacityGb) {
        return ['matched_capacity_gb' => null, 'matched_speed_mhz' => null, 'score' => null, 'match_status' => 'unresolved', 'source_version' => null];
    }

    $statement = $database->prepare('SELECT capacity_gb, speed_mhz, score, source_version FROM ram_benchmarks WHERE capacity_gb = :capacity AND speed_mhz = :speed LIMIT 1');
    $statement->execute(['capacity' => $capacityGb, 'speed' => $speedMhz ?? 0]);
    $exact = $statement->fetch();
    if ($exact) {
        return ['matched_capacity_gb' => (int) $exact['capacity_gb'], 'matched_speed_mhz' => (int) $exact['speed_mhz'], 'score' => (int) $exact['score'], 'match_status' => 'exact', 'source_version' => $exact['source_version']];
    }

    $statement = $database->prepare('SELECT capacity_gb, speed_mhz, score, source_version FROM ram_benchmarks WHERE capacity_gb = :capacity ORDER BY ABS(CAST(speed_mhz AS SIGNED) - :speed) LIMIT 1');
    $statement->execute(['capacity' => $capacityGb, 'speed' => $speedMhz ?? 0]);
    $match = $statement->fetch();
    return $match
        ? ['matched_capacity_gb' => (int) $match['capacity_gb'], 'matched_speed_mhz' => (int) $match['speed_mhz'], 'score' => (int) $match['score'], 'match_status' => $speedMhz ? 'nearest' : 'estimated', 'source_version' => $match['source_version']]
        : ['matched_capacity_gb' => null, 'matched_speed_mhz' => null, 'score' => null, 'match_status' => 'unresolved', 'source_version' => null];
}

function resolveQueuedBenchmarks(PDO $database, int $limit = 25): array
{
    $jobs = $database->prepare(
        'SELECT j.job_id, j.game_id
         FROM sync_jobs j
         WHERE j.job_type = "benchmark_resolution" AND j.status = "queued"
         ORDER BY j.created_at ASC LIMIT :limit'
    );
    $jobs->bindValue(':limit', max(1, min(100, $limit)), PDO::PARAM_INT);
    $jobs->execute();
    $items = $jobs->fetchAll();

    $claim = $database->prepare('UPDATE sync_jobs SET status = "running", attempts = attempts + 1 WHERE job_id = :job_id AND status = "queued"');
    $requirements = $database->prepare('SELECT * FROM game_requirements WHERE game_id = :game_id');
    $upsert = $database->prepare(
        'INSERT INTO game_benchmark_matches
            (requirement_id, hardware_type, required_text, matched_model, matched_capacity_gb, matched_speed_mhz, benchmark_score, match_status, benchmark_source_version, resolved_at)
         VALUES (:requirement_id, :hardware_type, :required_text, :matched_model, :matched_capacity_gb, :matched_speed_mhz, :benchmark_score, :match_status, :source_version, NOW())
         ON DUPLICATE KEY UPDATE required_text = VALUES(required_text), matched_model = VALUES(matched_model), matched_capacity_gb = VALUES(matched_capacity_gb), matched_speed_mhz = VALUES(matched_speed_mhz), benchmark_score = VALUES(benchmark_score), match_status = VALUES(match_status), benchmark_source_version = VALUES(benchmark_source_version), resolved_at = NOW()'
    );
    $finish = $database->prepare('UPDATE sync_jobs SET status = "complete", last_error = NULL WHERE job_id = :job_id');
        $setEligibility = $database->prepare(
                'UPDATE games g
                 SET g.is_active = EXISTS (
                         SELECT 1
                         FROM game_requirements r
                         INNER JOIN game_benchmark_matches m ON m.requirement_id = r.requirement_id
                         WHERE r.game_id = g.game_id
                             AND r.requirement_type = "minimum"
                             AND m.hardware_type IN ("cpu", "gpu", "ram")
                             AND m.benchmark_score IS NOT NULL
                         GROUP BY r.requirement_id
                         HAVING COUNT(DISTINCT m.hardware_type) = 3
                 )
                 WHERE g.game_id = :game_id'
        );

    $complete = 0;
    foreach ($items as $item) {
        $claim->execute(['job_id' => $item['job_id']]);
        if ($claim->rowCount() !== 1) {
            continue;
        }

        try {
            $requirements->execute(['game_id' => $item['game_id']]);
            foreach ($requirements->fetchAll() as $requirement) {
                $models = [
                    ['type' => 'cpu', 'text' => $requirement['cpu_text']],
                    ['type' => 'gpu', 'text' => $requirement['gpu_text']],
                ];
                foreach ($models as $model) {
                    $match = resolveDatabaseModel($database, $model['type'] === 'cpu' ? 'cpu_benchmarks' : 'gpu_benchmarks', (string) $model['text']);
                    $upsert->execute([
                        'requirement_id' => $requirement['requirement_id'],
                        'hardware_type' => $model['type'],
                        'required_text' => $model['text'],
                        'matched_model' => $match['matched_model'],
                        'matched_capacity_gb' => null,
                        'matched_speed_mhz' => null,
                        'benchmark_score' => $match['score'],
                        'match_status' => $match['match_status'],
                        'source_version' => $match['source_version'],
                    ]);
                }

                $ram = resolveDatabaseRam($database, $requirement['ram_capacity_gb'] !== null ? (int) $requirement['ram_capacity_gb'] : null, $requirement['ram_speed_mhz'] !== null ? (int) $requirement['ram_speed_mhz'] : null);
                $upsert->execute([
                    'requirement_id' => $requirement['requirement_id'],
                    'hardware_type' => 'ram',
                    'required_text' => $requirement['ram_text'],
                    'matched_model' => null,
                    'matched_capacity_gb' => $ram['matched_capacity_gb'],
                    'matched_speed_mhz' => $ram['matched_speed_mhz'],
                    'benchmark_score' => $ram['score'],
                    'match_status' => $ram['match_status'],
                    'source_version' => $ram['source_version'],
                ]);
            }
            $setEligibility->execute(['game_id' => $item['game_id']]);
            $finish->execute(['job_id' => $item['job_id']]);
            $complete++;
        } catch (Throwable $error) {
            $database->prepare('UPDATE sync_jobs SET status = "failed", last_error = :error WHERE job_id = :job_id')->execute(['error' => $error->getMessage(), 'job_id' => $item['job_id']]);
        }
    }

    return ['processed' => count($items), 'complete' => $complete];
}

if (PHP_SAPI === 'cli') {
    $limit = isset($argv[1]) ? max(1, (int) $argv[1]) : 25;
    echo json_encode(resolveQueuedBenchmarks(databaseConnection(), $limit)) . PHP_EOL;
}
