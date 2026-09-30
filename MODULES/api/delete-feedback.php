<?php

declare(strict_types=1);

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/admin-auth.php';

header('Content-Type: application/json; charset=utf-8');

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
    $input = $_POST;
}

$feedbackId = 0;
foreach (['feedback_id', 'feedbackId', 'review_id', 'reviewId', 'id'] as $key) {
    if (isset($input[$key])) {
        $feedbackId = (int) $input[$key];
        break;
    }
}
if ($feedbackId <= 0) {
    foreach (['feedback_id', 'feedbackId', 'review_id', 'reviewId', 'id'] as $key) {
        if (isset($_GET[$key])) {
            $feedbackId = (int) $_GET[$key];
            break;
        }
    }
}

if ($feedbackId <= 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'A valid feedback_id is required.']);
    exit;
}

try {
    $database = databaseConnection();

    $delete = $database->prepare('DELETE FROM site_feedback WHERE feedback_id = :feedback_id');
    $delete->execute(['feedback_id' => $feedbackId]);

    if ($delete->rowCount() === 0) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Feedback not found.']);
        exit;
    }

    echo json_encode([
        'success' => true,
        'feedback_id' => $feedbackId,
        'message' => 'Feedback deleted.',
    ]);
} catch (Throwable $error) {
    error_log('delete-feedback.php error: ' . $error->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Unable to delete feedback.']);
}