# 05 — Benchmark Resolution

> **This is the most important operational document in the guide.**
> Benchmark resolution is a **queue with no worker in the web application.** It must be run manually from a terminal.

---

## 1. The complete pipeline

```
  ┌──────────────────────────────────────────────────────────────────┐
  │ STEP 1 — A job row is created (any of these)                    │
  │                                                                  │
  │  update-games.php:450-469      add AND edit of a game            │
  │  enrich-games.php:45-49        after Steam metadata sync         │
  │  import-rawg-catalog.php:23-27 RAWG catalogue import             │
  │                                (job_type: 'rawg_metadata')       │
  └───────────────────────────────┬──────────────────────────────────┘
                                  ▼
                        sync_jobs
                        job_type = 'benchmark_resolution'
                        status    = 'queued'
                        run_after = NOW()
                                  │
                                  │  ⚠ NOTHING RUNS AUTOMATICALLY ⚠
                                  │  no cron, no Task Scheduler,
                                  │  no web call, no launch.json task
                                  ▼
  ┌──────────────────────────────────────────────────────────────────┐
  │ STEP 2 — HUMAN runs the CLI                                      │
  │                                                                  │
  │   cd GameSpec-Optimizer\MODULES                                  │
  │   C:\xampp\php\php.exe resolve-game-benchmarks.php 25            │
  └───────────────────────────────┬──────────────────────────────────┘
                                  ▼
  ┌──────────────────────────────────────────────────────────────────┐
  │ STEP 3 — resolveQueuedBenchmarks()  (resolve-game-benchmarks.php)│
  │                                                                  │
  │  3a. SELECT jobs WHERE status='queued' ORDER BY created_at       │
  │      LIMIT :limit  (clamped 1..100, default 25)        109-117   │
  │  3b. claim: status='running', attempts++               119      │
  │      skip if rowCount() !== 1                          146-149   │
  │  3c. SELECT * FROM game_requirements WHERE game_id     120       │
  │  3d. resolve CPU, GPU, RAM                             154-185   │
  │  3e. UPSERT into game_benchmark_matches               121-126   │
  │  3f. recompute games.is_active                        128-142   │
  │  3g. job → 'complete' (127) or 'failed'+last_error (190)         │
  └───────────────────────────────┬──────────────────────────────────┘
                                  ▼
              game_benchmark_matches  (3 rows per requirement)
              games.is_active         (0 or 1)
              sync_jobs.status        ('complete' / 'failed')
```

---

## 2. When jobs are created

| Producer | Line | `job_type` | Dedup guard? |
|---|---|---|---|
| `update-games.php` | 450–469 | `benchmark_resolution` | **No** — every save queues another row |
| `enrich-games.php` | 45–49 | `benchmark_resolution` | **No** |
| `import-rawg-catalog.php` | 23–27 | `rawg_metadata` | **Yes** — has an `AND NOT EXISTS (… status IN ('queued','running','complete'))` clause |

The insert performed by `update-games.php`:

```php
INSERT INTO sync_jobs (game_id, job_type, status, run_after)
VALUES (:game_id, "benchmark_resolution", "queued", NOW())
```

> **Inconsistency:** `import-rawg-catalog.php` guards against duplicate queue entries; `update-games.php` does not. Editing a game 10 times leaves 10 queued rows. Processing all 10 is wasteful but not incorrect — the UPSERT is idempotent.

---
## 3. How jobs are selected

`resolve-game-benchmarks.php:107-117`:

```php
$jobs = $database->prepare(
    'SELECT j.job_id, j.game_id
     FROM sync_jobs j
     WHERE j.job_type = "benchmark_resolution" AND j.status = "queued"
     ORDER BY j.created_at ASC LIMIT :limit'
);
$jobs->bindValue(':limit', max(1, min(100, $limit)), PDO::PARAM_INT);
```

- Default `$limit = 25` (line 198: `$limit = isset($argv[1]) ? max(1, (int) $argv[1]) : 25`)
- Hard-clamped to **100** (line 115)
- **`run_after` is NOT used as a filter.** The column exists and is written, but selection is purely `status='queued'` ordered by `created_at`. `job-maintenance.php` writes `run_after` for exponential backoff, yet the selector ignores it. **Inconsistency: backoff is computed but never honoured.**

