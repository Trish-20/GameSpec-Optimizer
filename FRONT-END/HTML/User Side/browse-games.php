<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Browse Games - GameSpec Optimizer</title>
    <script>try { document.documentElement.dataset.theme = localStorage.getItem('gamespec-theme') === 'dark' ? 'dark' : 'light'; } catch (e) {}</script>
    <link rel="stylesheet" href="../../CSS/User Side/UserSideStyle.css">
    <!-- Mobile layout layer: every rule sits inside a max-width media
         query, so desktop rendering is left completely untouched. -->
    <link rel="stylesheet" href="../../CSS/shared/MobileResponsive.css?v=<?= @filemtime(__DIR__ . '/../../CSS/shared/MobileResponsive.css') ?: '1' ?>">
</head>
<body class="sidebar-open">

<?php include 'header.php'; ?>

<div class="content">
    <!-- Fixed Top Section -->
    <div class="browse-top-section">
        <div class="search-filter-container">
            <div class="search-box">
                <input type="text" id="gameSearch" placeholder="Search games &#8212; try &quot;Minecraft&quot;, &quot;GTA V&quot;, etc..." oninput="filterGames()" aria-label="Search games">
                <span class="search-icon"><i class="fas fa-magnifying-glass"></i></span>
            </div>

            <button type="button" id="moreFiltersBtn" class="more-filters-btn" onclick="toggleMoreFilters()" aria-expanded="false" aria-controls="moreFiltersPanel">
                <i class="fas fa-sliders" aria-hidden="true"></i>
                <span>Filters</span>
                <span class="filter-count" id="activeFilterCount" hidden>0</span>
                <i class="fas fa-chevron-down toggle-icon" aria-hidden="true"></i>
            </button>

            <div class="sort-filter">
                <label for="sortOrderSearch" class="sort-label">Sort:</label>
                <div class="search-dropdown" id="sortOrderDropdown">
                    <input type="text" class="search-input" id="sortOrderSearch" placeholder="Most Popular" autocomplete="off" aria-label="Sort games">
                    <input type="hidden" id="sortOrder" value="popular">
                    <div class="dropdown-list" id="sortOrderDropdownList"></div>
                </div>
            </div>
            <button class="theme-toggle toolbar-theme-toggle" type="button" onclick="toggleTheme()" aria-label="Switch color theme" title="Switch Theme" aria-pressed="false">
                <i class="fas fa-moon" aria-hidden="true"></i><span class="theme-toggle-label">Dark mode</span>
            </button>
            <div class="active-filter-facets" id="activeFilterFacets" aria-label="Active filters" hidden></div>
        </div>

        <!-- Collapsible More Filters Panel -->
        <div id="moreFiltersPanel" class="more-filters-panel" style="display: none;" aria-hidden="true">
            <div class="facets-panel-heading">
                <div><h3>Refine games</h3><p>Combine filters to narrow your results.</p></div>
                <div class="facets-panel-tools">
                    <span class="facets-result-count" id="facetsResultCount" aria-live="polite">Loading games</span>
                    <button type="button" class="clear-filters-btn" onclick="clearGameSearch()"><i class="fas fa-rotate-left" aria-hidden="true"></i> Clear all</button>
                </div>
            </div>
            <div class="more-filters-grid">
                <div class="filter-group">
                    <label for="genreFilterSearch">Genre</label>
                    <div class="search-dropdown" id="genreFilterDropdown">
                        <input type="text" class="search-input" id="genreFilterSearch" placeholder="All genres" autocomplete="off" aria-label="Filter by genre">
                        <input type="hidden" id="genreFilter" value="">
                        <div class="dropdown-list" id="genreFilterDropdownList"></div>
                    </div>
                </div>
                <div class="filter-group">
                    <label for="platformFilterSearch">Works on</label>
                    <div class="search-dropdown" id="platformFilterDropdown">
                        <input type="text" class="search-input" id="platformFilterSearch" placeholder="Filter by platform..." autocomplete="off">
                        <input type="hidden" id="platformFilter" value="">
                        <div class="dropdown-list" id="platformFilterDropdownList"></div>
                    </div>
                </div>

                <div class="filter-group">
                    <label for="yearFilterSearch">Released</label>
                    <div class="search-dropdown" id="yearFilterDropdown">
                        <input type="text" class="search-input" id="yearFilterSearch" placeholder="Filter by year..." autocomplete="off">
                        <input type="hidden" id="yearFilter" value="">
                        <div class="dropdown-list" id="yearFilterDropdownList"></div>
                    </div>
                </div>

                <div class="filter-group">
                    <label for="requirementFilterSearch">How demanding is this game?</label>
                    <div class="search-dropdown" id="requirementFilterDropdown">
                        <input type="text" class="search-input" id="requirementFilterSearch" placeholder="Filter by demand..." autocomplete="off">
                        <input type="hidden" id="requirementFilter" value="">
                        <div class="dropdown-list" id="requirementFilterDropdownList"></div>
                    </div>
                    <span class="filter-hint">How powerful a computer the game needs.</span>
                </div>

            </div>
        </div>
    </div>

    <section class="browse-hero" aria-labelledby="browseHeroTitle">
        <div class="browse-hero-copy">
            <p class="browse-hero-eyebrow">Browse Games</p>
            <h1 id="browseHeroTitle">Find Your <span>Next Game</span></h1>
            <p class="browse-hero-description">Explore games, check their system requirements, and see how they may run on your PC.</p>
        </div>
        <a class="browse-hero-credit" href="https://commons.wikimedia.org/wiki/File:Renier_Meganck_-_Mountainous_forest_landscape_with_a_view_of_a_castle.jpg" target="_blank" rel="noopener noreferrer" aria-label="Banner artwork: Mountainous forest landscape with a view of a castle by Renier Meganck, public domain">Artwork: Renier Meganck &#183; Public domain</a>
    </section>

    <div class="browse-category-bar">
        <div class="browse-category-tabs" role="tablist" aria-label="Game categories">
            <button type="button" class="browse-category-tab active" role="tab" aria-selected="true" data-category="popular" onclick="setBrowseCategory('popular')"><i class="fas fa-fire" aria-hidden="true"></i><span>Popular</span></button>
            <button type="button" class="browse-category-tab" role="tab" aria-selected="false" data-category="latest" onclick="setBrowseCategory('latest')"><i class="far fa-clock" aria-hidden="true"></i><span>Latest</span></button>
            <button type="button" class="browse-category-tab" role="tab" aria-selected="false" data-category="all" onclick="setBrowseCategory('all')"><i class="fas fa-gamepad" aria-hidden="true"></i><span>All Games</span></button>
        </div>
        <p class="browse-game-total" id="browseGameTotal" aria-live="polite">Loading games...</p>
        <p class="visually-hidden" id="browseResultCount" role="status" aria-live="polite">Loading games...</p>
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

<script src="../../JAVASCRIPT/User Side/UserSideFunction.js?v=<?= @filemtime(__DIR__ . '/../../JAVASCRIPT/User Side/UserSideFunction.js') ?: '1' ?>"></script>
<script>
    // Set active state for current page
    document.querySelector('[data-page="browse"]')?.classList.add('active');
    updateThemeButton();
    // Initialize the page
    if (typeof initBrowseGames === 'function') {
        initBrowseGames();
    }
</script>
</body>
</html>
