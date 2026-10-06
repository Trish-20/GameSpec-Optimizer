<?php

declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/benchmark-resolver.php';

/**
 * Read a benchmark catalogue into a per-request cache.
 *
 * resolveDatabaseModel() needs every catalogue row to scan for a token match.
 * Without this cache a single game costs one full-table SELECT per component,
 * because the function is called separately for CPU and GPU. The rows never
 * change during a request, so they are fetched once per table instead.
 *
 * Only the two benchmark tables are reachable here: the caller passes a
 * literal table name from resolveGameBenchmarksNow(), never user input.
 */
function benchmarkCatalogueRows(PDO $database, string $table): array
{
    static $cache = [];

    if (!isset($cache[$table])) {
        $cache[$table] = $database->query(
            "SELECT model, normalized_model, score, source_version FROM {$table}"
        )->fetchAll();
    }

    return $cache[$table];
}

/**
 * Canonicalize CPU names for identity matching.
 *
 * Vendors and punctuation are already removed by normalizeBenchmarkName().
 * This additionally joins/splits the common Core 2 Duo/Quad spellings and
 * ignores a clock annotation only when a distinct model identifier (for
 * example Q8400, 2500K, or 5600X) remains. The model number is therefore still
 * required for matching; clocks alone never make two CPU families equivalent.
 */
function normalizeCpuModelForMatching(string $value): string
{
    $normalized = normalizeBenchmarkName($value);
    $normalized = preg_replace('/\bcore\s*2\s*(quad|duo)\b/', 'core 2 $1', $normalized);

    // Require a model code with at least three digits before dropping clocks.
    // This preserves useful distinctions such as Q8400 vs Q6600 and i5-2500K
    // vs i5-2400 while avoiding a broad "Core i7"-only match.
    $hasDistinctModelId = preg_match('/\b(?:[a-z]{1,3}\s*)?\d{3,}[a-z]{0,3}\b/i', $normalized) === 1;
    if ($hasDistinctModelId) {
        // normalizeBenchmarkName turns decimal punctuation into spaces, so
        // both "2.6 GHz" and "2.66GHz" arrive as "2 6 ghz" / "2 66 ghz".
        // Decimal clocks become two number tokens ("2 66ghz"), whereas model
        // IDs can sit immediately before a separate clock ("i7 4790 4 ghz").
        // Limit decimal components to short numbers so this never consumes a
        // four-digit SKU as though it were the whole clock value.
        $normalized = preg_replace('/\b(?:\d{1,2}\s+\d{1,3}|\d{1,2}|\d{3,})\s*(?:ghz|mhz)\b/', ' ', $normalized);
        $normalized = trim(preg_replace('/\s+/', ' ', $normalized));
    }

    return $normalized;
}

