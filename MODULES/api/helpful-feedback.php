<?php

declare(strict_types=1);

require_once __DIR__ . '/../db.php';

header('Content-Type: application/json; charset=utf-8');

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
    exit;
}

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
$voterToken = (string) ($input['voter_token'] ?? '');
if (!preg_match('/^[a-f0-9]{64}$/i', $voterToken)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'A valid anonymous voting token is required.']);
    exit;
}

if ($feedbackId <= 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'A valid feedback_id is required.']);
    exit;
}

try {
    $database = databaseConnection();

    $database->beginTransaction();
    $exists = $database->prepare('SELECT feedback_id FROM site_feedback WHERE feedback_id = :feedback_id AND is_approved = 1 FOR UPDATE');
    $exists->execute(['feedback_id' => $feedbackId]);
    if (!$exists->fetch()) {
        $database->rollBack();
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Feedback not found.']);
        exit;
    }

    $vote = $database->prepare(
        'INSERT IGNORE INTO site_feedback_helpful_votes (feedback_id, voter_token_hash)
         VALUES (:feedback_id, :token_hash)'
    );
    $vote->execute([
        'feedback_id' => $feedbackId,
        'token_hash' => hash('sha256', strtolower($voterToken)),
    ]);
    $alreadyVoted = $vote->rowCount() === 0;
    if (!$alreadyVoted) {
        $update = $database->prepare(
            'UPDATE site_feedback SET helpful_count = COALESCE(helpful_count, 0) + 1
             WHERE feedback_id = :feedback_id AND is_approved = 1'
        );
        $update->execute(['feedback_id' => $feedbackId]);
    }

    $count = $database->prepare('SELECT helpful_count FROM site_feedback WHERE feedback_id = :feedback_id');
    $count->execute(['feedback_id' => $feedbackId]);

    $database->commit();
    echo json_encode([
        'success' => true,
        'already_voted' => $alreadyVoted,
        'feedback_id' => $feedbackId,
        'helpful_count' => (int) $count->fetchColumn(),
        'message' => 'Thanks for your feedback!',
    ]);
} catch (Throwable $error) {
    if (isset($database) && $database->inTransaction()) {
        $database->rollBack();
    }
    error_log('helpful-feedback.php error: ' . $error->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Unable to update helpful count.']);
}
