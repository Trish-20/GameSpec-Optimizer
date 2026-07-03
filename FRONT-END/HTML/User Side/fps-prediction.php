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
            <div class="fps-input-panel">
                <h3>Hardware Configuration</h3>
                
                <label>Select a Game:</label>
                <div class="search-dropdown" id="gameDropdown">
                    <input type="text" class="search-input" id="gameSearch" placeholder="Search games..." autocomplete="off">
                    <input type="hidden" id="selectedGame">
                    <div class="dropdown-list" id="gameDropdownList"></div>
                </div>

                <label>Select CPU:</label>
                <div class="search-dropdown" id="cpuDropdown">
                    <input type="text" class="search-input" id="cpuSearch" placeholder="Search CPUs..." autocomplete="off">
                    <input type="hidden" id="cpuSelect">
                    <div class="dropdown-list" id="cpuDropdownList"></div>
                </div>
                
                <label>Select GPU:</label>
                <div class="search-dropdown" id="gpuDropdown">
                    <input type="text" class="search-input" id="gpuSearch" placeholder="Search GPUs..." autocomplete="off">
                    <input type="hidden" id="gpuSelect">
                    <div class="dropdown-list" id="gpuDropdownList"></div>
                </div>
                
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
                
                <label for="performanceMode">Performance Mode:</label>
                <select id="performanceMode">
                    <option value="battery">Battery Saver</option>
                    <option value="balanced" selected>Balanced</option>
                    <option value="performance">Performance</option>
                </select>

                <div class="fps-action-row">
                    <button type="button" class="detect-hardware-btn" onclick="detectHardware()">Detect Hardware</button>
                    <button type="button" onclick="predictFPS()">Analyze Performance</button>
                </div>
            </div>

            <div class="fps-results-panel" id="fpsResultsPanel">
                <div class="results-placeholder">
                    <div class="placeholder-icon"><i class="fas fa-chart-line"></i></div>
                    <p>Configure your hardware and click "Analyze Performance" to see results</p>
                </div>
            </div>

            <section class="feedback-preview">
                <div class="feedback-header">
                    <div>
                        <h3>Community Feedback</h3>
                        <p>See what other players think about GameSpec Optimizer.</p>
                    </div>

                    <a href="feedback.php" class="view-all-link">
                        View All Reviews
                    </a>
                </div>

                <div class="feedback-preview-list" id="feedbackPreviewList">
                    <!-- Latest feedback will be inserted here -->
                </div>
            </section>
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

