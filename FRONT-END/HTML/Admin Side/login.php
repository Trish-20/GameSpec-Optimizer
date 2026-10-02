<?php

declare(strict_types=1);

require_once __DIR__ . '/../../../MODULES/auth.php';
require_once __DIR__ . '/../../../MODULES/db.php';

startApplicationSession();

if (isAdminUser()) {
    header('Location: dashboard-admin.php');
    exit;
}

$errorMessage = '';
$returnTo = (string) ($_GET['return_to'] ?? $_POST['return_to'] ?? 'dashboard-admin.php');
if (!str_starts_with($returnTo, '/') || str_starts_with($returnTo, '//')) {
    $returnTo = 'dashboard-admin.php';
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $username = trim((string) ($_POST['username'] ?? ''));
    $password = (string) ($_POST['password'] ?? '');
    $remember = isset($_POST['remember_me']) && $_POST['remember_me'] === '1';

    if (!hasValidCsrfToken() || $username === '' || $password === '') {
        $errorMessage = 'Invalid username or password.';
    } else {
        try {
            $database = databaseConnection();
            $statement = $database->prepare(
                'SELECT user_id, username, password_hash, role, status
                 FROM users
                 WHERE username = :username
                 LIMIT 1'
            );
            $statement->execute(['username' => $username]);
            $user = $statement->fetch();

            if ($user
                && $user['status'] === 'active'
                && $user['role'] === 'admin'
                && password_verify($password, (string) $user['password_hash'])) {
                loginApplicationUser($user, $remember);

                $update = $database->prepare(
                    'UPDATE users SET last_login_at = NOW() WHERE user_id = :user_id'
                );
                $update->execute(['user_id' => (int) $user['user_id']]);

                header('Location: ' . $returnTo);
                exit;
            }

            $errorMessage = 'Invalid username or password.';
        } catch (Throwable $error) {
            error_log('Admin login failed: ' . $error->getMessage());
            $errorMessage = 'Unable to sign in right now.';
        }
    }
}

$csrf = csrfToken();
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Login - GameSpec Optimizer</title>
    <link rel="stylesheet" href="../../CSS/Admin Side/AdminSideStyle.css">
    <!-- Mobile layout layer: every rule sits inside a max-width media
         query, so desktop rendering is left completely untouched. -->
    <link rel="stylesheet" href="../../CSS/shared/MobileResponsive.css?v=<?= @filemtime(__DIR__ . '/../../CSS/shared/MobileResponsive.css') ?: '1' ?>">
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
                    <div>
                        <p class="admin-login-eyebrow">Administrator access</p>
                        <h2>Sign in to continue</h2>
                    </div>
                </div>

                <div class="admin-login-error-slot" aria-live="polite">
                    <?php if ($errorMessage !== ''): ?>
                        <div class="admin-login-error" role="alert">
                            <?= htmlspecialchars($errorMessage, ENT_QUOTES, 'UTF-8') ?>
                        </div>
                    <?php endif; ?>
                </div>

                <form method="post" autocomplete="on">
                    <input type="hidden" name="csrf_token" value="<?= htmlspecialchars($csrf, ENT_QUOTES, 'UTF-8') ?>">
                    <input type="hidden" name="return_to" value="<?= htmlspecialchars($returnTo, ENT_QUOTES, 'UTF-8') ?>">

                    <label for="username">Username</label>
                    <div class="admin-login-input-wrap">
                        <i class="fa-solid fa-user" aria-hidden="true"></i>
                        <input id="username" name="username" type="text" autocomplete="username" required>
                    </div>

                    <div class="admin-login-password-label">
                        <label for="password">Password</label>
                        <a href="forgot-password.php">Forgot Password?</a>
                    </div>
                    <div class="admin-login-input-wrap">
                        <i class="fa-solid fa-lock" aria-hidden="true"></i>
                        <input id="password" name="password" type="password" autocomplete="current-password" required>
                        <button type="button" class="admin-login-password-toggle" aria-label="Show password" aria-controls="password">
                            <i class="fa-solid fa-eye" aria-hidden="true"></i>
                        </button>
                    </div>

                    <label class="admin-login-remember">
                        <input name="remember_me" type="checkbox" value="1">
                        <span>Remember me</span>
                    </label>
                    <button type="submit" class="btn-primary">Sign In</button>
                </form>
            </div>
        </section>
    </main>
    <script>
        const passwordInput = document.getElementById('password');
        const passwordToggle = document.querySelector('.admin-login-password-toggle');

        passwordToggle?.addEventListener('click', () => {
            const isPassword = passwordInput.type === 'password';
            passwordInput.type = isPassword ? 'text' : 'password';
            passwordToggle.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
            passwordToggle.querySelector('i').className = isPassword
                ? 'fa-solid fa-eye-slash'
                : 'fa-solid fa-eye';
        });
    </script>
</body>
</html>
