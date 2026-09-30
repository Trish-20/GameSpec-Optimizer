# 14 — Verification & Auditing

A collection of non-destructive SQL queries, CLI commands, and test scripts to inspect, audit, and verify the integrity of the GameSpec Optimizer system.

---

## 1. Database Health Check (Read-Only SQL)

Execute in MySQL Workbench, phpMyAdmin, or MySQL CLI:

```sql
-- 1. Check Row Counts Across Core Tables
SELECT 'games' AS table_name, COUNT(*) AS count FROM games
UNION ALL
SELECT 'game_requirements', COUNT(*) FROM game_requirements
UNION ALL
SELECT 'game_benchmark_matches', COUNT(*) FROM game_benchmark_matches
UNION ALL
SELECT 'cpu_benchmarks', COUNT(*) FROM cpu_benchmarks
UNION ALL
SELECT 'gpu_benchmarks', COUNT(*) FROM gpu_benchmarks
UNION ALL
SELECT 'ram_benchmarks', COUNT(*) FROM ram_benchmarks
UNION ALL
SELECT 'sync_jobs', COUNT(*) FROM sync_jobs
UNION ALL
SELECT 'site_feedback', COUNT(*) FROM site_feedback;

-- 2. Audit Game Visibility Gate (Active vs Inactive Breakdown)
SELECT 
    is_active,
    COUNT(*) AS total_games,
    SUM(CASE WHEN min_matches = 3 THEN 1 ELSE 0 END) AS fully_resolved_games,
    SUM(CASE WHEN min_matches < 3 THEN 1 ELSE 0 END) AS unpredicted_games
FROM (
    SELECT 
        g.game_id, 
        g.is_active,
        COUNT(DISTINCT CASE WHEN m.benchmark_score IS NOT NULL THEN m.hardware_type END) AS min_matches
    FROM games g
    LEFT JOIN game_requirements r ON r.game_id = g.game_id AND r.requirement_type = 'minimum'
    LEFT JOIN game_benchmark_matches m ON m.requirement_id = r.requirement_id
    GROUP BY g.game_id, g.is_active
) AS gate_summary
GROUP BY is_active;

-- 3. Check Pending or Failed Sync Queue Jobs
SELECT job_type, status, COUNT(*) AS count
FROM sync_jobs
GROUP BY job_type, status;

-- 4. Check Unresolved Minimum Requirements
SELECT g.title, m.hardware_type, m.required_text, m.match_status
FROM game_benchmark_matches m
JOIN game_requirements r ON r.requirement_id = m.requirement_id
JOIN games g ON g.game_id = r.game_id
WHERE r.requirement_type = 'minimum' AND m.benchmark_score IS NULL;
```

---

## 2. CLI Environment & ML Verification

Run directly from Windows PowerShell or CMD:

```powershell
# 1. Verify Python Virtual Environment & Installed ML Packages
cd C:\xampp\htdocs\New\GameSpec-Optimizer\MODULES
..\.venv\Scripts\python.exe -m pip list | findstr "scikit-learn xgboost joblib pandas"

# 2. Check Integrity of Serialized Models
..\.venv\Scripts\python.exe -c "
import joblib
gb = joblib.load('gb_model.joblib')
xgb = joblib.load('xgb_model.joblib')
cols = joblib.load('feature_columns.joblib')
print('GB Features:', gb.n_features_in_)
print('Columns count:', len(cols))
print('Columns:', cols)
"

# 3. Direct Test of ML Predictor (Bypassing PHP Layer)
..\.venv\Scripts\python.exe ml-predict.py "{\"game_cpu_min\":14200,\"game_gpu_min\":9000,\"game_ram_min\":2500,\"cpu_score\":19700,\"gpu_score\":17500,\"ram_score\":4000,\"res_width\":1920,\"res_height\":1080,\"graphics_preset\":\"High\",\"shadow_quality\":\"High\",\"texture_quality\":\"High\",\"anti_aliasing\":\"TAA\",\"vsync\":\"Off\",\"performance_mode\":0}"

# 4. Direct Test of Hardware Auto-Detection
..\.venv\Scripts\python.exe detect-hardware.py
```

---

## 3. Web API Smoke Tests

Using `curl` or VS Code REST Client (`MODULES/api/test.http`):

```bash
# Test Games Catalog API
curl -s "http://localhost:8080/GameSpec-Optimizer/MODULES/api/get-games.php" | findstr "success"

# Test CPU Benchmarks API
curl -s "http://localhost:8080/GameSpec-Optimizer/MODULES/api/get-cpus.php" | head -n 20

# Test Feedback Retrieval API
curl -s "http://localhost:8080/GameSpec-Optimizer/MODULES/api/get-latest-feedback.php"
```
