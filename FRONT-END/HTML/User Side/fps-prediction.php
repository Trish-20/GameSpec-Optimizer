<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>FPS Prediction - GameSpec Optimizer</title>
    <link rel="stylesheet" href="../../CSS/User Side/UserSideStyle.css">
</head>
<body class="sidebar-open">

<?php include 'header.php'; ?>

<div class="content">
    <div class="page-container">
        <h2>FPS Prediction</h2>
        <div class="tab-card">
            <label for="selectedGame">Select a Game:</label>
            <select id="selectedGame">
                <option value="">Select a Game</option>
            </select>

            <label for="cpu2">Enter CPU Model:</label>
            <input id="cpu2" type="text" placeholder="e.g., i5-12400F">
            
            <label for="gpu2">Enter GPU Model:</label>
            <input id="gpu2" type="text" placeholder="e.g., RTX 3060">
            
            <label for="ram2">Enter RAM (GB):</label>
            <input id="ram2" type="number" placeholder="e.g., 16">
            
            <label for="graphicsQuality">Graphics Quality:</label>
            <select id="graphicsQuality">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
            </select>
            <button onclick="predictFPS()">Predict FPS</button>
            <h3 id="fpsResult"></h3>
        </div>
    </div>

    <?php include 'footer.php'; ?>
</div>

<script src="../../JAVASCRIPT/User Side/UserSideFunction.js"></script>
<script>
    // Set active state for current page
    document.querySelector('[data-page="predict"]')?.classList.add('active');
    // Load games for dropdown
    if (typeof loadGameDropdown === 'function') {
        loadGameDropdown();
    }
</script>
</body>
</html>
