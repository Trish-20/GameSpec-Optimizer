<?php

declare(strict_types=1);

require_once __DIR__ . '/../../../MODULES/auth.php';

startApplicationSession();

if ($_SERVER['REQUEST_METHOD'] === 'POST' && hasValidCsrfToken()) {
    logoutApplicationUser();
}

header('Location: login.php');
exit;
