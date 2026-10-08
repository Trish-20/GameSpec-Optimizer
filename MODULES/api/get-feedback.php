<?php

declare(strict_types=1);

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/admin-auth.php';

header('Content-Type: application/json; charset=utf-8');

try {
    $database = databaseConnection();
    $databaseOffsetMinutes = databaseUtcOffsetMinutes($database);

    $search = trim((string) ($_GET['search'] ?? ''));
    $rating = (int) ($_GET['rating'] ?? 0);
    $limit = max(1, min(200, (int) ($_GET['limit'] ?? 100)));
    $offset = max(0, (int) ($_GET['offset'] ?? 0));

    $conditions = ['is_approved = 1'];
    $parameters = [];

    if ($search !== '') {
        // Native prepared statements are used (emulated prepares are off), so each
        // placeholder may appear only once. Use a distinct name per column.
        $conditions[] = '(feedback_title LIKE :search_title
                         OR comment LIKE :search_comment
                         OR display_name LIKE :search_name)';
        $parameters['search_title'] = '%' . $search . '%';
        $parameters['search_comment'] = '%' . $search . '%';
        $parameters['search_name'] = '%' . $search . '%';
    }

    if ($rating >= 1 && $rating <= 5) {
        $conditions[] = 'rating = :rating';
        $parameters['rating'] = $rating;
    }

    // The report reason column is added on first write; older rows simply have
    // no reason, so read it only when it is actually present.
    $hasReportReason = tableHasColumn($database, 'site_feedback', 'report_reason');
    $reasonColumn = $hasReportReason ? ', report_reason' : '';

    $sql = 'SELECT feedback_id, rating, feedback_title, comment, display_name,
                   is_anonymous, helpful_count, reported_count' . $reasonColumn . ', is_approved, created_at
            FROM site_feedback
            WHERE ' . implode(' AND ', $conditions) . '
            ORDER BY created_at DESC, feedback_id DESC
            LIMIT :limit OFFSET :offset';

    $statement = $database->prepare($sql);
    foreach ($parameters as $name => $value) {
        $statement->bindValue(':' . $name, $value, $name === 'rating' ? PDO::PARAM_INT : PDO::PARAM_STR);
    }
    $statement->bindValue(':limit', $limit, PDO::PARAM_INT);
    $statement->bindValue(':offset', $offset, PDO::PARAM_INT);
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
            'database_utc_offset_minutes' => $databaseOffsetMinutes,
        ];
    }

    echo json_encode($feedbacks, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
} catch (Throwable $error) {
    error_log('get-feedback.php error: ' . $error->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Unable to retrieve feedback.']);
}
