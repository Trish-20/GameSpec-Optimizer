<?php

declare(strict_types=1);

require_once __DIR__ . '/../../../MODULES/auth.php';
require_once __DIR__ . '/../../../MODULES/db.php';

startApplicationSession();

$message = 'If an account matches that email, a reset link has been sent.';
$csrf = csrfToken();

if ($_SERVER['REQUEST_METHOD'] === 'POST' && hasValidCsrfToken()) {
    $email = trim((string) ($_POST['email'] ?? ''));

    if ($email !== '' && strlen($email) <= 254 && filter_var($email, FILTER_VALIDATE_EMAIL) !== false) {
        try {
            $database = databaseConnection();
            $statement = $database->prepare(
                'SELECT user_id, email
                 FROM users
                 WHERE email = :email
                   AND role = "admin" AND status = "active"
                 LIMIT 1'
            );
            $statement->execute(['email' => $email]);
            $user = $statement->fetch();

            if ($user) {
                $selector = bin2hex(random_bytes(16));
                $validator = bin2hex(random_bytes(32));
                $insert = $database->prepare(
                    'INSERT INTO admin_password_resets
                        (user_id, selector, token_hash, expires_at)
                     VALUES
                     (:user_id, :selector, :token_hash, DATE_ADD(NOW(), INTERVAL 60 MINUTE))'
                );
                $insert->execute([
                    'user_id' => (int) $user['user_id'],
                    'selector' => $selector,
                    'token_hash' => hash('sha256', $validator),
                ]);

                $environment = loadEnvironment();
                // Configure APP_BASE_URL in Render, or use Render's service URL.
                // Do not build reset links from the request Host header.
                $baseUrl = rtrim((string) ($environment['APP_BASE_URL'] ?? $environment['RENDER_EXTERNAL_URL'] ?? ''), '/');
                $baseParts = parse_url($baseUrl);
                if ($baseParts === false || !in_array($baseParts['scheme'] ?? '', ['http', 'https'], true)
                    || empty($baseParts['host']) || isset($baseParts['user']) || isset($baseParts['pass'])) {
                    throw new RuntimeException('Password reset base URL is not configured.');
                }

                $resetUrl = $baseUrl . '/FRONT-END/HTML/Admin%20Side/reset-password.php?selector='
                    . rawurlencode($selector) . '&token=' . rawurlencode($validator);
                $apiKey = trim((string) ($environment['BREVO_API_KEY'] ?? ''));
                $senderEmail = trim((string) ($environment['BREVO_SENDER_EMAIL'] ?? ''));
                $senderName = trim((string) ($environment['BREVO_SENDER_NAME'] ?? ''));
                if ($apiKey === '' || $senderName === ''
                    || filter_var($senderEmail, FILTER_VALIDATE_EMAIL) === false
                    || preg_match('/[\\r\\n]/', $senderName)) {
                    throw new RuntimeException('Password reset email configuration is incomplete.');
                }
                if (!function_exists('curl_init')) {
                    throw new RuntimeException('PHP cURL is unavailable.');
                }

                $escape = static fn (string $value): string => htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                $safeResetUrl = $escape($resetUrl);
                $payload = [
                    'sender' => ['name' => $senderName, 'email' => $senderEmail],
                    'to' => [['email' => (string) $user['email']]],
                    'subject' => 'GameSpec Optimizer - Password Reset',
                    'htmlContent' => '<p>Hello,</p>'
                        . '<p>We received a request to reset your GameSpec Optimizer password.</p>'
                        . '<p><a href="' . $safeResetUrl . '" style="display:inline-block;padding:12px 20px;'
                        . 'background:#45c98a;color:#07110d;text-decoration:none;border-radius:6px">Reset Password</a></p>'
                        . '<p>This link will expire after 60 minutes.</p>'
                        . '<p>If you did not request a password reset, you can safely ignore this email.</p>',
                    'textContent' => "Hello,\n\nWe received a request to reset your GameSpec Optimizer password.\n\n"
                        . "Reset your password using this link within 60 minutes:\n" . $resetUrl . "\n\n"
                        . 'If you did not request a password reset, you can safely ignore this email.',
                ];
                $handle = curl_init('https://api.brevo.com/v3/smtp/email');
                curl_setopt_array($handle, [
                    CURLOPT_POST => true,
                    CURLOPT_RETURNTRANSFER => true,
                    CURLOPT_CONNECTTIMEOUT => 10,
                    CURLOPT_TIMEOUT => 25,
                    CURLOPT_HTTPHEADER => [
                        'accept: application/json',
                        'api-key: ' . $apiKey,
                        'content-type: application/json',
                    ],
                    CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                ]);
                $responseBody = curl_exec($handle);
                $curlFailed = $responseBody === false;
                $httpStatus = (int) curl_getinfo($handle, CURLINFO_HTTP_CODE);
                curl_close($handle);

                if ($curlFailed || $httpStatus < 200 || $httpStatus >= 300) {
                    error_log('Password reset email delivery failed; Brevo HTTP status ' . $httpStatus . '.');
                    // Keep the hashed token valid for 60 minutes. A new request
                    // can issue another link if delivery needs to be retried.
                }
            }
        } catch (Throwable $error) {
            error_log('Admin password reset request could not be completed.');
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
                    <p class="admin-login-eyebrow">Account recovery</p>
                    <h2>Reset your password</h2>
                </div>
                <div class="admin-login-error-slot">
                    <p class="admin-login-recovery-message"><?= htmlspecialchars($message, ENT_QUOTES, 'UTF-8') ?></p>
                </div>
                <form method="post">
                    <input type="hidden" name="csrf_token" value="<?= htmlspecialchars($csrf, ENT_QUOTES, 'UTF-8') ?>">
                    <label for="email">Email address</label>
                    <div class="admin-login-input-wrap">
                        <i class="fa-solid fa-envelope" aria-hidden="true"></i>
                        <input id="email" name="email" type="email" autocomplete="email" maxlength="254" required>
                    </div>
                    <button type="submit" class="btn-primary">Send reset link</button>
                    <a class="admin-login-back-link" href="login.php">Back to sign in</a>
                </form>
            </div>
        </section>
    </main>
</body>
</html>
