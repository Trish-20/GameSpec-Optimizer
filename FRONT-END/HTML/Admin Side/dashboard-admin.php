<?php
require_once __DIR__ . '/admin-guard.php';
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dashboard - Admin Panel</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="stylesheet" href="../../CSS/Admin Side/AdminSideStyle.css">
    <!-- Mobile layout layer: every rule sits inside a max-width media
         query, so desktop rendering is left completely untouched. -->
    <link rel="stylesheet" href="../../CSS/shared/MobileResponsive.css?v=<?= @filemtime(__DIR__ . '/../../CSS/shared/MobileResponsive.css') ?: '1' ?>">
</head>
<body class="sidebar-open">

<?php include 'header.php'; ?>

<div class="content">
    <div class="page-container">
        <h2>Admin Dashboard</h2>
        
        <div class="stats-grid">
    
    <div class="stat-card">
        <div class="stat-icon">
            <i class="fas fa-gamepad"></i>
        </div>
        <div class="stat-body">
            <span class="stat-label">Total Games</span>
            <span class="stat-value" id="totalGames">--</span>
        </div>
    </div>
    
    <div class="stat-card">
        <div class="stat-icon">
            <i class="fas fa-microchip"></i>
        </div>
        <div class="stat-body">
            <span class="stat-label">Total CPUs</span>
            <span class="stat-value" id="totalCPUs">--</span>
        </div>
    </div>
    
    <div class="stat-card">
        <div class="stat-icon">
            <i class="fas fa-video"></i>
        </div>
        <div class="stat-body">
            <span class="stat-label">Total GPUs</span>
            <span class="stat-value" id="totalGPUs">--</span>
        </div>
    </div>
    
    <div class="stat-card">
        <div class="stat-icon">
            <i class="fas fa-chart-bar"></i>
        </div>
        <div class="stat-body">
            <span class="stat-label">Avg CPU Score</span>
            <span class="stat-value" id="avgCPUScore">--</span>
        </div>
    </div>
    
    <div class="stat-card">
        <div class="stat-icon">
            <i class="fas fa-chart-line"></i>
        </div>
        <div class="stat-body">
            <span class="stat-label">Avg GPU Score</span>
            <span class="stat-value" id="avgGPUScore">--</span>
        </div>
    </div>
    
    <div class="stat-card">
        <div class="stat-icon">
            <i class="fas fa-crown"></i>
        </div>
        <div class="stat-body">
            <span class="stat-label">Top GPU</span>
            <span class="stat-value" id="topGPU" title="Loading top hardware configuration...">--</span>
        </div>
    </div>
    
</div>
        
        <div class="admin-card reports-card">
            <div class="report-text-group">
                <h3>Generate Reports</h3>
                <p>Download CSV reports for data backup or system analysis.</p>
                <hr> 
            </div>

            <div class="report-buttons">
                <button onclick="downloadReport('games')" class="report-btn">
                    <i class="fas fa-gamepad btn-icon"></i> Game Requirements
                </button>
                <button onclick="downloadReport('cpus')" class="report-btn">
                    <i class="fas fa-microchip btn-icon"></i> CPU Benchmarks
                </button>
                <button onclick="downloadReport('gpus')" class="report-btn">
                    <i class="fas fa-video btn-icon"></i> GPU Benchmarks
                </button>
                <button onclick="downloadReport('all')" class="report-btn primary">
                    <i class="fas fa-box-open btn-icon"></i> Download All
                </button>

                
            </div>
</div>
        
        <div class="tables-grid">
            <div class="admin-card games-table full-width-table">
                <h3>Recent Games</h3>
                    <div class="search-box">
                        <i class="fas fa-search search-icon"></i>
                        <input type="text" id="gameSearch" placeholder="Search games..." onkeyup="filterGameList()">
                    </div>
                <div class="table-container">
                    <table id="gamesTable">
                        <thead>
                            <tr>
                                <th>Game Title</th>
                                <th>CPU Req</th>
                                <th>GPU Req</th>
                                <th>RAM</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                    <div id="noGameMessage" class="no-results-state" style="display: none;" aria-live="polite">
                        <p>No games match your search.</p>
                    </div>
                </div>
            </div>
            
            <div class="admin-card cpus-table half-width-table">
                <h3>Top CPUs</h3>
                <div class="table-container">
                    <table id="cpusTable">
                        <thead>
                            <tr>
                                <th>Model</th>
                                <th>Score</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            </div>
            
            <div class="admin-card games-card half-width-table">
                <h3>Top GPUs</h3>
                <div class="table-container">
                    <table id="gpusTable">
                        <thead>
                            <tr>
                                <th>Model</th>
                                <th>Score</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>

    <?php include 'footer.php'; ?>
</div>

<script src="../../JAVASCRIPT/Admin Side/AdminSideFunction.js?v=<?= @filemtime(__DIR__ . '/../../JAVASCRIPT/Admin Side/AdminSideFunction.js') ?: '1' ?>"></script>
<script>
    // Initialize current system navigation state highlight tags
    document.querySelector('[data-page="dashboard"]')?.classList.add('active');
    
    // Automatically query background engines for card analytics
    if (typeof loadDashboardData === 'function') {
        loadDashboardData();
    }
</script>
</body>
</html>