# 08 — Hardware Auto-Detection

The button **"Detect Hardware"** on `FRONT-END/HTML/User Side/fps-prediction.php` (line 71) invokes `detectHardware()` in `UserSideFunction.js`. It queries the local Windows machine for CPU, GPU, and RAM, matches the returned text against benchmark tables, and pre-populates the prediction dropdowns.

---

## 1. End-to-end trace

```
[User clicks "Detect Hardware"]
  │
  ▼ UserSideFunction.js: detectHardware()   (line 2042)
  │  ├─ ensures cpus[] / gpus[] are populated (lines 2044-2045)
  │  └─ fetch('../../../MODULES/api/get-hardware.php')
  │
  ▼ MODULES/api/get-hardware.php            (lines 1-38)
  │  ├─ locates python binary (prefers .venv/Scripts/python.exe,
  │  │   falls back to 'python'/'python3' on PATH)
  │  ├─ runs MODULES/detect-hardware.py via shell_exec()
  │  └─ parses stdout as JSON and relays to browser
  │
  ▼ MODULES/detect-hardware.py              (lines 64-100)
  │  ├─ get_windows_cpu()     → wmic cpu get name
  │  ├─ get_windows_ram_gb()  → ctypes.windll.kernel32.GlobalMemoryStatusEx
  │  └─ get_windows_gpu()     → wmic path win32_VideoController get name
  │                            (prefers dedicated: nvidia/geforce/rtx/radeon rx)
  │
  ▼ UserSideFunction.js: response processing (lines 2054-2086)
     ├─ findBestHardwareMatch(cpus, result.cpu_model)   (line 2004)
     ├─ findBestHardwareMatch(gpus, result.gpu_model)
     ├─ findClosestRamOption(result.ram_gb)             (line 2029)
     ├─ sets visible search inputs and hidden score inputs
     └─ showModal("Hardware Detected", ...)
```

---

## 2. Low-level OS probes (`detect-hardware.py`)

### 2.1 CPU detection (lines 37–42)

```python
def get_windows_cpu():
    devices = run_wmic_query("wmic cpu get name")
    if devices:
        return devices[0]
    return platform.processor() or "Unknown CPU"
```

WMIC query stdout example:
```
Name
Intel(R) Core(TM) i7-10700K CPU @ 3.80GHz
```

`run_wmic_query()` discards the header line and returns the first row.

### 2.2 RAM detection (lines 44–62)

```python
def get_windows_ram_gb():
    class MEMORYSTATUSEX(ctypes.Structure):
        _fields_ = [
            ("dwLength", ctypes.c_ulong),
            ("dwMemoryLoad", ctypes.c_ulong),
            ("ullTotalPhys", ctypes.c_ulonglong),
            ...
        ]
    status = MEMORYSTATUSEX()
    status.dwLength = ctypes.sizeof(MEMORYSTATUSEX)
    if ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(status)):
        return round(status.ullTotalPhys / (1024 ** 3), 2)
    return 0
```

Uses Win32 `GlobalMemoryStatusEx`. Returns physical RAM in gigabytes rounded to 2 decimal places (e.g., `15.87` or `16.0`).

### 2.3 GPU detection (lines 15–35, 77–80)

```python
def get_windows_gpu(get_integrated=False):
    devices = run_wmic_query("wmic path win32_VideoController get name")
    if not devices:
        return "No Graphics Card Detected"

    if get_integrated:
        integrated = [d for d in devices if "intel" in d.lower() or "amd" in d.lower() or "graphics" in d.lower()]
        return integrated[0] if integrated else devices[0]
    else:
        dedicated = [d for d in devices if "nvidia" in d.lower() or "geforce" in d.lower() or "rtx" in d.lower() or "radeon rx" in d.lower()]
        return dedicated[0] if dedicated else devices[-1]
```

- In `detect-hardware.py:77-80`, **`choice = "1"` is hard-coded** (dedicated GPU preferred). The interactive prompt is commented out.
- Laptops with dual GPUs (Intel UHD + NVIDIA RTX) will pick the **dedicated** card first.
- If no dedicated keywords match, it falls back to the **last device** in the WMIC list (`devices[-1]`).

### 2.4 Payload emitted by Python

```json
{
  "success": true,
  "cpu_model": "Intel(R) Core(TM) i7-10700K CPU @ 3.80GHz",
  "ram_gb": 15.87,
  "gpu_model": "NVIDIA GeForce RTX 3070"
}
```

