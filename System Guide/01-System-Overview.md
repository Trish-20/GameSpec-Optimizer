## 1. The request path in one line

```
Browser  →  frontend HTML/JS  →  PHP API  →  MySQL  →  benchmark / ML  →  result back to browser
```

Broken down per feature, there are three distinct paths, and they behave very differently:

|          Feature           |                              Path                                 |  Automatic? |
|----------------------------|-------------------------------------------------------------------|-------------|
| Browse / view games        | JS → `get-games.php` → MySQL                                      | Yes, fully  |
| Add / edit / delete a game | JS → `update-games.php` → MySQL (`sync_jobs`)                     | Yes, fully  |
| Benchmark resolution       | `sync_jobs` → **`resolve-game-benchmarks.php` (CLI)** → MySQL     | No — manual |
| FPS prediction             | JS → `hardware-specs-input.php` → **`ml-predict.py`** → `.joblib` | Yes, fully  |
| ML training                | **`ml-training.py` (CLI)** → `.joblib`                            | No — manual |
| Feedback                   | JS → `submit-feedback.php` → MySQL                                | Yes, fully  |


## 2. Folder map

```
GameSpec-Optimizer/
├── .env.local                  ← DB + RAWG credentials (never committed)
├── .venv/                      ← Python virtualenv (Scripts/python.exe)
├── requirements.txt            ← Python packages
├── test-db.php                 ← DB connectivity check
├── FRONT-END/
│   ├── CSS/
│   ├── HTML/
│   │   ├── Admin Side/          ← 5 admin pages + header/footer
│   │   └── User Side/           ← 4 user pages + header/footer
│   ├── JAVASCRIPT/
│   │   ├── Admin Side/AdminSideFunction.js      (1250 lines)
│   │   └── User Side/UserSideFunction.js        (2926 lines)
│   └── RES/                     ← tutorial screenshots, placeholder images
├── MODULES/
│   ├── db.php                   ← loadEnvironment(), databaseConnection()
│   ├── benchmark-resolver.php   ← normalization + CSV readers
│   ├── resolve-game-benchmarks.php  ← THE RESOLVER (CLI only)
│   ├── import-benchmarks.php    ← CSV → DB loader (CLI only)
│   ├── job-maintenance.php      ← queue recovery (CLI only)
│   ├── enrich-games.php         ← RAWG/Steam metadata (CLI only)
│   ├── import-rawg-catalog.php  ← RAWG catalogue import (CLI only)
│   ├── rawg-steam-client.php    ← external API client
│   ├── hardware-specs-input.php ← PHP→Python prediction bridge
│   ├── ml-training.py           ← REAL trainer (manual)
│   ├── ml-predict.py            ← REAL predictor
│   ├── model-comparison.py      ← experiment script (saves nothing)
│   ├── detect-hardware.py       ← Windows WMIC/ctypes hardware probe
│   ├── gb_model.joblib          ← trained model #1
│   ├── xgb_model.joblib         ← trained model #2
│   ├── feature_columns.joblib   ← ordered list of 16 feature names
│   └── api/                     ← 19 HTTP endpoints
├── DATA/
│   ├── mysql-schema.sql         ← schema (authoritative for DDL in this guide)
│   ├── gamespec_export.sql      ← data dump (NO CREATE TABLE statements)
│   ├── benchmark-data.csv       ← ML training dataset (STATIC)
│   ├── CPU-benchmarks-v4.csv    ← benchmark source
│   ├── GPU-benchmarks-v7.csv
│   ├── RAM-benchmarks.csv       ← only 6 rows
│   ├── game-requirements.csv    ← legacy sample data (NOT read by any API)
│   └── rawg-steam-cache/        ← JSON cache of external API calls
├── uploads/game-covers/         ← admin-uploaded cover images
└── System Guide/                ← this documentation
```

---

## 3. End-to-end diagrams

### 3.1 Viewing games (fully automatic)

```
browse-games.php
  └─ UserSideFunction.js:initBrowseGames()        (line 1001)
       └─ loadGamesFromCSV()                      (line 43)
            └─ GET MODULES/api/get-games.php
                 ├─ WHERE g.is_active = 1         (line 18)
                 ├─ per game: JOIN game_requirements
                 │             LEFT JOIN game_benchmark_matches  (lines 42-50)
                 └─ JSON array
       └─ loadGameGrid()                          (line 1197)
       └─ filterGames()                           (line 1381)
```

### 3.2 Adding a game (automatic up to a queue)

```
game-management.php
  └─ AdminSideFunction.js gameForm submit         (line 787)
       ├─ validation                              (lines 798-812)
       ├─ readFileAsDataUrl(file) → base64        (line 165)
       └─ POST MODULES/api/update-games.php       (lines 864-873)
            ├─ image decode + save to uploads/game-covers/  (60-189)
            ├─ duplicate title check → 409        (271-294)
            ├─ slug generation + uniqueness       (307-349)
            ├─ INSERT INTO games                  (357-385)
            ├─ UPSERT game_requirements           (399-442)
            └─ INSERT INTO sync_jobs  ← QUEUE ONLY (450-469)
                      │
                      │   ⚠ STOP. Nothing here runs the resolver.
                      ▼
        resolve-game-benchmarks.php   ← YOU must run this from a CLI
```

