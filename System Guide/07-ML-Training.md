# 07 — ML Training

> **Two facts before anything else:**
>
> 1. The training script `MODULES/ml-training.py` is **real** and produces real models.
> 2. The **Admin "ML Training" page is not connected to it.** Its buttons are simulated. Nothing in the web application can train, generate, or export a model.

---

## 1. How training is actually triggered

**Manually, from a terminal:**

```bash
cd C:\xampp\htdocs\New\GameSpec-Optimizer\MODULES
.venv\Scripts\python.exe ml-training.py
```

There is:
- no PHP endpoint that runs it,
- no `exec()` / `proc_open()` referencing it anywhere,
- no `fetch()` in the admin training functions,
- no cron / Task Scheduler entry.

A grep for `ml-training` across all `.php`, `.js`, `.py` files matches **only** `ml-training.py` itself and two strings inside `ml-predict.py`'s error message.

---

## 2. The Admin page is simulated (CONTRADICTIONS C2 / C3)

`FRONT-END/HTML/Admin Side/ml-training.php` renders four buttons calling:

| Button | Function | `AdminSideFunction.js` | What it really does |
|---|---|---|---|
| Update Training Data | `updateTrainingData()` | 643–682 | Three `setTimeout`s printing hard-coded strings such as *"Scanning game-requirements.csv... 31 games found."* and *"All 31 games present in training data."* |
| Generate Training Data | `generateData()` | 712–720 | A 1000 ms timer printing *"Generated 6,000 training samples."* |
| Retrain Model | `retrainModel()` | 684–710 | A 2000 ms timer printing *"Training Voting Ensemble model..."*, *"Gradient Boosting: n_estimators=300"*, *"MAE: 10.94 \| MAPE: 13.91%"* |
| Export | `exportModel()` | 722–730 | A 500 ms timer printing *"Model exported to: MODULES/fps_model.pkl"* |

The tell-tale comments remain in the source:

```
AdminSideFunction.js:655   // Simulate checking (replace with actual API call)
AdminSideFunction.js:697   // Simulate training (replace with actual API call)
```

**There is no `fetch()` in any of these four functions and no PHP file they call.**

Three further contradictions:

- **C2:** `exportModel()` reports `MODULES/fps_model.pkl`. **That file does not exist in the project.** The real artifacts are `gb_model.joblib`, `xgb_model.joblib`, `feature_columns.joblib`.
- **C3:** the status card in `ml-training.php` lines 22–33 shows hard-coded values — `Voting Ensemble (GB + XGB)`, `Last Trained: --` (never populated), `Training Data: 6,000 rows`, `Model Accuracy (MAE): ~10.94`. None are read from disk or database.
- The log text claims it scanned `game-requirements.csv` — but that file is **never read by any PHP, JS or Python code** (the only textual match is this fake string).

---

## 3. `ml-training.py` — complete trace

### 3.1 Dataset loading (lines 10–21)

```python
script_dir = os.path.dirname(os.path.abspath(__file__))
dataset_path = os.path.join(script_dir, '..', 'DATA', 'benchmark-data.csv')

try:
    df = pd.read_csv(dataset_path)
except FileNotFoundError:
    print("Error: Dataset file not found. Please check the file path.")
    exit()
```

- **CSV only.** No database library, no `pd.read_sql`, no connection of any kind in this file.
- Path resolved relative to the script → the working directory does not matter.
- On a missing file it prints a message and calls `exit()` — no stack trace.

### 3.2 Preprocessing (lines 24–35)

```python
df['graphics_preset']  = df['graphics_preset'].map({'Low':0,'Medium':1,'High':2,'Ultra':3})
df['shadow_quality']   = df['shadow_quality'].map({'Low':0,'Medium':1,'High':2,'Ultra':3})
df['texture_quality']  = df['texture_quality'].map({'Low':0,'Medium':1,'High':2,'Ultra':3})
df['vsync']            = df['vsync'].map({'On':1,'Off':0})
df['anti_aliasing']    = df['anti_aliasing'].map({'Off':0,'FXAA':1,'TAA':2})
if 'performance_mode' in df.columns:
    if df['performance_mode'].dtype == object:
        performance_mode_map = {'battery':-1,'balanced':0,'performance':1}
        df['performance_mode'] = df['performance_mode'].map(performance_mode_map)
    df['performance_mode'] = pd.to_numeric(df['performance_mode'], errors='coerce').fillna(0).astype(int)
```

