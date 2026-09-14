<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Browse Games - GameSpec Optimizer</title>
    <link rel="stylesheet" href="../../CSS/User Side/UserSideStyle.css">
</head>
<body class="sidebar-open">

<?php include 'header.php'; ?>

<div class="content">
    <!-- Fixed Top Section -->
    <div class="browse-top-section">
        <h2>Browse Games</h2>
        <p class="browse-subtitle">Find a game you like, see what kind of computer it needs in plain language, then check if your PC can run it.</p>
        
        <div class="search-filter-container">
            <div class="search-box">
                <input type="text" id="gameSearch" placeholder="Search games — try &quot;Minecraft&quot;..." oninput="filterGames()" aria-label="Search games">
                <span class="search-icon"><i class="fas fa-magnifying-glass"></i></span>
            </div>
            
            <div class="genre-filter">
                <label for="genreFilter" class="visually-hidden">Filter by game type</label>
                <select id="genreFilter" onchange="filterGames()" aria-label="Filter by game type">
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

            <button type="button" id="moreFiltersBtn" class="more-filters-btn" onclick="toggleMoreFilters()" aria-expanded="false" aria-controls="moreFiltersPanel">
                <i class="fas fa-sliders"></i>
                <span>More Filters</span>
                <i class="fas fa-chevron-down toggle-icon"></i>
            </button>

            <div class="sort-filter">
                <label for="sortOrder" class="sort-label">Sort:</label>
                <select id="sortOrder" onchange="filterGames()" aria-label="Sort games">
                    <option value="newest">Newest → Oldest</option>
                    <option value="oldest">Oldest → Newest</option>
                    <option value="az">A → Z</option>
                    <option value="za">Z → A</option>
                </select>
            </div>
        </div>

        <!-- Collapsible More Filters Panel -->
        <div id="moreFiltersPanel" class="more-filters-panel" style="display: none;" aria-hidden="true">
            <div class="more-filters-grid">
                <div class="filter-group">
                    <label for="platformFilter">Works on</label>
                    <select id="platformFilter" onchange="filterGames()" aria-label="Filter by platform">
                        <option value="">All computers</option>
                        <option value="pc">PC (Windows)</option>
                    </select>
                </div>

                <div class="filter-group">
                    <label for="yearFilter">Released</label>
                    <select id="yearFilter" onchange="filterGames()" aria-label="Filter by release year">
                        <option value="">Any year</option>
                        <option value="before-2010">Before 2010</option>
                        <option value="2010-2014">2010–2014</option>
                        <option value="2015-2019">2015–2019</option>
                        <option value="2020-2024">2020–2024</option>
                        <option value="2025-present">2025–Present</option>
                    </select>
                </div>

                <div class="filter-group">
                    <label for="requirementFilter">How demanding is this game?</label>
                    <select id="requirementFilter" onchange="filterGames()" aria-label="Filter by how demanding a game is">
                        <option value="">All levels</option>
                        <option value="low">Easy to Run</option>
                        <option value="moderate">Moderate</option>
                        <option value="high">Demanding</option>
                        <option value="very-high">Very Demanding</option>
                    </select>
                    <span class="filter-hint">How powerful a computer the game needs.</span>
                </div>

                <div class="filter-actions">
                    <button type="button" class="clear-filters-btn" onclick="clearGameSearch()">
                        <i class="fas fa-rotate-left"></i> Clear Filters
                    </button>
                </div>
            </div>
        </div>
    </div>

    <div id="noGameMessage" class="no-results-state" style="display: none;">
        <div class="no-results-icon-wrap">
            <i class="fas fa-magnifying-glass"></i>
        </div>
        <h3>No games found</h3>
        <p>We couldn't find any games matching your active filters.<br>Try adjusting your search query or clearing your filters.</p>
        <button class="clear-search-btn" onclick="clearGameSearch()">
            <i class="fas fa-times"></i> Clear search & filters
        </button>
    </div>

    <!-- Scrollable Game Section -->
    <div class="game-section">
        <div class="browse-result-bar" role="status" aria-live="polite">
            <p class="result-count" id="browseResultCount">Loading games…</p>
            <p class="result-hint">Tip: pick <strong>View Details</strong> to see plain-language requirements, or <strong>Can I Run This?</strong> to check your own PC.</p>
        </div>
        <div id="gameGrid" class="game-grid">
            <!-- Games will be loaded here dynamically -->
        </div>
    </div>

    <!-- Game details modal (View Details) : vertical layout
         Order: Genre > Title > Requirement badge > Image > Description >
         What you'll need > View detailed specifications > Details >
         Can I Run This? > Back to games. Close (X) stays top-right. -->
    <div class="game-modal-overlay" id="gameDetailsModal" aria-hidden="true">
        <div class="game-modal-dialog game-modal-dialog--vertical" role="dialog" aria-modal="true" aria-labelledby="gameModalTitle">
            <button type="button" class="game-modal-close" onclick="closeGameDetailsModal()" aria-label="Close game details">
                <i class="fas fa-xmark"></i>
            </button>
            <div class="game-modal-body">
                <p class="game-modal-eyebrow" id="gameModalEyebrow"></p>
                <h3 class="game-modal-title" id="gameModalTitle">Game details</h3>
                <div id="gameModalBadge"></div>
                <div class="game-modal-media game-modal-media--inline" id="gameModalMedia"></div>
                <p class="game-modal-description" id="gameModalDescription"></p>
                <div class="game-modal-simple" id="gameModalSimple"></div>
                <details class="game-modal-technical" id="gameModalTechnicalWrap">
                    <summary>View detailed specifications</summary>
                    <div id="gameModalTechnical"></div>
                </details>
                <div class="game-modal-actions game-modal-actions--stacked">
                    <button type="button" class="game-modal-primary" id="gameModalCta">
                        <i class="fas fa-gauge-high"></i> Can I Run This?
                    </button>
                    <button type="button" class="game-modal-secondary" onclick="closeGameDetailsModal()">Back to games</button>
                </div>
            </div>
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
