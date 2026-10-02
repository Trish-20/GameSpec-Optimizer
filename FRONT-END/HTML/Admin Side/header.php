<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">

<!-- Top Header Bar -->
<div class="top-header">
    <button class="sidebar-toggle" onclick="toggleSidebar()">☰</button>
    <span class="app-title">GameSpec Optimizer</span>
    <form class="admin-logout-form" method="post" action="logout.php">
        <input type="hidden" name="csrf_token" value="<?= htmlspecialchars(csrfToken(), ENT_QUOTES, 'UTF-8') ?>">
        <button type="submit" class="admin-logout-btn">Sign out</button>
    </form>
</div>

<!-- Sidebar Component -->
<div class="sidebar">
    <h2>Admin Panel</h2>
        
   <a href="dashboard-admin.php" class="nav-btn" data-page="dashboard">
    <i class="fas fa-chart-pie nav-icon"></i> Dashboard
    </a>

    <a href="game-management.php" class="nav-btn" data-page="games">
        <i class="fas fa-gamepad nav-icon"></i> Game Management
    </a>

    <a href="hardware-management.php" class="nav-btn" data-page="hardware">
        <i class="fas fa-server nav-icon"></i> Hardware Management
    </a>

    <a href="ml-training.php" class="nav-btn" data-page="ml">
        <i class="fas fa-brain nav-icon"></i> ML Training
    </a>

    <a href="feedback-management.php" class="nav-btn" data-page="feedback">
        <i class="fas fa-comments nav-icon"></i> Feedback Management
    </a>
        <!-- Hidden user side access -->
        <div class="hidden-user-btn" onclick="handleUserClick()"></div>
    </div>

<!-- Tap-to-close backdrop for the sidebar. Only becomes visible below
     900px, where the sidebar overlays the page instead of pushing it. -->
<div class="sidebar-scrim" onclick="toggleSidebar()" aria-hidden="true"></div>

<script>
    window.ADMIN_CSRF_TOKEN = <?= json_encode(csrfToken(), JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_AMP | JSON_HEX_QUOT) ?>;
    window.adminFetch = function(url, options = {}) {
        const request = { ...options };
        const method = String(request.method || 'GET').toUpperCase();
        request.headers = new Headers(request.headers || {});
        if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
            request.headers.set('X-CSRF-Token', window.ADMIN_CSRF_TOKEN);
        }
        return fetch(url, request).then(response => {
            if (response.status === 401 || response.status === 403) {
                window.location.href = 'login.php';
            }
            return response;
        });
    };

    let userClickCount = 0;
    let userClickTimer = null;
    
    function handleUserClick() {
        userClickCount++;
        
        // Reset counter after 2 seconds of no clicks
        if (userClickTimer) clearTimeout(userClickTimer);
        userClickTimer = setTimeout(() => {
            userClickCount = 0;
        }, 2000);
        
        // Navigate to user side after 3 clicks
        if (userClickCount >= 3) {
            userClickCount = 0;
            window.location.href = '../User Side/browse-games.php';
        }
    }
</script>