Notes:
- `performance_mode` is optional — guarded by `if 'performance_mode' in df.columns`.
- `.fillna(0)` means unparseable performance modes silently become `balanced`.
- Any category value not in the dictionaries becomes **`NaN`** (`.map()` has no default). A typo like lowercase `ultra` would yield `NaN` and later `NaN` features.
- The whole block sits in `try/except Exception` (line 51) which only **prints** `Error data conversion: <msg>` and continues — a preprocessing failure does not stop training, it silently corrupts features.

### 3.3 Feature engineering (lines 37–44)

```python
df['cpu_ratio'] = df['cpu_score'] / df['game_cpu_min']
df['gpu_ratio'] = df['gpu_score'] / df['game_gpu_min']
df['ram_ratio'] = df['ram_score'] / df['game_ram_min']
df['total_pixels'] = df['res_width'] * df['res_height']
```

These four are **derived identically at inference time** — the same formulas appear in `ml-predict.py:59-62`.

### 3.4 Dropping columns (lines 55–58)

```python
df = df.drop(columns=['game_title', 'res_width', 'res_height'], errors='ignore')
```

**`game_title` is dropped here.** This single line proves the model learns no per-game knowledge — and is the reason adding a game never requires retraining.

### 3.5 Target and features (lines 61–62)

```python
x = df.drop(columns=['expected_fps'])   # features
y = df['expected_fps']                  # target
```

**Target = `expected_fps`** — regression on frames per second.

### 3.6 Train/test split (line 65)

```python
x_train, x_test, y_train, y_test = train_test_split(x, y, test_size=0.2, random_state=44)
```

80 / 20 with `random_state = 44` → reproducible.

---
### 3.7 Models and hyperparameters (lines 71–88)

```python
gb_model = GradientBoostingRegressor(
    n_estimators=300,        # comment: "Optimal: avoids overfitting… 300 is over and 150 is under"
    max_depth=8,
    learning_rate=0.05,      # comment: "Optimal: balanced… 0.1 is dum, 0.03 is dum2"
    subsample=0.8,
    random_state=44)

xgb_model = XGBRegressor(
    n_estimators=400,
    max_depth=8,
    learning_rate=0.05,
    subsample=0.8,
    colsample_bytree=0.7,
    random_state=44,
    n_jobs=-1)
```

### 3.8 Training and ensembling (lines 91–97)

```python
gb_model.fit(x_train, y_train)
xgb_model.fit(x_train, y_train)

gb_pred  = gb_model.predict(x_test)
xgb_pred = xgb_model.predict(x_test)
y_pred   = (gb_pred + xgb_pred) / 2      # equal-weight average
```

The ensemble is **not** a fitted `VotingRegressor` — it is a plain arithmetic mean of two predictions, reproduced identically in `ml-predict.py:88-90`.

### 3.9 Evaluation (lines 101–116)

```python
cvs  = -cross_val_score(gb_model, x, y, cv=5,
                        scoring='neg_mean_absolute_error', n_jobs=-1)
mae  = mean_absolute_error(y_test, y_pred)
mse  = mean_squared_error(y_test, y_pred)
rmse = np.sqrt(mse)
r2   = r2_score(y_test, y_pred)
mape = np.mean(np.abs((y_test - y_pred) / y_test)) * 100
```

Printed: MAE, MSE, RMSE, R², MAPE, CV MAE, plus 10 sample predictions.

> **Note:** the 5-fold CV is computed on **GB only** — the comment at line 99 admits this (*"Use GB's CV as approximation"*). The reported CV MAE is **not** the ensemble's CV.

### 3.10 Saving (lines 128–137)

```python
model_dir = script_dir
joblib.dump(gb_model,        os.path.join(model_dir, 'gb_model.joblib'))
joblib.dump(xgb_model,       os.path.join(model_dir, 'xgb_model.joblib'))
joblib.dump(list(x.columns), os.path.join(model_dir, 'feature_columns.joblib'))
```

