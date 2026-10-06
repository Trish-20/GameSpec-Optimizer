<?php

declare(strict_types=1);

require_once __DIR__ . '/../../../MODULES/auth.php';
require_once __DIR__ . '/../../../MODULES/db.php';

startApplicationSession();
requireAdminPage();

$account = null;
try {
    $database = databaseConnection();
    $statement = $database->prepare(
        'SELECT username, email FROM users WHERE user_id = :user_id AND role = "admin" AND status = "active" LIMIT 1'
    );
    $statement->execute(['user_id' => (int) $_SESSION['user_id']]);
    $account = $statement->fetch();
} catch (Throwable $error) {
    error_log('Admin account settings could not be loaded.');
}

if (!$account) {
    http_response_code(503);
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Account Settings - Admin Panel</title>
    <link rel="stylesheet" href="../../CSS/Admin Side/AdminSideStyle.css">
    <link rel="stylesheet" href="../../CSS/shared/MobileResponsive.css?v=<?= @filemtime(__DIR__ . '/../../CSS/shared/MobileResponsive.css') ?: '1' ?>">
</head>
<body class="sidebar-open">
<?php include 'header.php'; ?>

<main class="content">
    <div class="page-container">
        <h2>Account Settings</h2>
        <section class="admin-card" style="max-width: 680px;">
            <h3>Recovery email</h3>
            <p>Your email is used only for password recovery. It is not required for username and password sign-in.</p>
            <?php if ($account): ?>
                <p><strong>Username:</strong> <?= htmlspecialchars((string) $account['username'], ENT_QUOTES, 'UTF-8') ?></p>
                <form id="adminEmailForm">
                    <label for="adminEmail">Email address <span>(optional; required to use Forgot Password)</span></label>
                    <input
                        id="adminEmail"
                        name="email"
                        type="email"
                        maxlength="254"
                        autocomplete="email"
                        value="<?= htmlspecialchars((string) ($account['email'] ?? ''), ENT_QUOTES, 'UTF-8') ?>"
                    >
                    <button type="submit" class="btn-primary">Save Email</button>
                    <p id="adminEmailStatus" role="status" aria-live="polite"></p>
                </form>
            <?php else: ?>
                <p role="alert">Account settings are temporarily unavailable.</p>
            <?php endif; ?>
        </section>
    </div>
</main>

<?php include 'footer.php'; ?>
<script>
    document.querySelector('[data-page="account"]')?.classList.add('active');

    const adminEmailForm = document.getElementById('adminEmailForm');
    const adminEmailStatus = document.getElementById('adminEmailStatus');

    adminEmailForm?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const button = adminEmailForm.querySelector('[type="submit"]');
        button.disabled = true;
        adminEmailStatus.textContent = '';

        try {
            const response = await adminFetch('../../../MODULES/api/update-admin-email.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: document.getElementById('adminEmail').value.trim() }),
            });
            const result = await response.json().catch(() => null);
            if (!response.ok || !result || result.success !== true) {
                throw new Error(result?.message || 'Unable to update the account email.');
            }
            adminEmailStatus.textContent = result.message;
        } catch (error) {
            adminEmailStatus.textContent = error.message || 'Unable to update the account email.';
        } finally {
            button.disabled = false;
        }
    });
</script>
<script src="../../JAVASCRIPT/Admin Side/AdminSideFunction.js?v=<?= @filemtime(__DIR__ . '/../../JAVASCRIPT/Admin Side/AdminSideFunction.js') ?: '1' ?>"></script>
</body>
</html>
