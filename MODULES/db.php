<?php

declare(strict_types=1);

function loadEnvironment(): array
{
    static $environment;
    if ($environment !== null) {
        return $environment;
    }

    $file = __DIR__ . '/../.env.local';
    if (!is_readable($file)) {
        throw new RuntimeException('Environment file not found.');
    }

    $environment = [];
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

    $connection = new PDO($pdoDsn, $username, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);

    return $connection;
}