### Claiming — the concurrency guard (line 119)

```php
$claim = $database->prepare(
  'UPDATE sync_jobs SET status = "running", attempts = attempts + 1
   WHERE job_id = :job_id AND status = "queued"');
```

Then lines 146–149:

```php
$claim->execute(['job_id' => $item['job_id']]);
if ($claim->rowCount() !== 1) {
    continue;     // someone else claimed it
}
```

A compare-and-swap, so two concurrent CLI runs cannot both process the same job.

---

## 4. How jobs are processed

Per claimed job (lines 151–192):

1. `SELECT * FROM game_requirements WHERE game_id = :game_id` (line 120)
2. For **each** requirement row (`minimum` and `recommended`, if present):
   - resolve CPU → UPSERT (`hardware_type='cpu'`)
   - resolve GPU → UPSERT (`hardware_type='gpu'`)
   - resolve RAM → UPSERT (`hardware_type='ram'`)
3. Recompute `games.is_active` (line 186)
4. Mark job `complete` (line 187)
5. On any `Throwable`: mark job `failed` and store the message (line 190)

### The UPSERT — lines 121–126

```php
INSERT INTO game_benchmark_matches
    (requirement_id, hardware_type, required_text, matched_model,
     matched_capacity_gb, matched_speed_mhz, benchmark_score,
     match_status, benchmark_source_version, resolved_at)
VALUES (:requirement_id, :hardware_type, :required_text, :matched_model,
        :matched_capacity_gb, :matched_speed_mhz, :benchmark_score,
        :match_status, :source_version, NOW())
ON DUPLICATE KEY UPDATE
    required_text = VALUES(required_text),
    matched_model = VALUES(matched_model),
    matched_capacity_gb = VALUES(matched_capacity_gb),
    matched_speed_mhz = VALUES(matched_speed_mhz),
    benchmark_score = VALUES(benchmark_score),
    match_status = VALUES(match_status),
    benchmark_source_version = VALUES(benchmark_source_version),
    resolved_at = NOW()
```

Depends on `uq_requirement_hardware_type (requirement_id, hardware_type)` (`mysql-schema.sql:121`). Because it is an UPSERT, **re-running is safe and idempotent** — it overwrites in place rather than duplicating.

> ⚠️ **Side effect:** if a re-run fails to find a match where it previously succeeded, the UPSERT **overwrites a good score with NULL**. Resolution can *remove* data, not only add it. After changing a requirement, always re-check `match_status`.

---


## 5. CPU matching — `resolveDatabaseModel()` lines 8–84

Used for both CPU (`cpu_benchmarks`) and GPU (`gpu_benchmarks`); only the marker list differs.

### 5.1 Split the free text (line 10)

```php
$parts = preg_split('/\b(?:or|and)\b|[,|\/]/i', $requiredText);
```

`"Intel Core i5-8400 or AMD Ryzen 5 3600"` → two parts.

### 5.2 Normalise

Each part goes through `normalizeBenchmarkName()` (`benchmark-resolver.php:5-12`): lowercase → strip `(r)/(tm)/™/®` → remove `nvidia|amd|intel|geforce|radeon` → `[^a-z0-9]+` → space → trim.

### 5.3 Model-marker gate (lines 13–15, 25–34)  ← the #1 failure point

```php
$modelMarkers = $table === 'gpu_benchmarks'
    ? ['gt','gtx','rtx','rx','arc','quadro','tesla','titan','radeon','geforce','intel','hd']
    : ['core','ryzen','threadripper','athlon','phenom','fx','xeon','pentium','celeron'];

foreach ($modelMarkers as $marker) {
    if (preg_match('/\b' . preg_quote($marker, '/') . '\b/', $required)) { $hasModelMarker = true; break; }
}
if (!$hasModelMarker) { continue; }      // ← part skipped entirely
```

**Words that pass:** `core`, `ryzen`, `gtx`, `rtx`, `rx`, `hd`, `intel`, `radeon`, `geforce`, `xenon`…
**Words that do not:** `ghz`, `directx`, `example`, `processor`, `dual`, `quad` (as in "quad-core").

