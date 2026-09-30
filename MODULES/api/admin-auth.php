<?php

declare(strict_types=1);

require_once __DIR__ . '/../auth.php';

header('Content-Type: application/json; charset=utf-8');

requireAdminApi(($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET');
