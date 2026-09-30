<?php

declare(strict_types=1);

require_once __DIR__ . '/../db.php';

header('Content-Type: application/json; charset=utf-8');

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
    $input = $_POST;
}

$title = trim((string) ($input['title'] ?? $input['feedback_title'] ?? ''));
$comment = trim((string) ($input['comment'] ?? ''));
$rating = (int) ($input['rating'] ?? 0);
$username = trim((string) ($input['username'] ?? $input['display_name'] ?? ''));
// Server decides anonymity: empty name => anonymous. Never trust the flag alone.
$isAnonymous = $username === '' ? 1 : 0;
if ($username !== '') {
    $username = mb_substr($username, 0, 100);
}

if ($title === '' || $comment === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Title and comment are required.']);
    exit;
}

if ($rating < 1 || $rating > 5) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Rating must be between 1 and 5.']);
    exit;
}

if (mb_strlen($title) > 150) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Title must be 150 characters or fewer.']);
    exit;
}

try {
    $database = databaseConnection();

    $insert = $database->prepare(
        'INSERT INTO site_feedback
            (rating, feedback_title, comment, display_name, is_anonymous, helpful_count, reported_count, is_approved)
         VALUES
            (:rating, :feedback_title, :comment, :display_name, :is_anonymous, 0, 0, 1)'
    );

    $insert->execute([
        'rating' => $rating,
        'feedback_title' => $title,
        'comment' => $comment,
        'display_name' => $isAnonymous === 1 ? null : $username,
        'is_anonymous' => $isAnonymous,
    ]);

    $feedbackId = (int) $database->lastInsertId();

    echo json_encode([
        'success' => true,
        'feedback_id' => $feedbackId,
        'message' => 'Thank you! Your feedback has been submitted.',
    ]);
} catch (Throwable $error) {
    error_log('submit-feedback.php error: ' . $error->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Unable to submit feedback.']);
}
