<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hardware Benchmark - GameSpec Optimizer</title>
    <link rel="stylesheet" href="../../CSS/User Side/UserSideStyle.css">
</head>
<body class="sidebar-open">

<?php include 'header.php'; ?>

<div class="content">
    <div class="page-container">
        <h2>Hardware Benchmark</h2>
        <div class="tab-card">
            <label for="cpu">Enter CPU Model:</label>
            <input id="cpu" type="text" placeholder="e.g., i5-12400F">
            
            <label for="gpu">Enter GPU Model:</label>
            <input id="gpu" type="text" placeholder="e.g., RTX 3060">
            
            <label for="ram">Enter RAM (GB):</label>
            <input id="ram" type="number" placeholder="e.g., 16">
            
            <button onclick="runBenchmark()">Get Benchmark Score</button>
            <h3 id="benchResult"></h3>
        </div>
    </div>

    <?php include 'footer.php'; ?>
</div>

<script src="../../JAVASCRIPT/User Side/UserSideFunction.js"></script>
<script>
    // Set active state for current page
    document.querySelector('[data-page="benchmark"]')?.classList.add('active');
</script>
</body>
</html>
