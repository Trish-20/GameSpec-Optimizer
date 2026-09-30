# 02 — Database Structure

Source of DDL: `DATA/mysql-schema.sql`.

> ⚠️ **Evidence limits for this document**
>
> MySQL was **not running** while this was written (`ERROR 2002 (HY000): Can't connect to MySQL server on 'localhost' (10061)`). Every column list below comes from the files, **not** from a live `SHOW CREATE TABLE`.
>
> The other SQL file, `DATA/gamespec_export.sql`, contains **only INSERT statements** — verified: `Select-String 'CREATE TABLE'` across `DATA/*.sql` matches only `mysql-schema.sql`. So the export cannot confirm column definitions.

---

## 1. How this project connects

`MODULES/db.php`:

- `loadEnvironment()` (line 5) reads `MODULES/../.env.local` = `GameSpec-Optimizer/.env.local`
- Requires the key `DB_CONNECTION_STRING` (line 44) — throws `RuntimeException('DB_CONNECTION_STRING is not configured.')` if absent (line 46)
- Parses `mysql:host=…;dbname=…;user=…;password=…;port=…` manually (lines 49–68)
- Rejects anything not starting with `mysql:` (line 60) — *"Only MySQL connections are supported."*
- Fallback database name if `dbname` missing: `gamespec_optimizer` (line 65)
- PDO options: `ERRMODE_EXCEPTION`, `FETCH_ASSOC`, `EMULATE_PREPARES => false` (lines 75–79)

`EMULATE_PREPARES => false` matters: it means **real** server-side prepared statements, so each placeholder may appear only **once** per query. That constraint is why `get-feedback.php` lines 27–31 use three different names (`:search_title`, `:search_comment`, `:search_name`) for the same `%value%`.

---

## 2. Table inventory

|           Table          | In `mysql-schema.sql`? | Used by code? | Verdict |
|--------------------------|------------------------|---------------|----------------------------------------|
| `games`                  | Yes (line 62)          | Yes           | **ACTIVE**                             |
| `game_requirements`      | Yes (line 86)          | Yes           | **ACTIVE**                             |
| `game_benchmark_matches` | Yes (line 109)         | Yes           | **ACTIVE**                             |
| `cpu_benchmarks`         | Yes (line 19)          | Yes           | **ACTIVE**                             |
| `gpu_benchmarks`         | Yes (line 34)          | Yes           | **ACTIVE**                             |
| `ram_benchmarks`         | Yes (line 50)          | Yes           | **ACTIVE**                             |
| `sync_jobs`              | Yes (line 140)         | Yes           | **ACTIVE**                             |
| `game_sync_state`        | Yes (line 128)         | Yes           | **ACTIVE**(`import-rawg-catalog.php`)  |
| `site_feedback`          | **NO**                 | Yes (7 files) | **MISSING FROM SCHEMA FILES**          |
| `users`                  | Yes (line 4)           | **No**        | Defined but unused                     |
| `reviews`                | Yes (line 157)         | **No**        | Defined but unused                     |

---

## 3. Relationship diagram (only relationships that exist)

```
games (game_id PK)
  │
  │ 1:N   fk_requirements_game   ON DELETE CASCADE  (mysql-schema.sql 103-106)
  ▼
game_requirements (requirement_id PK)
  UNIQUE (game_id, requirement_type)     ← 'minimum' | 'recommended'
  │
  │ 1:N   fk_matches_requirement  ON DELETE CASCADE  (mysql-schema.sql 122-125)
  ▼
game_benchmark_matches (match_id PK)
  UNIQUE (requirement_id, hardware_type) ← 'cpu' | 'gpu' | 'ram'

games ──1:N── sync_jobs (job_id PK, game_id FK)
                ON DELETE CASCADE        (mysql-schema.sql 151-154)

NO foreign keys to these (standalone reference tables):
  cpu_benchmarks    UNIQUE (model)
  gpu_benchmarks    UNIQUE (model)
  ram_benchmarks    UNIQUE (capacity_gb, speed_mhz)

NO foreign keys at all:
  game_sync_state
  site_feedback
```