> The dump contains real examples: `match_id` 456, `required_text = '1.7 Ghz'` → `unresolved`; `match_id` 457, `'DirectX 8.1 level Graphics Card (requires support for SSE)'` → `unresolved`.

### 5.4 Exact lookup (lines 36–41)

```php
SELECT model, score, source_version FROM {$table}
WHERE normalized_model = :normalized LIMIT 1
```
Found → return `['match_status' => 'exact', 'source_version' => …]` immediately.

### 5.5 Fuzzy scan (lines 43–61)

```php
$rows = $database->query("SELECT model, normalized_model, score, source_version FROM {$table}")->fetchAll();
$candidateCoverage = count($candidateTokens) > 0 ? $hits / count($candidateTokens) : 0;
if ($candidateCoverage >= 0.99) { $candidates[] = … }
```

**The containment direction is the opposite of what you might expect.** `candidateCoverage` divides by the **candidate's** token count, so the requirement text must *contain the candidate's name* almost entirely.

| Requirement text | DB `normalized_model` | Candidate tokens | Hits | Coverage | Pass ≥0.99? |
|---|---|---|---|---|---|
| `Intel Core i5-8400` | `core i5 8400` | core, i5, 8400 | 3 | **1.00** | ✅ |
| `Intel Core i5-8400 with cooler` | `core i5 8400` | core, i5, 8400 | 3 | **1.00** | ✅ |
| `i5-8400` → `i5 8400` | `core i5 8400` | core, i5, 8400 | 2 | 0.67 | ❌ |
| `Example CPU` | — | — | — | — | ❌ (gate rejected first) |

**Practical rule:** requirement text must include the **full** normalised model name, including words like `core`. A shortened `i5-8400` fails the threshold.

### 5.6 Ranking (lines 63–69)

```php
usort($candidates, function ($left, $right) {
    if ($left['hits'] === $right['hits']) {
        return (int) $left['row']['score'] <=> (int) $right['row']['score'];
    }
    return $right['hits'] <=> $left['hits'];
});
```

More token hits wins; **tie-break goes to the lower score** — deliberately conservative.

Across `or`/`and`/comma alternatives, line 73 keeps only the **weakest** best match:

```php
if ($bestMatch === null || $result['score'] < $bestMatch['score']) { $bestMatch = $result; }
```

### 5.7 Failure

Line 83 → `['matched_model' => null, 'score' => null, 'match_status' => 'unresolved', 'source_version' => null]`

---

## 6. RAM matching — `resolveDatabaseRam()` lines 86–105

```php
if (!$capacityGb) {
    return ['matched_capacity_gb'=>null,'matched_speed_mhz'=>null,
            'score'=>null,'match_status'=>'unresolved','source_version'=>null];
}

// 1) exact capacity + exact speed
SELECT capacity_gb, speed_mhz, score, source_version
FROM ram_benchmarks WHERE capacity_gb = :capacity AND speed_mhz = :speed LIMIT 1
   → 'exact'

// 2) same capacity, nearest speed
SELECT capacity_gb, speed_mhz, score, source_version
FROM ram_benchmarks WHERE capacity_gb = :capacity
ORDER BY ABS(CAST(speed_mhz AS SIGNED) - :speed) LIMIT 1
   → 'nearest'    if $speedMhz non-zero
   → 'estimated'  if $speedMhz is 0
   → 'unresolved' if no row for that capacity
```

**No marker gate and no string matching** — RAM is purely numeric.

> **Note:** step 2 cannot fall back to a *different* capacity. If no row exists with that exact `capacity_gb`, the query returns nothing → `unresolved`. (Contrast `benchmark-resolver.php::resolveRamBenchmark()` lines 181–184, which *does* fall back to all rows — but **that function is never called by the DB resolver**. Two implementations, only one is live.)

---


## 7. What each output field means

