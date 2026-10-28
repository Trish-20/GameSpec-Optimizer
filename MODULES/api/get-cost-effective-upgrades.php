<?php

declare(strict_types=1);

require_once __DIR__ . '/../cost-effective-upgrades.php';

header('Content-Type: application/json; charset=utf-8');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    http_response_code(405);
    header('Allow: POST');
    echo json_encode(['status' => 'error', 'message' => 'POST is required.']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Upgrade request data is invalid.']);
    exit;
}

try {
    echo json_encode(recommendCostEffectiveUpgrades($input, __DIR__ . '/../../DATA'), JSON_THROW_ON_ERROR);
} catch (Throwable $error) {
    error_log('Cost-effective hardware recommendation generation failed: ' . $error->getMessage());
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => 'Upgrade suggestions are temporarily unavailable. Existing performance results are unaffected.',
    ]);
}