**There is no join between `game_benchmark_matches` and the hardware tables.** The link is purely textual: `game_benchmark_matches.matched_model` holds a *copy* of `cpu_benchmarks.model` as a string, denormalised by the resolver.

---

## 4. Cascade behaviour

Deleting one `games` row removes, in this order:

|             Table            | How |
|------------------------------|---------------------------------------------------------------------------|
| `game_requirements`          | Direct FK `ON DELETE CASCADE` (`mysql-schema.sql` 103–106)                |
| `game_benchmark_matches`     | **Transitively** — its own FK cascades from `game_requirements` (122–125) |
| `sync_jobs`                  | Direct FK `ON DELETE CASCADE` (151–154)                                   |
| `uploads/game-covers/<file>` | **Not** a cascade — PHP `unlink()` in `delete-games.php` 110–122          |
| `site_feedback`              | **Not affected** — no `game_id` column, no FK                             |

This is confirmed in the code comment at `delete-games.php` lines 82–87.

---

## 5. Table-by-table reference

### 5.1 `games` — `mysql-schema.sql` lines 62–84

| Column | Type | Notes |
|---|---|---|
| `game_id` | `BIGINT UNSIGNED AUTO_INCREMENT` | **PK** |
| `rawg_id` | `BIGINT UNSIGNED NOT NULL` | `UNIQUE uq_games_rawg_id` (line 79) — **⚠ see C1 below** |
| `steam_app_id` | `INT UNSIGNED NULL` | `UNIQUE uq_games_steam_app_id` (line 80) |
| `title` | `VARCHAR(255) NOT NULL` | `INDEX idx_games_title` |
| `slug` | `VARCHAR(255) NULL` | used as `title_raw` by the frontend |
| `description` | `TEXT NULL` | free text |
| `cover_url` | `VARCHAR(1000) NULL` | relative path or `http(s)` URL |
| `release_date` | `DATE NULL` | RAWG import only |
| `release_year` | `SMALLINT UNSIGNED NULL` | |
| `genres`, `platforms` | `JSON NULL` | `JSON_SEARCH` used at `get-games.php:29` |
| `is_active` | `TINYINT(1) NOT NULL DEFAULT 1` | **the visibility gate** |
| `rawg_synced_at`, `steam_synced_at` | `DATETIME NULL` | |
| `created_at`, `updated_at` | `TIMESTAMP` | |

Indexes: `uq_games_rawg_id`, `uq_games_steam_app_id`, `idx_games_title`, `idx_games_release_year`, `idx_games_active_title (is_active, title)`.

> **CONTRADICTION C1.** `mysql-schema.sql:64` declares `rawg_id … NOT NULL` with **no DEFAULT**. But `update-games.php:357-377` inserts only `title, slug, description, cover_url, is_active, created_at, updated_at` — **`rawg_id` omitted** — while its comment (line 355) says *"rawg_id and steam_app_id remain NULL because this is a manually added game."*
>
> Evidence from `gamespec_export.sql`: 38 game rows, **0 with `rawg_id = NULL`**, and **0 `game_requirements` rows with `source='admin'`** (all 66 are `'steam'`).
>
> Either the live table differs from `mysql-schema.sql`, or no manual add has ever succeeded. **The live definition is NOT VERIFIED FROM SOURCE** (MySQL was not running).

**Used by:** `get-games.php`, `update-games.php`, `delete-games.php`, `enrich-games.php`, `import-rawg-catalog.php`, `export-games.php`, `resolve-game-benchmarks.php`.

### 5.2 `game_requirements` — lines 86–107

| Column | Type | Notes |
|---|---|---|
| `requirement_id` | `BIGINT UNSIGNED AUTO_INCREMENT` | **PK** |
| `game_id` | `BIGINT UNSIGNED NOT NULL` | **FK → `games`**, `ON DELETE CASCADE` |
| `requirement_type` | `ENUM('minimum','recommended')` | part of the unique key |
| `operating_system` | `TEXT NULL` | RAWG/Steam path only |
| `cpu_text` | `TEXT NULL` | **free text** — no FK to `cpu_benchmarks` |
| `gpu_text` | `TEXT NULL` | **free text** — no FK to `gpu_benchmarks` |
| `ram_text` | `TEXT NULL` | e.g. `"16 GB RAM"` |
| `storage_text` | `TEXT NULL` | |
| `ram_capacity_gb` | `SMALLINT UNSIGNED NULL` | **structured** — this is what gets matched |
| `ram_speed_mhz` | `SMALLINT UNSIGNED NULL` | **structured** |
| `raw_html` | `MEDIUMTEXT NULL` | original Steam HTML |
| `source` | `VARCHAR(30) NOT NULL DEFAULT 'steam'` | `'steam'` or `'admin'` |
| `synced_at` | `DATETIME NULL` | |

