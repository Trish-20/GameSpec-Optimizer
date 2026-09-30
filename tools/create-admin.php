<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once __DIR__ . '/../MODULES/db.php';

if ($argc !== 3) {
    fwrite(STDERR, "Usage: php tools/create-admin.php <username> <email>\n");
    exit(1);
}

$username = trim($argv[1]);
$email = trim($argv[2]);
$password = (string) readline('Admin password (input may be visible): ');

if ($username === '' || $email === '' || $password === '') {
    fwrite(STDERR, "Username, email, and password are required.\n");
    exit(1);
}

try {
    $database = databaseConnection();
    $statement = $database->prepare(
        'INSERT INTO users
            (username, email, password_hash, display_name, role, status)
         VALUES
            (:username, :email, :password_hash, :display_name, "admin", "active")'
    );
    $statement->execute([
        'username' => $username,
        'email' => $email,
        'password_hash' => password_hash($password, PASSWORD_DEFAULT),
        'display_name' => $username,
    ]);

    fwrite(STDOUT, "Admin account created.\n");
} catch (Throwable $error) {
    fwrite(STDERR, "Unable to create admin account.\n");
    exit(1);
}
