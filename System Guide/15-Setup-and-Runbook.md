# 15 — Setup & Runbook

Step-by-step instructions for provisioning, configuring, and maintaining GameSpec Optimizer on a Windows host.

---

## 1. Prerequisites

1. **Windows 10 / 11** (Required for hardware auto-detection scripts).
2. **XAMPP** (with Apache and MySQL / MariaDB, PHP 8.1+).
3. **Python 3.11+** installed and available on PATH.
4. **Git** (optional, for version management).

---

## 2. Fresh Installation Steps

### Step 1: Clone or Place Codebase
Ensure the project is in the XAMPP web root:
`C:\xampp\htdocs\New\GameSpec-Optimizer` (or `C:\xampp\htdocs\GameSpec-Optimizer`).

### Step 2: Database Initialization
1. Start Apache and MySQL from XAMPP Control Panel.
2. Open phpMyAdmin (`http://localhost/phpmyadmin`) or MySQL CLI:
   ```sql
   CREATE DATABASE gamespec_optimizer CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```
3. Import the base dump:
   ```bash
   mysql -u root gamespec_optimizer < C:\xampp\htdocs\New\GameSpec-Optimizer\DATA\gamespec_export.sql
   ```
4. Create the uncommitted feedback table:
   ```sql
   USE gamespec_optimizer;
   CREATE TABLE IF NOT EXISTS `site_feedback` (
     `feedback_id` INT AUTO_INCREMENT PRIMARY KEY,
     `rating` INT NOT NULL,
     `feedback_title` VARCHAR(150) NOT NULL,
     `comment` TEXT NOT NULL,
     `display_name` VARCHAR(100) DEFAULT NULL,
     `is_anonymous` TINYINT(1) DEFAULT 0,
     `helpful_count` INT DEFAULT 0,
     `reported_count` INT DEFAULT 0,
     `is_approved` TINYINT(1) DEFAULT 1,
     `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
   ```

### Step 3: Python Virtual Environment Setup
Open PowerShell as Administrator:
```powershell
cd C:\xampp\htdocs\New\GameSpec-Optimizer
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install --upgrade pip
pip install -r requirements.txt
```

Verify that `.venv\Scripts\python.exe` exists.

### Step 4: Populate Hardware Benchmarks (If Missing)
```bash
cd C:\xampp\htdocs\New\GameSpec-Optimizer\MODULES
php load-benchmarks.php
```

### Step 5: Resolve Initial Game Benchmarks
```bash
cd C:\xampp\htdocs\New\GameSpec-Optimizer\MODULES
php resolve-game-benchmarks.php
```

---

## 3. Routine Runbook Tasks

### Adding a New Game
1. Go to Admin Panel -> **Game Management** (`FRONT-END/HTML/Admin Side/game-management.php`).
2. Fill in Title, Release Year, Genres, Platforms, Description, and Specs (CPU, GPU, RAM for Min/Rec).
3. Click **Add Game**.
4. **Mandatory Step:** Open terminal and run the benchmark resolver:
   ```bash
   cd C:\xampp\htdocs\New\GameSpec-Optimizer\MODULES
   php resolve-game-benchmarks.php
   ```
5. Confirm the game appears in the user catalog (`browse-games.php`).

### Re-training the ML Model (Only when CSV changes)
1. Edit or update `DATA/benchmark-data.csv`.
2. Run the training script:
   ```bash
   cd C:\xampp\htdocs\New\GameSpec-Optimizer\MODULES
   ..\.venv\Scripts\python.exe ml-training.py
   ```
3. Verify that new `.joblib` files are produced with updated timestamps.
