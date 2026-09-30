# 04 — Hardware Benchmark System (CPU / GPU / RAM)

This system answers one question: **given free text like `"Intel Core i5-8400"` or a number like `16 GB @ 3200 MHz`, what single numeric score represents it?**

---

## 1. The three layers

```
① CSV files (source of truth for the reference data)
      DATA/CPU-benchmarks-v4.csv
      DATA/GPU-benchmarks-v7.csv
      DATA/RAM-benchmarks.csv
        │
        │  MODULES/import-benchmarks.php  (CLI only)
        ▼
② MySQL tables (what the resolver actually queries)
      cpu_benchmarks / gpu_benchmarks / ram_benchmarks
        │
        ├─► get-cpus.php / get-gpus.php / get-ram.php  →  browser dropdowns
        │
        └─► resolveDatabaseModel() / resolveDatabaseRam()  →  game_benchmark_matches
```

**There is a second, parallel writer:** `MODULES/api/update-cpus.php`, `update-gpus.php`, `update-ram.php`, used by the admin Hardware Management page. Those insert with `source_version = 'admin'`.

---

## 2. The CSV source files

| File | Header | Rows used | Columns used by the code |
|---|---|---|---|
| `DATA/CPU-benchmarks-v4.csv` | `cpuName,price,cpuMark,cpuValue,threadMark,threadValue,TDP,powerPerf,cores,testDate,socket,category` | desktop only (`row[11]=='desktop'`) | `row[0]` model, `row[2]` score (cpuMark), `row[8]` cores, `row[11]` category |
| `DATA/GPU-benchmarks-v7.csv` | `gpuName,G3Dmark,G2Dmark,price,gpuValue,TDP,powerPerformance,testDate,category` | desktop only (`row[8]=='desktop'`), minus quadro/tesla/titan/rtx-a | `row[0]` model, `row[1]` score (G3Dmark), `row[2]` g2d, `row[5]` tdp, `row[8]` category |
| `DATA/RAM-benchmarks.csv` | `ram_capacity_gb,ram_speed_mhz,ram_score` | **all 6 rows** | `row[0]` capacity, `row[1]` speed, `row[2]` score |

Reading is done by `readBenchmarkCsv()` (`benchmark-resolver.php:14-30`), which skips the header with one `fgetcsv()` call and then accumulates the rest.

**GPU exclusions** (`import-benchmarks.php:14`, mirrored at `benchmark-resolver.php:68`):

```php
preg_match('/\b(quadro|tesla|titan|rtx a)\b/i', $model)   // skipped
```

Professional/workstation and Titan cards never enter the reference set.

**The RAM source is tiny** — the whole file is:

```csv
ram_capacity_gb,ram_speed_mhz,ram_score
2,1600,1700
4,2200,2200
8,3200,2800
16,3200,4000
32,3600,6000
64,3600,7500
```

---

## 3. Bulk import process (CLI only)

`MODULES/import-benchmarks.php::importBenchmarkData(PDO $database)`:

1. **CPU** — `INSERT … ON DUPLICATE KEY UPDATE` on `uq_cpu_model`, writing `model`, `normalized_model`, `score`, `cores`, `category`, `source_version = 'CPU-benchmarks-v4'`.
2. **GPU** — same pattern on `uq_gpu_model`, `source_version = 'GPU-benchmarks-v7'`.
3. **RAM** — same pattern on `uq_ram_configuration (capacity_gb, speed_mhz)`, `source_version = 'RAM-benchmarks'`.

Returns counts `['cpu' => n, 'gpu' => n, 'ram' => n]`.

Guarded at lines 55–58:

```php
if (PHP_SAPI === 'cli') {
    $counts = importBenchmarkData(databaseConnection());
    echo json_encode($counts) . PHP_EOL;
}
```

```bash
cd GameSpec-Optimizer\MODULES
C:\xampp\php\php.exe import-benchmarks.php
```

> Nothing in the web application calls this. If `cpu_benchmarks` is empty, every dropdown is empty and no game can ever resolve.

### `normalizeBenchmarkName()` — the shared normalizer

`MODULES/benchmark-resolver.php:5-12`:

```php
function normalizeBenchmarkName(string $value): string
{
    $value = strtolower($value);
    $value = str_replace(['(r)', '(tm)', '™', '®'], '', $value);
    $value = preg_replace('/\b(nvidia|amd|intel|geforce|radeon)\b/', '', $value);
    $value = preg_replace('/[^a-z0-9]+/', ' ', $value);
    return trim(preg_replace('/\s+/', ' ', $value));
}
```

