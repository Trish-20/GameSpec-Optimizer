<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">

<!-- Top Header Bar -->
<div class="top-header">
    <button class="sidebar-toggle" type="button" onclick="toggleSidebar()" aria-label="Collapse navigation" aria-expanded="true" aria-controls="sidebarNavigation">
        <i class="fas fa-bars" aria-hidden="true"></i>
    </button>
    <span class="app-title">GameSpec Optimizer</span>
    <?php if (basename($_SERVER['PHP_SELF'] ?? '') !== 'browse-games.php'): ?>
        <button class="theme-toggle" type="button" onclick="toggleTheme()" aria-label="Switch color theme" title="Switch Theme" aria-pressed="false">
            <i class="fas fa-moon" aria-hidden="true"></i><span class="theme-toggle-label">Dark mode</span>
        </button>
    <?php endif; ?>
</div>

<script>
    (() => {
        const savedTheme = localStorage.getItem('gamespec-theme');
        document.documentElement.dataset.theme = savedTheme === 'dark' ? 'dark' : 'light';
    })();
    function updateThemeButton() {
        const dark = document.documentElement.dataset.theme === 'dark';
        const button = document.querySelector('.theme-toggle');
        if (!button) return;
        button.innerHTML = `<i class="fas fa-${dark ? 'sun' : 'moon'}" aria-hidden="true"></i><span class="theme-toggle-label">${dark ? 'Light mode' : 'Dark mode'}</span>`;
        button.setAttribute('aria-label', `Switch to ${dark ? 'light' : 'dark'} mode`);
        button.setAttribute('aria-pressed', String(dark));
        button.title = 'Switch Theme';
    }
    function toggleTheme() {
        const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
        document.documentElement.dataset.theme = theme;
        localStorage.setItem('gamespec-theme', theme);
        updateThemeButton();
    }
    updateThemeButton();
</script>

<!-- Sidebar Component -->
<nav class="sidebar" id="sidebarNavigation" aria-label="Main navigation">
    <h2>Navigation</h2>

    <a href="browse-games.php" class="nav-btn" data-page="browse">
        <i class="fas fa-gamepad nav-icon" aria-hidden="true"></i><span>Browse Games</span>
    </a>

    <a href="fps-prediction.php" class="nav-btn" data-page="predict">
        <i class="fas fa-gauge-high nav-icon" aria-hidden="true"></i><span>FPS Prediction</span>
    </a>

    <a href="hardware-benchmark.php" class="nav-btn" data-page="benchmark">
        <i class="fas fa-microchip nav-icon" aria-hidden="true"></i><span>Hardware Benchmark</span>
    </a>

    <div class="nav-divider" role="separator" aria-hidden="true"></div>
    <button type="button" class="nav-btn help-nav-btn" onclick="showPageHelp(document.querySelector('.sidebar .nav-btn.active')?.dataset.page || 'browse')">
        <i class="far fa-circle-question nav-icon" aria-hidden="true"></i><span>Help &amp; Support</span>
    </button>

    <!-- Hidden admin access -->
    <div class="hidden-admin-btn" onclick="handleAdminClick()"></div>
</nav>

<!-- Tap-to-close backdrop for the sidebar. Only becomes visible below
     900px, where the sidebar overlays the page instead of pushing it. -->
<div class="sidebar-scrim" onclick="toggleSidebar()" aria-hidden="true"></div>

<script>
    let adminClickCount = 0;
    let adminClickTimer = null;
    
    function handleAdminClick() {
        adminClickCount++;
        
        // Reset counter after 2 seconds of no clicks
        if (adminClickTimer) clearTimeout(adminClickTimer);
        adminClickTimer = setTimeout(() => {
            adminClickCount = 0;
        }, 2000);
        
        // Navigate to admin after 3 clicks
        if (adminClickCount >= 3) {
            adminClickCount = 0;
            window.location.href = '../Admin Side/dashboard-admin.php';
        }

        console.log(`Admin click count: ${adminClickCount}`);
    }
</script>