| Column | Meaning |
|---|---|
| `required_text` | Copy of `game_requirements.cpu_text` / `gpu_text` / `ram_text` at resolution time |
| `matched_model` | The **exact** `cpu_benchmarks.model` / `gpu_benchmarks.model` string chosen (not the normalised form) |
| `matched_capacity_gb`, `matched_speed_mhz` | The RAM row chosen; NULL for CPU/GPU |
| `benchmark_score` | Score copied from the reference table. **NULL ⇒ the game is hidden.** |
| `match_status` | `exact` \| `nearest` \| `estimated` \| `unresolved` (`alias` is never written) |
| `benchmark_source_version` | Provenance copied from `source_version`: `'CPU-benchmarks-v4'`, `'GPU-benchmarks-v7'`, `'RAM-benchmarks'`, or `'admin'`. NULL when unresolved. **Tells you which dataset produced the number.** |
| `resolved_at` | `NOW()` on **every** UPSERT — a *last-run* timestamp, not a first-created one |

**Which statuses are acceptable?** The visibility gate only tests `benchmark_score IS NOT NULL`, so `exact`, `nearest` **and** `estimated` are all fine. Only `unresolved` breaks the game.

---

## 8. Automatic or manual?

**Manual.** Evidence:

| Check | Result |
|---|---|
| `grep resolveQueuedBenchmarks` across the project | Only `resolve-game-benchmarks.php` itself (definition + CLI call) |
| HTTP endpoint calling it | **None** |
| JS calling it | **None** — `AdminSideFunction.js` has no reference |
| `.vscode/launch.json` | Only a Chrome debugger and a generic `debugpy` entry |
| cron / Task Scheduler config in repo | **None** |
| Any daemon / `while(true)` loop | **None** |

The CLI guard (`resolve-game-benchmarks.php:197-200`):

```php
if (PHP_SAPI === 'cli') {
    $limit = isset($argv[1]) ? max(1, (int) $argv[1]) : 25;
    echo json_encode(resolveQueuedBenchmarks(databaseConnection(), $limit)) . PHP_EOL;
}
```

**Requesting the URL in a browser does nothing** — under Apache `PHP_SAPI` is `fpm-httpd` / `cli-server`, never `cli`, so the block is skipped and the response is empty.

### How it is executed during development

```bash
cd C:\xampp\htdocs\New\GameSpec-Optimizer\MODULES
C:\xampp\php\php.exe resolve-game-benchmarks.php 25
```

- Argument is optional, default `25`, clamped to `100`.
- Output is a single JSON line, e.g. `{"processed":3,"complete":2}`.
- `processed` = jobs claimed; `complete` = jobs that finished without an exception.
- Re-running with an empty queue returns `{"processed":0,"complete":0}` — this is the quickest way to confirm the script runs at all.

---

## 9. THE KEY QUESTION

> ### "If I add a game from the admin panel, what must happen before its benchmark information is ready?"
>
> **You must run the resolver manually from a terminal:**
>
> ```bash
> cd C:\xampp\htdocs\New\GameSpec-Optimizer\MODULES
> C:\xampp\php\php.exe resolve-game-benchmarks.php 25
> ```
>
> Until that command runs, the game has:
> - `games.is_active = 1` (set at insert time, so it *appears* in lists)
> - **zero** rows in `game_benchmark_matches`
> - `cpu_benchmark` / `gpu_benchmark` / `ram_benchmark` = `null` in the API response
> - a `sync_jobs` row still at `status = 'queued'`
>
> **Prediction will fail**, because `hardware-specs-input.php` requires `game_cpu_min`, `game_gpu_min`, `game_ram_min`, `cpu_score`, `gpu_score`, `ram_score` to all be numeric, and `parseInt(null)` is `NaN`.
>
> **If the resolver runs and any one of CPU/GPU/RAM fails to match, `is_active` is set to 0 and the game disappears from *both* the user and admin lists.**

### Recommended sequence after adding a game

```bash
# 1. Confirm the queue has work   (SQL in §11)

# 2. Run the resolver
cd C:\xampp\htdocs\New\GameSpec-Optimizer\MODULES
C:\xampp\php\php.exe resolve-game-benchmarks.php 25

# 3. Confirm all three matches have scores   (SQL in §11)

# 4. If any are 'unresolved':
#      - fix the requirement text in the admin panel (see §5.3 / §5.5)
#      - re-run step 2
```

---


## 10. Optional housekeeping — `job-maintenance.php`

