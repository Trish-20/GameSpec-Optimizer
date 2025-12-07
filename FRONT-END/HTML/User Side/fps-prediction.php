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
    <div class="fps-prediction-container">
        <h2>FPS Prediction</h2>
        
        <div class="fps-layout">
            <!-- LEFT SIDE: Input Panel -->
            <div class="fps-input-panel">
                <h3>Hardware Configuration</h3>
                
                <label for="selectedGame">Select a Game:</label>
                <select id="selectedGame">
                    <option value="">Select a Game</option>
                </select>

                <label for="cpuSelect">Select CPU:</label>
                <select id="cpuSelect">
                    <option value="">Select a CPU</option>
                </select>
                
                <label for="gpuSelect">Select GPU:</label>
                <select id="gpuSelect">
                    <option value="">Select a GPU</option>
                </select>
                
                <label for="ramSelect">Select RAM:</label>
                <select id="ramSelect">
                    <option value="">Select RAM</option>
                    <option value="4">4 GB</option>
                    <option value="8">8 GB</option>
                    <option value="16">16 GB</option>
                    <option value="32">32 GB</option>
                    <option value="64">64 GB</option>
                </select>
                
                <label for="graphicsQuality">Graphics Quality:</label>
                <select id="graphicsQuality">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                </select>
                
                <button onclick="predictFPS()">Analyze Performance</button>
            </div>
            
            <!-- RIGHT SIDE: Results Panel -->
            <div class="fps-results-panel" id="fpsResultsPanel">
                <div class="results-placeholder">
                    <div class="placeholder-icon">📊</div>
                    <p>Configure your hardware and click "Analyze Performance" to see results</p>
                </div>
            </div>
        </div>
    </div>

    <?php include 'footer.php'; ?>
</div>

<script src="../../JAVASCRIPT/User Side/UserSideFunction.js"></script>
<script>
    // Set active state for current page
    document.querySelector('[data-page="predict"]')?.classList.add('active');
    // Load dropdowns
    if (typeof loadFPSPredictionDropdowns === 'function') {
        loadFPSPredictionDropdowns();
    }
</script>
</body>
</html>
