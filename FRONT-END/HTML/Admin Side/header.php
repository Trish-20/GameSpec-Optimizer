<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">

<!-- Top Header Bar -->
<div class="top-header">
    <button class="sidebar-toggle" onclick="toggleSidebar()">☰</button>
    <span class="app-title">GameSpec Optimizer</span>
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
