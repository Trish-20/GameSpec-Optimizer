<?php

declare(strict_types=1);

const ADMIN_REMEMBER_COOKIE = 'gamespec_admin_remember';
const ADMIN_REMEMBER_DAYS = 30;

function startApplicationSession(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (isset($_SERVER['SERVER_PORT']) && (int) $_SERVER['SERVER_PORT'] === 443);

    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    ini_set('session.cookie_httponly', '1');
    ini_set('session.cookie_samesite', 'Lax');
    ini_set('session.gc_maxlifetime', '1800');

    session_name('gamespec_admin');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => $isHttps,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);

    session_start();

    $sessionTimeout = !empty($_SESSION['remembered']) ? ADMIN_REMEMBER_DAYS * 86400 : 1800;
    if (isset($_SESSION['authenticated_at'])
        && time() - (int) $_SESSION['authenticated_at'] > $sessionTimeout) {
        logoutApplicationUser();
        session_start();
    }

    if (!isset($_SESSION['user_id'])) {
        restoreRememberedAdmin();
    }
}

function csrfToken(): string
{
    startApplicationSession();

    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }

    return (string) $_SESSION['csrf_token'];
}

function isAuthenticatedUser(): bool
{
    startApplicationSession();

    return isset($_SESSION['user_id'], $_SESSION['role'])
        && (int) $_SESSION['user_id'] > 0;
}

function isAdminUser(): bool
{
    startApplicationSession();

    return isAuthenticatedUser() && $_SESSION['role'] === 'admin';
}

function requireAdminPage(): void
{
    if (!isAdminUser()) {
        $returnTo = $_SERVER['REQUEST_URI'] ?? '';
        $location = 'login.php';
        if ($returnTo !== '') {
            $location .= '?return_to=' . rawurlencode($returnTo);
        }

        header('Location: ' . $location, true, 302);
        exit;
    }

    csrfToken();
}

function requireAdminApi(bool $checkCsrf = false): void
{
    if (!isAuthenticatedUser()) {
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'message' => 'Authentication is required.',
        ]);
        exit;
    }

    if (!isAdminUser()) {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'message' => 'Administrator access is required.',
        ]);
        exit;
    }

    if ($checkCsrf && !hasValidCsrfToken()) {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'message' => 'A valid security token is required.',
        ]);
        exit;
    }
}

function hasValidCsrfToken(): bool
{
    startApplicationSession();

    $provided = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if ($provided === '') {
        $provided = $_POST['csrf_token'] ?? '';
    }

    $expected = $_SESSION['csrf_token'] ?? '';

    return is_string($provided)
        && is_string($expected)
        && $provided !== ''
        && hash_equals($expected, $provided);
}

function loginApplicationUser(array $user, bool $remember = false): void
{
    startApplicationSession();
    session_regenerate_id(true);

    $_SESSION['user_id'] = (int) $user['user_id'];
    $_SESSION['username'] = (string) $user['username'];
    $_SESSION['role'] = (string) $user['role'];
    $_SESSION['authenticated_at'] = time();
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    $_SESSION['remembered'] = $remember;

    if ($remember) {
        $selector = bin2hex(random_bytes(16));
        $validator = bin2hex(random_bytes(32));
        $database = databaseConnection();
        $statement = $database->prepare(
            'INSERT INTO admin_auth_tokens
                (user_id, selector, token_hash, expires_at)
             VALUES
                (:user_id, :selector, :token_hash, DATE_ADD(NOW(), INTERVAL 30 DAY))'
        );
        $statement->execute([
            'user_id' => (int) $user['user_id'],
            'selector' => $selector,
            'token_hash' => hash('sha256', $validator),
        ]);
        setRememberCookie($selector . ':' . $validator);
    }
}

function logoutApplicationUser(): void
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        startApplicationSession();
    }

    $_SESSION = [];
    clearRememberCookie();

    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', [
            'expires' => time() - 42000,
            'path' => $params['path'] ?? '/',
            'domain' => $params['domain'] ?? '',
            'secure' => (bool) ($params['secure'] ?? false),
            'httponly' => (bool) ($params['httponly'] ?? true),
            'samesite' => $params['samesite'] ?? 'Lax',
        ]);
    }

    session_destroy();
}

function restoreRememberedAdmin(): void
{
    $cookie = $_COOKIE[ADMIN_REMEMBER_COOKIE] ?? '';
    $parts = explode(':', is_string($cookie) ? $cookie : '', 2);
    if (count($parts) !== 2 || !ctype_xdigit($parts[0]) || !ctype_xdigit($parts[1])) {
        return;
    }

    try {
        require_once __DIR__ . '/db.php';
        $database = databaseConnection();
        $statement = $database->prepare(
            'SELECT u.user_id, u.username, u.role, u.status, t.token_hash
             FROM admin_auth_tokens t
             INNER JOIN users u ON u.user_id = t.user_id
             WHERE t.selector = :selector AND t.expires_at > NOW()
             LIMIT 1'
        );
        $statement->execute(['selector' => $parts[0]]);
        $record = $statement->fetch();

        if (!$record || $record['status'] !== 'active' || $record['role'] !== 'admin'
            || !hash_equals((string) $record['token_hash'], hash('sha256', $parts[1]))) {
            clearRememberCookie();
            return;
        }

        session_regenerate_id(true);
        $_SESSION['user_id'] = (int) $record['user_id'];
        $_SESSION['username'] = (string) $record['username'];
        $_SESSION['role'] = 'admin';
        $_SESSION['authenticated_at'] = time();
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        $_SESSION['remembered'] = true;
    } catch (Throwable $error) {
        error_log('Remembered admin session restoration failed: ' . $error->getMessage());
    }
}

function setRememberCookie(string $value): void
{
    $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (isset($_SERVER['SERVER_PORT']) && (int) $_SERVER['SERVER_PORT'] === 443);
    setcookie(ADMIN_REMEMBER_COOKIE, $value, [
        'expires' => time() + (ADMIN_REMEMBER_DAYS * 86400),
        'path' => '/',
        'secure' => $isHttps,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

function clearRememberCookie(): void
{
    setcookie(ADMIN_REMEMBER_COOKIE, '', [
        'expires' => time() - 42000,
        'path' => '/',
        'secure' => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off'),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}
