<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">

<!-- Top Header Bar -->
<div class="top-header">
    <button class="sidebar-toggle" onclick="toggleSidebar()">☰</button>
    <span class="app-title">GameSpec Optimizer</span>
    <button class="help-btn" type="button" title="Help &amp; Tutorial Center" onclick="showPageHelp('browse')">
        <i class="fas fa-circle-question"></i>
    </button>
</div>

<!-- Sidebar Component -->
<div class="sidebar">
    <h2>User Panel</h2>

    <a href="browse-games.php" class="nav-btn" data-page="browse">
        <i class="fas fa-th-large nav-icon"></i> Browse Games
    </a>

    <a href="fps-prediction.php" class="nav-btn" data-page="predict">
        <i class="fas fa-tachometer-alt nav-icon"></i> FPS Prediction
    </a>

    <a href="hardware-benchmark.php" class="nav-btn" data-page="benchmark">
        <i class="fas fa-microchip nav-icon"></i> Hardware Benchmark
    </a>

    <!-- Hidden admin access -->
    <div class="hidden-admin-btn" onclick="handleAdminClick()"></div>
</div>

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
