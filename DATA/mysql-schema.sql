CREATE TABLE users (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE cpu_benchmarks (
    cpu_model VARCHAR(255) NOT NULL,
    cpu_score INT UNSIGNED NOT NULL,
    cores TINYINT UNSIGNED NOT NULL,
    threads TINYINT UNSIGNED NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (cpu_model),
    INDEX idx_cpu_score (cpu_score)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE gpu_benchmarks (
    gpuName VARCHAR(255) NOT NULL,
    G3Dmark INT UNSIGNED NOT NULL,
    G2Dmark INT UNSIGNED NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (gpuName),
    INDEX idx_gpu_g3dmark (G3Dmark),
    INDEX idx_gpu_g2dmark (G2Dmark)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE games (
    game_title VARCHAR(255) NOT NULL,
    game_cpu_model VARCHAR(255) NOT NULL,
    game_cpu_benchmark INT UNSIGNED NOT NULL,
    game_gpu_model VARCHAR(255) NOT NULL,
    game_gpu_benchmark INT UNSIGNED NOT NULL,
    game_ram_model VARCHAR(255) NOT NULL,
    game_ram_benchmark INT UNSIGNED NOT NULL,
    hasBloom TINYINT(1) NOT NULL DEFAULT 0,
    hasAntiAlias TINYINT(1) NOT NULL DEFAULT 0,
    hasShadows TINYINT(1) NOT NULL DEFAULT 0,
    hasVSync TINYINT(1) NOT NULL DEFAULT 0,
    game_image VARCHAR(255) NULL,
    game_description TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (game_title),
    INDEX idx_games_cpu_benchmark (game_cpu_benchmark),
    INDEX idx_games_gpu_benchmark (game_gpu_benchmark)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE reviews (
    review_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    game_title VARCHAR(255) NOT NULL,
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
        FOREIGN KEY (game_title) REFERENCES games(game_title)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT chk_reviews_rating
        CHECK (rating BETWEEN 1 AND 5),
    INDEX idx_reviews_game_title (game_title),
    INDEX idx_reviews_user_id (user_id),
    INDEX idx_reviews_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;