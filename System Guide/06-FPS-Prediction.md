# 06 — FPS Prediction

Prediction is **on-demand, stateless, and hybrid**: an ML model produces the FPS number, while simple comparisons produce the "can your PC run it" verdict.

---

## 1. Complete flow diagram

```
fps-prediction.php
  │
  ├─ loadFPSPredictionDropdowns()   UserSideFunction.js:97
  │     Promise.all([ loadGamesFromCSV()   :43  → GET get-games.php
  │                    loadCPUsFromCSV()    :59  → GET get-cpus.php
  │                    loadGPUsFromCSV()    :70  → GET get-gpus.php
  │                    loadRAMBenchmarks()  :81  → GET get-ram.php ])
  │     initSearchDropdown('game', games, g=>g.title, g=>g.title_raw)  :107
  │     initSearchDropdown('cpu',  cpus,  c=>c.model, c=>c.score)      :108  ← VALUE = SCORE
  │     initSearchDropdown('gpu',  gpus,  g=>g.model, g=>g.score)      :109  ← VALUE = SCORE
  │     ramData built from [4,8,16,32,64]                              :111-121
  │     graphicsQuality / performanceMode dropdowns                    :122-131
  │
  ├─ User clicks Predict → predictFPS()  :2394
  │      validate selections        :2404-2418
  │      resolve RAM score          :2411-2418
  │      find selected game         :2423
  │      build payload              :2441-2457
  │
  ├─ POST ../../../MODULES/hardware-specs-input.php   :2463
  │        │
  │        ├─ validate 6 numeric fields        hardware-specs-input.php:24-31
  │        ├─ apply defaults                   :34-41
  │        ├─ proc_open('.venv/Scripts/python.exe ml-predict.py')  :42,54
  │        ├─ fwrite(stdin, json)              :61
  │        ├─ read stdout / stderr             :63-69
  │        ├─ exit != 0 → error JSON           :73-81
  │        └─ echo json_decode(stdout)         :85-94
  │              │
  │              └─► ml-predict.py::predict_fps()
  │                    joblib.load(gb_model.joblib)          :49
  │                    joblib.load(xgb_model.joblib)         :50
  │                    joblib.load(feature_columns.joblib)   :51
  │                    compute ratios + total_pixels         :59-62
  │                    build 16-column DataFrame             :65-85
  │                    (gb_pred + xgb_pred) / 2              :88-90
  │                    ±5% performance mode                  :93-97
  │                    clamp to [1, 500]                     :100
  │                    print(json) → stdout
  │
  ├─ read result                                   :2471-2478
  ├─ CPU/GPU/RAM pass-fail (rule-based)            :2481-2483
  ├─ render FPS card + bottlenecks + bar chart     :2490-2600
  └─ recordPredictionHistory()                     :2869  (localStorage, last 8)
```

---

## 2. Inputs — every field sent

Built at `UserSideFunction.js:2441-2457`:

```js
const payload = {
    game_title:        selectedGame.title_raw || selectedGame.title || game,
    game_cpu_min:      parseInt(selectedGame.cpu_benchmark, 10),
    game_gpu_min:      parseInt(selectedGame.gpu_benchmark, 10),
    game_ram_min:      parseInt(selectedGame.ram_benchmark, 10),
    cpu_score:         cpuScoreNum,
    gpu_score:         gpuScoreNum,
    ram_score:         ramScoreNum,
    res_width:         1920,
    res_height:        1080,
    graphics_preset:   presetMap[quality] || 'Medium',
    shadow_quality:    presetMap[quality] || 'Medium',
    texture_quality:   presetMap[quality] || 'Medium',
    anti_aliasing:     antiAliasMap[quality] || 'Off',
    vsync:             'Off',
    performance_mode:  performanceMode
};
```

### Where each value comes from

