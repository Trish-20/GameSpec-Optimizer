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
        'SELECT username, email, role, status FROM users WHERE user_id = :user_id AND role = "admin" AND status = "active" LIMIT 1'
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
    <title>Account Management - Admin Panel</title>
    <link rel="stylesheet" href="../../CSS/Admin Side/AdminSideStyle.css">
    <link rel="stylesheet" href="../../CSS/shared/MobileResponsive.css?v=<?= @filemtime(__DIR__ . '/../../CSS/shared/MobileResponsive.css') ?: '1' ?>">
</head>
<body class="sidebar-open">
<?php include 'header.php'; ?>

<main class="content">
    <div class="page-container">
        <header class="admin-page-heading">
            <h2>Account Management</h2>
            <p>Manage your administrator account and view authorized administrator accounts.</p>
        </header>
        <section class="admin-card">
            <h3>My Account</h3>
            <p>Your username is used for sign-in. Add a recovery email to use Forgot Password.</p>
            <hr>
            <?php if ($account): ?>
                <div class="form-grid-2x2">
                    <div class="form-field">
                        <label for="adminUsername">Username</label>
                        <input id="adminUsername" type="text" value="<?= htmlspecialchars((string) $account['username'], ENT_QUOTES, 'UTF-8') ?>" readonly aria-readonly="true">
                    </div>
                    <div class="form-field">
                        <label>Role / Status</label>
                        <input type="text" value="<?= htmlspecialchars((string) $account['role'] . ' / ' . (string) $account['status'], ENT_QUOTES, 'UTF-8') ?>" readonly aria-readonly="true">
                    </div>
                    <form id="adminEmailForm" class="form-field admin-email-form">
                        <label for="adminEmail">Recovery Email</label>
                        <input
                            id="adminEmail"
                            name="email"
                            type="email"
                            maxlength="254"
                            autocomplete="email"
                            value="<?= htmlspecialchars((string) ($account['email'] ?? ''), ENT_QUOTES, 'UTF-8') ?>"   
                        >
                        <div class="admin-email-form-footer">
                            <small>Your recovery email is used for password recovery.</small>
                            <button type="submit" class="btn-primary">Save Changes</button>
                        </div>
                        <p id="adminEmailStatus" class="admin-form-status" role="status" aria-live="polite"></p>
                    </form>
                </div>
            <?php else: ?>
                <p class="admin-form-status is-error" role="alert">Account settings are temporarily unavailable.</p>
            <?php endif; ?>
        </section>
        <section class="admin-card admin-create-card">
            <h3>Administrator Accounts</h3>
            <p>Accounts with administrator access to this panel.</p>
            <hr>
            <div class="table-container">
                <table>
                    <thead><tr><th>Username</th><th>Email</th><th>Role</th><th>Status</th><th>Created</th><th>Last Login</th></tr></thead>
                    <tbody id="adminAccountsRows"><tr><td colspan="6">Loading administrator accounts...</td></tr></tbody>
                </table>
            </div>
            <div class="form-action-row"><button id="showCreateAdmin" class="btn-primary" type="button">+ Create Administrator</button></div>
            <div class="modal-overlay admin-create-modal" id="createAdminModal" aria-hidden="true" hidden>
                <section class="modal-dialog admin-create-dialog" role="dialog" aria-modal="true" aria-labelledby="createAdminTitle">
                    <div class="modal-header">
                        <h2 id="createAdminTitle">Create Administrator</h2>
                        <button class="modal-close" id="closeCreateAdmin" type="button" aria-label="Close">&times;</button>
                    </div>
                    <form id="createAdminForm" novalidate>
                        <div class="modal-body admin-create-modal-body">
                            <div class="form-grid-2x2">
                                <div class="form-field"><label for="newAdminUsername">Username</label><input id="newAdminUsername" name="username" type="text" minlength="3" maxlength="50" pattern="[A-Za-z0-9][A-Za-z0-9._-]{2,49}" required></div>
                                <div class="form-field"><label for="newAdminEmail">Email</label><input id="newAdminEmail" name="email" type="email" maxlength="254" required></div>
                                <div class="form-field"><label for="newAdminDisplayName">Display Name</label><input id="newAdminDisplayName" name="display_name" type="text" maxlength="100"></div>
                                <div class="form-field"><label for="newAdminPassword">Password</label><input id="newAdminPassword" name="password" type="password" minlength="12" maxlength="1024" autocomplete="new-password" required></div>
                                <div class="form-field"><label for="newAdminPasswordConfirmation">Confirm Password</label><input id="newAdminPasswordConfirmation" name="password_confirmation" type="password" minlength="12" maxlength="1024" autocomplete="new-password" required></div>
                            </div>
                        </div>
                        <div class="modal-footer admin-create-modal-footer">
                            <p id="createAdminStatus" class="admin-form-status" role="status" aria-live="polite"></p>
                            <button class="btn-primary" type="submit">Create Account</button>
                            <button class="btn-secondary" id="cancelCreateAdmin" type="button">Cancel</button>
                        </div>
                    </form>
                </section>
            </div>
        </section>
    </div>
</main>

