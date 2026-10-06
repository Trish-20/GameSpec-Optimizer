<?php
require_once __DIR__ . '/admin-guard.php';
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hardware Management - Admin Panel</title>
    <link rel="stylesheet" href="../../CSS/Admin Side/AdminSideStyle.css">
    <!-- Mobile layout layer: every rule sits inside a max-width media
         query, so desktop rendering is left completely untouched. -->
    <link rel="stylesheet" href="../../CSS/shared/MobileResponsive.css?v=<?= @filemtime(__DIR__ . '/../../CSS/shared/MobileResponsive.css') ?: '1' ?>">
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
                <hr>
                <form id="cpuForm">
                    <label for="cpuModel">CPU Model:</label>
                    <input type="text" id="cpuModel" list="cpuModelOptions" placeholder="e.g., Intel Core i7-12700K" required>
                    <datalist id="cpuModelOptions"></datalist>
                    
                    <label for="cpuScore">Benchmark Score:</label>
                    <input type="number" id="cpuScore" min="1" max="1000000" step="1" placeholder="e.g., 35000" required>
                    
                    <div class="form-action-row">
                        <button type="submit" class="btn-primary">Save CPU</button>
                    </div>
                </form>
                <hr>
                <div class="search-box inventory-search-box">
                    <i class="fas fa-search search-icon"></i>
                    <input type="text" id="cpuSearch" placeholder="Search CPU list..." oninput="filterHardwareList('cpu')">
                </div>
                
                <div id="cpuList" class="data-list"></div>
            </div>
            
            <!-- GPU Management -->
            <div class="admin-card hardware-card">
                <h3>GPU Management</h3>
                <hr>
                <form id="gpuForm">
                    <label for="gpuModel">GPU Model:</label>
                    <input type="text" id="gpuModel" list="gpuModelOptions" placeholder="e.g., NVIDIA RTX 4080" required>
                    <datalist id="gpuModelOptions"></datalist>
                    
                    <label for="gpuScore">Benchmark Score:</label>
                    <input type="number" id="gpuScore" min="1" max="1000000" step="1" placeholder="e.g., 28000" required>

                    <p id="gpuValidationError" class="hardware-validation-error" role="alert" aria-live="polite" hidden></p>
                    
                   <div class="form-action-row">
                        <button type="submit" class="btn-primary">Save GPU</button>
                    </div>
                </form>
                <hr>
                <div class="search-box inventory-search-box">
                    <i class="fas fa-search search-icon"></i>
                    <input type="text" id="gpuSearch" placeholder="Search GPU list..." oninput="filterHardwareList('gpu')">
                </div>

                <div id="gpuList" class="data-list"></div>
            </div>
            
            <!-- RAM Management -->
            <div class="admin-card hardware-card">
                <h3>RAM Management</h3>
                <hr>
                <form id="ramForm">
                    <label for="ramModel">RAM Model:</label>
                    <input type="text" id="ramModel" list="ramModelOptions" placeholder="e.g., 32GB DDR5-6000" required>
                    <datalist id="ramModelOptions"></datalist>
                    
                    <label for="ramScore">Benchmark Score:</label>
                    <input type="number" id="ramScore" min="1" max="1000000" step="1" placeholder="e.g., 8000" required>

                    <p id="ramValidationError" class="hardware-validation-error" role="alert" aria-live="polite" hidden></p>
                    
                    <div class="form-action-row">
                        <button type="submit" class="btn-primary">Save RAM</button>
                    </div>
                </form>
                <hr>
                <div class="search-box inventory-search-box">
                    <i class="fas fa-search search-icon"></i>
                    <input type="text" id="ramSearch" placeholder="Search RAM list..." oninput="filterHardwareList('ram')">
                </div>

                <div id="ramList" class="data-list"></div>
            </div>
        </div>
    </div>

    <?php include 'footer.php'; ?>
</div>

<script src="../../JAVASCRIPT/Admin Side/AdminSideFunction.js?v=<?= @filemtime(__DIR__ . '/../../JAVASCRIPT/Admin Side/AdminSideFunction.js') ?: '1' ?>"></script>
<script>
    document.querySelector('[data-page="hardware"]')?.classList.add('active');
    if (typeof loadAdminHardware === 'function') {
        loadAdminHardware();
    }
</script>
</body>
</html>
