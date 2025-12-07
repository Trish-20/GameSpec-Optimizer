<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ML Training - Admin Panel</title>
    <link rel="stylesheet" href="../../CSS/Admin Side/AdminSideStyle.css">
</head>
<body class="sidebar-open">

<?php include 'header.php'; ?>

<div class="content">
    <div class="page-container">
        <h2>Machine Learning Training</h2>
        
        <div class="admin-card">
            <h3>Model Status</h3>
            <div class="status-grid">
                <div class="status-item">
                    <span class="status-label">Current Model:</span>
                    <span class="status-value" id="modelName">Voting Ensemble (GB + XGB)</span>
                </div>
                <div class="status-item">
                    <span class="status-label">Last Trained:</span>
                    <span class="status-value" id="lastTrained">--</span>
                </div>
                <div class="status-item">
                    <span class="status-label">Training Data:</span>
                    <span class="status-value" id="dataCount">6,000 rows</span>
                </div>
                <div class="status-item">
                    <span class="status-label">Model Accuracy (MAE):</span>
                    <span class="status-value" id="modelAccuracy">~10.94</span>
                </div>
            </div>
        </div>
        
        <div class="admin-card">
            <h3>Training Actions</h3>
            <div class="action-buttons">
                <button onclick="updateTrainingData()" class="btn-secondary">Update Training Data</button>
                <button onclick="generateData()" class="btn-secondary">Generate Training Data</button>
                <button onclick="retrainModel()" class="btn-primary">Retrain Model</button>
                <button onclick="exportModel()" class="btn-secondary">Export</button>
            </div>
            <div id="trainingOutput" class="training-output"></div>
        </div>
        
        <div class="admin-card">
            <h3>Training Log</h3>
            <div id="trainingLog" class="log-container">
                <p class="log-entry">System ready. Select an action above.</p>
            </div>
        </div>
    </div>

    <?php include 'footer.php'; ?>
</div>

<script src="../../JAVASCRIPT/Admin Side/AdminSideFunction.js"></script>
<script>
    document.querySelector('[data-page="ml"]')?.classList.add('active');
</script>
</body>
</html>