- **PK:** `requirement_id`
- **FK:** `game_id` → `games.game_id` (`fk_requirements_game`, CASCADE)
- **Unique:** `uq_game_requirement_type (game_id, requirement_type)` — this is exactly what makes the admin UPSERT at `update-games.php:424` work (`ON DUPLICATE KEY UPDATE`)

**Design point:** CPU and GPU requirements exist *only* as free text. RAM is the only requirement stored in machine-comparable numeric form. Numeric conversion for CPU/GPU is entirely deferred to `game_benchmark_matches`.

**Used by:** `get-games.php`, `update-games.php`, `enrich-games.php`, `resolve-game-benchmarks.php`, `export-games.php`.

### 5.3 `game_benchmark_matches` — lines 109–126

| Column | Type | Notes |
|---|---|---|
| `match_id` | `BIGINT UNSIGNED AUTO_INCREMENT` | **PK** |
| `requirement_id` | `BIGINT UNSIGNED NOT NULL` | **FK → `game_requirements`**, `ON DELETE CASCADE` |
| `hardware_type` | `ENUM('cpu','gpu','ram')` | part of the unique key |
| `required_text` | `TEXT NULL` | copy of the original requirement string |
| `matched_model` | `VARCHAR(255) NULL` | copy of the benchmark row's `model` |
| `matched_capacity_gb` | `SMALLINT UNSIGNED NULL` | RAM only |
| `matched_speed_mhz` | `SMALLINT UNSIGNED NULL` | RAM only |
| `benchmark_score` | `INT UNSIGNED NULL` | **the number everything depends on** |
| `match_status` | `ENUM('exact','alias','nearest','estimated','unresolved')` default `'unresolved'` | see §6 |
| `benchmark_source_version` | `VARCHAR(100) NULL` | provenance of the score |
| `resolved_at` | `DATETIME NULL` | `NOW()` on **every** UPSERT |

- **PK:** `match_id`
- **FK:** `requirement_id` → `game_requirements.requirement_id`
- **Unique:** `uq_requirement_hardware_type (requirement_id, hardware_type)` — required by the resolver's `INSERT … ON DUPLICATE KEY UPDATE` at `resolve-game-benchmarks.php:121-126`

> The `alias` enum value is **never written by any code**. A grep across the project finds it only in `mysql-schema.sql:118`.

**Used by:** written by `resolve-game-benchmarks.php`, read by `get-games.php`.


### 5.4 `cpu_benchmarks` — lines 19–32

| Column | Type | Notes |
|---|---|---|
| `cpu_id` | `BIGINT UNSIGNED AUTO_INCREMENT` | **PK** |
| `model` | `VARCHAR(255) NOT NULL` | `UNIQUE uq_cpu_model` |
| `normalized_model` | `VARCHAR(255) NOT NULL` | `INDEX`; produced by `normalizeBenchmarkName()` |
| `score` | `INT UNSIGNED NOT NULL` | `INDEX idx_cpu_score` — the PassMark-style `cpuMark` |
| `cores` | `TINYINT UNSIGNED NULL` | |
| `category` | `VARCHAR(50) NULL` | only `'Desktop'` rows returned by `get-cpus.php` |
| `source_version` | `VARCHAR(100) NULL` | `'CPU-benchmarks-v4'` (import) or `'admin'` (manual) |

**Used by:** `import-benchmarks.php` (bulk writer), `update-cpus.php` (manual writer), `get-cpus.php` (reader), `resolve-game-benchmarks.php::resolveDatabaseModel()` (matched against).

