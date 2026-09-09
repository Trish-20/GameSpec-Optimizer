<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Game Management - Admin Panel</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="stylesheet" href="../../CSS/Admin Side/AdminSideStyle.css">
</head>
<body class="sidebar-open">

<?php include 'header.php'; ?>

<div class="content">
    <div class="page-container">
        <h2>Game Management</h2>
        
        <div class="admin-card game-form-card">
            <h3>Add / Update Game</h3>
            <hr>
            <form id="gameForm" class="game-form">
                <div class="form-grid-2x2">
                    <div class="form-field">
                        <label for="gameTitle">Game Title:</label>
                        <input type="text" id="gameTitle" list="gameTitleOptions" placeholder="e.g., Cyberpunk 2077" required>
                        <datalist id="gameTitleOptions"></datalist>
                    </div>

                    <div class="form-field">
                        <label for="gameCPU">Min CPU Requirement:</label>
                        <input type="text" id="gameCPU" list="gameCPUOptions" placeholder="e.g., Intel Core i5-8400" required>
                        <datalist id="gameCPUOptions"></datalist>
                    </div>

                    <div class="form-field">
                        <label for="gameGPU">Min GPU Requirement:</label>
                        <input type="text" id="gameGPU" list="gameGPUOptions" placeholder="e.g., NVIDIA GTX 1060" required>
                        <datalist id="gameGPUOptions"></datalist>
                    </div>

                    <div class="form-field">
                        <label for="gameRAM">Min RAM Requirement (GB):</label>
                        <input type="number" id="gameRAM" placeholder="e.g., 16" required>
                    </div>

                    <div class="form-field game-cover-field">
                        <label for="gameCover">Game Cover Picture:</label>
                        <input type="file" id="gameCover" accept="image/png,image/jpeg,image/webp,image/gif,image/avif">
                        <div id="gameCoverPreview" class="game-cover-preview" hidden>
                            <img id="gameCoverPreviewImage" alt="Selected game cover preview">
                            <button type="button" id="clearGameCover" class="btn-secondary">Remove preview</button>
                        </div>
                    </div>
                </div>

                <div class="form-actions-row">
                    <div class="form-actions-left">
                        <label for="gameGPU">Graphics Settings Available:</label>
                        <div class="toggle-group">
                            <div class="toggle-item">
                                <input type="checkbox" id="hasBloom" checked>
                                <label for="hasBloom">Bloom</label>
                            </div>
                            <div class="toggle-item">
                                <input type="checkbox" id="hasAntiAlias" checked>
                                <label for="hasAntiAlias">Anti-Aliasing</label>
                            </div>
                            <div class="toggle-item">
                                <input type="checkbox" id="hasShadows" checked>
                                <label for="hasShadows">Shadows</label>
                            </div>
                            <div class="toggle-item">
                                <input type="checkbox" id="hasVSync" checked>
                                <label for="hasVSync">VSync</label>
                            </div>
                        </div>
                    </div>
                    
                </div>
                 <hr>
                 <div class="form-action-row">
                    <button type="submit">Add / Update Game</button>
                </div>
            </form>
        </div>
        
        <div class="admin-card">
            <h3>Game List</h3>
            <div class="search-box">
                <i class="fas fa-search search-icon"></i>
                <input type="text" id="gameSearch" placeholder="Search games..." onkeyup="filterGameList()">
            </div>
            <hr>
            <div id="gameList" class="data-list"></div>
        </div>
    </div>

    <?php include 'footer.php'; ?>
</div>

<script src="../../JAVASCRIPT/Admin Side/AdminSideFunction.js"></script>
<script>
    document.querySelector('[data-page="games"]')?.classList.add('active');
    if (typeof loadAdminGames === 'function') {
        loadAdminGames();
    }
</script>
</body>
</html>
