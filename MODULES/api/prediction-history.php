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
    $action = (string) ($_GET['action'] ?? 'list');

    if ($action === 'summary') {
        $summary = $database->query(
            'SELECT COUNT(*) AS total_predictions,
                    SUM(created_at >= CURRENT_DATE()) AS predictions_today,
                    COUNT(DISTINCT game_title) AS games_analyzed
             FROM prediction_history'
        )->fetch();
        $most = $database->query(
            'SELECT game_title, COUNT(*) AS prediction_count
             FROM prediction_history GROUP BY game_title
             ORDER BY prediction_count DESC, game_title ASC LIMIT 1'
        )->fetch();
        echo json_encode([
            'total_predictions' => (int) ($summary['total_predictions'] ?? 0),
            'predictions_today' => (int) ($summary['predictions_today'] ?? 0),
            'games_analyzed' => (int) ($summary['games_analyzed'] ?? 0),
            'most_analyzed_game' => $most ? (string) $most['game_title'] : null,
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($action === 'details') {
        $id = trim((string) ($_GET['id'] ?? ''));
        if (!preg_match('/^[a-f0-9-]{36}$/i', $id)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Invalid prediction ID.']);
            exit;
        }
        $statement = $database->prepare('SELECT * FROM prediction_history WHERE prediction_id = :id LIMIT 1');
        $statement->execute(['id' => $id]);
        $row = $statement->fetch();
        if (!$row) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Prediction not found.']);
            exit;
        }
        echo json_encode($row, JSON_UNESCAPED_UNICODE);
        exit;
    }

    $where = [];
    $params = [];
    $game = trim((string) ($_GET['game'] ?? ''));
    $date = trim((string) ($_GET['date'] ?? ''));
    $mode = trim((string) ($_GET['mode'] ?? ''));
    if ($game !== '' && mb_strlen($game) <= 255) {
        $where[] = 'game_title LIKE :game';
        $params['game'] = '%' . $game . '%';
    }
    if ($date !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
        $where[] = 'created_at >= :date_start AND created_at < DATE_ADD(:date_end, INTERVAL 1 DAY)';
        $params['date_start'] = $date;
        $params['date_end'] = $date;
    }
    if (in_array($mode, ['battery', 'balanced', 'performance'], true)) {
        $where[] = 'performance_mode = :mode';
        $params['mode'] = $mode;
    }
    $clause = $where ? ' WHERE ' . implode(' AND ', $where) : '';

    if ($action === 'export') {
        header_remove('Content-Type');
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="prediction-history.csv"');
        $output = fopen('php://output', 'w');
        fputcsv($output, ['Prediction ID', 'Date & Time', 'Game', 'CPU', 'GPU', 'RAM (GB)', 'Graphics Preset', 'Performance Mode', 'Predicted FPS', 'Recommendation', 'Hardware Input Method']);
        $statement = $database->prepare('SELECT * FROM prediction_history' . $clause . ' ORDER BY created_at DESC, prediction_id DESC');
        $statement->execute($params);
        while ($row = $statement->fetch()) {
            $values = [$row['prediction_id'], $row['created_at'], $row['game_title'], $row['cpu_model'], $row['gpu_model'], $row['ram_gb'], $row['graphics_preset'], $row['performance_mode'], $row['predicted_fps'], $row['recommendation'], $row['hardware_input_method']];
            foreach ($values as &$value) {
                if (is_string($value) && preg_match('/^[\s]*[=+@-]/', $value)) {
                    $value = "'" . $value;
                }
            }
            unset($value);
            fputcsv($output, $values);
        }
        fclose($output);
        exit;
    }

    $page = max(1, (int) ($_GET['page'] ?? 1));
    $pageSize = 20;
    $count = $database->prepare('SELECT COUNT(*) FROM prediction_history' . $clause);
    $count->execute($params);
    $total = (int) $count->fetchColumn();
    $statement = $database->prepare(
        'SELECT prediction_id, created_at, game_title, predicted_fps, performance_mode
         FROM prediction_history' . $clause . ' ORDER BY created_at DESC, prediction_id DESC
         LIMIT :limit OFFSET :offset'
    );
    foreach ($params as $name => $value) {
        $statement->bindValue(':' . $name, $value, PDO::PARAM_STR);
    }
    $statement->bindValue(':limit', $pageSize, PDO::PARAM_INT);
    $statement->bindValue(':offset', ($page - 1) * $pageSize, PDO::PARAM_INT);
    $statement->execute();
    echo json_encode(['records' => $statement->fetchAll(), 'page' => $page, 'page_size' => $pageSize, 'total' => $total], JSON_UNESCAPED_UNICODE);
} catch (Throwable $error) {
    error_log('Prediction history request failed.');
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Prediction history is temporarily unavailable.']);
}
