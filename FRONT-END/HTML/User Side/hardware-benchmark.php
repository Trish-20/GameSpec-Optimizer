<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hardware Benchmark - GameSpec Optimizer</title>
    <link rel="stylesheet" href="../../CSS/User Side/UserSideStyle.css">
    <!-- Mobile layout layer: every rule sits inside a max-width media
         query, so desktop rendering is left completely untouched. -->
    <link rel="stylesheet" href="../../CSS/shared/MobileResponsive.css">
</head>
<body class="sidebar-open">

<?php include 'header.php'; ?>

<div class="content">
    <div class="page-container">
        <h2>Hardware Benchmark</h2>
        <div class="tab-card">
                        <label>Choose a Hardware Type:</label>
            <div class="search-dropdown" id="hardwareTypeDropdown">
                <input type="text" class="search-input" id="hardwareTypeSearch" placeholder="Select hardware type..." autocomplete="off">
                <input type="hidden" id="hardwareTypeSelect" value="">
                <div class="dropdown-list" id="hardwareTypeDropdownList"></div>
            </div>
            
            <label for="hardwareSearch">Select Hardware:</label>
            <div class="search-dropdown" id="hardwareDropdown">
                <input type="text" class="search-input" id="hardwareSearch" placeholder="First select a hardware type above" autocomplete="off" disabled>
                <input type="hidden" id="hardwareSelect">
                <div class="dropdown-list" id="hardwareDropdownList"></div>
            </div>
            
            <button onclick="getBenchmarkScore()">Get Benchmark Score</button>

            <div id="benchResult" class="benchmark-result"></div>
        </div>
    </div>

    <?php include 'footer.php'; ?>
</div>

<script src="../../JAVASCRIPT/User Side/UserSideFunction.js"></script>
<script>
    // Set active state for current page
    document.querySelector('[data-page="benchmark"]')?.classList.add('active');
    // Initialize hardware benchmark
    if (typeof initHardwareBenchmark === 'function') {
        initHardwareBenchmark();
    }
</script>
</body>
</html>