| Field | Origin | Notes |
|---|---|---|
| `game_title` | `games.slug` (via `title_raw`) | **Not used by the model** — dropped during training |
| `game_cpu_min` | `game_benchmark_matches.benchmark_score`, `hardware_type='cpu'` | ← **requires benchmark resolution** |
| `game_gpu_min` | same, `hardware_type='gpu'` | ← **requires benchmark resolution** |
| `game_gpu_min` / `game_ram_min` | same pattern | ← **requires benchmark resolution** |
| `cpu_score` | `#cpuSelect` hidden input | **the dropdown's value is the score** (line 108) |
| `gpu_score` | `#gpuSelect` | value = score (line 109) |
| `ram_score` | looked up live from `ramBenchmarks` | lines 2411–2415: filter by capacity, sort ascending, **take `[0]`** — the lowest score for that capacity |
| `res_width` / `res_height` | **hard-coded `1920` / `1080`** | lines 2449–2450. There is no resolution control in the UI. |
| `graphics_preset` | `#graphicsQuality` ∈ {low, medium, high} | `presetMap` line 2429 — **no `ultra` option offered** |
| `shadow_quality` | **same dropdown** as preset | line 2452 |
| `texture_quality` | **same dropdown** as preset | line 2453 |
| `anti_aliasing` | derived from quality | line 2435: low→`Off`, medium→`FXAA`, high→`TAA` |
| `vsync` | **hard-coded `'Off'`** | line 2455 |
| `performance_mode` | `#performanceMode` ∈ {battery, balanced, performance} | line 2456 |

> **Notable:** `shadow_quality` and `texture_quality` are always identical to `graphics_preset`, and `vsync` is always `Off`. In practice the model sees **one** quality knob, not three independent ones.

### Guard clauses (lines 2404–2424)

```js
if (!cpuScore)        return showModal('Warning', 'Please select a CPU.');
if (!gpuScore)        return showModal('Warning', 'Please select a GPU.');
if (!ramSelect.value) return showModal('Warning', 'Please select RAM.');
...
if (!Number.isFinite(ramScoreNum))
    return showModal('Warning', `No benchmark score is available for ${ramGB} GB RAM.`);
...
const selectedGame = games.find(g => g.title_raw === game);
if (!selectedGame)    return showModal('Error', 'Game not found.');
```

---

## 3. The PHP bridge — `hardware-specs-input.php`

Note: it is **not** inside `api/` — it sits at `MODULES/hardware-specs-input.php`, which is why the JS path is `../../../MODULES/hardware-specs-input.php` (three levels up from `FRONT-END/HTML/User Side/`).

| Lines | Behaviour |
|---|---|
| 11–18 | Reads JSON from `php://input` |
| 24–31 | Requires **numeric** `game_cpu_min, game_gpu_min, game_ram_min, cpu_score, gpu_score, ram_score` → otherwise `"Missing or invalid field: <name>"` |
| 34–41 | Defaults: `1920×1080`, preset/shadow/texture `Medium`, AA `Off`, vsync `Off`, performance `balanced` |
| 39 | `$pythonCmd = __DIR__ . '/../.venv/Scripts/python.exe'` |
| 42 | `$command = $pythonCmd . ' ' . escapeshellarg($scriptPath)` |
| 54 | `proc_open($command, $descriptors, $pipes, __DIR__)` — **cwd is `MODULES/`** |
| 61–63 | `fwrite($pipes[0], json_encode($inputs))` then close stdin — JSON arrives via **stdin**, not argv |
| 65–69 | Reads stdout and stderr separately |
| 71–81 | `proc_close()`; non-zero exit → `{"success":false,"message":"Python prediction process failed","exit_code":…,"stderr":…}` |
| 85–94 | `json_decode(stdout)`; `null` → `{"success":false,"message":"Invalid response from ML model","raw_output":…,"stderr":…}` |

> ⚠️ **No interpreter fallback here.** Line 39 hard-codes `.venv/Scripts/python.exe`. Compare `get-hardware.php:11-14`, which *does* fall back to `python`/`python3` on the PATH. **Prediction breaks entirely if the venv is missing, while hardware detection still works.** This asymmetry is a common source of confusion.

Resolved path: `GameSpec-Optimizer/.venv/Scripts/python.exe`.

---

## 4. The Python model — `ml-predict.py`

### 4.1 Loading (lines 46–51)

```python
script_dir = os.path.dirname(os.path.abspath(__file__))
gb_model        = joblib.load(os.path.join(script_dir, 'gb_model.joblib'))
xgb_model       = joblib.load(os.path.join(script_dir, 'xgb_model.joblib'))
feature_columns = joblib.load(os.path.join(script_dir, 'feature_columns.joblib'))
```

Paths resolve **relative to the script file**, so the working directory does not matter for loading the models.

### 4.2 Categorical mapping (lines 54–56, 72–77)

