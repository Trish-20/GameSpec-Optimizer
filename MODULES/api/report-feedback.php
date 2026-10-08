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
if ($feedbackId <= 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'A valid feedback_id is required.']);
    exit;
}

$reason = trim((string) ($input['report_reason'] ?? $input['reportReason'] ?? $input['reason'] ?? ''));

if ($reason === '') {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Please tell us why you are reporting this feedback.',
    ]);
    exit;
}

if (mb_strlen($reason) > 255) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'The report reason must be 255 characters or fewer.',
    ]);
    exit;
}

try {
    $database = databaseConnection();

    // Make sure the column exists so the admin can always see the reason.
    // If it cannot be created the report is still recorded, just without one.
    $hasReasonColumn = ensureFeedbackReportReasonColumn($database);

    if ($hasReasonColumn) {
        $update = $database->prepare(
            'UPDATE site_feedback
             SET reported_count = reported_count + 1,
                 report_reason = :report_reason
             WHERE feedback_id = :feedback_id AND is_approved = 1'
        );
        $update->execute([
            'report_reason' => $reason,
            'feedback_id' => $feedbackId,
        ]);
    } else {
        $update = $database->prepare(
            'UPDATE site_feedback
             SET reported_count = reported_count + 1
             WHERE feedback_id = :feedback_id AND is_approved = 1'
        );
        $update->execute(['feedback_id' => $feedbackId]);
    }

    if ($update->rowCount() === 0) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Feedback not found.']);
        exit;
    }

    $count = $database->prepare('SELECT reported_count FROM site_feedback WHERE feedback_id = :feedback_id');
    $count->execute(['feedback_id' => $feedbackId]);

    echo json_encode([
        'success' => true,
        'feedback_id' => $feedbackId,
        'reported_count' => (int) $count->fetchColumn(),
        'message' => 'Feedback reported. Thank you.',
    ]);
} catch (Throwable $error) {
    error_log('report-feedback.php error: ' . $error->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Unable to report feedback.']);
}
