<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hardware Management - Admin Panel</title>
    <link rel="stylesheet" href="../../CSS/Admin Side/AdminSideStyle.css">
</head>
<body class="sidebar-open">

<?php include 'header.php'; ?>

<div class="content">
    <div class="page-container">
        <h2>Hardware Management</h2>
        
        <div class="hardware-grid">
            <!-- CPU Management -->
            <div class="admin-card hardware-card">
                <h3>CPU Management</h3>
                <form id="cpuForm">
                    <label for="cpuModel">CPU Model:</label>
                    <input type="text" id="cpuModel" placeholder="e.g., Intel Core i7-12700K" required>
                    
                    <label for="cpuScore">Benchmark Score:</label>
                    <input type="number" id="cpuScore" placeholder="e.g., 35000" required>
                    
                    <div class="form-action-row">
                        <button type="submit" class="btn-primary">Save CPU</button>
                    </div>
                </form>

                <hr>
                
                <div id="cpuList" class="data-list"></div>
            </div>
            
            <!-- GPU Management -->
            <div class="admin-card hardware-card">
                <h3>GPU Management</h3>
                <form id="gpuForm">
                    <label for="gpuModel">GPU Model:</label>
                    <input type="text" id="gpuModel" placeholder="e.g., NVIDIA RTX 4080" required>
                    
                    <label for="gpuScore">Benchmark Score:</label>
                    <input type="number" id="gpuScore" placeholder="e.g., 28000" required>
                    
                   <div class="form-action-row">
                        <button type="submit" class="btn-primary">Save CPU</button>
                    </div>
                </form>

                <hr>

                <div id="gpuList" class="data-list"></div>
            </div>
            
            <!-- RAM Management -->
            <div class="admin-card hardware-card">
                <h3>RAM Management</h3>
                <form id="ramForm">
                    <label for="ramModel">RAM Model:</label>
                    <input type="text" id="ramModel" placeholder="e.g., 32GB DDR5-6000" required>
                    
                    <label for="ramScore">Benchmark Score:</label>
                    <input type="number" id="ramScore" placeholder="e.g., 8000" required>
                    
                    <div class="form-action-row">
                        <button type="submit" class="btn-primary">Save CPU</button>
                    </div>
                </form>

                <hr>

                <div id="ramList" class="data-list"></div>
            </div>
        </div>
    </div>

    <?php include 'footer.php'; ?>
</div>

<script src="../../JAVASCRIPT/Admin Side/AdminSideFunction.js"></script>
<script>
    document.querySelector('[data-page="hardware"]')?.classList.add('active');
    if (typeof loadAdminHardware === 'function') {
        loadAdminHardware();
    }
</script>
</body>
</html>