| Input | Output |
|---|---|
| `Intel Core i5-8400` | `core i5 8400` |
| `NVIDIA GeForce RTX 4070 Ti` | `rtx 4070 ti` |
| `AMD Ryzen 5 5600X @ 3.70GHz` | `ryzen 5 5600x 3 70ghz` |

Vendor words are **removed**, which is what lets `GTX 1060` match `NVIDIA GTX 1060`. Note that **`core` survives** (only `intel` is stripped) — this matters for the resolver's marker gate in `05-Benchmark-Resolution.md`.

A duplicate Python implementation exists at `DATA/normalize.py` (used to pre-build the `*-import-normalized.csv` files). It matches the PHP behaviour but is a **separate copy** — changing one does not change the other.

---
## 4. Admin add process (HTTP)

| | CPU | GPU | RAM |
|---|---|---|---|
| Form | `hardware-management.php` `#cpuForm` | `#gpuForm` | `#ramForm` |
| JS handler | `AdminSideFunction.js:909` | `:986` | `:1053` |
| Fields | `#cpuModel`, `#cpuScore` | `#gpuModel`, `#gpuScore` | `#ramModel`, `#ramScore` |
| Client validation | `model && Number.isFinite(score) && score > 0` | same | same |
| Endpoint | `update-cpus.php` | `update-gpus.php` | `update-ram.php` |
| Duplicate key | `normalized_model` → 409 | `normalized_model` → 409 | `(capacity_gb, speed_mhz)` → 409 |
| `category` | `'Desktop'` | `'Desktop'` | n/a |
| `source_version` | `'admin'` | `'admin'` | `'admin'` |

All three require `model` non-empty and `score > 0`, else **400**.

**RAM has parsing logic** (`update-ram.php:34-56`) because the form has no separate capacity/speed fields:

```php
preg_match('/(\d+)\s*GB/i', $model, $capMatch);              // capacity
preg_match('/DDR\d?[\s\-]*(\d{3,5})/i', $model, ...);        // "DDR4-3200" → 3200
// fallback:
preg_match('/(\d{3,5})\s*MHz/i', $model, ...);               // "3200MHz" → 3200
```

| Input | capacity_gb | speed_mhz |
|---|---|---|
| `16GB DDR4-3200` | 16 | 3200 |
| `32 GB DDR5-6000` | 32 | 6000 |
| `8GB` | 8 | **0** |
| `16 GB 3200MHz` | 16 | 3200 |

If capacity cannot be parsed → **400** *"Could not parse a valid capacity (GB) from the model string. Use a format like "16GB DDR4-3200" or "8GB"."* A speed of `0` later causes `match_status = 'estimated'` instead of `'nearest'`.

> ⚠️ **Cosmetic bug:** the GPU and RAM submit buttons are both labelled **"Save CPU"** in `hardware-management.php`. The endpoints are correct; only the labels are wrong.

> **There is no edit or delete endpoint for CPU/GPU/RAM** — insert only. `addLocalHardwareItem()` (`AdminSideFunction.js:224`) writes to `localStorage` under `gamespecAdminHardwareStore` and does **not** touch MySQL.

---

## 5. Retrieval APIs

| Endpoint | SQL | Notes |
|---|---|---|
| `get-cpus.php` | `SELECT model, score, cores FROM cpu_benchmarks WHERE category = "Desktop" ORDER BY score DESC` | returns `[{model, score, cores, threads:null}]` |
| `get-gpus.php` | `SELECT model, score, tdp FROM gpu_benchmarks WHERE category = "Desktop" ORDER BY score DESC` | returns `[{model, score, tdp}]` |
| `get-ram.php` | `SELECT capacity_gb AS capacity, speed_mhz AS speed, score FROM ram_benchmarks ORDER BY score DESC` | returns `[{capacity, speed, score}]` |

Errors → HTTP 500 with `{"error": "Unable to retrieve …"}`.

**Note the `category = "Desktop"` filter.** A row inserted by `update-cpus.php`/`update-gpus.php` always gets `category='Desktop'`, so admin-added hardware *is* returned. But `import-benchmarks.php` only imports desktop rows from the CSVs anyway (`row[11]`/`row[8]` must equal `desktop`).

---


## 6. Hardware detection (user side)

**Endpoint:** `MODULES/api/get-hardware.php`

