USE `gamespec_optimizer`;

-- Reconcile older deployed users tables with the current account schema.
-- Existing email columns become nullable; installations without one get it
-- added. Existing username/password values are never rewritten.
SET @admin_email_column_exists := (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'users'
      AND column_name = 'email'
);
SET @admin_email_column_ddl := IF(
    @admin_email_column_exists > 0,
    'ALTER TABLE users MODIFY COLUMN email VARCHAR(255) NULL',
    'ALTER TABLE users ADD COLUMN email VARCHAR(255) NULL'
);
PREPARE admin_email_column_stmt FROM @admin_email_column_ddl;
EXECUTE admin_email_column_stmt;
DEALLOCATE PREPARE admin_email_column_stmt;

-- A unique email index allows multiple NULL values while preventing two
-- administrators from sharing a recovery address.
SET @admin_email_index_exists := (
    SELECT COUNT(*)
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'users'
      AND index_name = 'uq_users_email'
);
SET @admin_email_index_ddl := IF(
    @admin_email_index_exists > 0,
    'SELECT 1',
    'CREATE UNIQUE INDEX uq_users_email ON users (email)'
);
PREPARE admin_email_index_stmt FROM @admin_email_index_ddl;
EXECUTE admin_email_index_stmt;
DEALLOCATE PREPARE admin_email_index_stmt;