### 3.3 Predicting FPS (fully automatic)

```
fps-prediction.php
  └─ UserSideFunction.js:predictFPS()             (line 2394)
       ├─ builds payload from benchmark scores    (lines 2441-2457)
       └─ POST MODULES/hardware-specs-input.php   (line 2463)
            ├─ validates 6 numeric fields
            ├─ proc_open('.venv/Scripts/python.exe', 'ml-predict.py')
            └─ writes JSON to stdin, reads stdout
                 └─ ml-predict.py::predict_fps()
                      ├─ joblib.load(gb_model.joblib)
                      ├─ joblib.load(xgb_model.joblib)
                      ├─ joblib.load(feature_columns.joblib)
                      ├─ computes ratios + total_pixels
                      ├─ fps = (gb_pred + xgb_pred) / 2
                      ├─ ±5% performance-mode scaling
                      └─ clamp to [1, 500]  → JSON on stdout
```

---

## 4. The visibility gate (memorise this)

`MODULES/resolve-game-benchmarks.php` lines 128–142 runs this after processing a job:

```sql
UPDATE games g SET g.is_active = EXISTS (
    SELECT 1 FROM game_requirements r
    INNER JOIN game_benchmark_matches m ON m.requirement_id = r.requirement_id
    WHERE r.game_id = g.game_id
      AND r.requirement_type = "minimum"
      AND m.hardware_type IN ("cpu","gpu","ram")
      AND m.benchmark_score IS NOT NULL
    GROUP BY r.requirement_id
    HAVING COUNT(DISTINCT m.hardware_type) = 3)
WHERE g.game_id = :game_id
```

**Translation:** a game is `is_active = 1` only when its `minimum` requirement has **all three** of CPU, GPU and RAM resolved to a real numeric score.

Because `get-games.php` line 18 filters `g.is_active = 1`, a game with even **one** failed match is **invisible to users on every page**, even though the row still exists in `games`.

Important consequence: the **admin** game list also loads via `get-games.php` (`AdminSideFunction.js` line 254), so **both** panels hide an inactive game after the resolver flips it to 0.

---

## 5. Where each concern lives

|           Concern           |                                     File(s)                                     |
|-----------------------------|---------------------------------------------------------------------------------|
| HTML structure              | `FRONT-END/HTML/{User,Admin} Side/*.php`                                        |
| All browser logic           | `FRONT-END/JAVASCRIPT/**` (only 2 files)                                        |
| All HTTP endpoints          | `MODULES/api/*.php` + `MODULES/hardware-specs-input.php`                        |
| DB connection               | `MODULES/db.php` — `loadEnvironment()` line 5, `databaseConnection()` line 36   |
| Requirement → score mapping | `MODULES/resolve-game-benchmarks.php`                                           |
| Reference normalization     | `MODULES/benchmark-resolver.php` — `normalizeBenchmarkName()` line 5            |
| ML training                 | `MODULES/ml-training.py`                                                        |
| ML inference                | `MODULES/ml-predict.py`                                                         |
| External APIs               | `MODULES/rawg-steam-client.php`                                                 |
| Configuration               | `.env.local` only (read by `db.php` line 12 and `rawg-steam-client.php` line 9) |

---

## 6. Things that do NOT exist

Stated explicitly so you do not go looking for them:

- **No authentication / login / session.** No `login.php`, no `$_SESSION` usage anywhere.
- **No predictions storage table.** Predictions are computed and discarded per request.
- **No CSRF tokens** anywhere.
- **No routing framework.** Each `.php` file is its own URL.
- **No background worker or queue daemon.** `sync_jobs` accumulates until a human runs the CLI.
- **No test suite.** `test-db.php` is a connectivity check, not a test framework.
- **No `package.json` and no `composer.json`.**
- **No schema auto-migration.** Nothing applies `DATA/mysql-schema.sql` — you run it yourself.

---

## 7. Two separate "brains"

Keep these apart; confusing them causes most design mistakes in this project:

|                          |            Live application data           |              ML training data              |
|--------------------------|--------------------------------------------|--------------------------------------------|
| Lives in                 | MySQL `gamespec_optimizer`                 | `DATA/benchmark-data.csv` (file)           |
| Updated by               | Admin panel, CLI importers, resolver       | **Nothing** — static, hand-made            |
| Read by                  | All APIs, resolver                         | `ml-training.py` only                      |
| Connected?               | **No.** Zero code paths between them       |                                            |
| Contains                 | Real games, real requirements, real scores | 31 games × 6,000 rows of `expected_fps`    |
| Used at prediction time? | Yes — supplies `game_cpu_min` etc.         | Indirectly — only through the fitted model |

Detail: `08-ML-Dataset-and-Features.md`.