```php
$venvPython = realpath(__DIR__ . '/../../.venv/Scripts/python.exe');
$pythonBinary = $venvPython && file_exists($venvPython)
    ? $venvPython
    : ((PHP_OS_FAMILY === 'Windows') ? 'python' : 'python3');      // lines 11-14  ← HAS a fallback

$command = escapeshellcmd($pythonBinary) . ' ' . escapeshellarg($pythonScript) . ' 2>&1';
$output = shell_exec($command);
```

**Script:** `MODULES/detect-hardware.py::get_specs()` returns:

```json
{ "success": true, "cpu_model": "…", "ram_gb": 32.0, "gpu_model": "…" }
```

| Value | Method | Detail |
|---|---|---|
| CPU | `subprocess.check_output("wmic cpu get name")` (`get_windows_cpu()`) | falls back to `platform.processor()` |
| GPU | `wmic path win32_VideoController get name` (`get_windows_gpu()`) | prefers a card containing `nvidia`/`geforce`/`rtx`/`rad eon rx`; else last device. Integrated selection is commented out — `choice = "1"` is hard-coded |
| RAM | `ctypes.windll.kernel32.GlobalMemoryStatusEx` (`get_windows_ram_gb()`) | `round(ullTotalPhys / 1024**3, 2)` |

> ⚠️ **Windows-only.** The script imports `ctypes.windll` and calls `wmic`; on Linux/macOS this endpoint fails. Note the string `'rad eon rx'` contains a **space** inside `radeon`, so it can never match a Radeon card — the `devices[-1]` fallback takes over instead.

### Matching the detected string against the database

`UserSideFunction.js`:

- `detectHardware()` (line 2042) → `fetch('../../../MODULES/api/get-hardware.php')`
- `findBestHardwareMatch(items, detectedModel)` (line 2004):

```js
const score = exact ? 100 : (tokenCoverage * 70) + (targetCoverage * 30);
return best && best.score >= 25 ? best.item : null;
```

- On a match: `cpuSelect.value = cpuMatch.score` (line 2061) — the **dropdown stores the score, not an id**.
- On **no** match: `cpuSelect.value = ''` → the text box shows the raw detected model but there is **no score**, so prediction refuses to proceed.

`normalizeHardwareText()` (line 1994) strips `11th/12th/13th/14th/15th gen`, `core tm`, and non-alphanumerics before comparing.
`findClosestRamOption()` (line 2029) maps the detected GB amount onto `[4, 8, 16, 32, 64]`.

---

## 7. How a requirement becomes a benchmark score

### 7.1 CPU requirement → CPU benchmark

```
game_requirements.cpu_text                cpu_benchmarks
   "Intel Core i5-8400"                       model / normalized_model / score
        │                                          │
        └──────── resolveDatabaseModel() ──────────┘
                     resolve-game-benchmarks.php:8
```

1. **Split** on `or` / `and` / `,` / `|` / `/` (line 10) — `"i5-8400 or Ryzen 5 3600"` becomes two parts.
2. **Normalise** each part with `normalizeBenchmarkName()`.
3. **Marker gate** (lines 13–15, 25–34): the part must contain one of
   `core, ryzen, threadripper, athlon, phenom, fx, xeon, pentium, celeron`.
   **If not, the part is skipped entirely** — this is why `"1.7 Ghz"` and `"Example CPU"` never match.
4. **Exact query** (line 36): `WHERE normalized_model = :normalized LIMIT 1` → `match_status = 'exact'`.
5. **Fuzzy scan** (lines 43–61): for every row compute
   `candidateCoverage = |candidateTokens ∩ requiredTokens| / |candidateTokens|`
   and keep candidates with **`candidateCoverage >= 0.99`** — the DB model name must be *almost fully contained* in your text.
6. **Rank** (lines 63–69): more token hits first; tie-break by **lower score** (conservative choice).
7. Nothing → `match_status = 'unresolved'`, `benchmark_score = NULL`.

### 7.2 GPU requirement → GPU benchmark

Identical algorithm, but the marker list (line 14) is
`gt, gtx, rtx, rx, arc, quadro, tesla, titan, radeon, geforce, intel, hd`
and the table scanned is `gpu_benchmarks`.

> `quadro`, `tesla`, `titan` are accepted as markers even though `import-benchmarks.php` **excluded** those cards from the table. A requirement naming a Quadro passes the gate, fails exact match, fails fuzzy match (the rows do not exist), and ends `unresolved`.

### 7.3 RAM requirement → RAM benchmark

`resolveDatabaseRam()` (line 86):

