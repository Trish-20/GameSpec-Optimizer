<?php

declare(strict_types=1);

require_once __DIR__ . '/../../../MODULES/auth.php';
require_once __DIR__ . '/../../../MODULES/db.php';

startApplicationSession();
requireAdminPage();

try {
    $database = databaseConnection();
    $activeAdmin = $database->prepare(
        'SELECT user_id FROM users WHERE user_id = :user_id AND role = "admin" AND status = "active" LIMIT 1'
    );
    $activeAdmin->execute(['user_id' => (int) $_SESSION['user_id']]);
    if (!$activeAdmin->fetch()) {
        http_response_code(403);
        exit('Administrator access is required.');
    }
} catch (Throwable $error) {
    error_log('Admin account management access check failed.');
    http_response_code(503);
    exit('Admin account management is temporarily unavailable.');
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Accounts - Admin Panel</title>
    <link rel="stylesheet" href="../../CSS/Admin Side/AdminSideStyle.css">
    <link rel="stylesheet" href="../../CSS/shared/MobileResponsive.css?v=<?= @filemtime(__DIR__ . '/../../CSS/shared/MobileResponsive.css') ?: '1' ?>">
</head>
<body class="sidebar-open">
<?php include 'header.php'; ?>

<main class="content">
    <div class="page-container admin-settings-layout">
        <header class="admin-page-heading">
            <h2>Admin Accounts</h2>
            <p>Create administrator accounts for authorized system users.</p>
        </header>
        <section class="admin-card admin-settings-card admin-create-card">
            <div class="admin-settings-card-heading">
                <h3>Create Admin Account</h3>
                <p>New administrators can sign in with their username and password.</p>
            </div>
            <form id="createAdminForm" class="admin-create-form" novalidate>
                <div class="admin-account-form-grid">
                    <div class="admin-form-field">
                        <label for="newAdminUsername">Username</label>
                        <input id="newAdminUsername" name="username" type="text" minlength="3" maxlength="50"
                            pattern="[A-Za-z0-9][A-Za-z0-9._-]{2,49}" autocomplete="off" required>
                        <small>Use 3 to 50 letters, numbers, dots, underscores, or hyphens; start with a letter or number.</small>
                    </div>

                    <div class="admin-form-field">
                        <label for="newAdminEmail">Email</label>
                        <input id="newAdminEmail" name="email" type="email" maxlength="254" autocomplete="email" required>
                    </div>

                    <div class="admin-form-field">
                        <label for="newAdminDisplayName">Display Name</label>
                        <input id="newAdminDisplayName" name="display_name" type="text" maxlength="100" autocomplete="name">
                    </div>

                    <div class="admin-form-field">
                        <label for="newAdminPassword">Password</label>
                        <input id="newAdminPassword" name="password" type="password" minlength="12" maxlength="1024"
                            autocomplete="new-password" required>
                    </div>

                    <div class="admin-form-field">
                        <label for="newAdminPasswordConfirmation">Confirm Password</label>
                        <input id="newAdminPasswordConfirmation" name="password_confirmation" type="password" minlength="12"
                            maxlength="1024" autocomplete="new-password" required>
                    </div>
                </div>
                <div class="admin-create-actions">
                    <button class="btn-primary" type="submit">Create Account</button>
                    <p id="createAdminStatus" class="admin-form-status" role="status" aria-live="polite"></p>
                </div>
            </form>
        </section>
    </div>
</main>

<?php include 'footer.php'; ?>
<script>
    document.querySelector('[data-page="admin-accounts"]')?.classList.add('active');

    const createAdminForm = document.getElementById('createAdminForm');
    const createAdminStatus = document.getElementById('createAdminStatus');

    const setCreateAdminStatus = (message, state = '') => {
        createAdminStatus.textContent = message;
        createAdminStatus.className = `admin-form-status${state ? ` is-${state}` : ''}`;
    };

    createAdminForm?.addEventListener('submit', async (event) => {
        event.preventDefault();
        setCreateAdminStatus('');
        if (!createAdminForm.reportValidity()) return;

        const fields = new FormData(createAdminForm);
        if (fields.get('password') !== fields.get('password_confirmation')) {
            setCreateAdminStatus('The passwords do not match.', 'error');
            return;
        }

        const button = createAdminForm.querySelector('[type="submit"]');
        button.disabled = true;
        try {
            const response = await adminFetch('../../../MODULES/api/create-admin.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: String(fields.get('username') || '').trim(),
                    email: String(fields.get('email') || '').trim(),
                    display_name: String(fields.get('display_name') || '').trim(),
                    password: String(fields.get('password') || ''),
                    password_confirmation: String(fields.get('password_confirmation') || ''),
                }),
            });
            const result = await response.json().catch(() => null);
            if (!response.ok || !result || result.success !== true) {
                throw new Error(result?.message || 'Unable to create admin account.');
            }

            createAdminForm.reset();
            setCreateAdminStatus(result.message, 'success');
        } catch (error) {
            setCreateAdminStatus(error.message || 'Unable to create admin account.', 'error');
        } finally {
            button.disabled = false;
        }
    });
</script>
<script src="../../JAVASCRIPT/Admin Side/AdminSideFunction.js?v=<?= @filemtime(__DIR__ . '/../../JAVASCRIPT/Admin Side/AdminSideFunction.js') ?: '1' ?>"></script>
</body>
</html>