All three land in `MODULES/`, **overwriting whatever was there**.

---

## 4. The three model files

| File | Contents | Written by | Read by |
|---|---|---|---|
| `MODULES/gb_model.joblib` | `GradientBoostingRegressor` — verified `n_estimators=300`, `max_depth=8`, `n_features_in_=16` | `ml-training.py:130` | `ml-predict.py:49` |
| `MODULES/xgb_model.joblib` | `XGBRegressor` | `ml-training.py:131` | `ml-predict.py:50` |
| `MODULES/feature_columns.joblib` | Python `list` of the 16 column names, **in order** | `ml-training.py:132` | `ml-predict.py:51` |

**Verified by loading the shipped artifacts** — `feature_columns.joblib` contains exactly:

```
game_cpu_min, game_gpu_min, game_ram_min, cpu_score, gpu_score, ram_score,
graphics_preset, shadow_quality, texture_quality, anti_aliasing, vsync,
performance_mode, cpu_ratio, gpu_ratio, ram_ratio, total_pixels
```

and the shipped `gb_model.joblib` is a `GradientBoostingRegressor(n_estimators=300, max_depth=8)` with `n_features_in_ = 16`. **The saved models match `ml-training.py` exactly** — genuine outputs, not placeholders.

`feature_columns.joblib` is the contract between training and inference. If you add or rename a column during training, prediction must produce the same name or `ml-predict.py:85` raises `KeyError`.

---

## 5. Model versioning

**There is none.**

- No version table, no version column, no registry file.
- No timestamp anywhere. The admin card shows `Last Trained: --` permanently (`ml-training.php:29`).
- The three `.joblib` files are overwritten in place; the previous model is not kept.
- Nothing records which CSV revision produced a given model.
- `benchmark_source_version` tracks **benchmark data** provenance in `game_benchmark_matches`, **not** the model.

Practical implication: you cannot tell from the system whether the deployed model is 1 day or 1 year old, and you cannot roll back unless you kept your own copy.

---


## 6. `model-comparison.py`

A **standalone experiment script**, not part of the application.

- Trains and reports five models: `RandomForestRegressor` (n_estimators=700), `GradientBoostingRegressor` (n_estimators=200), `XGBRegressor`, `SVR(kernel='rbf')` with `StandardScaler`, and the Voting Ensemble (GB 300 + XGB 400).
- Prints MAE / RMSE / R² / MAPE / training time for each and declares a winner by lowest MAE.
- **It saves nothing.** There is no `joblib.dump()` anywhere in the file. Running it changes no artifact.
- ⚠️ **Path difference (C5):** it reads `pd.read_csv('../DATA/benchmark-data.csv')` — relative to the **current working directory**, unlike `ml-training.py` which anchors on `script_dir`. It only works if run from inside `MODULES/`.

Use it for research; ignore it for operations.

---

## 7. ⭐ WHEN DOES THE ML MODEL NEED TO BE RETRAINED?

Answered **only** from what the code does.

### 7.1 The underlying principle

The model is a regressor over **16 numeric features**: the game's three *required scores*, the user's three scores, six encoding slots, and four derived values. **Game identity is not a feature** — `game_title` is dropped at `ml-training.py:55-58`.

Therefore retraining is needed **only when the meaning, range, or definition of those 16 features changes** — not when *rows in MySQL* change.

### 7.2 Scenario-by-scenario

