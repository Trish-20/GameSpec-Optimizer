<?php

declare(strict_types=1);

require_once __DIR__ . '/../../../MODULES/auth.php';
require_once __DIR__ . '/../../../MODULES/db.php';

startApplicationSession();

$message = '';
$formError = '';
$requestAccepted = false;
$emailValue = '';
$csrf = csrfToken();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!hasValidCsrfToken()) {
        $formError = 'This session has expired. Please refresh the page and try again.';
    } else {
        $email = trim((string) ($_POST['email'] ?? ''));
        $emailValue = $email;

        if ($email === '' || strlen($email) > 254 || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
            $formError = 'Please enter a valid email address.';
        } else {
            // Generic public response for every valid-format address so the
            // page never reveals whether an account exists (anti-enumeration).
            $message = 'If an account matches that email, a reset link has been sent.';
            // UI convenience only: allow the frontend countdown for any
            // valid-format request. This is not a security throttle.
            $requestAccepted = true;
            $deliverySucceeded = false;
            // Fixed stage labels only — never values. Lets the catch block say
            // how far processing got without leaking secrets.
            $resetStage = 'start';
            try {
            $database = databaseConnection();
            $resetStage = 'db_ok';
            $statement = $database->prepare(
                'SELECT user_id, email
                 FROM users
                 WHERE email = :email
                   AND role = "admin" AND status = "active"
                 LIMIT 1'
            );
            $statement->execute(['email' => $email]);
            $user = $statement->fetch();
            $resetStage = 'admin_lookup_done';

            if ($user) {
                $selector = bin2hex(random_bytes(16));
                $validator = bin2hex(random_bytes(32));
                $resetStage = 'token_generated';
                $insert = $database->prepare(
                    'INSERT INTO admin_password_resets
                        (user_id, selector, token_hash, expires_at)
                     VALUES
                     (:user_id, :selector, :token_hash, DATE_ADD(NOW(), INTERVAL 60 MINUTE))'
                );
                $resetStage = 'token_prepare_ok';
                $insert->execute([
                    'user_id' => (int) $user['user_id'],
                    'selector' => $selector,
                    'token_hash' => hash('sha256', $validator),
                ]);
                $resetStage = 'token_created';

                $environment = loadEnvironment();
                // Configure APP_BASE_URL in Render, or use Render's service URL.
                // Do not build reset links from the request Host header.
                $baseUrl = rtrim((string) ($environment['APP_BASE_URL'] ?? $environment['RENDER_EXTERNAL_URL'] ?? ''), '/');
                $baseParts = parse_url($baseUrl);
                if ($baseParts === false || !in_array($baseParts['scheme'] ?? '', ['http', 'https'], true)
                    || empty($baseParts['host']) || isset($baseParts['user']) || isset($baseParts['pass'])) {
                    throw new RuntimeException('Password reset base URL is not configured.');
                }

                // Include the application's install folder when it is served
                // below the configured site URL (for example, XAMPP /New/GameSpec-Optimizer).
                $scriptPath = str_replace('\\', '/', rawurldecode((string) ($_SERVER['SCRIPT_NAME'] ?? '')));
                $forgotPath = '/FRONT-END/HTML/Admin Side/forgot-password.php';
                $scriptPrefix = str_ends_with($scriptPath, $forgotPath)
                    ? rtrim(substr($scriptPath, 0, -strlen($forgotPath)), '/')
                    : '';
                $basePath = rtrim((string) ($baseParts['path'] ?? ''), '/');
                $installPath = $basePath;
                if ($scriptPrefix !== '' && $basePath === '') {
                    $installPath = $scriptPrefix;
                } elseif ($scriptPrefix !== '' && str_starts_with($scriptPrefix, $basePath . '/')) {
                    $installPath = $scriptPrefix;
                }
                $siteOrigin = $baseParts['scheme'] . '://' . $baseParts['host']
                    . (isset($baseParts['port']) ? ':' . $baseParts['port'] : '');

                $resetUrl = $siteOrigin . $installPath . '/FRONT-END/HTML/Admin%20Side/reset-password.php?selector='
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
                $resetStage = 'brevo_attempted';
                $responseBody = curl_exec($handle);
                $curlFailed = $responseBody === false;
                $curlErrno = $curlFailed ? (int) curl_errno($handle) : 0;
                $httpStatus = (int) curl_getinfo($handle, CURLINFO_HTTP_CODE);
                curl_close($handle);

                if ($curlFailed || $httpStatus < 200 || $httpStatus >= 300) {
                    // Internal delivery state only. The public message stays
                    // generic so account existence is never revealed.
                    // Never log API keys, tokens, emails, or response bodies.
                    error_log(sprintf(
                        'Password reset email delivery failed; Brevo HTTP status %d; curl errno %d.',
                        $httpStatus,
                        $curlErrno
                    ));
                    // Keep the hashed token valid for 60 minutes. A new request
                    // can issue another link if delivery needs to be retried.
                } else {
                    $deliverySucceeded = true;
                    error_log('Password reset email accepted by Brevo.');
                }
            }
        } catch (Throwable $error) {
            // Internal failure only; the public message stays generic.
            // Never include credentials, tokens, emails, messages, or URLs.
            // Stage is a fixed label; code is a 5-char SQLSTATE or a fixed word.
            $diagCode = ($error instanceof PDOException) ? (string) $error->getCode() : 'non-pdo';
            if (!preg_match('/^[0-9A-Z]{5}$/', $diagCode)) {
                $diagCode = 'non-sqlstate';
            }
            error_log('Admin password reset request could not be completed; stage=' . $resetStage . '; code=' . $diagCode . '.');
        }
        // Note: $requestAccepted remains true for any valid-format email so
        // the UI countdown is consistent and does not leak account existence.
        // $deliverySucceeded is the internal Brevo result only.
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
    <script>try { document.documentElement.dataset.theme = localStorage.getItem('gamespec-theme') === 'dark' ? 'dark' : 'light'; } catch (e) { document.documentElement.dataset.theme = 'light'; }</script>
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
                    <?php if ($formError !== ''): ?><div class="admin-login-error" role="alert"><?= htmlspecialchars($formError, ENT_QUOTES, 'UTF-8') ?></div><?php endif; ?>
                    <p class="admin-login-recovery-message"><?= htmlspecialchars($message, ENT_QUOTES, 'UTF-8') ?></p>
                </div>
                <form method="post" id="forgot-password-form" data-reset-accepted="<?= $requestAccepted ? '1' : '0' ?>">
                    <input type="hidden" name="csrf_token" value="<?= htmlspecialchars($csrf, ENT_QUOTES, 'UTF-8') ?>">
                    <label for="email">Email address</label>
                    <div class="admin-login-input-wrap">
                        <i class="fa-solid fa-envelope" aria-hidden="true"></i>
                        <input id="email" name="email" type="email" autocomplete="email" maxlength="254" required value="<?= htmlspecialchars($emailValue, ENT_QUOTES, 'UTF-8') ?>">
                    </div>
                    <button type="submit" class="btn-primary" id="send-reset-link-btn">Send reset link</button>
                    <a class="admin-login-back-link" id="back-to-sign-in" href="login.php">Back to sign in</a>
                </form>
            </div>
        </section>
    </main>
    <script>
        (function () {
            // 60-second resend cooldown: UI convenience only, not a security
            // throttle. localStorage lets the countdown survive a refresh.
            var COOLDOWN_SECONDS = 60;
            var STORAGE_KEY = 'gamespec_pw_reset_cooldown_until';
            var form = document.getElementById('forgot-password-form');
            var button = document.getElementById('send-reset-link-btn');
            var emailInput = document.getElementById('email');
            if (!form || !button) {
                return;
            }
            var originalLabel = button.textContent;
            var timerId = null;
            var isSubmitting = false;

            // Leaving for sign-in cancels the resend wait on this device.
            // Refreshing this page keeps the stored cooldown (see resume block below).
            var backLink = document.getElementById('back-to-sign-in');
            if (backLink) {
                backLink.addEventListener('click', function () {
                    if (timerId !== null) {
                        clearInterval(timerId);
                        timerId = null;
                    }
                    try {
                        localStorage.removeItem(STORAGE_KEY);
                    } catch (storageError) {
                        /* Storage unavailable: nothing to clear. */
                    }
                    // Do not preventDefault: navigation to login.php proceeds.
                });
            }

            function isValidEmail(value) {
                return value.length > 0
                    && value.length <= 254
                    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
            }

            function clearTimer() {
                if (timerId !== null) {
                    clearInterval(timerId);
                    timerId = null;
                }
            }

            function renderCountdown(remaining) {
                button.disabled = true;
                button.setAttribute('aria-disabled', 'true');
                button.textContent = 'Resend link in ' + remaining + ' second' + (remaining === 1 ? '' : 's');
            }

            function finishCountdown() {
                clearTimer();
                try {
                    localStorage.removeItem(STORAGE_KEY);
                } catch (storageError) {
                    /* Storage unavailable: countdown simply does not persist. */
                }
                button.disabled = false;
                button.removeAttribute('aria-disabled');
                button.textContent = originalLabel;
            }

            function startCountdown(seconds) {
                var until = Date.now() + seconds * 1000;
                try {
                    localStorage.setItem(STORAGE_KEY, String(until));
                } catch (storageError) {
                    /* Storage unavailable: countdown runs for this view only. */
                }
                tick(until);
                clearTimer();
                timerId = setInterval(function () {
                    tick(until);
                }, 1000);
            }

            function tick(until) {
                var remaining = Math.ceil((until - Date.now()) / 1000);
                if (remaining <= 0) {
                    finishCountdown();
                    return;
                }
                renderCountdown(remaining);
            }

            // Resume a cooldown started before a refresh.
            var storedUntil = 0;
            try {
                storedUntil = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10) || 0;
            } catch (storageError) {
                storedUntil = 0;
            }
            if (storedUntil > Date.now()) {
                clearTimer();
                timerId = setInterval(function () {
                    tick(storedUntil);
                }, 1000);
                tick(storedUntil);
            } else if (form.getAttribute('data-reset-accepted') === '1') {
                // The server accepted a valid-format request on this load.
                startCountdown(COOLDOWN_SECONDS);
            }

            form.addEventListener('submit', function (event) {
                if (isSubmitting || button.disabled) {
                    // Prevent repeated clicks / duplicate posts during cooldown.
                    event.preventDefault();
                    return;
                }
                var value = (emailInput && emailInput.value ? emailInput.value : '').trim();
                if (!isValidEmail(value)) {
                    event.preventDefault();
                    if (emailInput) {
                        emailInput.focus();
                    }
                    return;
                }
                isSubmitting = true;
                button.disabled = true;
                button.setAttribute('aria-disabled', 'true');
            });
        })();
    </script>
</body>
</html>
