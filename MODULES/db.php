<?php

declare(strict_types=1);

function loadEnvironment(): array
{
    static $environment;
    if ($environment !== null) {
        return $environment;
    }

    $environment = [];

    // Local development (XAMPP): read the ignored .env.local file.
    $file = __DIR__ . '/../.env.local';
    if (is_readable($file)) {
        foreach (file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
            $line = trim($line);
            if ($line === '' || str_starts_with($line, '#')) {
                continue;
            }

            $separator = strpos($line, '=');
            if ($separator === false) {
                continue;
            }

            $name = trim(substr($line, 0, $separator));
            $environment[$name] = trim(substr($line, $separator + 1), " \t\r\n\"'");
        }
    }

    // Cloud hosts and CI supply secrets as real environment variables, and
    // there is no .env.local file in a container image. These take precedence
    // over the file so a deployed platform can always override local values.
    foreach (['DB_CONNECTION_STRING', 'DB_SSL_CA', 'RAW_API_KEY', 'APP_ENV', 'PYTHON_BIN'] as $name) {
        $value = getenv($name);
        if ($value !== false && $value !== '') {
            $environment[$name] = $value;
        }
    }

    if ($environment === []) {
        throw new RuntimeException(
            'No configuration found. Set the DB_CONNECTION_STRING environment variable, '
            . 'or provide a .env.local file.'
        );
    }

    return $environment;
}

function databaseConnection(): PDO
{
    static $connection;
    if ($connection instanceof PDO) {
        return $connection;
    }

    $environment = loadEnvironment();
    $connectionString = $environment['DB_CONNECTION_STRING'] ?? '';
    if ($connectionString === '') {
        throw new RuntimeException('DB_CONNECTION_STRING is not configured.');
    }

    $parts = explode(';', $connectionString);
    $dsn = array_shift($parts);
    $options = [];
    foreach ($parts as $part) {
        if (!str_contains($part, '=')) {
            continue;
        }
        [$key, $value] = explode('=', $part, 2);
        $options[strtolower(trim($key))] = trim($value);
    }

    if (!str_starts_with($dsn, 'mysql:')) {
        throw new RuntimeException('Only MySQL connections are supported.');
    }

    $host = $options['host'] ?? $options['server'] ?? '127.0.0.1';
    $database = $options['dbname'] ?? $options['database'] ?? 'gamespec_optimizer';
    $username = $options['user'] ?? $options['userid'] ?? $options['username'] ?? '';
    $password = $options['password'] ?? '';
    $port = $options['port'] ?? null;

    $pdoDsn = 'mysql:host=' . $host . ';dbname=' . $database . ';charset=utf8mb4';
    if ($port !== null && $port !== '') {
        $pdoDsn .= ';port=' . $port;
    }

    $pdoOptions = [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ];

    $caPath = $environment['DB_SSL_CA'] ?? '';
    if ($caPath !== '') {
        if (!is_readable($caPath)) {
            throw new RuntimeException('DB_SSL_CA does not point to a readable certificate file.');
        }

        $pdoOptions[PDO::MYSQL_ATTR_SSL_CA] = $caPath;
        $pdoOptions[PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT] = true;
    }
    
    $connection = new PDO($pdoDsn, $username, $password, $pdoOptions);

    return $connection;
}

/**
 * Check whether a column already exists on a table.
 *
 * Used by the lightweight, self-healing migrations below so a fresh clone and
 * an already-provisioned database both keep working without a manual step.
 */
function tableHasColumn(PDO $database, string $table, string $column): bool
{
    static $cache = [];

    $key = $table . '.' . $column;
    if (isset($cache[$key])) {
        return $cache[$key];
    }

    $statement = $database->prepare(
        'SELECT COUNT(*) FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table AND COLUMN_NAME = :column'
    );
    $statement->execute(['table' => $table, 'column' => $column]);

    return $cache[$key] = ((int) $statement->fetchColumn() > 0);
}

/**
 * Make sure `site_feedback` can carry the reason a user gave when reporting a
 * piece of feedback. The column is added on first use, so existing installs do
 * not need a separate migration step. Returns false when the column could not
 * be created (the caller then degrades gracefully instead of failing).
 */
function ensureFeedbackReportReasonColumn(PDO $database): bool
{
    if (tableHasColumn($database, 'site_feedback', 'report_reason')) {
        return true;
    }

    try {
        $database->exec(
            'ALTER TABLE site_feedback
             ADD COLUMN report_reason VARCHAR(255) NULL AFTER reported_count'
        );
    } catch (Throwable $error) {
        error_log('Unable to add site_feedback.report_reason: ' . $error->getMessage());
        return false;
    }

    return true;
}