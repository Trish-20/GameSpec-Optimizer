<?php

declare(strict_types=1);

require_once __DIR__ . '/../auth.php';
require_once __DIR__ . '/../db.php';

header('Content-Type: application/json; charset=utf-8');
requireAdminApi();
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    header('Allow: GET');
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
    exit;
}

try {
    $database = databaseConnection();
    $statement = $database->query(
        'SELECT username, email, role, status, created_at, last_login_at
         FROM users WHERE role = "admin" ORDER BY created_at DESC, username ASC'
    );
    $databaseOffsetMinutes = databaseUtcOffsetMinutes($database);
    echo json_encode([
        'accounts' => $statement->fetchAll(),
        'database_utc_offset_minutes' => $databaseOffsetMinutes,
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $error) {
    error_log('Admin account list could not be loaded.');
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Administrator accounts are temporarily unavailable.']);
}
