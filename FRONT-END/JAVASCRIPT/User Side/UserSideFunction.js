// ============================================================================
// 1. STATE & BACKEND DATA FETCHING
// ============================================================================
// Games will be loaded from CSV via PHP API
let games = [];

// Load games from CSV
async function loadGamesFromCSV() {
    try {
        const response = await fetch('../../../MODULES/api/get-games.php');
        games = await response.json();
        return games;
    } catch (error) {
        console.error('Error loading games:', error);
        return [];
    }
}

// --- CPU and GPU data ---
let cpus = [];
let gpus = [];

async function loadCPUsFromCSV() {
    try {
        const response = await fetch('../../../MODULES/api/get-cpus.php');
        cpus = await response.json();
        return cpus;
    } catch (error) {
        console.error('Error loading CPUs:', error);
        return [];
    }
}

async function loadGPUsFromCSV() {
    try {
        const response = await fetch('../../../MODULES/api/get-gpus.php');
        gpus = await response.json();
        return gpus;
    } catch (error) {
        console.error('Error loading GPUs:', error);
        return [];
    }
}


// ============================================================================
// 2. INITIALIZATION & SETUP ROUTINES
// ============================================================================
// --- FPS PREDICTION: Load all dropdowns ---
async function loadFPSPredictionDropdowns() {
    // Load all data in parallel
    await Promise.all([
        loadGamesFromCSV(),
        loadCPUsFromCSV(),
        loadGPUsFromCSV()
    ]);
    
    // Initialize searchable dropdowns
    initSearchDropdown('game', games, game => game.title, game => game.title_raw);
    initSearchDropdown('cpu', cpus, cpu => cpu.model, cpu => cpu.score);
    initSearchDropdown('gpu', gpus, gpu => gpu.model, gpu => gpu.score);
    
    // Check if game was passed via URL
    const urlParams = new URLSearchParams(window.location.search);
    const preselectedGame = urlParams.get('game');
    if (preselectedGame) {
        const game = games.find(g => g.title_raw === preselectedGame);
        if (game) {
            document.getElementById('gameSearch').value = game.title;
            document.getElementById('selectedGame').value = preselectedGame;
        }
    }
}

// --- GAME DROPDOWN: Load for FPS Prediction (legacy) #KEEP FOR NOW #ToRemove  ---
async function loadGameDropdown() {
    await loadFPSPredictionDropdowns();
}

// --- LEGACY: Load games for old structure #ToRemove ---
async function loadGames() {
    await loadGamesFromCSV();
    
    const div = document.getElementById('gameList');
    const select = document.getElementById('selectedGame');
    
    if (div) {
        div.innerHTML = '';
        games.forEach(game => {
            div.innerHTML += `
                <div class="game-box">
                    <strong>${game.title}</strong>
                    <p>CPU: ${game.cpu_model}</p>
                    <p>GPU: ${game.gpu_model}</p>
                    <p>RAM: ${game.ram_model}</p>
                </div>
            `;
        });
    }
    
    if (select) {
        select.innerHTML = '<option value="">Select a Game</option>';
        games.forEach(game => {
            select.innerHTML += `<option value="${game.title_raw}">${game.title}</option>`;
        });
    }
    
    const initialButton = document.querySelector('.sidebar button');
    if (initialButton) showTab('browse', initialButton);
}


