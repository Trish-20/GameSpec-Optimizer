# 16 — Troubleshooting

Common operational errors, edge cases, root causes, and verified fixes for GameSpec Optimizer.

---

## 1. Fast Diagnostic Matrix

| Symptom / Error Message | Root Cause | Exact Resolution |
|---|---|---|
| **Newly added game does not appear in user list or dropdowns** | Game failed the Visibility Gate (`is_active = 0`) because benchmark scores for minimum CPU, GPU, or RAM are `NULL`. | Run `php MODULES/resolve-game-benchmarks.php` from CLI. If still inactive, check `game_benchmark_matches` to see which requirement failed token matching. |
| **"Missing or invalid field: game_cpu_min"** (on FPS Prediction) | The selected game has `NULL` for its minimum CPU benchmark score. | Run `resolve-game-benchmarks.php`. Ensure the CPU text in `game_requirements` contains recognizable tokens matching `cpu_benchmarks`. |
| **"Python prediction process failed"** | Virtual environment is missing or lacks required Python libraries. | Run `pip install -r requirements.txt` inside the `.venv` folder. Ensure `.venv\Scripts\python.exe` exists. |
| **"Models not found. Please run ml-training.py first."** | One or more `.joblib` files are missing from `MODULES/`. | Run `python MODULES/ml-training.py` to regenerate `gb_model.joblib`, `xgb_model.joblib`, and `feature_columns.joblib`. |
| **"Failed to detect hardware"** (Auto-Detect button fails) | Running on Linux/macOS, or Python lacks access to Windows WMIC / `kernel32.dll`. | Ensure Apache is running locally on Windows. Alternatively, select hardware manually from the searchable dropdowns. |
| **"No benchmark score is available for N GB RAM"** | Selected RAM capacity is not listed in `ram_benchmarks`. | Insert standard capacities into `ram_benchmarks` (e.g. 4, 8, 16, 32, 64 GB). |
| **"Invalid response from ML model"** | Python printed non-JSON diagnostic text or warnings to `stdout` before JSON output. | Check Python warnings (e.g., scikit-learn version mismatches). Silence warnings or align library versions. |
| **Admin page buttons say "Save CPU" on GPU/RAM forms** | Mislabeled button text in `hardware-management.php`. | Cosmetic bug only; the forms submit correctly to `update-gpus.php` and `update-ram.php`. |
| **Feedback submission returns 500 error** | `site_feedback` table does not exist in MySQL. | Run the `CREATE TABLE site_feedback` DDL provided in `02-Database-Structure.md` or `09-Feedback-System.md`. |

---

## 2. Debugging the Benchmark Resolver

If `php resolve-game-benchmarks.php` completes but games remain inactive:

1. **Check job status in MySQL:**
   ```sql
   SELECT job_id, game_id, status, error_message, attempts 
   FROM sync_jobs 
   WHERE status != 'completed';
   ```
2. **Inspect raw match attempts:**
   ```sql
   SELECT requirement_id, hardware_type, required_text, matched_model, benchmark_score, match_status
   FROM game_benchmark_matches
   WHERE match_status = 'unresolved';
   ```
3. **Common String Matching Issues:**
   - Overly complex requirement strings: `"Intel Core i5-8400 or AMD Ryzen 5 2600 (AVX required)"`.
   - The token parser may get confused by parenthetical remarks or secondary requirements.
   - Edit the game in Admin Panel to use simplified model names (e.g. `"Intel Core i5-8400 / AMD Ryzen 5 2600"`).

---

## 3. Python ML Inference Debugging

Test the inference pipeline directly from PowerShell to observe stderr output:

```powershell
cd C:\xampp\htdocs\New\GameSpec-Optimizer\MODULES

# Run with sample payload
..\.venv\Scripts\python.exe ml-predict.py "{\"game_cpu_min\":10000,\"game_gpu_min\":8000,\"game_ram_min\":2000,\"cpu_score\":12000,\"gpu_score\":9500,\"ram_score\":4000,\"res_width\":1920,\"res_height\":1080,\"graphics_preset\":\"Medium\",\"shadow_quality\":\"Medium\",\"texture_quality\":\"Medium\",\"anti_aliasing\":\"Off\",\"vsync\":\"Off\",\"performance_mode\":0}"
```

If this prints JSON with `"success": true`, the ML layer is fully functional, and any web-layer failure stems from the PHP `proc_open` bridge or JSON encoding in `hardware-specs-input.php`.