```php
if (!$capacityGb) return [... 'match_status' => 'unresolved', 'benchmark_score' => null];

// 1. exact on capacity+speed
SELECT … FROM ram_benchmarks WHERE capacity_gb = :capacity AND speed_mhz = :speed LIMIT 1
   → 'exact'

// 2. nearest speed within the same capacity
SELECT … FROM ram_benchmarks WHERE capacity_gb = :capacity
   ORDER BY ABS(CAST(speed_mhz AS SIGNED) - :speed) LIMIT 1
   → 'nearest'     if $speedMhz is non-zero
   → 'estimated'   if $speedMhz is 0
   → 'unresolved'  if no row at all
```

**RAM does not need a marker word** — it is matched numerically, not textually.



## 8. What happens when hardware cannot be matched

| Case | Result |
|---|---|
| Requirement text has no marker word | Part skipped; `unresolved`; `benchmark_score = NULL` |
| Model string too short for the 0.99 containment rule | No candidate; `unresolved` |
| RAM capacity not in `ram_benchmarks` (e.g. 12 GB, 24 GB) | `unresolved` |
| RAM capacity present but exact speed missing | `nearest` — **still succeeds** |
| `ram_capacity_gb` is NULL or 0 | immediate `unresolved` (line 88) |
| Reference table empty (import never run) | everything `unresolved` |

**Consequences of a NULL score:**

1. `resolve-game-benchmarks.php:128-142` sets `games.is_active = 0` unless **all three** resolve.
2. `get-games.php:18` filters `g.is_active = 1` → the game disappears from **both** user and admin lists.
3. If it still reaches prediction, `parseInt(null)` → `NaN` and `hardware-specs-input.php` returns *"Missing or invalid field: game_cpu_min"*.

For a **user's own hardware** that fails to match, the dropdown never receives a score, so `predictFPS()` stops at its guards:

```js
if (!cpuScore) return showModal('Warning', 'Please select a CPU.');    // line 2404
if (!gpuScore) return showModal('Warning', 'Please select a GPU.');    // line 2405
if (!ramSelect.value) return showModal('Warning', 'Please select RAM.'); // line 2406
```

and for RAM specifically (lines 2416–2418):

```js
if (!Number.isFinite(ramScoreNum)) {
    return showModal('Warning', `No benchmark score is available for ${ramGB} GB RAM.`);
}
```

---

## 9. Verification (read-only)

```sql
-- Reference table sizes
SELECT 'cpu' AS t, COUNT(*) AS n FROM cpu_benchmarks
UNION ALL SELECT 'gpu', COUNT(*) FROM gpu_benchmarks
UNION ALL SELECT 'ram', COUNT(*) FROM ram_benchmarks;

-- Categories present (get-cpus.php only returns 'Desktop')
SELECT category, COUNT(*) FROM cpu_benchmarks GROUP BY category;
SELECT category, COUNT(*) FROM gpu_benchmarks GROUP BY category;

-- Source mix: how much came from the CSV vs. the admin panel
SELECT source_version, COUNT(*) FROM cpu_benchmarks GROUP BY source_version;
SELECT source_version, COUNT(*) FROM gpu_benchmarks GROUP BY source_version;
SELECT source_version, COUNT(*) FROM ram_benchmarks GROUP BY source_version;

-- What a given requirement normalises to
SELECT model, normalized_model, score, source_version
FROM cpu_benchmarks
WHERE normalized_model = 'core i5 8400';     -- output of normalizeBenchmarkName('Intel Core i5-8400')

-- RAM coverage
SELECT capacity_gb, speed_mhz, score FROM ram_benchmarks ORDER BY capacity_gb, speed_mhz;

-- Which CPU/GPU do admin-added entries use?
SELECT model, score, category, source_version FROM cpu_benchmarks
WHERE source_version = 'admin';
```

All `SELECT` only.

> ⚠️ **DESTRUCTIVE — do NOT run casually:** `TRUNCATE TABLE cpu_benchmarks, gpu_benchmarks, ram_benchmarks;` would empty the reference data. Nothing could ever resolve again until you re-ran `php import-benchmarks.php`.

---

## 10. Manual re-run checklist

```bash
# 1. (Re)load reference data from CSVs
cd GameSpec-Optimizer\MODULES
C:\xampp\php\php.exe import-benchmarks.php
# → {"cpu":<n>,"gpu":<n>,"ram":<n>}

# 2. Re-resolve any queued games afterwards
C:\xampp\php\php.exe resolve-game-benchmarks.php 25
```

Order matters: **import first, resolve second.** Resolving against an empty reference table writes `unresolved` rows and can flip `games.is_active` to 0.

