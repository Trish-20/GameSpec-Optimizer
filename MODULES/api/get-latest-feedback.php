<?php

declare(strict_types=1);

require_once __DIR__ . '/../db.php';

header('Content-Type: application/json; charset=utf-8');

try {
    $database = databaseConnection();

    // The report reason column is added on first write; older rows simply have
    // no reason, so read it only when it is actually present.
    $hasReportReason = tableHasColumn($database, 'site_feedback', 'report_reason');
    $reasonColumn = $hasReportReason ? ', report_reason' : '';

    $statement = $database->prepare(
        'SELECT feedback_id, rating, feedback_title, comment, display_name,
                is_anonymous, helpful_count, reported_count' . $reasonColumn . ', is_approved, created_at
         FROM site_feedback
         WHERE is_approved = 1
         ORDER BY created_at DESC, feedback_id DESC
         LIMIT 100'
    );
    $statement->execute();

    $feedbacks = [];
    foreach ($statement->fetchAll() as $row) {
        $isAnonymous = (int) $row['is_anonymous'] === 1;
        $feedbacks[] = [
            'feedback_id' => (int) $row['feedback_id'],
            'review_id' => (int) $row['feedback_id'],
            'rating' => (int) $row['rating'],
            'title' => (string) ($row['feedback_title'] ?? ''),
            'feedback_title' => (string) ($row['feedback_title'] ?? ''),
            'review_title' => (string) ($row['feedback_title'] ?? ''),
            'comment' => (string) $row['comment'],
            'report_reason' => $hasReportReason ? (string) ($row['report_reason'] ?? '') : '',
            'username' => $isAnonymous ? 'Anonymous' : (string) ($row['display_name'] ?? 'Guest'),
            'display_name' => $isAnonymous ? null : $row['display_name'],
            'is_anonymous' => $isAnonymous,
            'helpful_count' => (int) $row['helpful_count'],
            'reported_count' => (int) $row['reported_count'],
            'reported' => (int) $row['reported_count'] > 0,
            'is_approved' => (int) $row['is_approved'] === 1,
            'created_at' => (string) $row['created_at'],
        ];
    }

    echo json_encode($feedbacks, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
} catch (Throwable $error) {
    error_log('get-latest-feedback.php error: ' . $error->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Unable to retrieve feedback.']);
}