### 5.5 `gpu_benchmarks` — lines 34–48

| Column | Type | Notes |
|---|---|---|
| `gpu_id` | `BIGINT UNSIGNED AUTO_INCREMENT` | **PK** |
| `model` | `VARCHAR(255) NOT NULL` | `UNIQUE uq_gpu_model` |
| `normalized_model` | `VARCHAR(255) NOT NULL` | `INDEX` |
| `score` | `INT UNSIGNED NOT NULL` | `INDEX idx_gpu_score` — the `G3Dmark` column |
| `g2d_score` | `INT UNSIGNED NULL` | `G2Dmark` |
| `tdp` | `SMALLINT UNSIGNED NULL` | |
| `category` | `VARCHAR(50) NULL` | only `'Desktop'` returned by `get-gpus.php` |
| `source_version` | `VARCHAR(100) NULL` | `'GPU-benchmarks-v7'` or `'admin'` |

**Used by:** `import-benchmarks.php`, `update-gpus.php`, `get-gpus.php`, `resolve-game-benchmarks.php`.

### 5.6 `ram_benchmarks` — lines 50–60

| Column | Type | Notes |
|---|---|---|
| `ram_id` | `BIGINT UNSIGNED AUTO_INCREMENT` | **PK** |
| `capacity_gb` | `SMALLINT UNSIGNED NOT NULL` | part of unique key |
| `speed_mhz` | `SMALLINT UNSIGNED NOT NULL` | part of unique key |
| `score` | `INT UNSIGNED NOT NULL` | |
| `source_version` | `VARCHAR(100) NULL` | `'RAM-benchmarks'` or `'admin'` |

- **Unique:** `uq_ram_configuration (capacity_gb, speed_mhz)`
- `INDEX idx_ram_capacity (capacity_gb)`

**Source file `DATA/RAM-benchmarks.csv` contains only 6 rows:**

| capacity_gb | speed_mhz | score |
|---|---|---|
| 2 | 1600 | 1700 |
| 4 | 2200 | 2200 |
| 8 | 3200 | 2800 |
| 16 | 3200 | 4000 |
| 32 | 3600 | 6000 |
| 64 | 3600 | 7500 |

**Consequence:** any game requiring **12 GB or 24 GB**, or any user picking a capacity outside `{4,8,16,32,64}`, cannot get a match. The frontend dropdown is hard-coded to `[4, 8, 16, 32, 64]` (`UserSideFunction.js:112`).

### 5.7 `sync_jobs` — lines 140–155

| Column | Type | Notes |
|---|---|---|
| `job_id` | `BIGINT UNSIGNED AUTO_INCREMENT` | **PK** |
| `game_id` | `BIGINT UNSIGNED NULL` | **FK → `games`**, `ON DELETE CASCADE` |
| `job_type` | `ENUM('rawg_metadata','steam_requirements','benchmark_resolution')` | |
| `status` | `ENUM('queued','running','complete','failed')` default `'queued'` | `INDEX idx_sync_jobs_status (status, run_after)` |
| `attempts` | `TINYINT UNSIGNED NOT NULL DEFAULT 0` | incremented on claim |
| `run_after` | `DATETIME NULL` | used for backoff |
| `last_error` | `TEXT NULL` | set when `status='failed'` |
| `created_at`, `updated_at` | `TIMESTAMP` | |

**Producers of rows:**
- `update-games.php:450-469` — `benchmark_resolution`, on every add *and* edit
- `enrich-games.php:45-49` — `benchmark_resolution`, after Steam metadata
- `import-rawg-catalog.php:23-27` — `rawg_metadata`, **with a `NOT EXISTS` dedup guard**

**Consumer:** `resolve-game-benchmarks.php` (CLI only).

> **Inconsistency:** `update-games.php` has **no dedup guard**, so every edit adds another queued row, while `import-rawg-catalog.php` does guard against this.


### 5.8 `game_sync_state` — lines 128–138

