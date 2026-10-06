<?php

declare(strict_types=1);

require_once __DIR__ . '/../auth.php';
require_once __DIR__ . '/../db.php';

header('Content-Type: application/json; charset=utf-8');

function createAdminResponse(int $status, bool $success, string $message): void
{
    http_response_code($status);
    echo json_encode(['success' => $success, 'message' => $message]);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    createAdminResponse(405, false, 'Unable to create admin account.');
}

requireAdminApi(true);

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
    $input = $_POST;
}

$allowedFields = ['username', 'email', 'display_name', 'password', 'password_confirmation'];
if (array_diff(array_keys($input), $allowedFields) !== []) {
    createAdminResponse(400, false, 'Unable to create admin account.');
}

foreach ($allowedFields as $field) {
    if (isset($input[$field]) && !is_string($input[$field])) {
        createAdminResponse(400, false, 'Unable to create admin account.');
    }
}

$username = trim((string) ($input['username'] ?? ''));
$email = trim((string) ($input['email'] ?? ''));
$displayName = trim((string) ($input['display_name'] ?? ''));
$password = (string) ($input['password'] ?? '');
$passwordConfirmation = (string) ($input['password_confirmation'] ?? '');

if (!preg_match('/^[A-Za-z0-9][A-Za-z0-9._-]{2,49}$/D', $username)
    || strlen($email) > 254
    || filter_var($email, FILTER_VALIDATE_EMAIL) === false
    || strlen($displayName) > 100
    || strlen($password) < 12
    || strlen($password) > 1024
    || !hash_equals($password, $passwordConfirmation)) {
    createAdminResponse(400, false, 'Check the account details and password confirmation.');
}

try {
    $database = databaseConnection();
    $database->beginTransaction();

    // Do not rely only on the role captured in the session: an administrator
    // may have been disabled after signing in.
    $adminCheck = $database->prepare(
        'SELECT user_id FROM users
         WHERE user_id = :user_id AND role = "admin" AND status = "active"
         LIMIT 1 FOR UPDATE'
    );
    $adminCheck->execute(['user_id' => (int) ($_SESSION['user_id'] ?? 0)]);
    if (!$adminCheck->fetch()) {
        $database->rollBack();
        createAdminResponse(403, false, 'Administrator access is required.');
    }

    $duplicate = $database->prepare(
        'SELECT user_id FROM users WHERE username = :username OR email = :email LIMIT 1'
    );
    $duplicate->execute(['username' => $username, 'email' => $email]);
    if ($duplicate->fetch()) {
        $database->rollBack();
        createAdminResponse(409, false, 'That username or email is already in use.');
    }

    $passwordHash = password_hash($password, PASSWORD_DEFAULT);
    if ($passwordHash === false) {
        throw new RuntimeException('Password hashing failed.');
    }

    $insert = $database->prepare(
        'INSERT INTO users
            (username, email, password_hash, display_name, role, status)
         VALUES
            (:username, :email, :password_hash, :display_name, "admin", "active")'
    );
    $insert->execute([
        'username' => $username,
        'email' => $email,
        'password_hash' => $passwordHash,
        'display_name' => $displayName !== '' ? $displayName : null,
    ]);
    $database->commit();

    createAdminResponse(201, true, 'Admin account created successfully.');
} catch (PDOException $error) {
    if (isset($database) && $database->inTransaction()) {
        $database->rollBack();
    }
    if ((string) $error->getCode() === '23000') {
        createAdminResponse(409, false, 'That username or email is already in use.');
    }
    error_log('Admin account creation failed.');
    createAdminResponse(500, false, 'Unable to create admin account.');
} catch (Throwable $error) {
    if (isset($database) && $database->inTransaction()) {
        $database->rollBack();
    }
    error_log('Admin account creation failed.');
    createAdminResponse(500, false, 'Unable to create admin account.');
}
