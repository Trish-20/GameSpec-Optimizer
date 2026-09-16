CREATE DATABASE IF NOT EXISTS gamespec_optimizer;
USE `gamespec_optimizer`;

CREATE TABLE IF NOT EXISTS users ( -- NOT YET APPLIED
    user_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(100) NULL,
    role ENUM('user', 'admin') NOT NULL DEFAULT 'user',
    status ENUM('active', 'disabled', 'pending') NOT NULL DEFAULT 'active',
    last_login_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_users_username (username),
    UNIQUE KEY uq_users_email (email)
);

CREATE TABLE IF NOT EXISTS cpu_benchmarks (
    cpu_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    model VARCHAR(255) NOT NULL,
    normalized_model VARCHAR(255) NOT NULL,
    score INT UNSIGNED NOT NULL,
    cores TINYINT UNSIGNED NULL,
    category VARCHAR(50) NULL,
    source_version VARCHAR(100) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_cpu_model (model),
    INDEX idx_cpu_normalized_model (normalized_model),
    INDEX idx_cpu_score (score)
);

CREATE TABLE IF NOT EXISTS gpu_benchmarks (
    gpu_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    model VARCHAR(255) NOT NULL,
    normalized_model VARCHAR(255) NOT NULL,
    score INT UNSIGNED NOT NULL,
    g2d_score INT UNSIGNED NULL,
    tdp SMALLINT UNSIGNED NULL,
    category VARCHAR(50) NULL,
    source_version VARCHAR(100) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_gpu_model (model),
    INDEX idx_gpu_normalized_model (normalized_model),
    INDEX idx_gpu_score (score)
);

CREATE TABLE IF NOT EXISTS ram_benchmarks (
    ram_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    capacity_gb SMALLINT UNSIGNED NOT NULL,
    speed_mhz SMALLINT UNSIGNED NOT NULL,
    score INT UNSIGNED NOT NULL,
    source_version VARCHAR(100) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_ram_configuration (capacity_gb, speed_mhz),
    INDEX idx_ram_capacity (capacity_gb)
);

CREATE TABLE IF NOT EXISTS games (
    game_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    rawg_id BIGINT UNSIGNED NOT NULL,
    steam_app_id INT UNSIGNED NULL,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NULL,
    description TEXT NULL,
    cover_url VARCHAR(1000) NULL,
    release_date DATE NULL,
    release_year SMALLINT UNSIGNED NULL,
    genres JSON NULL,
    platforms JSON NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    rawg_synced_at DATETIME NULL,
    steam_synced_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_games_rawg_id (rawg_id),
    UNIQUE KEY uq_games_steam_app_id (steam_app_id),
    INDEX idx_games_title (title),
    INDEX idx_games_release_year (release_year),
    INDEX idx_games_active_title (is_active, title)
);

CREATE TABLE IF NOT EXISTS game_requirements (
    requirement_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    game_id BIGINT UNSIGNED NOT NULL,
    requirement_type ENUM('minimum', 'recommended') NOT NULL,
    operating_system TEXT NULL,
    cpu_text TEXT NULL,
    gpu_text TEXT NULL,
    ram_text TEXT NULL,
    storage_text TEXT NULL,
    ram_capacity_gb SMALLINT UNSIGNED NULL,
    ram_speed_mhz SMALLINT UNSIGNED NULL,
    raw_html MEDIUMTEXT NULL,
    source VARCHAR(30) NOT NULL DEFAULT 'steam',
    synced_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_game_requirement_type (game_id, requirement_type),
    CONSTRAINT fk_requirements_game
        FOREIGN KEY (game_id) REFERENCES games(game_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS game_benchmark_matches (
    match_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    requirement_id BIGINT UNSIGNED NOT NULL,
    hardware_type ENUM('cpu', 'gpu', 'ram') NOT NULL,
    required_text TEXT NULL,
    matched_model VARCHAR(255) NULL,
    matched_capacity_gb SMALLINT UNSIGNED NULL,
    matched_speed_mhz SMALLINT UNSIGNED NULL,
    benchmark_score INT UNSIGNED NULL,
    match_status ENUM('exact', 'alias', 'nearest', 'estimated', 'unresolved') NOT NULL DEFAULT 'unresolved',
    benchmark_source_version VARCHAR(100) NULL,
    resolved_at DATETIME NULL,
    UNIQUE KEY uq_requirement_hardware_type (requirement_id, hardware_type),
    CONSTRAINT fk_matches_requirement
        FOREIGN KEY (requirement_id) REFERENCES game_requirements(requirement_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS game_sync_state (
    sync_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    source ENUM('rawg', 'steam', 'benchmarks') NOT NULL,
    sync_scope VARCHAR(100) NOT NULL,
    last_cursor VARCHAR(255) NULL,
    last_success_at DATETIME NULL,
    last_error TEXT NULL,
    next_run_at DATETIME NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_sync_source_scope (source, sync_scope)
);

CREATE TABLE IF NOT EXISTS sync_jobs (
    job_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    game_id BIGINT UNSIGNED NULL,
    job_type ENUM('rawg_metadata', 'steam_requirements', 'benchmark_resolution') NOT NULL,
    status ENUM('queued', 'running', 'complete', 'failed') NOT NULL DEFAULT 'queued',
    attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
    run_after DATETIME NULL,
    last_error TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_sync_jobs_status (status, run_after),
    CONSTRAINT fk_sync_jobs_game
        FOREIGN KEY (game_id) REFERENCES games(game_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS reviews ( -- NOT YET APPLIED
    review_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    game_id BIGINT UNSIGNED NOT NULL,
    rating TINYINT UNSIGNED NOT NULL,
    review_title VARCHAR(150) NULL,
    comment TEXT NOT NULL,
    helpful_count INT UNSIGNED NOT NULL DEFAULT 0,
    reported_count INT UNSIGNED NOT NULL DEFAULT 0,
    is_anonymous TINYINT(1) NOT NULL DEFAULT 0,
    is_approved TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_reviews_user
        FOREIGN KEY (user_id) REFERENCES users(user_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_reviews_game
        FOREIGN KEY (game_id) REFERENCES games(game_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT chk_reviews_rating
        CHECK (rating BETWEEN 1 AND 5),
    INDEX idx_reviews_game_id (game_id),
    INDEX idx_reviews_user_id (user_id),
    INDEX idx_reviews_created_at (created_at)
);