function resolveDatabaseModel(PDO $database, string $table, string $requiredText): array
{
    $parts = preg_split('/\b(?:or|and)\b|[,\|\/]/i', $requiredText);
    $bestMatch = null;

    $modelMarkers = $table === 'gpu_benchmarks'
        ? ['gt', 'gtx', 'rtx', 'rx', 'arc', 'quadro', 'tesla', 'titan', 'radeon', 'geforce', 'intel', 'hd']
        : ['core', 'ryzen', 'threadripper', 'athlon', 'phenom', 'fx', 'xeon', 'pentium', 'celeron'];

    $rows = benchmarkCatalogueRows($database, $table);
    $isCpu = $table === 'cpu_benchmarks';

    foreach ($parts as $part) {
        $required = $isCpu
            ? normalizeCpuModelForMatching($part)
            : normalizeBenchmarkName($part);
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

        if ($isCpu) {
            foreach ($rows as $row) {
                if (normalizeCpuModelForMatching((string) $row['model']) === $required) {
                    return ['matched_model' => $row['model'], 'score' => (int) $row['score'], 'match_status' => 'exact', 'source_version' => $row['source_version']];
                }
            }
        } else {
            $statement = $database->prepare("SELECT model, score, source_version FROM {$table} WHERE normalized_model = :normalized LIMIT 1");
            $statement->execute(['normalized' => $required]);
            $exact = $statement->fetch();
            if ($exact) {
                return ['matched_model' => $exact['model'], 'score' => (int) $exact['score'], 'match_status' => 'exact', 'source_version' => $exact['source_version']];
            }
        }

        $requiredTokens = array_values(array_filter(explode(' ', $required), static fn (string $token): bool => strlen($token) > 1));
        $candidates = [];
        foreach ($rows as $row) {
            $candidateName = $isCpu
                ? normalizeCpuModelForMatching((string) $row['model'])
                : (string) $row['normalized_model'];
            $candidateTokens = array_values(array_filter(explode(' ', $candidateName), static fn (string $token): bool => strlen($token) > 1));

            // Count DISTINCT required tokens present in this row, not the number
            // of candidate tokens that happen to match. Counting per candidate
            // token let a duplicated word score twice: the catalogue row
            // "9800 GTX 9800 GTX" contains "gtx" two times, so a requirement of
            // "GTX 1060" scored 2 hits on it and, in the fallback pass below,
            // reached full coverage on identity tokens that it does not
            // actually contain. array_intersect compares set membership.
            $matchedTokens = array_values(array_intersect($requiredTokens, $candidateTokens));
            $hits = count($matchedTokens);
            
            // Coverage is checked in BOTH directions and a row is accepted when
            // either side reaches 0.99:
            //
            // - required-side: the catalogue row covers everything the game asked
            //   for. "Intel Core i7-3770K" normalises to "core i7 3770k" (3
            //   tokens) while the row is "core i7 3770k 3 50ghz" (4 tokens after
            //   the length filter); dividing by the candidate's token count gave
            //   3/4 = 0.75 and left the CPU unresolved even though the exact part
            //   was in the table. Dividing by the required tokens gives 3/3.
            // - candidate-side: the row's name sits entirely inside the
            //   requirement. "gtx 1630" (row) vs "gtx 1630 4gb vram" (text) is
            //   2/2, and "hd 2000" (row) vs "hd graphics 2000" is 2/2; dividing
            //   by the required tokens gave 2/4 and 2/3 and dropped matches the
            //   original resolver produced.
            //
            // Accepting the union of both rules means a match either rule found
            // on its own still passes, so re-running the resolver can never turn
            // a previously-resolved score back into NULL - it can only add
            // matches.
            $requiredCoverage = count($requiredTokens) > 0 ? $hits / count($requiredTokens) : 0;
            $candidateCoverage = count($candidateTokens) > 0 ? $hits / count($candidateTokens) : 0;

            if ($requiredCoverage >= 0.99 || $candidateCoverage >= 0.99) {
                $candidates[] = ['row' => $row, 'coverage' => max($requiredCoverage, $candidateCoverage), 'hits' => $hits];
            }
        }

        /*
         * FALLBACK: identity tokens only.
         *
         * Measuring coverage against the required tokens fixes the CPU case
         * (required "core i7 3770k" vs catalogue "core i7 3770k 3 50ghz"), but
         * on its own it is too strict in the opposite direction. A requirement
         * may name something the catalogue does not list as a separate row, for
         * example "GTX 1060 6GB" when the catalogue only has "gtx 1060",
         * "gtx 1060 3gb" and "gtx 1060 5gb". Requiring every token then scores
         * 2/3 and never matches, which the old code did match.
         *
         * So if the strict pass found nothing, retry using only tokens that
         * identify the part itself. Capacity ("6gb", "16gb") and clock
         * ("3 50ghz", "ghz") tokens are qualifiers of a variant, not the
         * identity of the model, so they are excluded from the comparison. This
         * keeps both directions working: the corrected strict pass first, and
         * this broader pass only when strict matching found nothing.
         */
        if ($candidates === []) {
            $identityTokens = array_values(array_filter(
                $requiredTokens,
                static fn (string $token): bool => !preg_match('/^\d+(gb|mb|tb|ghz|mhz)$/', $token)
                    && !preg_match('/^(ghz|mhz|gb|mb)$/', $token)
            ));

            // Only retry when the qualifier filter actually removed something,
            // otherwise this would duplicate the strict pass exactly.
            if ($identityTokens !== [] && count($identityTokens) < count($requiredTokens)) {
                foreach ($rows as $row) {
                    $candidateName = $isCpu
                        ? normalizeCpuModelForMatching((string) $row['model'])
                        : (string) $row['normalized_model'];
                    $candidateTokens = array_values(array_filter(explode(' ', $candidateName), static fn (string $token): bool => strlen($token) > 1));

                    // Same set-based counting as the strict pass above, so a
                    // row that repeats a token cannot inflate its own score.
                    $hits = count(array_intersect($identityTokens, $candidateTokens));

                    $identityCoverage = count($identityTokens) > 0 ? $hits / count($identityTokens) : 0;

                    if ($identityCoverage >= 0.99) {
                        $candidates[] = ['row' => $row, 'coverage' => $identityCoverage, 'hits' => $hits];
                    }
                }
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
    if ($match) {
        return ['matched_capacity_gb' => (int) $match['capacity_gb'], 'matched_speed_mhz' => (int) $match['speed_mhz'], 'score' => (int) $match['score'], 'match_status' => $speedMhz ? 'nearest' : 'estimated', 'source_version' => $match['source_version']];
    }

    // The capacity itself is not in the catalogue. DATA/RAM-benchmarks.csv only
    // measures 2/4/8/16/32/64 GB, while requirements also ask for 1/3/5/6/12
    // GB, and the two queries above match capacity exactly - so those games
    // collapsed to NULL over a row the catalogue simply does not have. Fall
    // back to the closest measured capacity so the requirement still resolves.
    // The capacity that was actually used is stored in matched_capacity_gb and
    // the status is 'estimated', so the substitution stays visible in the admin
    // UI; ties go to the lower score, the same conservative tie-break
    // resolveDatabaseModel() uses. Existing rows never reach this point: they
    // already resolved on an exact capacity above, so no resolved score changes.
    $statement = $database->prepare(
        'SELECT capacity_gb, speed_mhz, score, source_version FROM ram_benchmarks
         ORDER BY ABS(CAST(capacity_gb AS SIGNED) - :capacity), score ASC LIMIT 1'
    );
    $statement->execute(['capacity' => $capacityGb]);
    $nearest = $statement->fetch();
    if (!$nearest) {
        return ['matched_capacity_gb' => null, 'matched_speed_mhz' => null, 'score' => null, 'match_status' => 'unresolved', 'source_version' => null];
    }

    return ['matched_capacity_gb' => (int) $nearest['capacity_gb'], 'matched_speed_mhz' => (int) $nearest['speed_mhz'], 'score' => (int) $nearest['score'], 'match_status' => 'estimated', 'source_version' => $nearest['source_version']];
}

/**
 * Resolve CPU/GPU/RAM for ONE game and recompute its visibility.
 *
 * This is the single-game entry point used by update-games.php, so saving a
 * game never drains the whole queue. The matching logic is the existing
 * resolveDatabaseModel()/resolveDatabaseRam() pair, and the UPSERT targets the
 * uq_requirement_hardware_type unique key, so repeated calls update the same
 * rows instead of creating duplicates. Safe to retry.
 *
 * Never throws for an unresolvable component: an unresolved part is stored as
 * match_status='unresolved' with a NULL score, which is exactly what keeps the
 * visibility gate closed.
 */
function resolveGameBenchmarksNow(PDO $database, int $gameId): array
{
    $requirements = $database->prepare('SELECT * FROM game_requirements WHERE game_id = :game_id');
    $requirements->execute(['game_id' => $gameId]);

    $upsert = $database->prepare(
        'INSERT INTO game_benchmark_matches
            (requirement_id, hardware_type, required_text, matched_model, matched_capacity_gb, matched_speed_mhz, benchmark_score, match_status, benchmark_source_version, resolved_at)
         VALUES (:requirement_id, :hardware_type, :required_text, :matched_model, :matched_capacity_gb, :matched_speed_mhz, :benchmark_score, :match_status, :source_version, NOW())
         ON DUPLICATE KEY UPDATE required_text = VALUES(required_text), matched_model = VALUES(matched_model), matched_capacity_gb = VALUES(matched_capacity_gb), matched_speed_mhz = VALUES(matched_speed_mhz), benchmark_score = VALUES(benchmark_score), match_status = VALUES(match_status), benchmark_source_version = VALUES(benchmark_source_version), resolved_at = NOW()'
    );

    $detail = ['cpu' => null, 'gpu' => null, 'ram' => null];

    foreach ($requirements->fetchAll() as $requirement) {
        $models = [
            ['type' => 'cpu', 'text' => (string) $requirement['cpu_text']],
            ['type' => 'gpu', 'text' => (string) $requirement['gpu_text']],
        ];

        foreach ($models as $model) {
            $match = resolveDatabaseModel($database, $model['type'] === 'cpu' ? 'cpu_benchmarks' : 'gpu_benchmarks', $model['text']);
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

            if ($requirement['requirement_type'] === 'minimum') {
                $detail[$model['type']] = [
                    'required_text' => $model['text'],
                    'matched_model' => $match['matched_model'],
                    'score' => $match['score'],
                    'match_status' => $match['match_status'],
                ];
            }
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

        if ($requirement['requirement_type'] === 'minimum') {
            $detail['ram'] = [
                'required_text' => $requirement['ram_text'],
                'matched_capacity_gb' => $ram['matched_capacity_gb'],
                'matched_speed_mhz' => $ram['matched_speed_mhz'],
                'score' => $ram['score'],
                'match_status' => $ram['match_status'],
            ];
        }
    }

    $isActive = recomputeGameEligibility($database, $gameId);

    $unresolved = [];
    foreach (['cpu' => 'CPU', 'gpu' => 'GPU', 'ram' => 'RAM'] as $type => $label) {
        if ($detail[$type] === null || $detail[$type]['score'] === null) {
            $unresolved[] = $label;
        }
    }

    return [
        'game_id' => $gameId,
        'is_active' => $isActive,
        'ready' => $isActive && $unresolved === [],
        'unresolved' => $unresolved,
        'detail' => $detail,
    ];
}

/**
 * Recompute games.is_active for one game using the existing visibility gate.
 *
 * A game becomes visible only when CPU, GPU and RAM all have a non-NULL
 * benchmark_score for its "minimum" requirement. This is the single source of
 * truth for the gate; both the batch CLI path and the automatic path call it so
 * the two cannot drift apart.
 *
 * The SQL is unchanged from the original inline statement.
 */
function recomputeGameEligibility(PDO $database, int $gameId): bool
{
    $statement = $database->prepare(
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
    $statement->execute(['game_id' => $gameId]);

    $read = $database->prepare('SELECT is_active FROM games WHERE game_id = :game_id LIMIT 1');
    $read->execute(['game_id' => $gameId]);

    return (int) $read->fetchColumn() === 1;
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
    $finish = $database->prepare('UPDATE sync_jobs SET status = "complete", last_error = NULL WHERE job_id = :job_id');

    $complete = 0;
    foreach ($items as $item) {
        $claim->execute(['job_id' => $item['job_id']]);
        if ($claim->rowCount() !== 1) {
            continue;
        }

        try {
            // Per-game work now lives in resolveGameBenchmarksNow(), so this CLI
            // path and the automatic path in update-games.php share exactly one
            // implementation of the matching and the visibility gate.
            resolveGameBenchmarksNow($database, (int) $item['game_id']);
            $finish->execute(['job_id' => $item['job_id']]);
            $complete++;
        } catch (Throwable $error) {
            $database->prepare('UPDATE sync_jobs SET status = "failed", last_error = :error WHERE job_id = :job_id')->execute(['error' => $error->getMessage(), 'job_id' => $item['job_id']]);
        }
    }

    return ['processed' => count($items), 'complete' => $complete];
}

// Keep including this module side-effect free. The queue batch should run only
// when this file itself is invoked as the CLI entry point; other CLI callers
// (maintenance scripts and focused single-game checks) may include it solely
// to use resolveGameBenchmarksNow().
$isDirectCliInvocation = PHP_SAPI === 'cli'
    && isset($_SERVER['SCRIPT_FILENAME'])
    && realpath($_SERVER['SCRIPT_FILENAME']) === __FILE__;

if ($isDirectCliInvocation) {
    $limit = isset($argv[1]) ? max(1, (int) $argv[1]) : 25;
    echo json_encode(resolveQueuedBenchmarks(databaseConnection(), $limit)) . PHP_EOL;
}
