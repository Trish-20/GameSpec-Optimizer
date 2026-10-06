<?php

declare(strict_types=1);

require_once __DIR__ . '/../auth.php';
require_once __DIR__ . '/../db.php';

header('Content-Type: application/json; charset=utf-8');

function adminEmailResponse(int $status, bool $success, string $message): void
{
    http_response_code($status);
    echo json_encode(['success' => $success, 'message' => $message]);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    adminEmailResponse(405, false, 'Unable to update the account email.');
}

requireAdminApi(true);

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
    $input = $_POST;
}

$emailInput = $input['email'] ?? '';
if (!is_string($emailInput)) {
    adminEmailResponse(400, false, 'Enter a valid email address, or leave it blank.');
}
$email = trim($emailInput);
if ($email !== '' && (strlen($email) > 254 || filter_var($email, FILTER_VALIDATE_EMAIL) === false)) {
    adminEmailResponse(400, false, 'Enter a valid email address, or leave it blank.');
}

$userId = (int) ($_SESSION['user_id'] ?? 0);
if ($userId <= 0) {
    adminEmailResponse(401, false, 'Authentication is required.');
}

try {
    $database = databaseConnection();

    if ($email !== '') {
        $duplicate = $database->prepare(
            'SELECT user_id FROM users WHERE email = :email AND user_id <> :user_id LIMIT 1'
        );
        $duplicate->execute(['email' => $email, 'user_id' => $userId]);
        if ($duplicate->fetch()) {
            adminEmailResponse(409, false, 'That email address is already assigned to another account.');
        }
    }

    $update = $database->prepare(
        'UPDATE users SET email = :email WHERE user_id = :user_id AND role = "admin" AND status = "active"'
    );
    $update->execute([
        'email' => $email === '' ? null : $email,
        'user_id' => $userId,
    ]);

    if ($update->rowCount() < 1) {
        $current = $database->prepare(
            'SELECT user_id FROM users WHERE user_id = :user_id AND role = "admin" AND status = "active" LIMIT 1'
        );
        $current->execute(['user_id' => $userId]);
        if (!$current->fetch()) {
            adminEmailResponse(403, false, 'Administrator account is unavailable.');
        }
    }

    adminEmailResponse(200, true, 'Account email updated successfully.');
} catch (PDOException $error) {
    // Keep the unique constraint authoritative if two admins submit the same
    // address at nearly the same time.
    if ((string) $error->getCode() === '23000') {
        adminEmailResponse(409, false, 'That email address is already assigned to another account.');
    }
    error_log('Admin account email update failed.');
    adminEmailResponse(500, false, 'Unable to update the account email.');
} catch (Throwable $error) {
    error_log('Admin account email update failed.');
    adminEmailResponse(500, false, 'Unable to update the account email.');
}
