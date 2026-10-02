<?php

declare(strict_types=1);

require_once __DIR__ . '/../../../MODULES/auth.php';
require_once __DIR__ . '/../../../MODULES/db.php';

startApplicationSession();
$selector = (string) ($_GET['selector'] ?? $_POST['selector'] ?? '');
$token = (string) ($_GET['token'] ?? $_POST['token'] ?? '');
$csrf = csrfToken();
$error = '';
$success = false;

if (!ctype_xdigit($selector) || !ctype_xdigit($token)) {
    $error = 'This reset link is invalid or expired.';
} elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $password = (string) ($_POST['password'] ?? '');
    $confirmation = (string) ($_POST['password_confirmation'] ?? '');

    if (!hasValidCsrfToken() || strlen($password) < 12 || !hash_equals($password, $confirmation)) {
        $error = 'Use a matching password with at least 12 characters.';
    } else {
        $database = databaseConnection();
        $statement = $database->prepare(
            'SELECT reset_id, user_id, token_hash
             FROM admin_password_resets
             WHERE selector = :selector AND expires_at > NOW() AND used_at IS NULL
             LIMIT 1'
        );
        $statement->execute(['selector' => $selector]);
        $reset = $statement->fetch();

        if (!$reset || !hash_equals((string) $reset['token_hash'], hash('sha256', $token))) {
            $error = 'This reset link is invalid or expired.';
        } else {
            $update = $database->prepare(
                'UPDATE users SET password_hash = :password_hash WHERE user_id = :user_id AND role = "admin"'
            );
            $update->execute([
                'password_hash' => password_hash($password, PASSWORD_DEFAULT),
                'user_id' => (int) $reset['user_id'],
            ]);
            $consume = $database->prepare(
                'UPDATE admin_password_resets SET used_at = NOW() WHERE reset_id = :reset_id'
            );
            $consume->execute(['reset_id' => (int) $reset['reset_id']]);
            $success = true;
        }
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Password - GameSpec Optimizer</title>
    <link rel="stylesheet" href="../../CSS/Admin Side/AdminSideStyle.css">
    <!-- Mobile layout layer: every rule sits inside a max-width media
         query, so desktop rendering is left completely untouched. -->
    <link rel="stylesheet" href="../../CSS/shared/MobileResponsive.css">
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
                    <h2>Choose a new password</h2>
                </div>
                <div class="admin-login-error-slot">
                    <?php if ($error !== ''): ?><div class="admin-login-error" role="alert"><?= htmlspecialchars($error, ENT_QUOTES, 'UTF-8') ?></div><?php endif; ?>
                    <?php if ($success): ?><p class="admin-login-recovery-message">Your password was updated. <a href="login.php">Sign in</a>.</p><?php endif; ?>
                </div>
                <?php if (!$success && $error === ''): ?>
                    <form method="post">
                        <input type="hidden" name="csrf_token" value="<?= htmlspecialchars($csrf, ENT_QUOTES, 'UTF-8') ?>">
                        <input type="hidden" name="selector" value="<?= htmlspecialchars($selector, ENT_QUOTES, 'UTF-8') ?>">
                        <input type="hidden" name="token" value="<?= htmlspecialchars($token, ENT_QUOTES, 'UTF-8') ?>">
                        <label for="password">New password</label>
                        <input id="password" name="password" type="password" minlength="12" required>
                        <label for="password_confirmation">Confirm password</label>
                        <input id="password_confirmation" name="password_confirmation" type="password" minlength="12" required>
                        <button type="submit" class="btn-primary">Update password</button>
                    </form>
                <?php endif; ?>
            </div>
        </section>
    </main>
</body>
</html>
