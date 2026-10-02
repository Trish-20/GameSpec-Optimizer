<?php
require_once __DIR__ . '/admin-guard.php';
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ML Training - Admin Panel</title>
    <link rel="stylesheet" href="../../CSS/Admin Side/AdminSideStyle.css">
    <!-- Mobile layout layer: every rule sits inside a max-width media
         query, so desktop rendering is left completely untouched. -->
    <link rel="stylesheet" href="../../CSS/shared/MobileResponsive.css?v=<?= @filemtime(__DIR__ . '/../../CSS/shared/MobileResponsive.css') ?: '1' ?>">
</head>
<body class="sidebar-open">

<?php include 'header.php'; ?>

<div class="content">
    <div class="page-container">
        <h2>Machine Learning Training</h2>
        
        <div class="training-grid">
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
            
        <div class="admin-card training-card">
                <div class="training-header">
                    <h3>Machine learning training</h3>
                    <div class="action-buttons">
                        <button onclick="updateTrainingData()" class="report-btn">
                            <i class="fas fa-sync-alt"></i> Update Training Data
                        </button>
                        <button onclick="generateData()" class="report-btn">
                            <i class="fas fa-database"></i> Generate Training Data
                        </button>
                        <button onclick="retrainModel()" class="report-btn">
                            <i class="fas fa-cogs"></i> Retrain Model
                        </button>
                        <button onclick="exportModel()" class="report-btn">
                            <i class="fas fa-file-export"></i> Export
                        </button>
                    </div>

                </div>

                <div id="trainingLog" class="log-container">
                    <p class="log-entry">System ready. Select an action above.</p>
                </div>
            </div>
        </div>


    </div>

    <?php include 'footer.php'; ?>
</div>

<script src="../../JAVASCRIPT/Admin Side/AdminSideFunction.js?v=<?= @filemtime(__DIR__ . '/../../JAVASCRIPT/Admin Side/AdminSideFunction.js') ?: '1' ?>"></script>
<script>
    document.querySelector('[data-page="ml"]')?.classList.add('active');
</script>
</body>
</html>
