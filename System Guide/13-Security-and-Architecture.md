# 13 — Security & Architecture

This document outlines the architectural boundaries, security posture, and threat model of the GameSpec Optimizer codebase.

---

## 1. Architectural Model

GameSpec Optimizer is architected as a **hybrid multi-tier local web application**:

```
[Browser / Frontend]
   │  Pure HTML5, Vanilla JavaScript, CSS (no framework)
   ▼
[Web & API Layer]
   │  Apache / PHP 8.x PDO (XAMPP environment)
   ├───────────────────────┬────────────────────────┐
   ▼                       ▼                        ▼
[Relational DB]     [Local CLI/Subprocesses]  [Static Datasets]
MySQL 8.0/MariaDB   Python 3.11+ ML & Probes   CSVs & Pre-trained Joblib
```

---

## 2. Security Posture & Vulnerability Inventory

### 2.1 Complete Absence of Authentication & Authorization

- **No Sessions / Tokens:** There are no login pages, JWT tokens, session cookies, or API keys protecting admin or user endpoints.
- **Admin Exposure:** The Admin panel (`FRONT-END/HTML/Admin Side/`) is accessible to anyone who types the URL or clicks the triple-click easter egg.
- **Write Access:** Every mutating endpoint (`update-games.php`, `delete-games.php`, `update-cpus.php`, `delete-feedback.php`) executes without verifying caller identity.

### 2.2 Shell Execution & Injection Surface

The application executes system-level binaries via PHP:
1. `hardware-specs-input.php`:
   - Uses `proc_open()` with `$command = $pythonCmd . ' ' . escapeshellarg($scriptPath)`.
   - Arguments are safely isolated; user data is passed via `stdin` (`fwrite($pipes[0], json_encode($inputs))`).
2. `get-hardware.php`:
   - Uses `shell_exec(escapeshellcmd($pythonBinary) . ' ' . escapeshellarg($pythonScript))`.
   - Script path and binary paths are generated internally via `realpath()`.
   - No user input is concatenated into the command string.

### 2.3 SQL Injection Resistance

- **High Resistance:** All database mutations and reads across `MODULES/api/*.php` use PDO prepared statements with parameter binding.
- **Emulated Prepares Disabled:** `db.php` sets `PDO::ATTR_EMULATE_PREPARES => false`, forcing server-side prepared execution.

### 2.4 File Upload Security (`update-games.php`)

Game cover images are uploaded via Base64 payloads:
- Decoded using `base64_decode()`.
- Extracted MIME type checked against allowed list (`image/jpeg`, `image/png`, `image/webp`).
- Output path uses auto-generated slug filename: `uploads/game-covers/{slug}.{ext}`.
- Prevents directory traversal attacks via controlled target directory.

---

## 3. Deployment Constraints

1. **Localhost Single-User Assumption:** The codebase was designed for local evaluation. Hosting on a public web server without adding authentication would expose all admin management operations.
2. **Platform Dependency:** Hardware auto-detection relies on Windows-specific WMIC and `kernel32.dll` ctypes calls. Running on Linux or macOS breaks `detect-hardware.py`.
