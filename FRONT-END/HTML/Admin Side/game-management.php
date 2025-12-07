<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Game Management - Admin Panel</title>
    <link rel="stylesheet" href="../../CSS/Admin Side/AdminSideStyle.css">
</head>
<body class="sidebar-open">

<?php include 'header.php'; ?>

<div class="content">
    <div class="page-container">
        <h2>Game Management</h2>
        
        <div class="admin-card">
            <h3>Add / Update Game</h3>
            <form id="gameForm">
                <label for="gameTitle">Game Title:</label>
                <input type="text" id="gameTitle" placeholder="e.g., Cyberpunk 2077" required>
                
                <label for="gameCPU">Min CPU Requirement:</label>
                <input type="text" id="gameCPU" placeholder="e.g., Intel Core i5-8400" required>
                
                <label for="gameGPU">Min GPU Requirement:</label>
                <input type="text" id="gameGPU" placeholder="e.g., NVIDIA GTX 1060" required>
                
                <label for="gameRAM">Min RAM Requirement (GB):</label>
                <input type="number" id="gameRAM" placeholder="e.g., 16" required>
                
                <label>Graphics Settings Available:</label>
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
                
                <button type="submit">Add / Update Game</button>
            </form>
        </div>
        
        <div class="admin-card">
            <h3>Game List</h3>
            <div class="search-box">
                <input type="text" id="gameSearch" placeholder="Search games..." onkeyup="filterGameList()">
            </div>
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
