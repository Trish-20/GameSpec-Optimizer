<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Browse Games - GameSpec Optimizer</title>
<link rel="stylesheet" href="../../CSS/User Side/UserSideStyle.css">
    <link rel="stylesheet" href="../../CSS/User Side/_tooltip-modal.css">
</head>
<body class="sidebar-open">

<?php include 'header.php'; ?>

<div class="content">
    <!-- Fixed Top Section -->
    <div class="browse-top-section">
        <h2>Browse Games</h2>
        
        <div class="search-filter-container">
            <div class="search-box">
                <input type="text" id="gameSearch" placeholder="Search games..." oninput="filterGames()">
                <span class="search-icon"><i class="fas fa-magnifying-glass"></i></span>
            </div>
            
            <div class="genre-filter">
                <select id="genreFilter" onchange="filterGames()">
                    <option value="">All Genres</option>
                    <option value="action">Action</option>
                    <option value="rpg">RPG</option>
                    <option value="fps">FPS</option>
                    <option value="adventure">Adventure</option>
                    <option value="sports">Sports</option>
                    <option value="racing">Racing</option>
                    <option value="strategy">Strategy</option>
                    <option value="sandbox">Sandbox</option>
                </select>
            </div>
        </div>
    </div>

    <!-- Scrollable Game Section -->
    <div class="game-section">
        <div id="gameGrid" class="game-grid">
            <!-- Games will be loaded here dynamically -->
        </div>
    </div>

    <?php include 'footer.php'; ?>
</div>

<script src="../../JAVASCRIPT/User Side/UserSideFunction.js"></script>
<script>
    // Set active state for current page
    document.querySelector('[data-page="browse"]')?.classList.add('active');
    // Initialize the page
    if (typeof initBrowseGames === 'function') {
        initBrowseGames();
    }
</script>
</body>
</html>