| Event | Retrain? | Why (from source) |
|---|---|---|
| **Adding a game** | **NO** | The new game enters prediction as three numbers supplied at inference time from `game_benchmark_matches`. The model has no per-game parameters; `game_title` is dropped in training. |
| **Adding a CPU** | **NO** | `cpu_benchmarks` rows feed (a) the user dropdown and (b) `resolveDatabaseModel()`. Neither is read by `ml-training.py`. A new CPU simply produces a new `cpu_score` input. |
| **Adding a GPU** | **NO** | Same, via `gpu_benchmarks`. |
| **Adding RAM** | **NO** | Same, via `ram_benchmarks`. Useful **only if** it lets a previously-`unresolved` requirement resolve — a *data* fix, not a model fix. |
| **Changing benchmark mappings** (re-running the resolver, different `match_status`) | **NO** | This changes what `game_cpu_min` etc. *contain*. The model accepts any numeric value of that kind. Prediction quality moves with data quality; the weights stay valid. |
| **Changing the training dataset** (`DATA/benchmark-data.csv`) | **YES** | It is the only thing the model is fitted on (`ml-training.py:11-14`). A new CSV has no effect until you re-run the script. |
| **Changing ML code / features / hyperparameters** (`ml-training.py`) | **YES** | New columns change `feature_columns.joblib`; new hyperparameters change the fitted trees. Re-run the script, otherwise training and inference disagree. |
| **Upgrading scikit-learn / xgboost** | **Likely YES — NOT VERIFIED FROM SOURCE** | `joblib.load` across library versions can fail or warn. `requirements.txt` pins `scikit-learn==1.9.0`, `xgboost==3.3.0`, `joblib==1.5.3`. Cross-version compatibility is not tested anywhere in this project. |

### 7.3 The caveat (model *quality*, not model *validity*)

The CSV covers **31 games**. A new game whose required scores fall far outside the training distribution gets an extrapolated prediction that may be less trustworthy.

This is a **dataset-coverage** concern, not a "you must retrain" requirement:

- Prediction **still works** — no code blocks it.
- Retraining **on the unchanged CSV would not help** — the CSV is never regenerated from MySQL.
- The only way to genuinely improve coverage is to **add new rows to `DATA/benchmark-data.csv` yourself** (by hand or with a script you write — **no such script exists in this project**) and then re-run `ml-training.py`.

### 7.4 Direct answer

> **Do I need to retrain after adding a game from the Admin panel?**
>
> **No.** Adding a game only writes `games`, `game_requirements`, and a `sync_jobs` row. It does not touch `DATA/benchmark-data.csv`, and it does not touch `MODULES/*.joblib`. Once the benchmark resolver has given the game scores, it is immediately usable for prediction.
>
> **What you *must* do instead:** run `php resolve-game-benchmarks.php` — see `05-Benchmark-Resolution.md`. That is the actual missing step, not retraining.

---


## 8. Re-training procedure (the real one)

```bash
# 1. Optional: back up the current models first (nothing else does this)
mkdir ..\model-backup
copy gb_model.joblib ..\model-backup\
copy xgb_model.joblib ..\model-backup\
copy feature_columns.joblib ..\model-backup\

# 2. Train
cd C:\xampp\htdocs\New\GameSpec-Optimizer\MODULES
.venv\Scripts\python.exe ml-training.py

# 3. Confirm the three files changed
dir *.joblib

# 4. Smoke-test inference
.venv\Scripts\python.exe ml-predict.py "{\"game_cpu_min\":14200,\"game_gpu_min\":9000,\"game_ram_min\":2500,\"cpu_score\":19700,\"gpu_score\":17500,\"ram_score\":4000,\"res_width\":1920,\"res_height\":1080,\"graphics_preset\":\"High\",\"shadow_quality\":\"High\",\"texture_quality\":\"High\",\"anti_aliasing\":\"TAA\",\"vsync\":\"Off\",\"performance_mode\":0}"
```

Expected console output from step 2: MAE / MSE / RMSE / R² / MAPE / CV MAE, then `Models saved successfully:` with the three filenames.

Expected from step 4: a single JSON line with `"success": true`.

**After retraining, the admin page will still display the same hard-coded numbers** — it does not read the models (§2).

---

## 9. Verification (read-only)

```sql
-- Training data is NOT in MySQL. Confirm the disconnect:
SELECT COUNT(*) FROM games;          -- e.g. 38  (live data)
-- DATA/benchmark-data.csv has 6001 lines (6000 rows + header), 31 distinct titles
-- These two numbers do NOT have to agree, and nothing reconciles them.
```

```bash
# Confirm the model artifacts and their mtime
dir C:\xampp\htdocs\New\GameSpec-Optimizer\MODULES\*.joblib

# Confirm feature count
cd C:\xampp\htdocs\New\GameSpec-Optimizer\MODULES
.venv\Scripts\python.exe -c "import joblib; print(len(joblib.load('feature_columns.joblib')))"
# -> 16
```

Nothing here modifies data.

