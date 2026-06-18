<!-- Top Header Bar -->
<div class="top-header">
    <button class="sidebar-toggle" onclick="toggleSidebar()">☰</button>
    <span class="app-title">GameSpec Optimizer</span>
</div>

<!-- Sidebar Component -->
<div class="sidebar">
    <h2>Admin Panel</h2>
    <a href="dashboard-admin.php" class="nav-btn" data-page="dashboard">Dashboard</a>
    <a href="game-management.php" class="nav-btn" data-page="games">Game Management</a>
    <a href="hardware-management.php" class="nav-btn" data-page="hardware">Hardware Management</a>
    <a href="ml-training.php" class="nav-btn" data-page="ml">ML Training</a>
    
    <!-- Hidden user side access -->
    <div class="hidden-user-btn" onclick="handleUserClick()"></div>
</div>

<script>
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
