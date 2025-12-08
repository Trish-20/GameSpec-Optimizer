<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dashboard - Admin Panel</title>
    <link rel="stylesheet" href="../../CSS/Admin Side/AdminSideStyle.css">
</head>
<body class="sidebar-open">

<?php include 'header.php'; ?>

<div class="content">
    <div class="page-container">
        <h2>Admin Dashboard</h2>
        
        <!-- Statistics Cards -->
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-icon">🎮</div>
                <div class="stat-info">
                    <span class="stat-value" id="totalGames">--</span>
                    <span class="stat-label">Total Games</span>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">💻</div>
                <div class="stat-info">
                    <span class="stat-value" id="totalCPUs">--</span>
                    <span class="stat-label">Total CPUs</span>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">🖥️</div>
                <div class="stat-info">
                    <span class="stat-value" id="totalGPUs">--</span>
                    <span class="stat-label">Total GPUs</span>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">📊</div>
                <div class="stat-info">
                    <span class="stat-value" id="avgCPUScore">--</span>
                    <span class="stat-label">Avg CPU Score</span>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">📈</div>
                <div class="stat-info">
                    <span class="stat-value" id="avgGPUScore">--</span>
                    <span class="stat-label">Avg GPU Score</span>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">🏆</div>
                <div class="stat-info">
                    <span class="stat-value" id="topGPU">--</span>
                    <span class="stat-label">Top GPU</span>
                </div>
            </div>
        </div>
        
        <!-- Generate Reports Section -->
        <div class="admin-card">
            <h3>Generate Reports</h3>
            <p>Download CSV reports for data backup or analysis.</p>
            <div class="report-buttons">
                <button onclick="downloadReport('games')" class="report-btn">
                    <span class="btn-icon">🎮</span>
                    Game Requirements Report
                </button>
                <button onclick="downloadReport('cpus')" class="report-btn">
                    <span class="btn-icon">💻</span>
                    CPU Benchmarks Report
                </button>
                <button onclick="downloadReport('gpus')" class="report-btn">
                    <span class="btn-icon">🖥️</span>
                    GPU Benchmarks Report
                </button>
                <button onclick="downloadReport('all')" class="report-btn primary">
                    <span class="btn-icon">📦</span>
                    Download All Reports
                </button>
            </div>
        </div>
        
        <!-- Data Tables Section -->
        <div class="tables-grid">
            <!-- Games Table -->
            <div class="admin-card table-card">
                <h3>Recent Games</h3>
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
                        <tbody>
                            <!-- Populated by JS -->
                        </tbody>
                    </table>
                </div>
            </div>
            
            <!-- CPUs Table -->
            <div class="admin-card table-card">
                <h3>Top CPUs</h3>
                <div class="table-container">
                    <table id="cpusTable">
                        <thead>
                            <tr>
                                <th>Model</th>
                                <th>Score</th>
                            </tr>
                        </thead>
                        <tbody>
                            <!-- Populated by JS -->
                        </tbody>
                    </table>
                </div>
            </div>
            
            <!-- GPUs Table -->
            <div class="admin-card table-card">
                <h3>Top GPUs</h3>
                <div class="table-container">
                    <table id="gpusTable">
                        <thead>
                            <tr>
                                <th>Model</th>
                                <th>Score</th>
                            </tr>
                        </thead>
                        <tbody>
                            <!-- Populated by JS -->
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>

    <?php include 'footer.php'; ?>
</div>

<script src="../../JAVASCRIPT/Admin Side/AdminSideFunction.js"></script>
<script>
    document.querySelector('[data-page="dashboard"]')?.classList.add('active');
    
    // Load dashboard data
    if (typeof loadDashboardData === 'function') {
        loadDashboardData();
    }
</script>
</body>
</html>
