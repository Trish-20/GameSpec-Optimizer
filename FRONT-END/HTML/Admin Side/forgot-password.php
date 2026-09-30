<?php

declare(strict_types=1);

require_once __DIR__ . '/../../../MODULES/auth.php';
require_once __DIR__ . '/../../../MODULES/db.php';

startApplicationSession();

$message = 'If an active administrator account matches those details, a reset link has been sent.';
$csrf = csrfToken();

if ($_SERVER['REQUEST_METHOD'] === 'POST' && hasValidCsrfToken()) {
    $identity = trim((string) ($_POST['identity'] ?? ''));

    if ($identity !== '') {
        try {
            $database = databaseConnection();
            $statement = $database->prepare(
                'SELECT user_id, email
                 FROM users
                 WHERE (username = :identity OR email = :identity)
                   AND role = "admin" AND status = "active"
                 LIMIT 1'
            );
            $statement->execute(['identity' => $identity]);
            $user = $statement->fetch();

            if ($user) {
                $selector = bin2hex(random_bytes(16));
                $validator = bin2hex(random_bytes(32));
                $insert = $database->prepare(
                    'INSERT INTO admin_password_resets
                        (user_id, selector, token_hash, expires_at)
                     VALUES
                        (:user_id, :selector, :token_hash, DATE_ADD(NOW(), INTERVAL 30 MINUTE))'
                );
                $insert->execute([
                    'user_id' => (int) $user['user_id'],
                    'selector' => $selector,
                    'token_hash' => hash('sha256', $validator),
                ]);

                $baseUrl = rtrim((string) (loadEnvironment()['APP_BASE_URL'] ?? ''), '/');
                $resetUrl = $baseUrl . '/FRONT-END/HTML/Admin%20Side/reset-password.php?selector='
                    . rawurlencode($selector) . '&token=' . rawurlencode($validator);
                $subject = 'GameSpec Optimizer administrator password reset';
                $body = "Use this link within 30 minutes to reset your password:\n\n" . $resetUrl;
                $headers = 'From: ' . (loadEnvironment()['MAIL_FROM'] ?? 'no-reply@localhost');
                mail((string) $user['email'], $subject, $body, $headers);
            }
        } catch (Throwable $error) {
            error_log('Admin password reset request failed: ' . $error->getMessage());
        }
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Forgot Password - GameSpec Optimizer</title>
    <link rel="stylesheet" href="../../CSS/Admin Side/AdminSideStyle.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
</head>
<body class="admin-login-page">
    <main class="admin-login-layout">
        <section class="admin-login-brand">
            <div class="admin-login-brand-content">
                <p class="admin-login-eyebrow">Admin Panel</p>
                <h1>GameSpec Optimizer</h1>
                <p class="admin-login-tagline">Manage games, benchmarks, and performance insights from one place.</p>
            </div>
        </section>
        <section class="admin-login-form-panel">
            <div class="admin-login-form-content">
                <div class="admin-login-heading">
                    <p class="admin-login-eyebrow">Account recovery</p>
                    <h2>Reset your password</h2>
                </div>
                <div class="admin-login-error-slot">
                    <p class="admin-login-recovery-message"><?= htmlspecialchars($message, ENT_QUOTES, 'UTF-8') ?></p>
                </div>
                <form method="post">
                    <input type="hidden" name="csrf_token" value="<?= htmlspecialchars($csrf, ENT_QUOTES, 'UTF-8') ?>">
                    <label for="identity">Username or email</label>
                    <div class="admin-login-input-wrap">
                        <i class="fa-solid fa-user" aria-hidden="true"></i>
                        <input id="identity" name="identity" type="text" autocomplete="username" required>
                    </div>
                    <button type="submit" class="btn-primary">Send reset link</button>
                    <a class="admin-login-back-link" href="login.php">Back to sign in</a>
                </form>
            </div>
        </section>
    </main>
</body>
</html>