| Column | Type | Notes |
|---|---|---|
| `sync_id` | `BIGINT UNSIGNED AUTO_INCREMENT` | **PK** |
| `source` | `ENUM('rawg','steam','benchmarks')` | |
| `sync_scope` | `VARCHAR(100) NOT NULL` | |
| `last_cursor` | `VARCHAR(255) NULL` | RAWG page number |
| `last_success_at`, `next_run_at` | `DATETIME NULL` | |
| `last_error` | `TEXT NULL` | |

**Unique:** `uq_sync_source_scope (source, sync_scope)`.

**Used by:** `import-rawg-catalog.php` lines 26–37 (reads `last_cursor`, writes it back after each page). Currently the only consumer. The `benchmarks` enum value is never used, and **no code reads `next_run_at`** — nothing schedules work from it.

### 5.9 `site_feedback` — ⚠️ **NO SCHEMA IN ANY PROJECT FILE**

Columns are **inferred from queries only**:

| Column | Evidence |
|---|---|
| `feedback_id` | PK; `lastInsertId()` in `submit-feedback.php` |
| `rating` | integer 1–5, validated at `submit-feedback.php:27-30` |
| `feedback_title` | max 150 chars (line 34) |
| `comment` | text |
| `display_name` | string or NULL when anonymous |
| `is_anonymous` | 0/1, computed server-side |
| `helpful_count` | incremented by `helpful-feedback.php` |
| `reported_count` | incremented by `report-feedback.php` |
| `is_approved` | always 1 on insert; filtered `= 1` on every read |
| `created_at` | used for ordering |

**Exact SQL types are NOT VERIFIED FROM SOURCE** — the DDL does not exist in `mysql-schema.sql`, `gamespec_export.sql`, or anywhere else in the project. A fresh install must create this table out-of-band.

**Used by (7 files):** `submit-feedback.php`, `get-feedback.php`, `get-latest-feedback.php`, `helpful-feedback.php`, `report-feedback.php`, `delete-feedback.php`, and `feedback-management.php:45` (comment only).

### 5.10 `users` — line 4, `-- NOT YET APPLIED`

Columns: `user_id` PK, `username` (UNIQUE), `email` (UNIQUE), `password_hash`, `display_name`, `role ENUM('user','admin')`, `status ENUM('active','disabled','pending')`, `last_login_at`, timestamps.

**Grep confirms no `.php`, `.js`, or `.py` file references `users`.** No login exists — this table is dead schema.

### 5.11 `reviews` — line 157, `-- NOT YET APPLIED`

Columns: `review_id` PK, `user_id` FK→`users` CASCADE, `game_id` FK→`games` CASCADE, `rating` with `CHECK (rating BETWEEN 1 AND 5)`, `review_title`, `comment`, `helpful_count`, `reported_count`, `is_anonymous`, `is_approved`, timestamps.

**Grep confirms no code references `reviews`.** Feedback lives entirely in `site_feedback`. This table is dead schema. Its FKs would cascade on game delete, but since nothing writes to it there is no observable effect.

---

## 6. `match_status` semantics

`ENUM('exact','alias','nearest','estimated','unresolved')`, default `'unresolved'` (`mysql-schema.sql:118`).

| Value | Set by | Meaning |
|---|---|---|
| `exact` | `resolveDatabaseModel()` line 40; `resolveDatabaseRam()` line 96 | `normalized_model` matched exactly (`WHERE normalized_model = :normalized`), or RAM capacity+speed matched exactly |
| `nearest` | `resolveDatabaseModel()` line 72; `resolveDatabaseRam()` line 103 | Token-coverage fuzzy match (CPU/GPU), or RAM matched by nearest speed when a speed *was* supplied |
| `estimated` | `resolveDatabaseRam()` line 103 | RAM matched on capacity only because `speed_mhz` was 0 / not given |
| `unresolved` | lines 83, 89, 104 | No match; `benchmark_score` is NULL |
| `alias` | **never written** | Appears only in the schema definition |

**What actually matters is `benchmark_score IS NOT NULL`, not the status string.** The visibility gate at lines 128–142 only checks for non-NULL scores. So `estimated` and `nearest` are fully acceptable; `unresolved` is not.

---

## 7. Schema inconsistencies summary

