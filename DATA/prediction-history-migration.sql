USE `gamespec_optimizer`;

-- Anonymous successful prediction events. No visitor account or network
-- identifiers are stored.
CREATE TABLE IF NOT EXISTS `prediction_history` (
  `prediction_id` CHAR(36) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `game_title` VARCHAR(255) NOT NULL,
  `cpu_model` VARCHAR(255) NULL,
  `gpu_model` VARCHAR(255) NULL,
  `ram_gb` SMALLINT UNSIGNED NULL,
  `graphics_preset` VARCHAR(20) NULL,
  `performance_mode` VARCHAR(20) NULL,
  `predicted_fps` DECIMAL(7,1) NOT NULL,
  `recommendation` TEXT NULL,
  `hardware_input_method` ENUM('detected', 'manually entered') NOT NULL,
  PRIMARY KEY (`prediction_id`),
  INDEX `idx_prediction_created_at` (`created_at`),
  INDEX `idx_prediction_game_created` (`game_title`, `created_at`),
  INDEX `idx_prediction_mode_created` (`performance_mode`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- A random browser-held token is hashed before storage. The unique key makes
-- each browser token count at most once for a given feedback row.
CREATE TABLE IF NOT EXISTS `site_feedback_helpful_votes` (
  `feedback_id` INT NOT NULL,
  `voter_token_hash` CHAR(64) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`feedback_id`, `voter_token_hash`),
  INDEX `idx_feedback_helpful_vote_created` (`created_at`),
  CONSTRAINT `fk_feedback_helpful_vote_feedback`
    FOREIGN KEY (`feedback_id`) REFERENCES `site_feedback` (`feedback_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
