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
    <div class="page-container admin-settings-layout">
        <header class="admin-page-heading">
            <h2>Account Settings</h2>
            <p>Manage your administrator account and password recovery information.</p>
        </header>
        <section class="admin-card admin-settings-card">
            <div class="admin-settings-card-heading">
                <h3>Account Information</h3>
                <p>Your username is used for sign-in. Add a recovery email to use Forgot Password.</p>
            </div>
            <?php if ($account): ?>
                <div class="admin-account-form-grid">
                    <div class="admin-form-field">
                        <label for="adminUsername">Username</label>
                        <input id="adminUsername" type="text" value="<?= htmlspecialchars((string) $account['username'], ENT_QUOTES, 'UTF-8') ?>" readonly aria-readonly="true">
                    </div>
                    <form id="adminEmailForm" class="admin-form-field admin-email-form">
                        <label for="adminEmail">Recovery Email</label>
                        <input
                            id="adminEmail"
                            name="email"
                            type="email"
                            maxlength="254"
                            autocomplete="email"
                            value="<?= htmlspecialchars((string) ($account['email'] ?? ''), ENT_QUOTES, 'UTF-8') ?>"
                        >
                        <small>Your recovery email is used for password recovery.</small>
                        <button type="submit" class="btn-primary">Save Changes</button>
                        <p id="adminEmailStatus" class="admin-form-status" role="status" aria-live="polite"></p>
                    </form>
                </div>
            <?php else: ?>
                <p class="admin-form-status is-error" role="alert">Account settings are temporarily unavailable.</p>
            <?php endif; ?>
        </section>
    </div>
</main>

<?php include 'footer.php'; ?>
<script>
    document.querySelector('[data-page="account"]')?.classList.add('active');

    const adminEmailForm = document.getElementById('adminEmailForm');
    const adminEmailStatus = document.getElementById('adminEmailStatus');

    const setAdminEmailStatus = (message, state = '') => {
        if (!adminEmailStatus) return;
        adminEmailStatus.textContent = message;
        adminEmailStatus.className = `admin-form-status${state ? ` is-${state}` : ''}`;
    };

    adminEmailForm?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const button = adminEmailForm.querySelector('[type="submit"]');
        button.disabled = true;
        setAdminEmailStatus('');

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
            setAdminEmailStatus(result.message, 'success');
        } catch (error) {
            setAdminEmailStatus(error.message || 'Unable to update the account email.', 'error');
        } finally {
            button.disabled = false;
        }
    });
</script>
<script src="../../JAVASCRIPT/Admin Side/AdminSideFunction.js?v=<?= @filemtime(__DIR__ . '/../../JAVASCRIPT/Admin Side/AdminSideFunction.js') ?: '1' ?>"></script>
</body>
</html>