| # | Inconsistency | Evidence |
|---|---|---|
| 1 | `site_feedback` used by 7 files, **no DDL anywhere** | `submit-feedback.php` etc. vs `mysql-schema.sql` |
| 2 | `rawg_id NOT NULL` but `update-games.php` omits it and claims it "remains NULL" | `mysql-schema.sql:64` vs `update-games.php:355-377` |
| 3 | `users` + `reviews` defined but never used | `mysql-schema.sql:4,157` vs whole codebase |
| 4 | `match_status` includes `alias`, never written | `mysql-schema.sql:118` vs resolver |
| 5 | `update-games.php` queues without dedup; `import-rawg-catalog.php` dedups | `update-games.php:450` vs `import-rawg-catalog.php:23-27` |
| 6 | Dump `gamespec_export.sql` contains **zero** `source='admin'` requirement rows — no manual game is represented in it | verified by scanning the dump |
| 7 | `DATA/game-requirements.csv` exists with a different column set (`game_title, game_cpu_model, … hasBloom …`) and is read by **no PHP/JS/Python file** | grep for `game-requirements.csv` matches only `AdminSideFunction.js:658` inside a **fake** log string |
| 8 | `game_sync_state.next_run_at` column exists, no reader | `mysql-schema.sql:134` vs all PHP |

---


## 8. "Which table holds X?" — quick answers

| Question | Answer |
|---|---|
| Which table stores games? | `games` |
| Which table stores CPU data? | `cpu_benchmarks` |
| Which table stores GPU data? | `gpu_benchmarks` |
| Which table stores RAM data? | `ram_benchmarks` |
| Which table stores requirements? | `game_requirements` |
| Which table stores benchmark matches? | `game_benchmark_matches` |
| Which table stores predictions/results? | **None.** Predictions are never persisted. |
| Which table stores ML training data? | **None.** It is `DATA/benchmark-data.csv`. |
| Which table stores feedback? | `site_feedback` (no DDL in project) |
| Which table stores the job queue? | `sync_jobs` |
| Which table stores external-import cursors? | `game_sync_state` |
| Which table stores users/sessions? | **None in use.** `users` is dead schema. |

---

## 9. Verification queries (read-only)

Run these once MySQL is running.

```sql
-- Confirm the table list matches expectations
SHOW TABLES;

-- Resolve contradiction C1: what does the LIVE games table actually say?
SHOW CREATE TABLE games\G

-- Confirm site_feedback exists at all
SHOW CREATE TABLE site_feedback\G

-- Count rows per table
SELECT (SELECT COUNT(*) FROM games)                AS games,
       (SELECT COUNT(*) FROM game_requirements)    AS requirements,
       (SELECT COUNT(*) FROM game_benchmark_matches) AS matches,
       (SELECT COUNT(*) FROM cpu_benchmarks)       AS cpus,
       (SELECT COUNT(*) FROM gpu_benchmarks)       AS gpus,
       (SELECT COUNT(*) FROM ram_benchmarks)       AS ram,
       (SELECT COUNT(*) FROM site_feedback)        AS feedback;

-- Queue health
SELECT status, COUNT(*) FROM sync_jobs GROUP BY status;

-- Requirement sources: do manual games exist yet?
SELECT source, COUNT(*) FROM game_requirements GROUP BY source;

-- Resolution health: how many matches actually have a score?
SELECT match_status,
       COUNT(*)                              AS total,
       SUM(benchmark_score IS NOT NULL)      AS with_score
FROM game_benchmark_matches
GROUP BY match_status;

-- Visibility gate: which games are hidden and why?
SELECT g.game_id, g.title, g.is_active,
       SUM(m.benchmark_score IS NOT NULL) AS resolved_of_3
FROM games g
LEFT JOIN game_requirements r ON r.game_id = g.game_id AND r.requirement_type='minimum'
LEFT JOIN game_benchmark_matches m ON m.requirement_id = r.requirement_id
GROUP BY g.game_id, g.title, g.is_active
ORDER BY g.is_active, resolved_of_3;

-- Which games are visible to users (this is what get-games.php returns)?
SELECT game_id, title FROM games WHERE is_active = 1 ORDER BY title;
```

**None of the above modify data.** They are all `SELECT` / `SHOW`.