```python
preset_map = {'Low': 0, 'Medium': 1, 'High': 2, 'Ultra': 3}
aa_map     = {'Off': 0, 'FXAA': 1, 'TAA': 2}
vsync_map  = {'On': 1, 'Off': 0}
```

Unknown values fall back to `Medium` (index 1) / `Off` (0).

### 4.3 Engineered features (lines 59–62)

```python
cpu_ratio  = input_data['cpu_score']  / input_data['game_cpu_min']
gpu_ratio  = input_data['gpu_score']  / input_data['game_gpu_min']
ram_ratio  = input_data['ram_score']  / input_data['game_ram_min']
total_pixels = input_data['res_width'] * input_data['res_height']
```

> ⚠️ **Division-by-zero risk.** If a score were `0` rather than `NULL`, this raises `ZeroDivisionError`. PHP requires *numeric*, not *positive*, values, so `0` would reach Python. Benchmark scores come from CSVs where an empty cell becomes `0`.

### 4.4 Feature row assembly (lines 65–85)

```python
feature_array = pd.DataFrame(
    [[features[col] for col in feature_columns]],
    columns=feature_columns)
```

**Column order comes from `feature_columns.joblib`**, not from the dict — this prevents silent feature misalignment between training and inference.

The 16 features, in saved order (verified by loading the `.joblib`):

```
 1. game_cpu_min        5. cpu_score         9. texture_quality   13. cpu_ratio
 2. game_gpu_min        6. gpu_score        10. anti_aliasing     14. gpu_ratio
 3. game_ram_min        7. graphics_preset  11. vsync             15. ram_ratio
 4. game_cpu_min*       8. shadow_quality   12. performance_mode  16. total_pixels
```

*(printed exactly as: `game_cpu_min, game_gpu_min, game_ram_min, cpu_score, gpu_score, ram_score, graphics_preset, shadow_quality, texture_quality, anti_aliasing, vsync, performance_mode, cpu_ratio, gpu_ratio, ram_ratio, total_pixels`)*

---

### 4.5 The math (lines 87–100)

```python
gb_pred  = gb_model.predict(feature_array)[0]    # GradientBoostingRegressor
xgb_pred = xgb_model.predict(feature_array)[0]   # XGBRegressor
predicted_fps = (gb_pred + xgb_pred) / 2         # simple equal-weight average

performance_mode = normalize_performance_mode(input_data.get('performance_mode', 0))
if performance_mode == 1:
    predicted_fps *= 1.05        # 'performance'  → +5%
elif performance_mode == -1:
    predicted_fps *= 0.95        # 'battery'      → −5%

predicted_fps = max(1, min(predicted_fps, 500))  # clamp to [1, 500]
```

> ⚠️ **CONTRADICTION C4.** The comment on line 95 says `# +15%`, but the code applies **×1.05 (±5%)**. The comment is wrong; the code is what runs.

### 4.6 Output (lines 102–111)

```json
{
  "success": true,
  "predicted_fps": 68.4,
  "performance_mode": 0,
  "hardware_ratios": { "cpu": 1.39, "gpu": 1.94, "ram": 1.43 }
}
```

`hardware_ratios` is **returned but never displayed** — `predictFPS()` reads only `result.success` and `result.predicted_fps` (lines 2473–2478).

### 4.7 Error paths (lines 113–143)

| Exception | Response |
|---|---|
| `FileNotFoundError` (a `.joblib` missing) | `{"success":false,"error":"Models not found. Please run ml-training.py first.","detail":…}` |
| Any other exception | `{"success":false,"error":"<message>"}` |
| `json.JSONDecodeError` on input (line 136) | `{"success":false,"error":"Invalid JSON input","detail":…}` |

---

## 5. Is the prediction ML, rules, or hybrid?

**Hybrid, with a clear separation.**

| Output | How it is produced |
|---|---|
| **The FPS number** | **ML** — `(gb_pred + xgb_pred) / 2` |
| Performance-mode adjustment | Deterministic arithmetic (±5%) applied *after* the model |
| Clamp to [1, 500] | Deterministic |
| "Meets requirement" bars | **Rules** — `UserSideFunction.js:2481-2483` |
| Bottleneck list | **Rules** — rendered only when `estimatedFPS < 45` (line 2523) |
| Good / Playable / Low label | **Rules** — thresholds 75 and 45 (lines 2491–2498) |
| Summary sentence | **Rules** — same thresholds (lines 2494–2504) |

The rule-based part, verbatim:

