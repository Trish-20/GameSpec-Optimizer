# GameSpec Optimizer — System Guide

> **Audience:** a developer who knows basic PHP / JavaScript / MySQL but did **not** build this backend.
>
> **Ground rule:** every statement here was traced to an actual file, function, line number, table, or endpoint. Where something could not be confirmed from the source, the text says **NOT VERIFIED FROM SOURCE**. Where two files contradict each other, both are named and the contradiction is documented rather than smoothed over.
>
> **No application code was modified to produce this guide.** Documentation only.

---

## 1. What GameSpec Optimizer is

GameSpec Optimizer is a web application that:

1. Stores a catalogue of PC games and their **minimum** hardware requirements.
2. Converts those human-readable requirements into **numeric benchmark scores** using reference benchmark tables.
3. Compares a user's own hardware scores against a game's required scores and **estimates expected FPS** using a pre-trained machine-learning model.
4. Collects **user feedback** about the site.

The core idea: a requirement like *"Intel Core i5-8400"* is free text and cannot be compared with *"AMD Ryzen 5 3600"*. The system resolves both to a single number (e.g. `19700`) so they *can* be compared.

### The single most important architectural fact

> **The live database and the machine-learning training data are two completely separate worlds. They are not connected.**
>
> The prediction model is trained from the static file `DATA/benchmark-data.csv`. Nothing ever writes to that file from the database, and nothing ever reads the database during training. The trained model contains **no per-game knowledge** — it only reacts to three numbers (the game's required CPU/GPU/RAM scores). This is why adding a game never requires retraining. See `07-ML-Training.md` and `08-ML-Dataset-and-Features.md`.

---

## 2. Technologies used

| Layer | Technology | Evidence |
|---|---|---|
| Frontend | HTML5 + vanilla JavaScript (no framework, no build step) | `FRONT-END/HTML/**`, `FRONT-END/JAVASCRIPT/**` |
| Styling | Hand-written CSS | `FRONT-END/CSS/Admin Side/AdminSideStyle.css`, `FRONT-END/CSS/User Side/UserSideStyle.css` |
| Icons | Font Awesome 6.4.0 via CDN | `User Side/header.php` line 1 |
| Backend | PHP with PDO, MySQL only | `MODULES/db.php` lines 36–82 |
| ML | Python, scikit-learn, XGBoost, pandas, joblib | `MODULES/ml-training.py`, `requirements.txt` |
| ML serving | PHP → Python bridge via `proc_open` (stdin/stdout JSON) | `MODULES/hardware-specs-input.php` |
| Database | MySQL / MariaDB, database `gamespec_optimizer` | `DATA/mysql-schema.sql` line 1, `MODULES/db.php` line 65 |
| External APIs | RAWG API, Steam Store API | `MODULES/rawg-steam-client.php` lines 82, 89, 102 |
| Dev environment | XAMPP on Windows, VS Code, project-local `.venv` | `.vscode/settings.json`, `hardware-specs-input.php` line 39 |

No Composer, no npm, no package manager. There is **no `package.json` and no `composer.json`**. Every file is loaded manually.

---

## 3. Main components

### 3.1 Frontend — User side (`FRONT-END/HTML/User Side/`)

| Page | Purpose |
|---|---|
| `browse-games.php` | Searchable/filterable game grid + details modal |
| `fps-prediction.php` | The FPS prediction form |
| `hardware-benchmark.php` | CPU/GPU/RAM benchmark score lookup tool |
| `feedback.php` | Feedback list + submit modal |
| `header.php` / `footer.php` | Sidebar nav; hidden 3-click admin entry |
| `UserSide-Backup-Old.php` | Legacy backup, **not loaded by navigation** |

### 3.2 Frontend — Admin side (`FRONT-END/HTML/Admin Side/`)

| Page | Purpose |
|---|---|
| `dashboard-admin.php` | Counts + averages + top-10 tables + CSV export |
| `game-management.php` | Add / edit / delete games |
| `hardware-management.php` | Add CPU / GPU / RAM |
| `ml-training.php` | **UI shell only — see warning below** |
| `feedback-management.php` | List / filter / paginate / delete feedback |
| `header.php` / `footer.php` | Sidebar nav; hidden 3-click user entry |
| `AdminSide-Backup-Old.php` | Legacy backup |

> ⚠️ **`ml-training.php` does not train anything.** Its four buttons call `updateTrainingData()`, `retrainModel()`, `generateData()` and `exportModel()` in `AdminSideFunction.js` lines 643–730. Every one is a `setTimeout()` that writes hard-coded text. Line 655 reads `// Simulate checking (replace with actual API call)`; line 697 reads `// Simulate training (replace with actual API call)`. There is **no `fetch()` in any of the four** and no PHP file they call. See `07-ML-Training.md`.

### 3.3 JavaScript

| File | Lines | Role |
|---|---|---|
| `FRONT-END/JAVASCRIPT/User Side/UserSideFunction.js` | 2926 | User-side data loading, filtering, prediction, feedback |
| `FRONT-END/JAVASCRIPT/Admin Side/AdminSideFunction.js` | 1250 | Admin CRUD, dashboard, reports, (fake) ML training UI |

### 3.4 Backend / API (`MODULES/api/`, 19 endpoints)

| Endpoint | Method | Purpose |
|---|---|---|
| `get-games.php` | GET | Games + requirements + benchmark matches (`is_active = 1` only) |
| `get-game-details.php` | GET | Live RAWG+Steam lookup for a search term |
| `get-cpus.php` | GET | CPU benchmark rows (`category = 'Desktop'`) |
| `get-gpus.php` | GET | GPU benchmark rows (`category = 'Desktop'`) |
| `get-ram.php` | GET | RAM benchmark rows |
| `get-hardware.php` | GET | Runs `detect-hardware.py`, returns detected hardware |
| `update-games.php` | POST | **Add *and* edit** games (mode chosen by presence of `gameId`) |
| `delete-games.php` | POST/GET | Delete a game |
| `update-cpus.php` | POST | Add a CPU |
| `update-gpus.php` | POST | Add a GPU |
| `update-ram.php` | POST | Add a RAM entry |
| `submit-feedback.php` | POST | Insert feedback |
| `get-feedback.php` | GET | Feedback with server-side search/rating/paging |
| `get-latest-feedback.php` | GET | Feedback, approved only, newest 100 |
| `helpful-feedback.php` | POST | `helpful_count + 1` |
| `report-feedback.php` | POST | `reported_count + 1` |
| `delete-feedback.php` | POST | Delete feedback |
| `export-games.php` | GET | CSV report |
| `export-cpus.php` | GET | CSV report |
| `export-gpus.php` | GET | CSV report |

> `get-feedback.php` is fully implemented but is **not called from any JavaScript in the project**. Both the user page and the admin page use `get-latest-feedback.php` instead.

### 3.5 Database — MySQL `gamespec_optimizer`

- **In use:** `games`, `game_requirements`, `game_benchmark_matches`, `cpu_benchmarks`, `gpu_benchmarks`, `ram_benchmarks`, `sync_jobs`, `game_sync_state`, `site_feedback`
- **Defined but not referenced by any code:** `users`, `reviews` (both commented `-- NOT YET APPLIED`)
- **Used by code but absent from every schema file:** `site_feedback`

Full detail in `02-Database-Structure.md`.

### 3.6 Benchmark system

| File | Role |
|---|---|
| `MODULES/benchmark-resolver.php` | `normalizeBenchmarkName()`, CSV readers, CSV-based matching |
| `MODULES/resolve-game-benchmarks.php` | **The actual resolver** — `resolveDatabaseModel()`, `resolveDatabaseRam()`, `resolveQueuedBenchmarks()` |
| `MODULES/import-benchmarks.php` | Bulk-loads the three benchmark CSVs into the DB (CLI only) |

Source data: `DATA/CPU-benchmarks-v4.csv`, `DATA/GPU-benchmarks-v7.csv`, `DATA/RAM-benchmarks.csv`.

### 3.7 ML system

| File | Role |
|---|---|
| `MODULES/ml-training.py` | Real trainer. Reads the CSV, fits two models, writes three `.joblib` files. CLI only. |
| `MODULES/ml-predict.py` | Loads the models, builds the feature row, returns predicted FPS |
| `MODULES/model-comparison.py` | Standalone experiment; trains 5 models, **saves nothing** |
| `MODULES/gb_model.joblib` | Trained `GradientBoostingRegressor` |
| `MODULES/xgb_model.joblib` | Trained `XGBRegressor` |
| `MODULES/feature_columns.joblib` | Ordered list of the 16 feature names |
| `DATA/benchmark-data.csv` | Training dataset — 6,000 data rows, 31 games |

### 3.8 Feedback system

`site_feedback` table + 5 API endpoints + user page (`feedback.php`) + admin page (`feedback-management.php`).


### 3.9 External APIs (`MODULES/rawg-steam-client.php`)

| Function | Line | Endpoint |
|---|---|---|
| `rawgRequest()` | 82 | `https://api.rawg.io/api/{path}` — key from `RAW_API_KEY` |
| `steamAppDetailsRequest()` | 89 | `https://store.steampowered.com/api/appdetails?appids=…` |
| `findSteamAppIdByTitle()` | 102 | `https://store.steampowered.com/api/storesearch/?term=…` |

Also `normalizeRequirements()` (line 133), `extractRamSpec()` (line 169), `getGameFromRawgAndSteam()` (line 202), and a disk cache under `DATA/rawg-steam-cache/`.

> These APIs are used **only** by the CLI import scripts and `get-game-details.php`. They are **not** used when an admin adds a game manually.

### 3.10 Background / CLI processes

Every one is gated behind `if (PHP_SAPI === 'cli')` and must be run from a terminal:

| Script | Purpose | Trigger |
|---|---|---|
| `MODULES/resolve-game-benchmarks.php` | Drains the `sync_jobs` benchmark queue | **Manual — nothing in the web app runs it** |
| `MODULES/job-maintenance.php` | Recovers stuck jobs, retries failed jobs | Manual |
| `MODULES/import-benchmarks.php` | Loads benchmark CSVs into DB | Manual |
| `MODULES/import-rawg-catalog.php` | Imports the RAWG catalogue | Manual, needs `RAW_API_KEY` |
| `MODULES/enrich-games.php` | Fetches RAWG + Steam metadata, writes requirements | Manual |
| `MODULES/ml-training.py` | Trains and saves the ML models | Manual |

**There is no cron entry, no Windows Task Scheduler entry, and no `launch.json` task that runs any of these.** `.vscode/launch.json` contains only a Chrome debugger and a generic Python debugger.

---

## 4. Architecture diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│  BROWSER                                                             │
│  FRONT-END/HTML/User Side/*.php     FRONT-END/HTML/Admin Side/*.php │
│  UserSideFunction.js (2926 ln)      AdminSideFunction.js (1250 ln)  │
└───────────────┬──────────────────────────────────┬───────────────────┘
                │ fetch()/JSON                      │ fetch()/JSON
                ▼                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│  PHP API LAYER — MODULES/api/*.php                                   │
│  get-games  get-cpus  get-gpus  get-ram  get-hardware               │
│  update-games  delete-games  update-cpus/gpus/ram                   │
│  submit-feedback  get-feedback  get-latest-feedback                  │
│  helpful-feedback  report-feedback  delete-feedback  export-*        │
│  ──────────────────────────────────────────────────────────────────── │
│  hardware-specs-input.php   (NOT in api/ — sits one level up)        │
└───────────────┬──────────────────────────────┬───────────────────────┘
                │ PDO                          │ proc_open → Python
                ▼                              ▼
┌───────────────────────────────┐   ┌──────────────────────────────────┐
│  MySQL gamespec_optimizer     │   │  MODULES/ml-predict.py            │
│                               │   │    loads gb_model.joblib          │
│  games                       │   │    loads xgb_model.joblib         │
│   └─ game_requirements       │   │    loads feature_columns.joblib   │
│        └─ game_benchmark_     │   │    → predicted_fps (JSON stdout)  │
│           matches             │   └──────────────────────────────────┘
│  cpu_benchmarks                                      ▲
│  gpu_benchmarks          ┌───────────────────────────┘
│  ram_benchmarks          │ models are produced by
│  sync_jobs               │ ml-training.py  ← CLI ONLY
│  game_sync_state         │
│  site_feedback           │
└───────────┬───────────────┘
            │ read by
            ▼
   resolve-game-benchmarks.php  ← CLI ONLY, never called by the web app
     reads sync_jobs (status='queued')
     matches game_requirements against cpu/gpu/ram_benchmarks
     writes game_benchmark_matches
     recomputes games.is_active   ← the visibility gate

   MODULES/ml-training.py  ← CLI ONLY
     reads DATA/benchmark-data.csv  (STATIC — not connected to MySQL)
     writes *.joblib
```

---


## 5. Development environment (as found)

| Item | Value | Evidence |
|---|---|---|
| OS | Windows | `platform.win32`; `detect-hardware.py` uses `ctypes.windll` and `wmic` |
| Web server | XAMPP Apache, served at `http://localhost:8080/GameSpec-Optimizer/...` | `.vscode/launch.json` URL |
| PHP | XAMPP bundled; code uses PHP 8 features such as `str_starts_with` (`db.php` line 8) | `db.php`, `rawg-steam-client.php` |
| Database | MySQL 8.0.39 | `DATA/gamespec_export.sql` lines 2–3 |
| DB config | `GameSpec-Optimizer/.env.local`, key `DB_CONNECTION_STRING` | `db.php` lines 12, 44 |
| RAWG key | `GameSpec-Optimizer/.env.local`, key `RAW_API_KEY` | `rawg-steam-client.php` line 75 |
| Python | Project venv at `GameSpec-Optimizer/.venv/Scripts/python.exe` | `.vscode/settings.json` |
| Python packages | `requirements.txt` (joblib, numpy, pandas, scikit-learn, scipy, xgboost, …) | `requirements.txt` |
| Editor | VS Code | `.vscode/settings.json` |
| Connection test | `test-db.php` (project root) | prints SUCCESS/FAILED + row counts |

**Live verification performed for this guide:** MySQL was **not running** during analysis (`ERROR 2002 (HY000): Can't connect to MySQL server on 'localhost' (10061)`). All schema statements therefore come from `DATA/mysql-schema.sql` and the data-only dump `DATA/gamespec_export.sql`. Anything about the *live* table definitions is marked accordingly.

---

## 6. Where should I look?

| "I want to understand…" | Read |
|---|---|
| game adding / editing / deleting | **`03-Game-Management.md`** |
| what tables exist and which are unused | **`02-Database-Structure.md`** |
| CPU / GPU / RAM data, imports, detection | **`04-Hardware-Benchmark-System.md`** |
| why my new game has no score yet | **`05-Benchmark-Resolution.md`** |
| how FPS is predicted | **`06-FPS-Prediction.md`** |
| ML training and when retraining is needed | **`07-ML-Training.md`** |
| the training CSV and the 16 features | **`08-ML-Dataset-and-Features.md`** |
| feedback, ratings, helpful/report | **`09-Feedback-System.md`** |
| the end-to-end user journey | **`10-User-Flow.md`** |
| the end-to-end admin journey | **`11-Admin-Flow.md`** |
| how to test everything | **`12-Testing-and-Verification.md`** |
| putting this on a server | **`13-Deployment-Guide.md`** |
| backups and restore | **`14-Backup-and-Recovery.md`** |
| security audit | **`15-Security-Considerations.md`** |
| something is broken | **`16-Troubleshooting.md`** |

---


## 7. IMPORTANT THINGS I NEED TO KNOW AS THE DEVELOPER

The facts that will save you the most time, each traced to source.

**1. Does adding a game require ML retraining?**
**No.** `MODULES/ml-training.py` lines 55–58 drop `game_title` from the dataset, and the 16 features in `feature_columns.joblib` are purely numeric. The model holds no per-game knowledge. A new game is usable as soon as it has benchmark scores.

**2. Does adding a game automatically resolve benchmarks?**
**Yes.** `MODULES/api/update-games.php` inserts the `sync_jobs` row, claims it (`queued → running`) and calls `resolveGameBenchmarksNow()` in the same request. The response tells you the real outcome via `prediction_ready` and `benchmark_resolution.unresolved`.

**3. Is benchmark resolution automatic or manual?**
**Automatic on save.** The CLI entry point of `MODULES/resolve-game-benchmarks.php` still exists, but only as a fallback for jobs left `queued` by a crashed request or the install-time backfill. The #1 cause of "my new game doesn't show up for users" is now a *failed* match: the game is saved with `is_active = 0`, so check `benchmark_resolution.unresolved` in the save response and look for the `HIDDEN FROM USERS (benchmark unresolved)` marker in the admin list.

**4. What is the gate that makes a game visible to users?**
`resolve-game-benchmarks.php` lines 128–142 recompute `games.is_active`. A game becomes visible **only if CPU, GPU and RAM all resolve to a non-NULL `benchmark_score`** for its `minimum` requirement (`HAVING COUNT(DISTINCT m.hardware_type) = 3`). `get-games.php` line 18 filters on `g.is_active = 1`.

**5. Where does prediction happen?**
`MODULES/hardware-specs-input.php` (PHP) shells out to `MODULES/ml-predict.py` (Python) via `proc_open`, passing JSON on stdin. Prediction is **on-demand and stateless**.

**6. Where does ML training happen?**
`MODULES/ml-training.py`, run manually from a terminal. The admin "ML Training" page is a simulation.

**7. Where does training data come from?**
The static file `DATA/benchmark-data.csv` — 6,000 rows across 31 fixed games. **Not from MySQL.** No code writes to it.

**8. Where are predictions stored?**
**Nowhere.** There is no predictions table and no results table. Predictions are computed per request and discarded. Only `games.is_active` is persisted.

**9. What is stored in MySQL?**
Games, requirement text, resolved benchmark matches, the three hardware reference tables, the job queue, sync state, and feedback.

**10. What is stored only in files?**
- The entire ML training dataset → `DATA/benchmark-data.csv`
- The three trained models → `MODULES/*.joblib`
- The source benchmark CSVs → `DATA/*-benchmarks*.csv`
- Game cover images → `uploads/game-covers/`
- Database + API credentials → `.env.local`
- Up to 8 recent predictions, per browser → `localStorage` (`UserSideFunction.js` lines 2757, 2879)

**11. What happens if the ML model is missing?**
`ml-predict.py` lines 113–118 catch `FileNotFoundError` and return `{"success": false, "error": "Models not found. Please run ml-training.py first."}`. The UI shows an error modal; browsing still works.

**12. What happens if a benchmark cannot be matched?**
`game_benchmark_matches` gets a row with `match_status = 'unresolved'` and `benchmark_score = NULL`. Because the visibility gate requires all three scores, **one failed match hides the entire game from users**. Common causes: requirement text contains no model marker word (`core`, `ryzen`, `gtx`, `rtx`, …), or the RAM capacity is not one of the 6 rows in `DATA/RAM-benchmarks.csv`.

**13. What must be backed up?**
MySQL database, `uploads/game-covers/`, the three `.joblib` files, `DATA/*.csv`, and `.env.local`. See `14-Backup-and-Recovery.md`.

**14. What must be running for the system to work?**
- Apache/PHP (web pages and APIs)
- MySQL (every API)
- The Python venv **with** `.venv/Scripts/python.exe` (for prediction — `hardware-specs-input.php` line 39 has no fallback, unlike `get-hardware.php` lines 11–14)
- The three `.joblib` files next to `ml-predict.py`
- Nothing else. No queue daemon, no scheduler, no background worker.

**15. Is there any authentication?**
**No.** No login, no session, no authorization check anywhere. The admin panel is reachable by typing the URL. `users` and `reviews` are defined in the schema but never read or written by code. Every admin API is publicly callable. See `15-Security-Considerations.md`.


---

## 8. Known contradictions between files

Documented, **not fixed** (this guide changes no application code).

| # | Contradiction | Files |
|---|---|---|
| C1 | `rawg_id` is `BIGINT UNSIGNED NOT NULL` with a `UNIQUE` key and no default, but the insert omits it and a comment says it "remains NULL" | `DATA/mysql-schema.sql` line 64 vs `MODULES/api/update-games.php` lines 355–377 |
| C2 | Admin UI claims export to `MODULES/fps_model.pkl`, a file that does not exist; real artifacts are the three `.joblib` files | `AdminSideFunction.js` line 727 vs the `MODULES/` directory |
| C3 | Admin UI shows "MAE 10.94" / "6,000 rows" as if measured; the values are hard-coded strings | `ml-training.php` lines 22–33 vs `AdminSideFunction.js` lines 643–730 |
| C4 | `ml-predict.py` line 95 comment says `+15%` but the code multiplies by `1.05` | `MODULES/ml-predict.py` lines 94–97 |
| C5 | `ml-training.py` resolves `../DATA/benchmark-data.csv` relative to the script; `model-comparison.py` uses `'../DATA/benchmark-data.csv'` relative to the **current working directory**, so it only works when run from inside `MODULES/` | `ml-training.py` line 11 vs `model-comparison.py` line 12 |
| C6 | `site_feedback` is queried by 7 files but has no `CREATE TABLE` in any `.sql` file | `submit-feedback.php` etc. vs `DATA/mysql-schema.sql` |
| C7 | The GPU and RAM buttons are both labelled "Save CPU" in the admin HTML | `FRONT-END/HTML/Admin Side/hardware-management.php` |
| C8 | `delete-games.php` says deleting works for games with "rawg_id/steam_app_id NULL", which the schema forbids for `rawg_id` | `delete-games.php` lines 82–87 vs `mysql-schema.sql` line 64 |
| C9 | Admin hardware form offers a "Save CPU" label on the GPU and RAM cards (same as C7, listed separately because it is a user-facing string) | `hardware-management.php` GPU + RAM `<button>` elements |

---

## 9. Documentation conventions used in this guide

- `file.php:123` means line 123 of that file.
- **`NOT VERIFIED FROM SOURCE`** — the claim could not be confirmed from any project file (usually because the live database was not reachable during analysis).
- **`SECURITY REVIEW NEEDED`** — something that works but has not been verified as safe.
- Statements about the **live** MySQL schema are kept separate from statements about `DATA/mysql-schema.sql`, which may be stale.
- Contradictions are reported with both file names rather than silently resolved.