// ============================================================================
// 3. FRONT-END UI COMPONENTS & UTILITIES
// ============================================================================
// ========== MODAL DIALOG SYSTEM ==========
function showModal(title, message, onConfirm = null) {
    let modalOverlay = document.getElementById('appModal');
    
    // Create modal if it doesn't exist
    if (!modalOverlay) {
        const html = `
            <div id="appModal" class="modal-overlay">
                <div class="modal-dialog">
                    <div class="modal-header">
                        <h2 id="modalTitle">Modal</h2>
                        <button class="modal-close" onclick="closeModal()">&times;</button>
                    </div>
                    <div class="modal-body" id="modalBody">
                        Message goes here
                    </div>
                    <div class="modal-footer">
                        <button class="modal-btn modal-btn-primary" id="modalConfirmBtn" onclick="closeModal()">OK</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);
        modalOverlay = document.getElementById('appModal');
    }
    
    // Set content
    document.getElementById('modalTitle').textContent = title || 'Notification';
    document.getElementById('modalBody').textContent = message || '';
    
    // Setup confirm button
    const confirmBtn = document.getElementById('modalConfirmBtn');
    confirmBtn.onclick = function() {
        closeModal();
        if (onConfirm) onConfirm();
    };
    
    // Show modal
    modalOverlay.classList.add('active');
    
    // Close on overlay click
    modalOverlay.addEventListener('click', function(e) {
        if (e.target === this) closeModal();
    });
}

function closeModal() {
    const modal = document.getElementById('appModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// --- SIDEBAR CONTROL ---
function toggleSidebar() {
    document.body.classList.toggle('sidebar-open');
}

// --- SEARCHABLE DROPDOWN FUNCTIONALITY ---
function initSearchDropdown(type, data, getLabel, getValue) {
    const searchInput = document.getElementById(`${type}Search`);
    const hiddenInput = document.getElementById(type === 'game' ? 'selectedGame' : `${type}Select`);
    const dropdownList = document.getElementById(`${type}DropdownList`);
    const dropdown = document.getElementById(`${type}Dropdown`);
    
    if (!searchInput || !dropdownList || !dropdown) return;
    
    let highlightedIndex = -1;
    let isSelecting = false; // Flag to prevent reopening on selection
    
    // Populate initial list
    function populateList(filter = '') {
        const filtered = data.filter(item => 
            getLabel(item).toLowerCase().includes(filter.toLowerCase())
        ).slice(0, 50); // Limit to 50 results for performance
        
        dropdownList.innerHTML = '';
        highlightedIndex = -1;
        
        if (filtered.length === 0) {
            dropdownList.innerHTML = '<div class="no-results">No results found</div>';
            return;
        }
        
        filtered.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'dropdown-item';
            div.textContent = getLabel(item);
            div.dataset.value = getValue(item);
            div.dataset.index = index;
            
            div.addEventListener('mousedown', (e) => {
                e.preventDefault(); // Prevent input blur
                selectItem(item);
            });
            
            dropdownList.appendChild(div);
        });
    }
    
    function selectItem(item) {
        isSelecting = true;
        searchInput.value = getLabel(item);
        hiddenInput.value = getValue(item);
        dropdown.classList.remove('active');
        searchInput.blur(); // Remove focus from input
        setTimeout(() => { isSelecting = false; }, 100);
    }
    
    function highlightItem(index) {
        const items = dropdownList.querySelectorAll('.dropdown-item');
        items.forEach(item => item.classList.remove('highlighted'));
        
        if (index >= 0 && index < items.length) {
            items[index].classList.add('highlighted');
            items[index].scrollIntoView({ block: 'nearest' });
            highlightedIndex = index;
        }
    }
    
    // Event listeners
    searchInput.addEventListener('focus', () => {
        if (isSelecting) return; // Don't reopen if we just selected
        populateList(searchInput.value);
        dropdown.classList.add('active');
    });
    
    searchInput.addEventListener('input', () => {
        populateList(searchInput.value);
        hiddenInput.value = ''; // Clear selection when typing
        dropdown.classList.add('active');
    });
    
    searchInput.addEventListener('keydown', (e) => {
        const items = dropdownList.querySelectorAll('.dropdown-item');
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            highlightItem(Math.min(highlightedIndex + 1, items.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            highlightItem(Math.max(highlightedIndex - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (highlightedIndex >= 0 && items[highlightedIndex]) {
                const value = items[highlightedIndex].dataset.value;
                const item = data.find(d => String(getValue(d)) === String(value));
                if (item) selectItem(item);
            }
        } else if (e.key === 'Escape') {
            dropdown.classList.remove('active');
        }
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!dropdown.contains(e.target)) {
            dropdown.classList.remove('active');
        }
    });
}

// --- LEGACY: TAB NAVIGATION (for old UserSide.html) #ToRemove ---
function showTab(tabName, button) {
    document.querySelectorAll('.tab').forEach(tab => tab.style.display = "none");
    document.getElementById(tabName).style.display = "block";
    
    document.querySelectorAll('.sidebar button').forEach(btn => btn.classList.remove('active'));
    if (button) {
        button.classList.add('active');
    }
}


// ============================================================================
// 4. APPLICATION LOGIC & HANDLERS
// ============================================================================
// --- BROWSE GAMES: Initialize and Load Games ---
async function initBrowseGames() {
    await loadGamesFromCSV();
    loadGameGrid();
}

function loadGameGrid() {
    const grid = document.getElementById('gameGrid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    games.forEach(game => {
        const card = document.createElement('div');
        card.className = 'game-card';
        card.dataset.title = game.title.toLowerCase();
        
        const imageUrl = game.image ? `../../RES/${game.image}` : '';

        // Store description for hover modal
        const description = (game.description || '').trim();
        card.dataset.description = description;

        card.innerHTML = `
            <div class="game-image" ${imageUrl ? `style="background-image: url('${imageUrl}')"` : ''}>
                ${!imageUrl ? '🎮' : ''}
            </div>
            <div class="game-name">${game.title}</div>
        `;

        card.onclick = () => selectGame(game.title_raw);

        // Tooltip-like hover (right side of card)
        let tooltipTimer = null;
        let tooltipEl = null;

        const createTooltip = () => {
            if (tooltipEl) return tooltipEl;

            const title = game.title || 'Game';
            const desc = (card.dataset.description || '').trim();

            // Build extra details. Backend currently only guarantees description + requirement fields.
            // We derive Genre/Multiplayer from the game title/description (same heuristic used by filterGames).
            const textForHeuristics = `${title} ${desc}`.toLowerCase();

            const categoryKeywords = {
                action: ['action', 'adventure', 'combat', 'stealth', 'open-world'],
                rpg: ['rpg', 'loot', 'fantasy', 'choices', 'quest', 'exploration'],
                fps: ['fps', 'shooter', 'competitive', 'agent', 'tactics', 'battle royale'],
                adventure: ['adventure', 'open-world', 'story', 'journey', 'quest'],
                sports: ['sports', 'soccer'],
                racing: ['racing'],
                strategy: ['strategy', 'tactics', 'team strategy'],
                sandbox: ['sandbox', 'building', 'crafting', 'survival']
            };

            const guessGenre = (() => {
                const entries = Object.entries(categoryKeywords);
                for (const [key, kws] of entries) {
                    if (kws.some(k => textForHeuristics.includes(k))) return key.toUpperCase();
                }
                return '';
            })();

            const guessMultiplayer = (() => {
                // Simple keyword-based guess
                if (textForHeuristics.includes('co-op') || textForHeuristics.includes('coop')) return 'CO-OP';
                if (textForHeuristics.includes('raids') || textForHeuristics.includes('online')) return 'ONLINE';
                if (textForHeuristics.includes('competitive') || textForHeuristics.includes('tactical') || textForHeuristics.includes('ranked')) return 'COMPETITIVE';
                if (textForHeuristics.includes('battle royale')) return 'ONLINE (BATTLE ROYALE)';
                if (textForHeuristics.includes('team-based') || textForHeuristics.includes('team strategy')) return 'ONLINE';
                return '';
            })();

            const reqSummary = (() => {
                const cpuReq = typeof game.cpu_benchmark === 'number' ? game.cpu_benchmark.toLocaleString() : game.cpu_benchmark;
                const gpuReq = typeof game.gpu_benchmark === 'number' ? game.gpu_benchmark.toLocaleString() : game.gpu_benchmark;
                const ramReq = typeof game.ram_benchmark === 'number' ? (game.ram_benchmark / 250) : game.ram_benchmark;

                const cpuModel = game.cpu_model || 'CPU';
                const gpuModel = game.gpu_model || 'GPU';
                const ramModel = game.ram_model || (ramReq ? `${ramReq} GB` : 'RAM');

                // Keep it compact for tooltip.
                return {
                    cpu: `${cpuModel} (Score: ${cpuReq})`,
                    gpu: `${gpuModel} (Score: ${gpuReq})`,
                    ram: `${ramModel} (Min)`
                };
            })();

            const safeRow = (label, value) => {
                if (!value) return '';
                return `<div class="tooltip-row"><span class="tooltip-label">${label}:</span><span class="tooltip-value">${value}</span></div>`;
            };

            tooltipEl = document.createElement('div');
            tooltipEl.className = 'game-hover-tooltip';
            tooltipEl.innerHTML = `
                <div class="tooltip-title">${title}</div>
                ${safeRow('Genre', guessGenre)}
                ${safeRow('Multiplayer', guessMultiplayer)}
                ${safeRow('Developer / Publisher', game.developer_publisher || '')}
                <div class="tooltip-divider"></div>
                <div class="tooltip-body">${desc || 'No description available.'}</div>
                <div class="tooltip-divider"></div>
                <div class="tooltip-subtitle">Recommended CPU/GPU/RAM</div>
                ${safeRow('CPU', reqSummary.cpu)}
                ${safeRow('GPU', reqSummary.gpu)}
                ${safeRow('RAM', reqSummary.ram)}
            `;

            document.body.appendChild(tooltipEl);

            // Trigger sweep-in transition
            requestAnimationFrame(() => {
                tooltipEl?.classList.add('game-hover-tooltip--show');
            });

            return tooltipEl;
        };

        const positionTooltip = (rect) => {
            if (!tooltipEl) return;

            // Place tooltip to the right side of the card.
            const gap = 12;
            const minLeft = 16;
            const minTop = 16;

            let left = rect.right + gap;
            let top = rect.top + rect.height / 2 - tooltipEl.offsetHeight / 2;

            // Clamp horizontally within viewport
            const maxLeft = window.innerWidth - tooltipEl.offsetWidth - 16;
            left = Math.max(minLeft, Math.min(maxLeft, left));

            // Clamp vertically within viewport
            const maxTop = window.innerHeight - tooltipEl.offsetHeight - 16;
            top = Math.max(minTop, Math.min(maxTop, top));

            tooltipEl.style.left = `${left}px`;
            tooltipEl.style.top = `${top}px`;
        };



        card.addEventListener('pointerenter', (e) => {
            const rect = card.getBoundingClientRect();
            tooltipTimer = setTimeout(() => {
                createTooltip();
                positionTooltip(rect);
            }, 120);
        });

        card.addEventListener('pointermove', (e) => {
            // If tooltip already exists, keep it positioned (optional lightweight)
            if (!tooltipEl) return;
            const rect = card.getBoundingClientRect();
            positionTooltip(rect);
        });

        card.addEventListener('pointerleave', () => {
            if (tooltipTimer) clearTimeout(tooltipTimer);
            tooltipTimer = null;
            if (tooltipEl) {
                tooltipEl.remove();
                tooltipEl = null;
            }

            // Remove sweep effect
            // removeHoverSweep(card); -- walang declared function, so comment out ko muna
        });

        grid.appendChild(card);
    });
}

function filterGames() {
    const searchTerm = document.getElementById('gameSearch')?.value.toLowerCase() || '';
    const genreFilter = document.getElementById('genreFilter')?.value || '';
    
    const cards = document.querySelectorAll('.game-card');
    
    cards.forEach(card => {
        const title = card.dataset.title;
        
        const matchesSearch = title.includes(searchTerm);

        // Filter related games when genreFilter is set.
        // The browse-games filter uses a selector value like: action, rpg, fps, adventure, etc.
        // Our CSV doesn't include genres, so we map selector values to keywords found in the game title/description.
        // When genreFilter is set, we show all cards that match the selected category keyword.
        const desc = (card.dataset.description || '').toLowerCase();
        const titleLower = title.toLowerCase();

        const filterKey = String(genreFilter).toLowerCase();
        const categoryKeywords = {
            action: ['action', 'adventure', 'rpg', 'myth', 'combat', 'stealth', 'open-world'],
            rpg: ['rpg', 'adventure', 'choices', 'loot', 'fantasy', 'myth', 'exploration'],
            fps: ['fps', 'shooter', 'legend', 'tactics', 'aim', 'competitive', 'agent', 'firefight', 'battle royale'],
            adventure: ['adventure', 'open-world', 'story', 'journey', 'mythic', 'quest'],
            sports: ['sports', 'soccer', 'competitive'],
            racing: ['racing'],
            strategy: ['strategy', 'tactics', 'team strategy', 'operator'],
            sandbox: ['sandbox', 'survival', 'building', 'crafting', 'endless worlds']
        };

        const keywords = categoryKeywords[filterKey] || [];
        const matchesGenre = !filterKey || keywords.length === 0
            ? true
            : keywords.some(k => titleLower.includes(k) || desc.includes(k));


        card.style.display = (matchesSearch && matchesGenre) ? 'block' : 'none';

    });
}

const sampleFeedbackData = [
    {
        title: "Excellent prediction accuracy",
        comment: "The FPS predictions feel much more accurate now and helped me choose a better GPU for my setup.",
        rating: 5,
        username: "Ava",
        is_anonymous: false,
        created_at: "2026-06-28",
        helpful_count: 3,
        reported: false
    },
    {
        title: "Great recommendation flow",
        comment: "I liked how the suggestions were easy to understand and matched the games I usually play.",
        rating: 4,
        username: "Noah",
        is_anonymous: false,
        created_at: "2026-06-24",
        helpful_count: 1,
        reported: false
    },
    {
        title: "Helpful for budget builds",
        comment: "This made it simple to compare hardware options before buying anything new for my rig.",
        rating: 5,
        username: "Anonymous",
        is_anonymous: true,
        created_at: "2026-06-20",
        helpful_count: 2,
        reported: false
    }
];

let feedbackState = [...sampleFeedbackData];

function loadStoredFeedback() {
    try {
        const stored = localStorage.getItem("gamespecFeedback");
        if (!stored) return [];
        const parsed = JSON.parse(stored);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.warn("Unable to read saved feedback.", error);
        return [];
    }
}

const storedFeedback = loadStoredFeedback();
if (storedFeedback.length) {
    feedbackState = [...storedFeedback, ...feedbackState];
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function buildFeedbackCardHtml(item, index = 0, { showDelete = false } = {}) {
    const title = escapeHtml(item.title || "Untitled feedback");
    const comment = escapeHtml(item.comment || "No comment provided.");
    const rating = Number(item.rating) || 0;
    const username = item.is_anonymous ? "Anonymous" : escapeHtml(item.username || "Guest");
    const createdAt = item.created_at ? new Date(item.created_at).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" }) : "Recently added";
    const stars = "★".repeat(rating) + "☆".repeat(5 - rating);
    const helpfulCount = Number(item.helpful_count || 0);
    const isReported = Boolean(item.reported);
    const usernameText = item.is_anonymous ? "Anonymous" : String(item.username || "Guest");

    return `
        <div class="feedback-card"
            data-title="${title.toLowerCase()}"
            data-comment="${comment.toLowerCase()}"
            data-rating="${rating}"
            data-username="${usernameText.toLowerCase()}"
            data-created="${createdAt.toLowerCase()}">
            <div class="feedback-card-header">
                <div>
                    <h4>${title}</h4>
                    <div class="feedback-meta">${username} · ${createdAt}</div>
                </div>
                <span class="feedback-rating-badge">${stars}</span>
            </div>
            <p class="feedback-comment">${comment}</p>
            <div class="feedback-card-footer">
                <span class="feedback-helpful-count">Helpful <strong>${helpfulCount}</strong></span>
                <div class="feedback-actions">
                    <button type="button" class="feedback-action-btn feedback-helpful-btn" onclick="markFeedbackHelpful(${index})">
                        <i class="fas fa-thumbs-up"></i> Helpful
                    </button>
                    <button type="button" class="feedback-action-btn feedback-report-btn" onclick="reportFeedbackItem(${index})" ${isReported ? "disabled" : ""}>
                        <i class="fas fa-flag"></i> ${isReported ? "Reported" : "Report"}
                    </button>
                    ${showDelete ? `<button type="button" class="feedback-action-btn feedback-delete-btn" onclick="deleteFeedbackItem(${index})"><i class="fas fa-trash-alt"></i> Delete</button>` : ""}
                </div>
            </div>
        </div>
    `;
}

function renderFeedbackCards(feedbacks, container, { limit = null, showDelete = false } = {}) {
    if (!container) return;

    const items = Array.isArray(feedbacks) ? feedbacks : [];
    const visibleItems = limit ? items.slice(0, limit) : items;

    if (!visibleItems.length) {
        container.innerHTML = `
            <div class="results-placeholder">
                <div class="placeholder-icon"><i class="fas fa-comment-dots"></i></div>
                <p>No feedback available yet.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = visibleItems.map((item, index) => buildFeedbackCardHtml(item, index, { showDelete })).join("");

    if (typeof filterFeedback === "function") {
        filterFeedback();
    }
}

function persistFeedbackState() {
    try {
        localStorage.setItem("gamespecFeedback", JSON.stringify(feedbackState));
    } catch (error) {
        console.warn("Unable to update saved feedback locally.", error);
    }
}

function deleteFeedbackItem(index) {
    if (!Number.isInteger(index) || index < 0 || index >= feedbackState.length) return;

    feedbackState.splice(index, 1);
    persistFeedbackState();

    const listContainer = document.getElementById("feedbackList");
    if (listContainer) {
        renderFeedbackCards(feedbackState, listContainer, { showDelete: true });
    }

    updateFeedbackSummary(feedbackState);

    if (typeof loadFeedbackPreview === "function") {
        loadFeedbackPreview();
    }
}

function markFeedbackHelpful(index) {
    if (!Number.isInteger(index) || index < 0 || index >= feedbackState.length) return;

    feedbackState[index].helpful_count = Number(feedbackState[index].helpful_count || 0) + 1;
    persistFeedbackState();

    const listContainer = document.getElementById("feedbackList");
    if (listContainer) {
        renderFeedbackCards(feedbackState, listContainer, { showDelete: true });
    }

    if (typeof loadFeedbackPreview === "function") {
        loadFeedbackPreview();
    }
}

function reportFeedbackItem(index) {
    if (!Number.isInteger(index) || index < 0 || index >= feedbackState.length) return;

    feedbackState[index].reported = true;
    persistFeedbackState();

    const listContainer = document.getElementById("feedbackList");
    if (listContainer) {
        renderFeedbackCards(feedbackState, listContainer, { showDelete: true });
    }

    if (typeof loadFeedbackPreview === "function") {
        loadFeedbackPreview();
    }
}

function openFeedbackModal() {
    const overlay = document.getElementById("feedbackModalOverlay");
    if (overlay) {
        overlay.classList.add("active");
    }
}

function closeFeedbackModal() {
    const overlay = document.getElementById("feedbackModalOverlay");
    if (overlay) {
        overlay.classList.remove("active");
    }
}

function handleFeedbackSubmit(event) {
    event.preventDefault();

    const form = document.getElementById("feedbackForm");
    if (!form) return;

    const formData = new FormData(form);
    const newFeedback = {
        title: String(formData.get("title") || "Untitled feedback").trim(),
        comment: String(formData.get("comment") || "No comment provided.").trim(),
        rating: Number(formData.get("rating") || 5),
        username: String(formData.get("username") || "").trim(),
        is_anonymous: !String(formData.get("username") || "").trim(),
        created_at: new Date().toISOString(),
        helpful_count: 0,
        reported: false
    };

    feedbackState.unshift(newFeedback);

    try {
        localStorage.setItem("gamespecFeedback", JSON.stringify(feedbackState));
    } catch (error) {
        console.warn("Unable to save feedback locally.", error);
    }

    const listContainer = document.getElementById("feedbackList");
    if (listContainer) {
        renderFeedbackCards(feedbackState, listContainer, { showDelete: true });
    }

    updateFeedbackSummary(feedbackState);

    if (typeof loadFeedbackPreview === "function") {
        loadFeedbackPreview();
    }

    form.reset();
    closeFeedbackModal();
}

function updateFeedbackSummary(feedbacks) {
    const averageRatingEl = document.getElementById("averageRating");
    const averageStarsEl = document.getElementById("averageStars");
    const totalReviewsEl = document.getElementById("totalReviews");

    const items = Array.isArray(feedbacks) ? feedbacks : [];

    if (!items.length) {
        if (averageRatingEl) averageRatingEl.textContent = "0.0";
        if (averageStarsEl) averageStarsEl.textContent = "☆☆☆☆☆";
        if (totalReviewsEl) totalReviewsEl.textContent = "No reviews yet";
        return;
    }

    const average = (items.reduce((sum, item) => sum + (Number(item.rating) || 0), 0) / items.length).toFixed(1);
    const fullStars = Math.round(Number(average));

    if (averageRatingEl) averageRatingEl.textContent = average;
    if (averageStarsEl) averageStarsEl.textContent = "★".repeat(fullStars) + "☆".repeat(5 - fullStars);
    if (totalReviewsEl) totalReviewsEl.textContent = `${items.length} community review${items.length === 1 ? "" : "s"}`;
}

async function loadFeedbackData() {
    try {
        const response = await fetch("../../MODULES/api/get-latest-feedback.php");

        if (!response.ok) {
            throw new Error("Feedback request failed");
        }

        const feedbacks = await response.json();

        if (Array.isArray(feedbacks) && feedbacks.length) {
            feedbackState = feedbacks;
            return feedbackState;
        }
    } catch (error) {
        console.warn("Using sample feedback data because the live feedback endpoint is unavailable.", error);
    }

    return feedbackState;
}

function filterFeedback() {

    const searchTerm = document
        .getElementById("feedbackSearch")
        ?.value
        .toLowerCase() || "";

    const ratingFilter = document
        .getElementById("ratingFilter")
        ?.value || "";

    const cards = document.querySelectorAll(".feedback-card");

    cards.forEach(card => {

        const title = card.dataset.title || "";
        const comment = card.dataset.comment || "";
        const rating = card.dataset.rating || "";

        const username = card.dataset.username || "";
    const createdAt = card.dataset.created || "";

    const matchesSearch =
            title.includes(searchTerm) ||
            comment.includes(searchTerm) ||
            username.includes(searchTerm) ||
            createdAt.includes(searchTerm);

        const matchesRating =
            ratingFilter === "" ||
            rating === ratingFilter;

        card.style.display =
            (matchesSearch && matchesRating)
                ? "block"
                : "none";
    });

}

async function loadFeedbackPage() {
    const listContainer = document.getElementById("feedbackList");

    if (listContainer) {
        listContainer.innerHTML = `
            <div class="results-placeholder">
                <div class="placeholder-icon"><i class="fas fa-comment-dots"></i></div>
                <p>Loading community feedback...</p>
            </div>
        `;
    }

    const feedbacks = await loadFeedbackData();

    updateFeedbackSummary(feedbacks);

    if (listContainer) {
        renderFeedbackCards(feedbacks, listContainer, { showDelete: true });
    }
}

function selectGame(title) {
    // Navigate to FPS prediction with selected game
    window.location.href = `fps-prediction.php?game=${encodeURIComponent(title)}`;
}

function detectHardware() {
    window.location.href = 'hardware-benchmark.php';
}

// --- HARDWARE BENCHMARK FUNCTIONALITY ---
async function initHardwareBenchmark() {
    // Pre-load CPU and GPU data
    await Promise.all([loadCPUsFromCSV(), loadGPUsFromCSV()]);
}

function loadHardwareOptions() {
    const hardwareType = document.getElementById('hardwareType').value;
    const hardwareSelect = document.getElementById('hardwareSelect');
    const hardwareSearch = document.getElementById('hardwareSearch');

    if (!hardwareType) {
        hardwareSelect.innerHTML = '<option value="">First select a hardware type above</option>';
        hardwareSelect.disabled = true;
        if (hardwareSearch) {
            hardwareSearch.value = '';
            hardwareSearch.disabled = true;
        }
        return;
    }

    hardwareSelect.disabled = false;
    if (hardwareSearch) {
        hardwareSearch.value = '';
        hardwareSearch.disabled = false;
    }

    if (hardwareType === 'cpu') {
        hardwareSelect.innerHTML = '<option value="">Select a CPU</option>';
        cpus.forEach(cpu => {
            hardwareSelect.innerHTML += `<option value="${cpu.score}" data-name="${cpu.model}">${cpu.model} (${cpu.cores}C/${cpu.threads}T)</option>`;
        });
    } else if (hardwareType === 'gpu') {
        hardwareSelect.innerHTML = '<option value="">Select a GPU</option>';
        gpus.forEach(gpu => {
            hardwareSelect.innerHTML += `<option value="${gpu.score}" data-name="${gpu.model}">${gpu.model}</option>`;
        });
    } else if (hardwareType === 'ram') {
        hardwareSelect.innerHTML = '<option value="">Select RAM Size</option>';
        const ramOptions = [
            { size: 4, score: 1000 },
            { size: 8, score: 2000 },
            { size: 16, score: 4000 },
            { size: 32, score: 8000 },
            { size: 64, score: 16000 }
        ];
        ramOptions.forEach(ram => {
            hardwareSelect.innerHTML += `<option value="${ram.score}" data-name="${ram.size} GB">${ram.size} GB DDR4/DDR5</option>`;
        });
    }

    filterHardwareOptions();
}

function filterHardwareOptions() {
    const searchValue = document.getElementById('hardwareSearch')?.value.toLowerCase() || '';
    const hardwareSelect = document.getElementById('hardwareSelect');
    if (!hardwareSelect) return;

    Array.from(hardwareSelect.options).forEach(option => {
        if (!option.value) {
            option.hidden = false;
            return;
        }

        const label = (option.textContent || '').toLowerCase();
        const matches = label.includes(searchValue);
        option.hidden = !matches;
    });
}

function getBenchmarkScore() {
    const hardwareType = document.getElementById('hardwareType').value;
    const hardwareSelect = document.getElementById('hardwareSelect');
    
    if (!hardwareType) {
        return showModal('Warning', 'Please select a hardware type first.');
    }
    
    if (!hardwareSelect.value) {
        return showModal('Warning', 'Please select a hardware model.');
    }
    
    const score = parseInt(hardwareSelect.value);
    const selectedOption = hardwareSelect.options[hardwareSelect.selectedIndex];
    const name = selectedOption.dataset.name || selectedOption.text;
    
    // Determine score rating
    let rating = '';
    let ratingClass = '';
    
    if (hardwareType === 'cpu') {
        if (score >= 40000) { rating = 'Excellent'; ratingClass = 'excellent'; }
        else if (score >= 25000) { rating = 'Great'; ratingClass = 'great'; }
        else if (score >= 15000) { rating = 'Good'; ratingClass = 'good'; }
        else if (score >= 8000) { rating = 'Average'; ratingClass = 'average'; }
        else { rating = 'Entry Level'; ratingClass = 'entry'; }
    } else if (hardwareType === 'gpu') {
        if (score >= 25000) { rating = 'Excellent'; ratingClass = 'excellent'; }
        else if (score >= 15000) { rating = 'Great'; ratingClass = 'great'; }
        else if (score >= 10000) { rating = 'Good'; ratingClass = 'good'; }
        else if (score >= 5000) { rating = 'Average'; ratingClass = 'average'; }
        else { rating = 'Entry Level'; ratingClass = 'entry'; }
    } else if (hardwareType === 'ram') {
        if (score >= 8000) { rating = 'Excellent'; ratingClass = 'excellent'; }
        else if (score >= 4000) { rating = 'Great'; ratingClass = 'great'; }
        else if (score >= 2000) { rating = 'Good'; ratingClass = 'good'; }
        else { rating = 'Entry Level'; ratingClass = 'entry'; }
    }
    
    const typeLabel = hardwareType.toUpperCase();
    
    document.getElementById('benchResult').innerHTML = `
        <div class="bench-score-card ${ratingClass}">
            <div class="bench-type">${typeLabel}</div>
            <div class="bench-name">${name}</div>
            <div class="bench-score">${score.toLocaleString()}</div>
            <div class="bench-label">Benchmark Score</div>
            <div class="bench-rating">${rating}</div>
        </div>
    `;
}

// --- SIMPLE HARDWARE SCORING (For demonstration only) ---
function scoreCPU(cpu) {
    cpu = cpu.toLowerCase();
    if (cpu.includes("i3") || cpu.includes("r3")) return 3;
    if (cpu.includes("i5") || cpu.includes("r5")) return 6;
    if (cpu.includes("i7") || cpu.includes("r7")) return 8;
    if (cpu.includes("i9") || cpu.includes("r9")) return 10;
    return 5;
}

function scoreGPU(gpu) {
    gpu = gpu.toLowerCase();
    if (gpu.includes("750") || gpu.includes("1050")) return 2;
    if (gpu.includes("970") || gpu.includes("1060") || gpu.includes("3050")) return 6;
    if (gpu.includes("2070") || gpu.includes("3070") || gpu.includes("4060")) return 8;
    if (gpu.includes("3080") || gpu.includes("4080")) return 10;
    return 4;
}

// --- LEGACY BENCHMARK (for old structure) #ToRemove ---
function runBenchmark() {
    const cpuEl = document.getElementById("cpu");
    const gpuEl = document.getElementById("gpu");
    const ramEl = document.getElementById("ram");
    
    if (!cpuEl || !gpuEl || !ramEl) return;
    
    const cpuScore = scoreCPU(cpuEl.value);
    const gpuScore = scoreGPU(gpuEl.value);
    const ramScore = Math.min(10, ramEl.value / 4);

    const total = Math.round(cpuScore + gpuScore + ramScore);
    const maxScore = 30;
    
    document.getElementById("benchResult").innerText = 
        `Your System Score: ${total}/${maxScore}`;
}

// --- FPS PREDICTION FUNCTIONALITY (ML-backed + Loading Screen while predicting) ---
let isPredictingFPS = false;

function showPredictionLoading() {
    let overlay = document.getElementById('predictionLoadingOverlay');

    if (!overlay) {
        const html = `
            <div id="predictionLoadingOverlay" class="prediction-loading-overlay">
                <div class="prediction-loading-card">
                    <div class="prediction-spinner"></div>
                    <h3>Analyzing Performance</h3>
                    <p>Please wait while the ML model evaluates your setup.</p>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);
        overlay = document.getElementById('predictionLoadingOverlay');
    }

    overlay.classList.add('active');
    document.body.classList.add('analysis-in-progress');

    const analyzeButton = document.querySelector('button[onclick="predictFPS()"]');
    if (analyzeButton) {
        analyzeButton.disabled = true;
        analyzeButton.dataset.originalText = analyzeButton.textContent;
        analyzeButton.textContent = 'Analyzing...';
    }
}

function hidePredictionLoading() {
    const overlay = document.getElementById('predictionLoadingOverlay');
    if (overlay) {
        overlay.classList.remove('active');
    }

    document.body.classList.remove('analysis-in-progress');

    const analyzeButton = document.querySelector('button[onclick="predictFPS()"]');
    if (analyzeButton) {
        analyzeButton.disabled = false;
        analyzeButton.textContent = analyzeButton.dataset.originalText || 'Analyze Performance';
    }
}

async function predictFPS() {
    if (isPredictingFPS) return;

    const game = document.getElementById("selectedGame").value;
    if (!game) return showModal('Warning', 'Please select a game first.');

    const cpuScore = document.getElementById("cpuSelect").value;
    const gpuScore = document.getElementById("gpuSelect").value;
    const ramSelect = document.getElementById("ramSelect");
    
    if (!cpuScore) return showModal('Warning', 'Please select a CPU.');
    if (!gpuScore) return showModal('Warning', 'Please select a GPU.');
    if (!ramSelect.value) return showModal('Warning', 'Please select RAM.');

    const cpuScoreNum = parseInt(cpuScore, 10);
    const gpuScoreNum = parseInt(gpuScore, 10);
    const ramGB = parseInt(ramSelect.value, 10);
    const ramScoreNum = ramGB * 250;

    const cpuName = document.getElementById("cpuSearch").value || 'Selected CPU';
    const gpuName = document.getElementById("gpuSearch").value || 'Selected GPU';

    const selectedGame = games.find(g => g.title_raw === game);
    if (!selectedGame) return showModal('Error', 'Game not found.');

    const quality = document.getElementById("graphicsQuality").value || 'medium';
    const performanceMode = document.getElementById("performanceMode")?.value || 'balanced';

    const presetMap = {
        low: 'Low',
        medium: 'Medium',
        high: 'High'
    };

    const antiAliasMap = {
        low: 'Off',
        medium: 'FXAA',
        high: 'TAA'
    };

    const payload = {
        game_title: selectedGame.title_raw || selectedGame.title || game,
        game_cpu_min: parseInt(selectedGame.cpu_benchmark, 10),
        game_gpu_min: parseInt(selectedGame.gpu_benchmark, 10),
        game_ram_min: parseInt(selectedGame.ram_benchmark, 10),
        cpu_score: cpuScoreNum,
        gpu_score: gpuScoreNum,
        ram_score: ramScoreNum,
        res_width: 1920,
        res_height: 1080,
        graphics_preset: presetMap[quality] || 'Medium',
        shadow_quality: presetMap[quality] || 'Medium',
        texture_quality: presetMap[quality] || 'Medium',
        anti_aliasing: antiAliasMap[quality] || 'Off',
        vsync: 'Off',
        performance_mode: performanceMode
    };

    isPredictingFPS = true;
    showPredictionLoading();

    try {
        const response = await fetch('../../../MODULES/hardware-specs-input.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (!result.success) {
            console.error('Prediction failed:', result);
            return showModal('Error', result.error || 'ML prediction failed.');
        }

        const estimatedFPS = Number(result.predicted_fps) || 0;
        const cpuOK = cpuScoreNum >= selectedGame.cpu_benchmark;
        const gpuOK = gpuScoreNum >= selectedGame.gpu_benchmark;
        const ramOK = ramScoreNum >= selectedGame.ram_benchmark;

        const bottlenecks = [];
        if (!cpuOK) bottlenecks.push({ type: 'CPU', name: cpuName, userScore: cpuScoreNum, required: selectedGame.cpu_benchmark });
        if (!gpuOK) bottlenecks.push({ type: 'GPU', name: gpuName, userScore: gpuScoreNum, required: selectedGame.gpu_benchmark });
        if (!ramOK) bottlenecks.push({ type: 'RAM', name: `${ramGB} GB`, userScore: ramScoreNum, required: selectedGame.ram_benchmark });

        let fpsClass = 'fps-ok';
        if (estimatedFPS >= 75) fpsClass = 'fps-good';
        else if (estimatedFPS < 45) fpsClass = 'fps-bad';

        let html = '';

        html += `
            <div class="fps-display ${fpsClass}">
                <div class="fps-value">${estimatedFPS}</div>
                <div class="fps-label">Estimated FPS</div>
            </div>
        `;

        if (estimatedFPS < 45 && bottlenecks.length > 0) {
            html += `
                <div class="result-section danger">
                    <h4>Performance Bottlenecks</h4>
                    <ul class="bottleneck-list">
                        ${bottlenecks.map(b => `
                            <li>${b.type}: ${b.name} - Your score: ${b.userScore.toLocaleString()} | Required: ${b.required.toLocaleString()}</li>
                        `).join('')}
                    </ul>
                </div>
            `;
        }

        const maxScore = Math.max(cpuScoreNum, gpuScoreNum, ramScoreNum, selectedGame.cpu_benchmark, selectedGame.gpu_benchmark, selectedGame.ram_benchmark);

        html += `
            <div class="result-section">
                <h4>Hardware vs Game Requirements</h4>
                <div class="bar-chart">
                    <div class="bar-item">
                        <div class="bar-label">
                            <span>CPU</span>
                            <span>${cpuOK ? 'Pass' : 'Below'}</span>
                        </div>
                        <div class="bar-row">
                            <span class="bar-model-name">Your: ${cpuName}</span>
                            <div class="bar-container">
                                <div class="bar-fill user" style="width: ${(cpuScoreNum / maxScore) * 100}%">${cpuScoreNum}</div>
                            </div>
                        </div>
                        <div class="bar-row">
                            <span class="bar-model-name">Req: ${selectedGame.cpu_model || 'Min Required'}</span>
                            <div class="bar-container">
                                <div class="bar-fill game" style="width: ${(selectedGame.cpu_benchmark / maxScore) * 100}%">${selectedGame.cpu_benchmark}</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="bar-item">
                        <div class="bar-label">
                            <span>GPU</span>
                            <span>${gpuOK ? 'Pass' : 'Below'}</span>
                        </div>
                        <div class="bar-row">
                            <span class="bar-model-name">Your: ${gpuName}</span>
                            <div class="bar-container">
                                <div class="bar-fill user" style="width: ${(gpuScoreNum / maxScore) * 100}%">${gpuScoreNum}</div>
                            </div>
                        </div>
                        <div class="bar-row">
                            <span class="bar-model-name">Req: ${selectedGame.gpu_model || 'Min Required'}</span>
                            <div class="bar-container">
                                <div class="bar-fill game" style="width: ${(selectedGame.gpu_benchmark / maxScore) * 100}%">${selectedGame.gpu_benchmark}</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="bar-item">
                        <div class="bar-label">
                            <span>RAM</span>
                            <span>${ramOK ? 'Pass' : 'Below'}</span>
                        </div>
                        <div class="bar-row">
                            <span class="bar-model-name">Your: ${ramGB} GB</span>
                            <div class="bar-container">
                                <div class="bar-fill user" style="width: ${(ramScoreNum / maxScore) * 100}%">${ramScoreNum}</div>
                            </div>
                        </div>
                        <div class="bar-row">
                            <span class="bar-model-name">Req: ${selectedGame.ram_model || (selectedGame.ram_benchmark / 250) + ' GB'}</span>
                            <div class="bar-container">
                                <div class="bar-fill game" style="width: ${(selectedGame.ram_benchmark / maxScore) * 100}%">${selectedGame.ram_benchmark}</div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="bar-legend">
                    <span><span class="legend-dot user"></span> Your Hardware</span>
                    <span><span class="legend-dot game"></span> Game Requirement</span>
                </div>
            </div>
        `;

        if (estimatedFPS >= 75) {
            html += `
                <div class="result-section success">
                    <h4>You have graphics headroom</h4>
                    <ul class="suggestion-list">
                        <li>Increase Graphics Quality to a higher preset</li>
                        <li>Enable Anti-Aliasing or move up to TAA</li>
                        <li>Increase Bloom or other post-processing effects</li>
                        <li>Increase Shadow Quality</li>
                        <li>Increase Texture Quality</li>
                    </ul>
                </div>
            `;
        } else if (estimatedFPS >= 60) {
            html += `
                <div class="result-section success">
                    <h4>You can slightly improve graphics</h4>
                    <ul class="suggestion-list">
                        ${quality === 'low' ? '<li>Increase Graphics Quality to Medium</li>' : ''}
                        ${quality === 'medium' ? '<li>Try High graphics quality</li>' : ''}
                        <li>Enable Anti-Aliasing</li>
                        <li>Increase Texture Quality</li>
                    </ul>
                </div>
            `;
        } else if (estimatedFPS < 50) {
            html += `
                <div class="result-section warning">
                    <h4>Suggested Settings to Improve FPS</h4>
                    <ul class="suggestion-list downgrade">
                        ${quality !== 'low' ? '<li>Lower Graphics Quality preset</li>' : ''}
                        <li>Disable or lower Anti-Aliasing</li>
                        <li>Lower Shadow Quality</li>
                        <li>Reduce View Distance</li>
                        <li>Disable Motion Blur</li>
                        <li>Lower Texture Quality</li>
                        <li>Disable Ambient Occlusion</li>
                    </ul>
                </div>
            `;
        }

        if (estimatedFPS < 50 && bottlenecks.length > 0) {
            html += `<div class="result-section danger">
                <h4>Recommended Hardware Upgrades</h4>
            `;

            bottlenecks.forEach(b => {
                if (b.type === 'CPU' && cpus.length > 0) {
                    const betterCPUs = cpus.filter(c => c.score >= selectedGame.cpu_benchmark && c.score > cpuScoreNum)
                        .sort((a, b) => a.score - b.score)
                        .slice(0, 3);
                    if (betterCPUs.length > 0) {
                        html += `
                            <div class="upgrade-category">
                                <h5>CPU Alternatives:</h5>
                                <div class="upgrade-options">
                                    ${betterCPUs.map(c => `
                                        <div class="upgrade-option">
                                            <span>${c.model} (${c.cores}C/${c.threads}T)</span>
                                            <span class="score">Score: ${c.score}</span>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        `;
                    }
                }
                
                if (b.type === 'GPU' && gpus.length > 0) {
                    const betterGPUs = gpus.filter(g => g.score >= selectedGame.gpu_benchmark && g.score > gpuScoreNum)
                        .sort((a, b) => a.score - b.score)
                        .slice(0, 3);
                    if (betterGPUs.length > 0) {
                        html += `
                            <div class="upgrade-category">
                                <h5>GPU Alternatives:</h5>
                                <div class="upgrade-options">
                                    ${betterGPUs.map(g => `
                                        <div class="upgrade-option">
                                            <span>${g.model}</span>
                                            <span class="score">Score: ${g.score}</span>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        `;
                    }
                }
                
                if (b.type === 'RAM') {
                    const currentRAM = ramGB;
                    const requiredRAM = selectedGame.ram_benchmark / 250;
                    const ramOptions = [8, 16, 32, 64].filter(r => r > currentRAM && r >= requiredRAM).slice(0, 3);
                    if (ramOptions.length > 0) {
                        html += `
                            <div class="upgrade-category">
                                <h5>RAM Alternatives:</h5>
                                <div class="upgrade-options">
                                    ${ramOptions.map(r => `
                                        <div class="upgrade-option">
                                            <span>${r} GB DDR4/DDR5</span>
                                            <span class="score">Score: ${r * 250}</span>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        `;
                    }
                }
            });
            
            html += `</div>`;
        }

        document.getElementById("fpsResultsPanel").innerHTML = html;
    } catch (error) {
        console.error('Prediction request failed:', error);
        return showModal('Error', 'Failed to contact the ML prediction service.');
    } finally {
        isPredictingFPS = false;
        hidePredictionLoading();
    }
}

async function loadFeedbackPreview() {
    const container = document.getElementById("feedbackPreviewList");

    if (!container) return;

    container.innerHTML = `
        <div class="results-placeholder">
            <div class="placeholder-icon"><i class="fas fa-comment-dots"></i></div>
            <p>Loading feedback...</p>
        </div>
    `;

    const feedbacks = await loadFeedbackData();
    renderFeedbackCards(feedbacks, container, { limit: 3 });
}

loadFeedbackPreview();