```js
const cpuOK = cpuScoreNum >= selectedGame.cpu_benchmark;
const gpuOK = gpuScoreNum >= selectedGame.gpu_benchmark;
const ramOK = selectedGame.ram_benchmark !== null && ramScoreNum >= selectedGame.ram_benchmark;

const bottlenecks = [];
if (!cpuOK) bottlenecks.push({ type:'CPU', name:cpuName, userScore:cpuScoreNum,
                               required:selectedGame.cpu_benchmark });
// …same for GPU and RAM
```

```js
if (estimatedFPS >= 75)      → 'fps-good' / "Excellent performance"
else if (estimatedFPS >= 45) → 'fps-ok'   / "Playable performance"
else                         → 'fps-bad'  / "Performance may be limited"
```

So: **the number is learned from data; the verdict is a threshold comparison.** They can disagree — a game may say *"Excellent performance"* while its bar chart shows the CPU *"Needs attention"*, because the model weighted the GPU while the bars check each part independently.

---

## 6. What is NOT stored

- **No database row** is written by prediction. There is no `predictions` table.
- `localStorage` keeps only the **last 8** entries for the history modal — `getPredictionHistoryKey()` (line 2751), `recordPredictionHistory()` (line 2869), capped with `history.slice(0, 8)` (line 2879).
- Nothing touches `site_feedback`, `game_benchmark_matches`, or `sync_jobs`.

---

## 7. Failure reference

| Symptom | Likely cause | Files to inspect |
|---|---|---|
| *"Missing or invalid field: game_cpu_min"* | `benchmark_score` NULL — resolver not run or match failed | `game_benchmark_matches`, `sync_jobs` |
| *"Models not found. Please run ml-training.py first."* | a `.joblib` is absent | `MODULES/*.joblib` |
| *"Failed to start Python prediction process"* | venv missing / not executable | `.venv/Scripts/python.exe` |
| *"Python prediction process failed"* + stderr | import error (sklearn/xgboost missing) | `requirements.txt`, `.venv` |
| *"Invalid response from ML model"* | Python emitted non-JSON (warnings/traceback) | `raw_output` in the response |
| *"Please select a CPU."* | detection failed to match DB, or blank selection | `#cpuSelect` value |
| *"No benchmark score is available for N GB RAM."* | capacity not in `ram_benchmarks` | `SELECT * FROM ram_benchmarks` |
| *"Game not found."* | `#selectedGame` empty / slug mismatch | `games.slug` vs `?game=` |
| FPS always ~1920×1080 behaviour | resolution is hard-coded | lines 2449–2450 |

More in `16-Troubleshooting.md`.

---

## 8. Verification (read-only)

```sql
-- The three numbers a game needs for prediction
SELECT g.game_id, g.title, g.is_active, m.hardware_type,
       m.required_text, m.matched_model, m.benchmark_score, m.match_status
FROM games g
JOIN game_requirements r ON r.game_id = g.game_id AND r.requirement_type='minimum'
LEFT JOIN game_benchmark_matches m ON m.requirement_id = r.requirement_id
WHERE g.title = '<title>'
ORDER BY m.hardware_type;

-- Games that CANNOT currently be predicted
SELECT g.game_id, g.title
FROM games g
LEFT JOIN game_requirements r ON r.game_id = g.game_id AND r.requirement_type='minimum'
LEFT JOIN game_benchmark_matches m ON m.requirement_id = r.requirement_id
GROUP BY g.game_id, g.title
HAVING COUNT(DISTINCT CASE WHEN m.benchmark_score IS NOT NULL
                           THEN m.hardware_type END) < 3;
```

To test the Python layer directly, bypassing PHP:

```bash
cd C:\xampp\htdocs\New\GameSpec-Optimizer\MODULES
.venv\Scripts\python.exe ml-predict.py "{\"game_cpu_min\":14200,\"game_gpu_min\":9000,\"game_ram_min\":2500,\"cpu_score\":19700,\"gpu_score\":17500,\"ram_score\":4000,\"res_width\":1920,\"res_height\":1080,\"graphics_preset\":\"High\",\"shadow_quality\":\"High\",\"texture_quality\":\"High\",\"anti_aliasing\":\"TAA\",\"vsync\":\"Off\",\"performance_mode\":0}"
```

Expected: one line of JSON with `"success": true` and a `predicted_fps` between 1 and 500.

