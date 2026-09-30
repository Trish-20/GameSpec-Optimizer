<?php
require_once __DIR__ . '/admin-guard.php';
?>
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
            <h3 id="gameFormTitle">Add Game</h3>
            <p id="gameFormModeHint" class="form-mode-hint">Fill in the details below to add a new game to the catalog.</p>
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

                    <div class="form-field">
                        <label for="gameRAMSpeed">Min RAM Speed (MHz):</label>
                        <input type="number" id="gameRAMSpeed" placeholder="e.g., 3200" required>
                    </div>

                    <!-- Filter fields: these values are constrained to the
                         same categories the user-side Browse Games filters
                         use, so a game added here can always be found by
                         users selecting a genre or release year. -->

                    <!-- Genre checkboxes (the .toggle-group / .toggle-item
                         styles already exist in AdminSideStyle.css). Values
                         mirror the Browse Games genre filter exactly. -->
                    <div class="form-field game-genre-field">
                        <label id="gameGenresLabel">Genres (used by Browse filters):</label>
                        <div class="toggle-group" id="gameGenreGroup" role="group" aria-labelledby="gameGenresLabel">
                            <?php
                            $browseGenres = [
                                'Action' => 'Action',
                                'RPG' => 'RPG',
                                'Shooter' => 'Shooter / FPS',
                                'Adventure' => 'Adventure',
                                'Sports' => 'Sports',
                                'Racing' => 'Racing',
                                'Strategy' => 'Strategy',
                                'Sandbox' => 'Sandbox',
                                'Simulation' => 'Simulation',
                                'Puzzle' => 'Puzzle',
                                'Indie' => 'Indie',
                                'Survival' => 'Survival',
                            ];
                            foreach ($browseGenres as $value => $label): ?>
                                <div class="toggle-item">
                                    <input type="checkbox" id="genre-<?= htmlspecialchars(strtolower($value), ENT_QUOTES, 'UTF-8') ?>" class="gameGenreCheckbox" value="<?= htmlspecialchars($value, ENT_QUOTES, 'UTF-8') ?>">
                                    <label for="genre-<?= htmlspecialchars(strtolower($value), ENT_QUOTES, 'UTF-8') ?>"><?= htmlspecialchars($label, ENT_QUOTES, 'UTF-8') ?></label>
                                </div>
                            <?php endforeach; ?>
                        </div>
                        <small class="field-hint">Select at least one so users can filter this game by genre.</small>
                    </div>

                    <div class="form-field">
                        <label for="gameReleaseYear">Release Year:</label>
                        <input type="number" id="gameReleaseYear" min="1970" max="<?= (int) date('Y') + 2 ?>" placeholder="e.g., 2024">
                    </div>

                    <div class="form-field">
                        <label for="gamePlatform">Platforms:</label>
                        <select id="gamePlatform" multiple size="3" aria-describedby="gamePlatformHint">
                            <option value="PC" selected>PC (Windows)</option>
                            <option value="macOS">macOS</option>
                            <option value="Linux">Linux</option>
                        </select>
                        <small id="gamePlatformHint" class="field-hint">Hold Ctrl / Cmd to select more than one. PC is required.</small>
                    </div>

                    <!-- Cover upload/insertion on the RIGHT, top-aligned with
                         the Min RAM Speed field and spanning down beside the
                         description. The file input and preview share ONE
                         unified drop card. Layout only — upload behaviour
                         unchanged. -->
                    <div class="form-field game-cover-field">
                        <label for="gameCover">Game Cover Picture:</label>
                        <div class="game-cover-dropzone">
                            <input type="file" id="gameCover" accept="image/png,image/jpeg,image/webp,image/gif,image/avif">
                            <div id="gameCoverPreview" class="game-cover-preview" hidden>
                                <span class="game-cover-thumb">
                                    <img id="gameCoverPreviewImage" alt="Selected game cover preview">
                                    <button type="button" id="clearGameCover" class="game-cover-remove" title="Remove preview" aria-label="Remove selected game cover preview">
                                        <i class="fas fa-xmark" aria-hidden="true"></i>
                                    </button>
                                </span>
                            </div>
                            <div id="gameCoverPlaceholder" class="game-cover-placeholder">
                                <span>[ Image Preview ]</span>
                                <p>Game image preview will appear here.</p>
                            </div>
                        </div>
                    </div>

                    <!-- Description sits in the LEFT column directly under the
                         Min RAM Speed field, stretching to match the cover
                         column height (balanced square block). -->
                    <div class="form-field game-description-field">
                        <label for="gameDescription">Game Description:</label>
                        <textarea id="gameDescription" rows="3" placeholder="Enter a short description of the game..."></textarea>
                    </div>
                </div>

                 <hr>
                 <div class="form-action-row" style="display: flex; gap: 12px; align-items: center;">
                    <button type="submit" id="gameSubmitBtn">Add Game</button>
                    <button type="button" id="cancelEditBtn" class="btn-secondary" style="display: none;" onclick="cancelGameEdit()">Cancel Edit</button>
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
            <div id="noGameMessage" class="no-results-state" style="display: none;" aria-live="polite">
                <p>No games match your search.</p>
            </div>
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