---
## 3. The PHP execution layer (`get-hardware.php`)

```php
$venvPython = realpath(__DIR__ . '/../../.venv/Scripts/python.exe');
$pythonBinary = $venvPython && file_exists($venvPython)
    ? $venvPython
    : ((PHP_OS_FAMILY === 'Windows') ? 'python' : 'python3');

$command = escapeshellcmd($pythonBinary) . ' ' . escapeshellarg($pythonScript) . ' 2>&1';
$output = shell_exec($command);
```

Key points:
- **Interpreter fallback works here:** unlike `hardware-specs-input.php` (which hard-codes `.venv/Scripts/python.exe`), `get-hardware.php` falls back to `python` on the system PATH.
- `2>&1` ensures errors from Python arrive in `$output` and trigger the JSON decode exception instead of hanging silently.

---

## 4. Frontend fuzzy matching against benchmark datasets

The detected raw strings rarely match database model names exactly. `UserSideFunction.js` resolves them:

### 4.1 Token normalization (`normalizeHardwareText()`, lines 1994–2002)

```javascript
function normalizeHardwareText(text) {
    return String(text || '')
        .toLowerCase()
        .replace(/\b(11th|12th|13th|14th|15th)\s+gen\b/gi, ' ')
        .replace(/\bcore\s+tm\b/gi, 'core')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}
```

Strips generational fluff, trademark symbols, and non-alphanumeric punctuation.

### 4.2 Two-way token coverage scoring (`findBestHardwareMatch()`, lines 2004–2027)

```javascript
const scoredMatches = items.map(item => {
    const model = normalizeHardwareText(item.model);
    const modelTokens = model.split(/\s+/).filter(token => token.length > 1);

    const tokenHits = modelTokens.filter(token => targetTokens.includes(token)).length;
    const tokenCoverage = modelTokens.length ? tokenHits / modelTokens.length : 0;
    const targetCoverage = targetTokens.length ? tokenHits / targetTokens.length : 0;
    const exact = model === target ? 1 : 0;

    return {
        item,
        score: exact ? 100 : (tokenCoverage * 70) + (targetCoverage * 30)
    };
}).sort((a, b) => b.score - a.score);

const best = scoredMatches[0];
return best && best.score >= 25 ? best.item : null;
```

- **Threshold is 25** (out of 100).
- Matches with score `< 25` return `null`.
- On `null`, the visible text input shows the detected string, but **the hidden score input remains blank** — blocking prediction until the user manually picks an entry.

### 4.3 RAM tier snapping (`findClosestRamOption()`, lines 2029–2040)

```javascript
function findClosestRamOption(ramGb) {
    const options = [4, 8, 16, 32, 64];
    if (!options.length || !Number.isFinite(ramGb)) return null;

    return options.reduce((closest, value) => {
        if (closest === null) return value;
        return Math.abs(value - ramGb) < Math.abs(closest - ramGb) ? value : closest;
    }, null);
}
```

Snaps fractional values (e.g. `15.87 GB`) to the nearest standard tier (`16`).

---

## 5. Architectural limitation: Localhost vs Remote deployment

> ⚠️ **CRITICAL ARCHITECTURAL REALITY:**
>
> `detect-hardware.py` executes on the **server hosting PHP**, not in the client browser.
>
> In the project's default setup (local XAMPP on Windows), the server **is** the user's machine, so auto-detection reads the user's CPU, GPU, and RAM.
>
> If the application is deployed to a remote server or Linux cloud host:
> 1. Auto-detect returns the **server's hardware** (e.g. Intel Xeon / AWS virtual GPU), not the client's.
> 2. On Linux, `ctypes.windll` and `wmic` crash or fail immediately because they are Windows-specific.
>
> The codebase acknowledges this in `UserSideFunction.js:386`:
> *"If automatic detection is unavailable (for example on a non-Windows system, or when permissions are restricted), you can select your hardware manually from the searchable dropdowns instead."*

---

## 6. Verification (read-only)

Run the detection script directly from terminal:

```bash
cd C:\xampp\htdocs\New\GameSpec-Optimizer\MODULES
python detect-hardware.py
```

Expected output:
```json
{"success": true, "cpu_model": "...", "ram_gb": 16.0, "gpu_model": "..."}
```