<?php include 'footer.php'; ?>
<script>
    document.querySelector('[data-page="account-management"]')?.classList.add('active');

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

    const adminAccountsRows = document.getElementById('adminAccountsRows');
    const createAdminModal = document.getElementById('createAdminModal');
    const createAdminForm = document.getElementById('createAdminForm');
    const createAdminStatus = document.getElementById('createAdminStatus');
    const createAdminTrigger = document.getElementById('showCreateAdmin');
    const openCreateAdminModal = () => {
        setCreateAdminStatus('');
        createAdminModal.hidden = false;
        createAdminModal.classList.add('active');
        createAdminModal.setAttribute('aria-hidden', 'false');
        document.getElementById('newAdminUsername').focus();
    };
    const closeCreateAdminModal = () => {
        createAdminModal.classList.remove('active');
        createAdminModal.setAttribute('aria-hidden', 'true');
        createAdminModal.hidden = true;
        createAdminTrigger.focus();
    };
    const setCreateAdminStatus = (message, state = '') => {
        createAdminStatus.textContent = message;
        createAdminStatus.className = `admin-form-status${state ? ` is-${state}` : ''}`;
    };
    async function loadAdminAccounts() {
        adminAccountsRows.innerHTML = '<tr><td colspan="6">Loading administrator accounts...</td></tr>';
        try {
            const response = await adminFetch('../../../MODULES/api/get-admin-accounts.php');
            const accounts = await response.json();
            const accountList = Array.isArray(accounts) ? accounts : accounts.accounts;
            if (!response.ok || !Array.isArray(accountList)) throw new Error(accounts.message || 'Unable to load administrator accounts.');
            const databaseOffsetMinutes = Number.isFinite(Number(accounts.database_utc_offset_minutes))
                ? Number(accounts.database_utc_offset_minutes)
                : 0;
            adminAccountsRows.innerHTML = accountList.length ? accountList.map(account => `<tr>
                <td>${escapeAccountValue(account.username)}</td><td>${escapeAccountValue(account.email || '—')}</td>
                <td>${escapeAccountValue(account.role)}</td><td>${escapeAccountValue(account.status)}</td>
                <td>${escapeAccountValue(formatAdminDateTime(account.created_at, databaseOffsetMinutes))}</td><td>${escapeAccountValue(formatAdminDateTime(account.last_login_at, databaseOffsetMinutes))}</td>
            </tr>`).join('') : '<tr><td colspan="6">No administrator accounts found.</td></tr>';
        } catch (error) { adminAccountsRows.innerHTML = `<tr><td colspan="6">${escapeAccountValue(error.message || 'Account list unavailable.')}</td></tr>`; }
    }
    function formatAdminDateTime(value, databaseOffsetMinutes) {
        if (!value) return '—';
        const parts = String(value).match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
        if (!parts) return String(value);
        const date = new Date(Date.UTC(
            Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]),
            Number(parts[4]), Number(parts[5]), Number(parts[6] || 0)
        ) - databaseOffsetMinutes * 60_000);
        if (Number.isNaN(date.getTime())) return String(value);
        return new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
            timeZone: 'Asia/Taipei',
        }).format(date);
    }
    function escapeAccountValue(value) {
        return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
    }
    createAdminTrigger.addEventListener('click', openCreateAdminModal);
    document.getElementById('cancelCreateAdmin').addEventListener('click', () => {
        createAdminForm.reset();
        setCreateAdminStatus('');
        closeCreateAdminModal();
    });
    document.getElementById('closeCreateAdmin').addEventListener('click', closeCreateAdminModal);
    createAdminModal.addEventListener('click', event => {
        if (event.target === createAdminModal) closeCreateAdminModal();
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !createAdminModal.hidden) closeCreateAdminModal();
    });
    createAdminForm.addEventListener('submit', async event => {
        event.preventDefault();
        if (!createAdminForm.reportValidity()) return;
        const fields = new FormData(createAdminForm);
        if (fields.get('password') !== fields.get('password_confirmation')) return setCreateAdminStatus('The passwords do not match.', 'error');
        const button = createAdminForm.querySelector('[type="submit"]');
        button.disabled = true;
        try {
            const response = await adminFetch('../../../MODULES/api/create-admin.php', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: String(fields.get('username')).trim(), email: String(fields.get('email')).trim(), display_name: String(fields.get('display_name') || '').trim(), password: String(fields.get('password')), password_confirmation: String(fields.get('password_confirmation')) })
            });
            const result = await response.json().catch(() => null);
            if (!response.ok || !result?.success) throw new Error(result?.message || 'Unable to create administrator account.');
            createAdminForm.reset();
            setCreateAdminStatus(result.message, 'success');
            await loadAdminAccounts();
        } catch (error) { setCreateAdminStatus(error.message || 'Unable to create administrator account.', 'error'); }
        finally { button.disabled = false; }
    });
    loadAdminAccounts();
</script>
<script src="../../JAVASCRIPT/Admin Side/AdminSideFunction.js?v=<?= @filemtime(__DIR__ . '/../../JAVASCRIPT/Admin Side/AdminSideFunction.js') ?: '1' ?>"></script>
</body>
</html>