```php
// Recover jobs stuck 'running' for more than 2 hours
UPDATE sync_jobs SET status = 'queued'
 WHERE status = 'running' AND updated_at < DATE_SUB(NOW(), INTERVAL 2 HOUR);

// Re-queue failed jobs with backoff: run_after = NOW() + attempts² hours
UPDATE sync_jobs SET status = 'queued',
       run_after = DATE_ADD(NOW(), INTERVAL POW(attempts, 2) HOUR)
 WHERE status = 'failed' AND attempts <= 5;
```

Run with `php job-maintenance.php`. Returns `{"recovered":n,"retried":m}`.

**Caveat:** `run_after` is written here, but the resolver's SELECT ignores it (§3), so the backoff currently has no practical effect — a re-queued job is picked up immediately.

Jobs with `attempts > 5` stay `failed` permanently until reset manually.

---

## 11. Verification (read-only SQL)

```sql
-- Is the queue waiting?
SELECT status, COUNT(*) AS n, MIN(created_at) AS oldest
FROM sync_jobs
WHERE job_type = 'benchmark_resolution'
GROUP BY status;

-- What is stuck?
SELECT job_id, game_id, status, attempts, run_after, last_error, created_at, updated_at
FROM sync_jobs
WHERE job_type = 'benchmark_resolution' AND status IN ('queued','running','failed')
ORDER BY created_at;

-- Resolution health across all games
SELECT g.game_id, g.title, g.is_active,
       SUM(m.benchmark_score IS NOT NULL) AS resolved_of_3
FROM games g
LEFT JOIN game_requirements r
       ON r.game_id = g.game_id AND r.requirement_type = 'minimum'
LEFT JOIN game_benchmark_matches m
       ON m.requirement_id = r.requirement_id
GROUP BY g.game_id, g.title, g.is_active
ORDER BY resolved_of_3, g.is_active;

-- Exactly which hardware failed, and the text it failed on
SELECT r.game_id, m.hardware_type, m.required_text,
       m.matched_model, m.benchmark_score, m.match_status,
       m.benchmark_source_version, m.resolved_at
FROM game_benchmark_matches m
JOIN game_requirements r ON r.requirement_id = m.requirement_id
WHERE m.benchmark_score IS NULL
ORDER BY r.game_id, m.hardware_type;

-- Provenance: which dataset produced each score
SELECT benchmark_source_version, COUNT(*) AS n
FROM game_benchmark_matches
GROUP BY benchmark_source_version;

-- Have the reference tables been populated at all?
SELECT (SELECT COUNT(*) FROM cpu_benchmarks) AS cpus,
       (SELECT COUNT(*) FROM gpu_benchmarks) AS gpus,
       (SELECT COUNT(*) FROM ram_benchmarks) AS ram;
```

All `SELECT` only — safe to run repeatedly.

> ⚠️ **DESTRUCTIVE — labelled, do NOT run casually:**
> `DELETE FROM sync_jobs WHERE status = 'queued';` discards all pending resolution work. Only use it if you deliberately want to abandon queued jobs.

---

## 12. Failure modes cheat-sheet

| Symptom | Cause | Where to look |
|---|---|---|
| Game added, no score | Resolver never run | `sync_jobs.status = 'queued'` |
| Job stays `queued` forever | No worker | nothing in the repo drains it automatically |
| Job `failed` | Exception during processing | `sync_jobs.last_error` |
| Job `running` for hours | Crashed mid-run | `job-maintenance.php` recovers after 2 h |
| CPU `unresolved` | No marker word (§5.3) | `game_benchmark_matches.required_text` |
| CPU `unresolved` | Text too short for 0.99 (§5.5) | compare `required_text` with `cpu_benchmarks.normalized_model` |
| GPU `unresolved` | Requirement names an excluded card (quadro/titan) | `gpu_benchmarks` has no such row |
| RAM `unresolved` | Capacity not in the 6-row CSV | `SELECT * FROM ram_benchmarks` |
| RAM `estimated` (not `nearest`) | `ram_speed_mhz` was 0/NULL | `game_requirements.ram_speed_mhz` |
| Game vanished after running resolver | 1 of 3 scores NULL → `is_active = 0` | the gate query in §11 |
| Good score became NULL | Re-run overwrote it (§4) | compare `resolved_at` history |

More: `16-Troubleshooting.md`.

