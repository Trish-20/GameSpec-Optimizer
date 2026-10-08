// ============================================================================
// 1. STATE & BACKEND DATA FETCHING
// ============================================================================
// Games will be loaded from CSV via PHP API
let games = [];

function normalizeGameRecord(game) {
    const minimum = game?.requirements?.minimum || {};
    const minimumBenchmarks = game?.benchmarks?.minimum || {};

    return {
        ...game,
        title_raw: game.title_raw || game.slug || game.title,
        image: game.image || game.cover || '',
        genres: Array.isArray(game.genres) ? game.genres : [],
        cpu_model: minimum.cpu || '',
        gpu_model: minimum.gpu || '',
        ram_model: minimum.ram || (minimum.ram_capacity_gb ? `${minimum.ram_capacity_gb} GB RAM` : ''),
        ram_capacity_gb: minimum.ram_capacity_gb ?? null,
        ram_speed_mhz: minimum.ram_speed_mhz ?? null,
        cpu_benchmark: minimumBenchmarks.cpu?.score ?? null,
        gpu_benchmark: minimumBenchmarks.gpu?.score ?? null,
        ram_benchmark: minimumBenchmarks.ram?.score ?? null,
        benchmark_matches: game.benchmarks || {}
    };
}

function getGameImageUrl(image) {
    if (!image) return '';
    const value = String(image).trim();
    if (/^data:image\//i.test(value)) return value;
    if (/^https?:\/\//i.test(value)) return value;
    // update-games.php stores a project-relative path such as
    // uploads/game-covers/game_xxx.jpg.
    // From FRONT-END/HTML/User Side/, that file is reachable at ../../../uploads/...
    // A leading-slash value is treated the same way for backward compatibility.
    if (value.charAt(0) === '/') return `../../..${value}`;
    if (/^uploads\//i.test(value)) return `../../../${value}`;
    return `../../RES/${value}`;
}

// Load games from CSV
async function loadGamesFromCSV() {
    try {
        const response = await fetch('../../../MODULES/api/get-games.php');
        games = (await response.json()).map(normalizeGameRecord);
        return games;
    } catch (error) {
        console.error('Error loading games:', error);
        return [];
    }
}

// --- CPU and GPU data ---
let cpus = [];
let gpus = [];
let ramBenchmarks = [];

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

async function loadRAMBenchmarks() {
    try {
        const response = await fetch('../../../MODULES/api/get-ram.php');
        ramBenchmarks = await response.json();
        return ramBenchmarks;
    } catch (error) {
        console.error('Error loading RAM benchmarks:', error);
        return [];
    }
}


// ============================================================================
// 2. INITIALIZATION & SETUP ROUTINES
// ============================================================================
// --- FPS PREDICTION: Load all dropdowns ---
let fpsPredictionInitialization = null;

async function loadFPSPredictionDropdowns() {
    if (fpsPredictionInitialization) {
        return fpsPredictionInitialization;
    }

    fpsPredictionInitialization = initializeFPSPredictionDropdowns();
    return fpsPredictionInitialization;
}

async function initializeFPSPredictionDropdowns() {
    // Load all data in parallel
    await Promise.all([
        loadGamesFromCSV(),
        loadCPUsFromCSV(),
        loadGPUsFromCSV(),
        loadRAMBenchmarks()
    ]);
    
        // Initialize searchable dropdowns
    initSearchDropdown('game', games, game => game.title, game => game.title_raw);
    initSearchDropdown('cpu', cpus, cpu => cpu.model, cpu => cpu.score);
    initSearchDropdown('gpu', gpus, gpu => gpu.model, gpu => gpu.score);
        // RAM uses capacity field for label (e.g. "8 GB"), score for value
    const ramData = [];
    const availableRamCapacities = [...new Set(ramBenchmarks
        .map(item => Number(item.capacity))
        .filter(capacity => Number.isFinite(capacity) && capacity > 0))]
        .sort((a, b) => a - b);
    (availableRamCapacities.length ? availableRamCapacities : [4, 8, 16, 32, 64]).forEach(cap => {
        const match = ramBenchmarks.find(r => Number(r.capacity) === cap);
        ramData.push({
            label: `${cap} GB`,
            value: String(cap),
            capacity: cap,
            score: match ? match.score : undefined
        });
    });
    initSearchDropdown('ram', ramData, ram => ram.label, ram => ram.value);
    initSearchDropdown('graphicsQuality', [
        { label: 'Low', value: 'low' },
        { label: 'Medium', value: 'medium' },
        { label: 'High', value: 'high' }
    ], item => item.label, item => item.value);
    initSearchDropdown('performanceMode', [
        { label: 'Battery Saver', value: 'battery' },
        { label: 'Balanced', value: 'balanced' },
        { label: 'Performance', value: 'performance' }
    ], item => item.label, item => item.value);

    // The markup already carries default values in the hidden inputs (for
    // example Performance Mode defaults to "balanced"). Show the matching label
    // in the visible box so each dropdown reads like a real field instead of
    // only showing its placeholder.
    ['graphicsQuality', 'performanceMode'].forEach(type => {
        const hiddenInput = document.getElementById(type);
        if (hiddenInput && hiddenInput.value && searchDropdownApis[type]) {
            searchDropdownApis[type].setValue(hiddenInput.value);
        }
    });
    
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
    document.getElementById('modalBody').innerText = message || '';
    
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

// ============================================================================
// 14) Help & Tutorial Center
// ============================================================================
// A comprehensive, scrollable guide opened from the "?" button in the header.
// Built once and reused on every user-facing page.
//
// Each section pairs a concise explanation with a clearly labelled image
// placeholder. The placeholder is a <div class="help-image-placeholder"> that a
// designer can later replace with a real <img src="..." alt="..."> without
// touching the surrounding markup.

// Maps the per-page help key (used by the header ? button) to a Help Center
// section so the Center opens on the most relevant topic.
const helpSectionByKey = {
    browse: 'browse-games',
    predict: 'fps-prediction',
    benchmark: 'hardware-benchmark',
    feedback: 'community-feedback'
};

// Reusable image placeholder. Swappable for <img src="..." alt="..."> later.
function helpImagePlaceholder(expectedName, altText) {
    const alt = altText || expectedName;
    return (
        '<div class="help-image-placeholder" role="img" aria-label="' + alt + '">' +
        '<div class="help-placeholder-icon" aria-hidden="true"><i class="fas fa-image"></i></div>' +
        '<div class="help-placeholder-name">' + expectedName + '</div>' +
        '<div class="help-placeholder-note">Screenshot will be inserted here</div>' +
        '</div>'
    );
}

// Caption helper (small caption placed under a placeholder).
function helpCaption(text) {
    return '<p class="help-image-caption">' + text + '</p>';
}

// Graceful fallback for images that are not yet provided: shows the labelled
// placeholder so the area stays visible until the real src is available.
function helpImageError(img, expectedName) {
    var wrap = img.parentNode;
    if (wrap && !wrap.classList.contains('has-fallback')) {
        wrap.classList.add('has-fallback');
        img.style.display = 'none';
        wrap.insertAdjacentHTML('beforeend', helpImagePlaceholder(expectedName));
    }
}

// ---------------------------------------------------------------------------
// Section content (rich HTML). Each entry renders inside a <section>.
// ---------------------------------------------------------------------------
const helpCenterSections = [
    {
        id: 'getting-started',
        toc: 'Getting Started',
        icon: 'fa-play',
        title: 'Getting Started with GameSpec Optimizer',
        content:
            '<p>Use GameSpec Optimizer in six simple steps:</p>' +
            '<ol class="help-steps">' +
            '<li>Browse or search for a game.</li>' +
            '<li>Select the game.</li>' +
            '<li>Configure or detect your hardware.</li>' +
            '<li>Choose graphics quality and performance mode.</li>' +
            '<li>Analyze performance.</li>' +
            '<li>Review FPS, bottlenecks, recommendations, and upgrade suggestions.</li>' +
            '</ol>' +
            '<div class="help-image">' +
                '<img src="../../RES/Tutorials/browse-games/Landing_page.png" '  +
                    'alt="GameSpec Optimizer workflow diagram">' +
            '</div>'
    },
    {
        id: 'browse-games',
        toc: 'Browse Games',
        icon: 'fa-gamepad',
        title: 'Browse Games',
        content:
            '<p>Use the search bar to find a game by name. Start typing part of the title and matching games appear as you type.</p>' +
            '<div class="help-image">' +
                '<img src="../../RES/Tutorials/browse-games/search_engine.png" '  +
                    'alt="Search bar on the Browse Games page">' +
            '</div>' +
            '<p>Use the genre filter to narrow down games by type. Available types include Action, RPG, FPS, Adventure, Sports, Racing, Strategy, and Sandbox.</p>' +
            '<div class="help-image">' +
                '<img src="../../RES/Tutorials/browse-games/filter_options.png" '  +
                    'alt="Genre filter on the Browse Games page">' +
            '</div>' +  
            '<p>Use <strong>More Filters</strong> to narrow down games further. Open it to filter by <strong>Works on</strong> (your computer type), <strong>Released</strong> (release year), and <strong>How demanding is this game?</strong> (how powerful a computer the game needs).</p>' +
            '<p><strong>How demanding is this game?</strong> means how powerful a computer the game needs. Each game shows one of these levels:</p>' +
            '<ul>' +
            '<li><strong>Easy to Run</strong> &mdash; works on most computers, including basic ones.</li>' +
            '<li><strong>Moderate</strong> &mdash; needs an average, reasonably modern computer.</li>' +
            '<li><strong>Demanding</strong> &mdash; needs a modern gaming computer.</li>' +
            '<li><strong>Very Demanding</strong> &mdash; needs a strong, high-end gaming computer.</li>' +
            '</ul>' +
            '<p>Open <strong>View Details</strong> on any game card to see that game&apos;s description and computer requirements.</p>' +
            '<div class="help-image">' +
                '<img src="../../RES/Tutorials/browse-games/view_details.png" '  +
                    'alt="Game Details view opened with View Details">' +
            '</div>' +
            '<p>The Game Details view shows, from top to bottom: the game type, the game title, the requirement level badge, the game image, the game description, <strong>What you&apos;ll need</strong> (memory, graphics, and processor in plain language), and <strong>View detailed specifications</strong>. Open <strong>View detailed specifications</strong> to see the exact processor, graphics, and memory details.</p>' +
            '<div class="help-image">' +
                '<img src="../../RES/Tutorials/browse-games/title_part.png" '  +
                    'alt="Game Details view opened with View Details">' +
            '</div>' +
            '<div class="help-image">' +
                '<img src="../../RES/Tutorials/browse-games/game_image.png" '  +
                    'alt="Game Details view opened with View Details">' +
            '</div>' +
            '<div class="help-image">' +
                '<img src="../../RES/Tutorials/browse-games/what_youll_need.png" '  +
                    'alt="Game Details view opened with View Details">' +
            '</div>' +
            '<div class="help-image">' +
                '<img src="../../RES/Tutorials/browse-games/detailed_spec.png" '  +
                    'alt="Game Details view opened with View Details">' +
            '</div>' +
            '<p>Select <strong>Can I Run This?</strong> to continue to FPS Prediction and check how the game may perform on your computer. The game you selected is already filled in there.</p>' +
            '<div class="help-image">' +
                '<img src="../../RES/Tutorials/browse-games/hardware_config.png" '  +
                    'alt="FPS Prediction page after selecting Can I Run This">' +
            '</div>' +
            '<p>To return to the Browse Games page, select the <strong>X</strong> close button at the top of the Game Details view.</p>'
    },
    {
        id: 'hardware-detection',
        toc: 'Hardware Detection',
        icon: 'fa-search',
        title: 'Hardware Detection',
        content:
            '<p>GameSpec Optimizer can fill in your hardware from what your browser reports. On the FPS Prediction page, click the <strong>Detect Hardware</strong> button and your CPU, GPU and RAM are suggested. Browsers only share an approximate picture, so always check the suggestions against your own machine before analyzing.</p>' +
            '<div class="help-image">' +
                '<img src="../../RES/Tutorials/hardware-detection/detect_hardware.png" ' +
                    'alt="FPS Prediction page after selecting Can I Run This">' +
            '</div>' + 
            '<p>If automatic detection is unavailable (for example on a non-Windows system, or when permissions are restricted), you can <strong>select your hardware manually</strong> from the searchable dropdowns instead.</p>' +
            '<h3>Find your hardware manually</h3>' +
            '<p>To look up your specs without the auto-detect feature:</p>' +
            '<ol class="help-steps">' +
            '<li><strong>Open Windows Run</strong> by pressing <kbd>Windows</kbd> + <kbd>R</kbd>.</li>' +
            '<li><strong>Type <code>dxdiag</code> and press Enter</strong> to open the DirectX Diagnostic Tool.</li>' +
            '<div class="help-image">' +
                '<img src="../../RES/Tutorials/hardware-detection/dxdiag.png" '  +
                    'alt="FPS Prediction page after selecting Can I Run This">' +
            '</div>' +
            '<li><strong>Check the System and Display tabs</strong> for your processor, memory, and graphics card.</li>' +
            '<div class="help-image">' +
                '<img src="../../RES/Tutorials/hardware-detection/display_information.png" '  +
                    'alt="FPS Prediction page after selecting Can I Run This">' +
            '</div>' +
            '</ol>' +
            '<ul>' +
            '<li><strong>System tab</strong> &mdash; find your CPU (Processor e.g 11th Gen Intel(R) Core(TM) i5 ‑ 1135G7 @ 2.40GHz (8 CPUs, ~2.4GHz)) and installed RAM (Memory e.g 16 GB).</li>' +
            '<div class="help-image">' +
                '<img src="../../RES/Tutorials/hardware-detection/processor_tab.png" '  +
                    'alt="FPS Prediction page after selecting Can I Run This">' +
            '</div>' +
            '<li><strong>Display tab</strong> &mdash; find your graphics card (Name under Device e.g Intel(R) Iris(R) Xe Graphics).</li>' +
            '<div class="help-image">' +
                '<img src="../../RES/Tutorials/hardware-detection/graphics_tab.png" '  +
                    'alt="FPS Prediction page after selecting Can I Run This">' +
            '</div>' +
            '</ul>'
    },
    {
        id: 'hardware-benchmark',
        toc: 'Hardware Benchmark',
        icon: 'fa-microchip',
        title: 'Hardware Benchmark',
        content:
            '<p>The Hardware Benchmark page lets you look up benchmark scores for individual components.</p>' +
            '<ul>' +
            '<li><strong>CPU benchmark</strong> &mdash; scores processor performance for gaming.</li>' +
            '<li><strong>GPU benchmark</strong> &mdash; scores graphics performance (the biggest FPS factor).</li>' +
            '<li><strong>RAM information</strong> &mdash; shows and scores your installed memory.</li>' +
            '</ul>' +
            '<p>First choose a <strong>hardware type</strong> (CPU, GPU, or RAM). Then <strong>select the specific component</strong> from the searchable list. Click <strong>Get Benchmark Score</strong> to see how that model performs &mdash; a numbered score with a rating (Excellent, Great, Good, Average, or Entry Level).</p>' +
            '<div class="help-image">' +
                '<img src="../../RES/Tutorials/hardware-benchmark/hardware_type.png" '  +
                    'alt="FPS Prediction page after selecting Can I Run This">' +
            '</div>' +
            '<div class="help-image">' +
                '<img src="../../RES/Tutorials/hardware-benchmark/hardware.png" '  +
                    'alt="FPS Prediction page after selecting Can I Run This">' +
            '</div>' +
            '<div class="help-image">' +
                '<img src="../../RES/Tutorials/hardware-benchmark/benchmark_score.png" '  +
                    'alt="FPS Prediction page after selecting Can I Run This">' +
            '</div>'
    },
    {
        id: 'fps-prediction',
        toc: 'FPS Prediction',
        icon: 'fa-chart-line',
        title: 'FPS Prediction',
        content:
            '<p>The FPS Prediction page collects the inputs below, then estimates your frame rate:</p>' +
            '<ul>' +
            '<li><strong>Game</strong> &mdash; the title you are testing. It sets the requirements used for the estimate.</li>' +
            '<li><strong>CPU</strong> &mdash; your processor. Search by model or detect it automatically.</li>' +
            '<li><strong>GPU</strong> &mdash; your graphics card. It has the largest impact on frame rate.</li>' +
            '<li><strong>RAM</strong> &mdash; select your system memory (4 GB to 64 GB).</li>' +
            '<li><strong>Graphics Quality</strong> &mdash; Low, Medium, or High. Higher quality looks better but usually lowers FPS.</li>' +
            '<li><strong>Performance Mode</strong> &mdash; Battery Saver, Balanced, or Performance. Match your Windows power mode for the most accurate estimate.</li>' +
            '</ul>' +
            '<div class="help-image">' +
                '<img src="../../RES/Tutorials/fps-prediction/FPS_inputFields.png" '  +
                    'alt="FPS Prediction page after selecting Can I Run This">' +
            '</div>' +
            '<p>When you click <strong>Analyze Performance</strong>, the application compares your hardware against the game&rsquo;s requirements and returns an estimated FPS value.</p>' 
    },
    {
        id: 'understanding-fps-results',
        toc: 'Understanding FPS Results',
        icon: 'fa-chart-pie',
        title: 'Understanding FPS Results',
        content:
            '<p>Every prediction is reported as an estimated FPS number. Results are classified using these fixed thresholds:</p>' +
            '<div class="help-fps-rating" role="group" aria-label="FPS rating scale">' +
            '<div class="help-fps-rating-item">' +
            '<span class="help-fps-dot help-fps-good" aria-hidden="true"></span>' +
            '<span class="help-fps-range">75+ FPS</span>' +
            '<span class="help-fps-label">Good / Excellent</span>' +
            '</div>' +
            '<div class="help-fps-rating-item">' +
            '<span class="help-fps-dot help-fps-ok" aria-hidden="true"></span>' +
            '<span class="help-fps-range">45\u201374 FPS</span>' +
            '<span class="help-fps-label">Playable</span>' +
            '</div>' +
            '<div class="help-fps-rating-item">' +
            '<span class="help-fps-dot help-fps-bad" aria-hidden="true"></span>' +
            '<span class="help-fps-range">Below 45 FPS</span>' +
            '<span class="help-fps-label">Low</span>' +
            '</div>' +
            '</div>' +
            '<p>When predicted FPS is well above a 60 FPS target, the application highlights headroom for higher graphics settings. When it is below target, it suggests settings to lower first.</p>' +
            '<div class="help-image">' +
                '<img src="../../RES/Tutorials/fps-prediction/upper_result.png" '  +
                    'alt="FPS Prediction page after selecting Can I Run This">' +
            '</div>' 
    },
    {
        id: 'hardware-comparison',
        toc: 'Hardware Requirement Comparison',
        icon: 'fa-balance-scale',
        title: 'Hardware Requirement Comparison',
        content:
            '<p>The results compare your hardware against the game&rsquo;s requirements component by component.</p>' +
            '<ul>' +
            '<li><strong>Minimum requirements</strong> &mdash; the lowest-spec hardware the game is expected to run on.</li>' +
            '<li><strong>Recommended requirements</strong> &mdash; hardware that delivers a smoother, more stable experience.</li>' +
            '</ul>' +
            '<p>Your CPU, GPU, and RAM are each compared against the game&rsquo;s minimum benchmark score.</p>' +
            '<ul>' +
            '<li><strong>Meets requirement</strong> means your component score is at least equal to the game&rsquo;s required score.</li>' +
            '<li>When a component is <strong>below the requirement</strong>, it is flagged as &ldquo;Needs attention&rdquo; and may be treated as a bottleneck.</li>' +
            '</ul>' +
            '<div class="help-image">' +
                '<img src="../../RES/Tutorials/fps-prediction/middle_result.png" '  +
                    'alt="FPS Prediction page after selecting Can I Run This">' +
            '</div>' 
    },
    {
        id: 'bottlenecks',
        toc: 'Bottlenecks',
        icon: 'fa-exclamation-triangle',
        title: 'Bottlenecks',
        content:
            '<p>A <strong>bottleneck</strong> is a hardware component that limits overall performance because it is much weaker than the rest of your system. Even with strong parts elsewhere, a weak link holds back the frame rate.</p>' +
            '<div class="help-bottleneck-diagram" aria-label="Bottleneck flow diagram">' +
            '<div class="bn-row"><div class="bn-item">CPU</div><div class="bn-item">GPU</div><div class="bn-item">RAM</div></div>' +
            '<div class="bn-arrow" aria-hidden="true">\u2193</div>' +
            '<div class="bn-target">Game Performance</div>' +
            '<div class="bn-arrow" aria-hidden="true">\u2193</div>' +
            '<div class="bn-result">FPS</div>' +
            '</div>' +
            '<p>If a component is identified as a bottleneck, upgrading it usually gives the largest FPS gain.</p>' +
            '<div class="help-image">' +
                '<img src="../../RES/Tutorials/fps-prediction/last_part.png" '  +
                    'alt="FPS Prediction page after selecting Can I Run This">' +
            '</div>' 
    },
    {
        id: 'graphics-recommendations',
        toc: 'Graphics Settings Recommendations',
        icon: 'fa-sliders-h',
        title: 'Graphics Settings Recommendations',
        content:
            '<p>Based on the gap between your estimated FPS and a 60 FPS target, the application suggests graphics adjustments.</p>' +
            '<p>If you have headroom, it may recommend:</p>' +
            '<ul>' +
            '<li>Increasing overall <strong>Graphics Quality</strong></li>' +
            '<li>Increasing <strong>Shadow Quality</strong></li>' +
            '<li>Adjusting <strong>Anti-Aliasing</strong> (for example, to TAA or FXAA)</li>' +
            '<li>Enabling <strong>Ambient Occlusion</strong></li>' +
            '<li>Enabling <strong>Bloom</strong></li>' +
            '<li>Adjusting other supported settings</li>' +
            '</ul>' +
            '<p>If your FPS is too low, the opposite adjustments are offered (lowering or disabling those same settings). All suggestions aim to <strong>balance visual quality and FPS</strong>.</p>' 
    },
    {
        id: 'upgrade-recommendations',
        toc: 'Upgrade Recommendations',
        icon: 'fa-arrow-up',
        title: 'Upgrade Recommendations',
        content:
            '<p>When your hardware does not meet a game&rsquo;s requirements, the application suggests specific upgrade options. The recommendation flows like this:</p>' +
            '<div class="help-upgrade-flow" aria-label="Upgrade recommendation flow">' +
            '<div class="uf-step">Current Hardware</div>' +
            '<div class="uf-arrow" aria-hidden="true">\u2193</div>' +
            '<div class="uf-step">Limiting Component</div>' +
            '<div class="uf-arrow" aria-hidden="true">\u2193</div>' +
            '<div class="uf-step">Recommended Upgrade</div>' +
            '<div class="uf-arrow" aria-hidden="true">\u2193</div>' +
            '<div class="uf-step uf-step-last">Expected Improvement</div>' +
            '</div>' +
            '<p>Review the limiting component first, then compare the suggested upgrade scores. After upgrading, re-run the prediction to confirm the improvement.</p>' 
    },
    {
        id: 'community-feedback',
        toc: 'Community Feedback',
        icon: 'fa-comments',
        title: 'Community Feedback',
        content:
            '<p>The Community Feedback page shows what other players think about their setups and results.</p>' +
            '<ul>' +
            '<li><strong>Viewing reviews</strong> &mdash; feedback cards show a star rating and comment.</li>' +
            '<li><strong>Searching feedback</strong> &mdash; type in the search box to filter reviews by keyword.</li>' +
            '<li><strong>Filtering by rating</strong> &mdash; use the rating dropdown to show only reviews of a certain star level.</li>' +
            '<li><strong>Adding feedback</strong> &mdash; click &ldquo;Add Feedback&rdquo; to open a form with a star rating, title, and comment.</li>' +
            '<li><strong>Helpful votes</strong> &mdash; click the helpful button on a review to mark it as useful.</li>' +
            '<li><strong>Reporting</strong> &mdash; use the report button on any review to flag inappropriate content.</li>' +
            '</ul>' +
            '<div class="help-image">' +
                '<img src="../../RES/Tutorials/feedback/feedback_preview.png" '  +
                    'alt="FPS Prediction page after selecting Can I Run This">' +
            '</div>'
    },
];

// ---------------------------------------------------------------------------
// FAQ (collapsible). answers are concise.
// ---------------------------------------------------------------------------
const helpFaqItems = [
    {
        q: 'What is FPS?',
        a: 'FPS (Frames Per Second) is how many full-screen images your game draws each second. Higher FPS means smoother motion. The app predicts FPS so you can estimate smoothness before playing.'
    },
    {
        q: 'What does minimum requirement mean?',
        a: 'The lowest-spec hardware the game is expected to run on. Meeting it usually means the game launches, but not necessarily at high settings or a smooth frame rate.'
    },
    {
        q: 'What does recommended requirement mean?',
        a: 'Hardware that delivers a smoother, more stable experience. Exceeding the recommended level helps you maintain good frame rates.'
    },
    {
        q: 'Why is my predicted FPS different from an actual game\'s FPS?',
        a: 'Predictions are estimates based on benchmark scores, not live measurement. Real FPS varies with your settings, resolution, background apps, drivers, and the specific game patch.'
    },
    {
        q: 'What is a bottleneck?',
        a: 'A component that limits overall performance because it is much weaker than the rest of your system. Upgrading the bottleneck usually gives the biggest FPS gain.'
    },
    {
        q: 'Why can\'t my hardware be detected?',
        a: 'Detection uses the Windows dxdiag tool and requires Windows with permission to read system information. On other operating systems, or if permissions are restricted, detection may fail. Select your hardware manually instead.'
    },
    {
        q: 'What does Performance Mode mean?',
        a: 'It reflects your Windows power mode: Battery Saver lowers performance for battery life, Balanced is the default, and Performance maximizes frame rate. Match it to your actual setting for the most accurate prediction.'
    },
    {
        q: 'Can I manually select my hardware?',
        a: 'Yes. Use the searchable dropdowns to pick your CPU, GPU, and RAM, or click Detect Hardware to fill them in automatically.'
    },
    {
        q: 'What do the FPS ratings mean?',
        a: '75+ FPS is Good / Excellent, 45\u201374 FPS is Playable, and below 45 FPS is Low.'
    },
    {
        q: 'How should I use the upgrade recommendation?',
        a: 'Review the limiting component first, then compare the suggested upgrade scores. The recommendation shows the gap to close; re-run the prediction after upgrading to confirm the improvement.'
    }
];

// ---------------------------------------------------------------------------
// Build the Help Center markup (TOC + sections + FAQ + support).
// ---------------------------------------------------------------------------
function helpTocLink(targetId, label, icon, extraClass) {
    const cls = extraClass ? 'help-toc-link ' + extraClass : 'help-toc-link';
    return '<li><a href="#" class="' + cls + '" data-target="' + targetId + '">' +
        '<i class="fas ' + icon + ' help-toc-icon" aria-hidden="true"></i>' +
        '<span>' + label + '</span></a></li>';
}

function buildHelpCenterHTML() {
    const tocListItems = helpTocLink('hc-getting-started', 'Start here', 'fa-home', 'help-toc-start active') +
        helpCenterSections.map(function (s) {
            return helpTocLink('hc-' + s.id, s.toc, s.icon || 'fa-circle');
        }).join('') +
        helpTocLink('hc-faq', 'FAQ', 'fa-question-circle');

    const tocListHtml = '<ul class="help-toc-list">' + tocListItems + '</ul>';

    const sections = helpCenterSections.map(function (s) {
        return '<section id="hc-' + s.id + '" class="help-section" tabindex="-1">' +
            '<h2 class="help-section-title">' +
            '<span class="help-section-icon" aria-hidden="true"><i class="fas ' + (s.icon || 'fa-play') + '"></i></span>' +
            '<span>' + s.title + '</span></h2>' +
            s.content +
            '</section>';
    }).join('');

    const faqItems = helpFaqItems.map(function (item) {
        return '<details class="help-faq-item">' +
            '<summary class="help-faq-question">' + item.q + '<span class="help-faq-icon" aria-hidden="true"></span></summary>' +
            '<div class="help-faq-answer"><p>' + item.a + '</p></div>' +
            '</details>';
    }).join('');

    return '' +
        '<div class="modal-dialog help-center-dialog" role="dialog" aria-modal="true" aria-labelledby="pageHelpTitle">' +
        '<div class="modal-header help-center-header">' +
        '<div class="help-center-heading">' +
        '<span class="help-center-kicker">GameSpec Optimizer</span>' +
        '<h2 id="pageHelpTitle">Help &amp; Tutorial Center</h2>' +
        '</div>' +
        '<button class="modal-close" type="button" id="pageHelpCloseBtn" aria-label="Close help">&times;</button>' +
        '</div>' +
        '<div class="help-center-body">' +
        '<nav class="help-toc" aria-label="Table of contents">' +
        tocListHtml +
        '</nav>' +
        '<div class="help-content">' +
        '<details class="help-toc-mobile" role="group" aria-label="On this page">' +
        '<summary class="help-toc-toggle" tabindex="0"><span class="help-toc-icon"></span>On this page</summary>' +
        tocListHtml +
        '</details>' +
        sections +
        '<section id="hc-faq" class="help-section" tabindex="-1">' +
        '<h2 class="help-section-title">' +
        '<span class="help-section-icon" aria-hidden="true"><i class="fas fa-question-circle"></i></span>' +
        '<span>Frequently Asked Questions</span></h2>' +
        '<div class="help-faq">' + faqItems + '</div>' +
        '</section>' +
        '</div>' +
        '</div>' +
        '</div>';
}

let pageHelpModal = null;

function createHelpCenterModal() {
    if (pageHelpModal) {
        return pageHelpModal;
    }

    pageHelpModal = document.createElement('div');
    pageHelpModal.id = 'pageHelpModal';
    pageHelpModal.className = 'modal-overlay page-help-modal';
    pageHelpModal.innerHTML = buildHelpCenterHTML();

    document.body.appendChild(pageHelpModal);

    // Close actions
    var closeHandler = function () { closePageHelp(); };
    var closeBtn = pageHelpModal.querySelector('#pageHelpCloseBtn');
    if (closeBtn) closeBtn.addEventListener('click', closeHandler);

    // Click outside the dialog closes the Center
    pageHelpModal.addEventListener('click', function (event) {
        if (event.target === pageHelpModal) {
            closePageHelp();
        }
    });

    // ESC key
    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && pageHelpModal && pageHelpModal.classList.contains('active')) {
            closePageHelp();
        }
    });

    initHelpCenterTOC(pageHelpModal);

    return pageHelpModal;
}

// Table-of-contents behaviour: smooth scroll + active highlight while scrolling.
function initHelpCenterTOC(modal) {
    var links = modal.querySelectorAll('.help-toc-link');

    links.forEach(function (link) {
        link.addEventListener('click', function (event) {
            event.preventDefault();
            var target = document.getElementById(link.getAttribute('data-target'));
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });

    // Highlight the current section in the TOC as the user scrolls.
    var sections = helpCenterSections.map(function (s) {
        return document.getElementById('hc-' + s.id);
    }).filter(Boolean);
    var extra = [document.getElementById('hc-faq')].filter(Boolean);
    sections = sections.concat(extra);

    if (!('IntersectionObserver' in window) || !sections.length) {
        return;
    }

    var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            var id = entry.target.id;
            var link = modal.querySelector('.help-toc-link[data-target="' + id + '"]');
            if (entry.isIntersecting) {
                links.forEach(function (l) { l.classList.remove('active'); });
                modal.querySelectorAll('.help-toc-link[data-target="' + id + '"]').forEach(function (match) {
                    match.classList.add('active');
                });
            }
        });
    }, { root: modal.querySelector('.help-content'), threshold: 0.35 });

    sections.forEach(function (s) { observer.observe(s); });
}

// Returns the help section key that best matches the current page, so the
// Help Center opens on the most relevant topic. Falls back to the passed
// pageKey, then to null (no scroll -> top of the Center).
function helpCurrentPageKey(pageKey) {
    var activeNav = document.querySelector('.sidebar .nav-btn.active');
    if (activeNav && activeNav.dataset && helpSectionByKey[activeNav.dataset.page]) {
        return activeNav.dataset.page;
    }
    var pathMap = {
        'browse-games.php': 'browse',
        'fps-prediction.php': 'predict',
        'hardware-benchmark.php': 'benchmark',
        'feedback.php': 'feedback'
    };
    var name = (window.location.pathname || '').split('/').pop().toLowerCase();
    if (pathMap[name]) {
        return pathMap[name];
    }
    return pageKey || null;
}

function showPageHelp(pageKey) {
    var modal = createHelpCenterModal();
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Scroll to the most relevant section for the current page.
    var key = helpCurrentPageKey(pageKey);
    var targetId = key ? helpSectionByKey[key] : null;
    if (!targetId && helpSectionByKey[pageKey]) {
        targetId = helpSectionByKey[pageKey];
    }
    var targetEl = targetId ? document.getElementById('hc-' + targetId) : null;
    if (targetEl) {
        setTimeout(function () {
            targetEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 80);
    }
    return false;
}

function closePageHelp() {
    var modal = document.getElementById('pageHelpModal');
    if (modal) {
        modal.classList.remove('active');
        var closeBtn = modal.querySelector('#pageHelpCloseBtn');
        if (closeBtn) closeBtn.blur();
    }
    document.body.style.overflow = '';
}


// --- SIDEBAR CONTROL ---
// Below 900px the sidebar overlays the page instead of pushing it
// sideways, so it needs different handling: a tap-outside backdrop
// and a background scroll lock. Wider screens keep the original
// push behaviour untouched.
var SIDEBAR_OVERLAY_BREAKPOINT = 900;

function isSidebarOverlayMode() {
    return window.innerWidth <= SIDEBAR_OVERLAY_BREAKPOINT;
}

function toggleSidebar() {
    document.body.classList.toggle('sidebar-open');
    syncSidebarScrollLock();
}

function closeSidebar() {
    document.body.classList.remove('sidebar-open');
    syncSidebarScrollLock();
}

// Applied as a class, never as an inline style: the help modal also
// manages body.style.overflow, and the two must not overwrite
// each other.
function syncSidebarScrollLock() {
    var shouldLock = isSidebarOverlayMode()
        && document.body.classList.contains('sidebar-open');
    document.body.classList.toggle('sidebar-locked', shouldLock);
}

document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && document.body.classList.contains('sidebar-open')) {
        closeSidebar();
    }
});

// Tapping a nav link while the drawer is open should reveal the page
// the user just navigated to.
document.addEventListener('click', function (event) {
    if (!isSidebarOverlayMode() || !event.target.closest) {
        return;
    }
    if (event.target.closest('.sidebar .nav-btn')) {
        closeSidebar();
    }
});

// Rotating or resizing past the breakpoint must not strand the lock.
window.addEventListener('resize', syncSidebarScrollLock);

// --- SEARCHABLE DROPDOWN FUNCTIONALITY ---
// Every dropdown on the User Side (FPS Prediction, Browse Games filters,
// Hardware Benchmark and Community Feedback) is built from the SAME
// .search-dropdown markup so they all share one look, one hover state and
// one thin dark scrollbar. This registry exposes a small API per dropdown so
// other helpers (Clear Filters, URL prefills, Detect Hardware) can set the
// visible label and the stored hidden value together.
const searchDropdownApis = {};

function initSearchDropdown(type, data, getLabel, getValue, onSelect) {
    const searchInput = document.getElementById(`${type}Search`);
    // The hidden input holds the real value. Most dropdowns use
    // `${type}Select`, but the Browse Games filters, the feedback rating
    // filter and the FPS graphics/performance fields keep their original ids
    // (e.g. `genreFilter`, `graphicsQuality`), so fall back to `${type}`.
    const hiddenInput = document.getElementById(
        type === 'game' ? 'selectedGame' : `${type}Select`
    ) || document.getElementById(type);
    const dropdownList = document.getElementById(`${type}DropdownList`);
    const dropdown = document.getElementById(`${type}Dropdown`);
    
    if (!searchInput || !dropdownList || !dropdown) return;
    
    let highlightedIndex = -1;
    let isSelecting = false; // Flag to prevent reopening on selection
    
    // Populate initial list. `data` may be an array or a function returning
    // the current option list (Hardware Benchmark passes a provider because
    // its options change when the hardware type changes).
    function populateList(filter = '') {
        const source = typeof data === 'function' ? data() : data;
        const filtered = source.filter(item => 
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
        clearDetectedHardwareSelection(type);
        searchInput.value = getLabel(item);
        if (hiddenInput) hiddenInput.value = getValue(item);
        if (hiddenInput) {
            hiddenInput.dataset.benchmarkId = item?.gpu_id ? String(item.gpu_id) : '';
        }
        dropdown.classList.remove('active');
        searchInput.blur(); // Remove focus from input
        setTimeout(() => { isSelecting = false; }, 100);
        if (typeof onSelect === 'function') {
            onSelect(item, getValue(item));
        }
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
        clearDetectedHardwareSelection(type);
        populateList(searchInput.value);
        if (hiddenInput) hiddenInput.value = ''; // Clear selection when typing
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
                const source = typeof data === 'function' ? data() : data;
                const item = source.find(d => String(getValue(d)) === String(value));
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

    // Small API so other code can set the label + stored value together
    // (e.g. URL prefills, Clear Filters, Detect Hardware) instead of writing
    // only to the visible search box.
    const api = {
        setValue(value) {
            const source = typeof data === 'function' ? data() : data;
            const match = source.find(d => String(getValue(d)) === String(value));
            searchInput.value = match ? getLabel(match) : '';
            if (hiddenInput) hiddenInput.value = match ? getValue(match) : '';
            if (hiddenInput) {
                hiddenInput.dataset.benchmarkId = match?.gpu_id ? String(match.gpu_id) : '';
            }
        },
        setItem(item) {
            searchInput.value = item ? getLabel(item) : '';
            if (hiddenInput) hiddenInput.value = item ? getValue(item) : '';
            if (hiddenInput) {
                hiddenInput.dataset.benchmarkId = item?.gpu_id ? String(item.gpu_id) : '';
            }
        },
        open() {
            populateList(searchInput.value);
            dropdown.classList.add('active');
        },
        close() {
            dropdown.classList.remove('active');
        }
    };

    searchDropdownApis[type] = api;
    return api;
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

    // Initialize the searchable dropdowns for the filter controls
    initSearchDropdown('genreFilter', [
        { label: 'All Genres', value: '' },
        { label: 'Action', value: 'action' },
        { label: 'RPG', value: 'rpg' },
        { label: 'FPS', value: 'fps' },
        { label: 'Adventure', value: 'adventure' },
        { label: 'Sports', value: 'sports' },
        { label: 'Racing', value: 'racing' },
        { label: 'Strategy', value: 'strategy' },
        { label: 'Sandbox', value: 'sandbox' }
    ], item => item.label, item => item.value, filterGames);

    initSearchDropdown('sortOrder', [
        { label: 'Newest → Oldest', value: 'newest' },
        { label: 'Oldest → Newest', value: 'oldest' },
        { label: 'A → Z', value: 'az' },
        { label: 'Z → A', value: 'za' }
    ], item => item.label, item => item.value, filterGames);

    initSearchDropdown('platformFilter', [
        { label: 'All computers', value: '' },
        { label: 'PC (Windows)', value: 'pc' }
    ], item => item.label, item => item.value, filterGames);

    initSearchDropdown('yearFilter', [
        { label: 'Any year', value: '' },
        { label: 'Before 2010', value: 'before-2010' },
        { label: '2010–2014', value: '2010-2014' },
        { label: '2015–2019', value: '2015-2019' },
        { label: '2020–2024', value: '2020-2024' },
        { label: '2025–Present', value: '2025-present' }
    ], item => item.label, item => item.value, filterGames);

    initSearchDropdown('requirementFilter', [
        { label: 'All levels', value: '' },
        { label: 'Easy to Run', value: 'low' },
        { label: 'Moderate', value: 'moderate' },
        { label: 'Demanding', value: 'high' },
        { label: 'Very Demanding', value: 'very-high' }
    ], item => item.label, item => item.value, filterGames);

    // Apply any filter values passed in the URL (if present). Use each
    // dropdown's API so the visible label matches the stored value instead of
    // showing the raw value (e.g. "action" instead of "Action").
    const urlParams = new URLSearchParams(window.location.search);
    const applyFilterFromUrl = (type, value) => {
        if (value && searchDropdownApis[type]) {
            searchDropdownApis[type].setValue(value);
        }
    };
    applyFilterFromUrl('genreFilter', urlParams.get('genre') || '');
    applyFilterFromUrl('sortOrder', urlParams.get('sort') || '');
    applyFilterFromUrl('platformFilter', urlParams.get('platform') || '');
    applyFilterFromUrl('yearFilter', urlParams.get('year') || '');
    applyFilterFromUrl('requirementFilter', urlParams.get('requirement') || '');

    // Trigger initial filter if gameSearch has a value
    const gameSearchVal = urlParams.get('q') || '';
    if (gameSearchVal) {
        document.getElementById('gameSearch').value = gameSearchVal;
    }
}

// --- BROWSE GAMES: shared frontend-only helpers (no backend changes) ---
function escapeBrowseHtml(value) {
    return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatGenreLabel(value) {
    if (!value) return 'Game';
    const text = String(value).trim().toLowerCase();
    const labels = { action: 'Action', rpg: 'RPG', fps: 'Shooter', adventure: 'Adventure', sports: 'Sports', racing: 'Racing', strategy: 'Strategy', sandbox: 'Sandbox / Survival' };
    return labels[text] || (text.charAt(0).toUpperCase() + text.slice(1));
}

function getBrowseRequirementInfo(game) {
    const gpu = parseInt(game?.gpu_benchmark, 10) || 0;
    const cpu = parseInt(game?.cpu_benchmark, 10) || 0;
    const peak = Math.max(gpu, cpu);
    if (peak <= 5000) return { value: 'low', label: 'Easy to Run', icon: 'fa-circle-check' };
    if (peak <= 12000) return { value: 'moderate', label: 'Moderate', icon: 'fa-circle-half-stroke' };
    if (peak <= 18000) return { value: 'high', label: 'Demanding', icon: 'fa-triangle-exclamation' };
    return { value: 'very-high', label: 'Very Demanding', icon: 'fa-fire' };
}

function guessBrowseGenre(game) {
    // Prefer the stored genre set (populated by admin Game Management) so a
    // game the admin labelled "Strategy" is found by the Strategy filter.
    const stored = Array.isArray(game?.genres) ? game.genres : [];
    for (const value of stored) {
        const mapped = mapStoredGenreToFilter(String(value || '').trim().toLowerCase());
        if (mapped) return mapped;
    }

    // Fall back to keyword matching for games with no stored genres.
    const text = `${game?.title || ''} ${game?.description || ''}`.toLowerCase();
    if (text.match(/fps|shooter|competitive|battle royale|squad/)) return 'fps';
    if (text.match(/rpg|fantasy|choices|quest|branching|exploration/)) return 'rpg';
    if (text.match(/sports|soccer|football/)) return 'sports';
    if (text.match(/racing|driving/)) return 'racing';
    if (text.match(/strategy|turn-based/)) return 'strategy';
    if (text.match(/sandbox|building|crafting|survival/)) return 'sandbox';
    if (text.match(/adventure|story|journey/)) return 'adventure';
    if (text.match(/action|combat|stealth|open.world/)) return 'action';
    return '';
}

/**
 * Return EVERY filter key a game should be discoverable under.
 *
 * A game can legitimately carry several genres (the admin Game Management
 * form allows up to 12 checkboxes), but the browse filter needs to match the
 * game under each of them — not just the first one. Games with no usable
 * stored genre fall back to the original keyword guess.
 */
function getBrowseGenreFilterKeys(game) {
    const stored = Array.isArray(game?.genres) ? game.genres : [];
    const keys = [];
    stored.forEach(value => {
        const mapped = mapStoredGenreToFilter(String(value || '').trim().toLowerCase());
        if (mapped && !keys.includes(mapped)) keys.push(mapped);
    });
    if (keys.length) return keys;

    const guessed = guessBrowseGenre(game);
    return guessed ? [guessed] : [];
}

// Maps the genre values stored in the database onto the filter keys used by
// the Browse Games genre dropdown (action, rpg, fps, adventure, ...).
function mapStoredGenreToFilter(genre) {
    const mapping = {
        action: 'action',
        rpg: 'rpg',
        'role-playing': 'rpg',
        shooter: 'fps',
        fps: 'fps',
        adventure: 'adventure',
        sports: 'sports',
        racing: 'racing',
        strategy: 'strategy',
        sandbox: 'sandbox',
        survival: 'sandbox',
        simulation: 'sandbox',
        sim: 'sandbox',
        puzzle: 'adventure',
        indie: 'action'
    };
    return mapping[genre] || '';
}

function getBrowseGenreTags(game) {
    if (Array.isArray(game?.genres) && game.genres.length) {
        return game.genres.slice(0, 2).map(formatGenreLabel);
    }
    const primary = guessBrowseGenre(game);
    const tags = [];
    if (primary) tags.push(formatGenreLabel(primary));
    const hay = `${game?.title || ''} ${(game?.description || '')}`.toLowerCase();
    if (/open.world|exploration/.test(hay) && !tags.includes('Open World')) tags.push('Open World');
    if (!tags.length) tags.push('Game');
    return tags.slice(0, 2);
}

function updateBrowseResultCount(visibleCount, totalCount) {
    const counter = document.getElementById('browseResultCount');
    if (!counter) return;
    const total = Number(totalCount || 0);
    const visible = Number(visibleCount || 0);
    if (!total) {
        counter.textContent = 'Loading games…';
        return;
    }
    counter.textContent = visible === total
        ? `${total} game${total === 1 ? '' : 's'}`
        : `${visible} of ${total} games`;
}

function openGameDetailsModal(titleRaw) {
    const game = games.find(item => item.title_raw === titleRaw);
    const modal = document.getElementById('gameDetailsModal');
    if (!game || !modal) {
        if (titleRaw) selectGame(titleRaw);
        return;
    }
    const requirement = getBrowseRequirementInfo(game);
    const genres = getBrowseGenreTags(game);
    const imageUrl = getGameImageUrl(game.image);
    const description = (game.description || '').trim() || 'No description is available for this game yet. The requirements below still apply.';
    const ramGb = parseInt(game.ram_capacity_gb, 10) || 0;
    const gpuScore = parseInt(game.gpu_benchmark, 10) || 0;
    const cpuScore = parseInt(game.cpu_benchmark, 10) || 0;
    const memoryText = ramGb ? `${ramGb} GB memory` : 'Check the exact memory below';
    const graphicsText = gpuScore <= 5000 ? 'Basic graphics can work' : 'Dedicated gaming graphics needed';
    const processorText = cpuScore <= 5000 ? 'Any modern processor' : 'Modern gaming processor';
    const media = document.getElementById('gameModalMedia');
    if (media) {
        // Vertical layout: natural-ratio <img> fills modal width (no crop / no stretch).
        media.style.backgroundImage = 'none';
        if (imageUrl) {
            media.innerHTML = `<img src="${imageUrl}" alt="${escapeBrowseHtml(game.title)} game image" loading="lazy">`;
        } else {
            media.innerHTML = '<div class="game-modal-media-fallback"><i class="fas fa-gamepad"></i></div>';
        }
    }
    const eyebrow = document.getElementById('gameModalEyebrow');
    if (eyebrow) eyebrow.textContent = genres.join(' • ');
    const titleEl = document.getElementById('gameModalTitle');
    if (titleEl) titleEl.textContent = game.title;
    const badge = document.getElementById('gameModalBadge');
    if (badge) badge.innerHTML = `<span class="req-badge req-${requirement.value}"><i class="fas ${requirement.icon}"></i> ${requirement.label}</span>`;
    const descEl = document.getElementById('gameModalDescription');
    if (descEl) descEl.textContent = description;
    const simple = document.getElementById('gameModalSimple');
    if (simple) {
        simple.innerHTML = `<h4>What you'll need</h4><ul><li><i class="fas fa-memory"></i> ${memoryText}</li><li><i class="fas fa-display"></i> ${graphicsText}</li><li><i class="fas fa-microchip"></i> ${processorText}</li></ul>`;
    }
    const technical = document.getElementById('gameModalTechnical');
    if (technical) {
        technical.innerHTML = `<div class="tech-grid"><div><span>Processor</span><strong>${escapeBrowseHtml(game.cpu_model) || 'Not listed'}</strong></div><div><span>Graphics</span><strong>${escapeBrowseHtml(game.gpu_model) || 'Not listed'}</strong></div><div><span>Memory</span><strong>${escapeBrowseHtml(game.ram_model) || 'Not listed'}</strong></div></div>`;
    }
    const cta = document.getElementById('gameModalCta');
    if (cta) cta.onclick = () => selectGame(game.title_raw);
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
}

function closeGameDetailsModal() {
    const modal = document.getElementById('gameDetailsModal');
    if (!modal) return;
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
}

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeGameDetailsModal();
});
document.addEventListener('click', (event) => {
    const modal = document.getElementById('gameDetailsModal');
    if (modal && event.target === modal) closeGameDetailsModal();
});

function loadGameGrid() {
    const grid = document.getElementById('gameGrid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    const knownReleaseYears = {
        'alan_wake_2': 2023,
        'apex_legends': 2019,
        'assassins_creed': 2007,
        'assasins_creed': 2007,
        'baldurs_gate_3': 2023,
        'black_myth_wukong': 2024,
        'cs_go': 2012,
        'csgo': 2012,
        'cyberpunk_2077': 2020,
        'destiny_2': 2017,
        'elden_ring': 2022,
        'fortnite': 2017,
        'gta_v': 2013,
        'genshin_impact': 2020,
        'god_of_war': 2018,
        'helldivers_2': 2024,
        'hogwarts_legacy': 2023,
        'horizon_zero_dawn': 2017,
        'league_of_legends': 2009,
        'lies_of_p': 2023,
        'minecraft': 2011,
        'overwatch': 2016,
        'pubg': 2017,
        'palworld': 2024,
        'rainbow_six_siege': 2015,
        'red_dead_redemption_2': 2018,
        'read_dead_redemption_2': 2018,
        'remnant_2': 2023,
        'rocket_league': 2015,
        'spider_man': 2018,
        'spiderman': 2018,
        'spider_man_remastered': 2022,
        'spiderman_remastered': 2022,
        'the_witcher_3': 2015,
        'valorant': 2020,
        'warzone': 2020
    };

    games.forEach(game => {
        const card = document.createElement('div');
        card.className = 'game-card game-card-new';
        card.dataset.title = game.title.toLowerCase();
        card.tabIndex = 0;
        card.setAttribute('role', 'article');
        
        const rawKey = (game.title_raw || game.title || '').toLowerCase().replace(/[^a-z0-9_]/g, '');
        // Prefer the real release year from the database so games added by an
        // admin land in the correct "Released" filter bucket. The legacy lookup
        // table and the 2020 default are kept as fallbacks.
        const storedYear = parseInt(game.release_year, 10)
            || parseInt(String(game.release_date || '').slice(0, 4), 10);
        const releaseYear = storedYear || knownReleaseYears[rawKey] || knownReleaseYears[game.title_raw] || 2020;
        card.dataset.year = releaseYear;
        card.dataset.gpuScore = parseInt(game.gpu_benchmark, 10) || 0;
        card.dataset.cpuScore = parseInt(game.cpu_benchmark, 10) || 0;
        card.dataset.displayTitle = game.title;

        const requirement = getBrowseRequirementInfo(game);
        const genreTags = getBrowseGenreTags(game);
        card.dataset.requirement = requirement.value;
        card.dataset.genre = getBrowseGenreFilterKeys(game).join(',');

        const imageUrl = getGameImageUrl(game.image);
        const description = (game.description || '').trim();
        card.dataset.description = description;
        card.dataset.displayTitle = game.title;

        const ramGb = parseInt(game.ram_capacity_gb, 10) || 0;
        const memoryText = ramGb ? `${ramGb} GB memory` : 'Check memory below';

        const gpuScoreForText = parseInt(game.gpu_benchmark, 10) || 0;
        const graphicsText = gpuScoreForText <= 5000 ? 'Basic graphics can work' : 'Dedicated graphics needed';
        const cpuScoreForText = parseInt(game.cpu_benchmark, 10) || 0;
        const processorText = cpuScoreForText <= 5000 ? 'Any modern processor' : 'Modern gaming processor';

        card.innerHTML = `
            <div class="game-image" ${imageUrl ? `style="background-image: url('${imageUrl}')"` : ''}>
                ${!imageUrl ? '<i class="fas fa-gamepad"></i>' : ''}
                <span class="req-badge req-${requirement.value}"><i class="fas ${requirement.icon}"></i> ${requirement.label}</span>
            </div>
            <div class="game-body">
                <div class="game-name">${game.title}</div>
                <div class="game-tags">${genreTags.join(' • ')}</div>
                <p class="game-needs-title">What you'll need</p>
                <ul class="game-needs">
                    <li><i class="fas fa-memory"></i> ${memoryText}</li>
                    <li><i class="fas fa-display"></i> ${graphicsText}</li>
                    <li><i class="fas fa-microchip"></i> ${processorText}</li>
                </ul>
                <div class="game-actions">
                    <button type="button" class="game-btn-secondary" data-action="details">View Details</button>
                    <button type="button" class="game-btn-primary" data-action="check">Can I Run This?</button>
                </div>
            </div>
        `;

        card.querySelector('[data-action="details"]').addEventListener('click', (event) => {
            event.stopPropagation();
            openGameDetailsModal(game.title_raw);
        });
        card.querySelector('[data-action="check"]').addEventListener('click', (event) => {
            event.stopPropagation();
            selectGame(game.title_raw);
        });
        card.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') openGameDetailsModal(game.title_raw);
        });

        grid.appendChild(card);
    });

    filterGames();
}

function toggleMoreFilters() {
    const panel = document.getElementById('moreFiltersPanel');
    const btn = document.getElementById('moreFiltersBtn');
    if (!panel || !btn) return;

    const isHidden = panel.style.display === 'none' || panel.style.display === '';
    if (isHidden) {
        panel.style.display = 'block';
        panel.setAttribute('aria-hidden', 'false');
        btn.classList.add('active');
        btn.setAttribute('aria-expanded', 'true');
    } else {
        panel.style.display = 'none';
        panel.setAttribute('aria-hidden', 'true');
        btn.classList.remove('active');
        btn.setAttribute('aria-expanded', 'false');
    }
}

function clearGameSearch() {
    const searchInput = document.getElementById('gameSearch');
    const genreFilter = document.getElementById('genreFilter');
    const genreFilterSearch = document.getElementById('genreFilterSearch');
    const platformFilter = document.getElementById('platformFilter');
    const platformFilterSearch = document.getElementById('platformFilterSearch');
    const yearFilter = document.getElementById('yearFilter');
    const yearFilterSearch = document.getElementById('yearFilterSearch');
    const requirementFilter = document.getElementById('requirementFilter');
    const requirementFilterSearch = document.getElementById('requirementFilterSearch');
    const sortOrder = document.getElementById('sortOrder');
    const sortOrderSearch = document.getElementById('sortOrderSearch');
    const noGameMessage = document.getElementById('noGameMessage');

    if (searchInput) searchInput.value = '';
    // Reset each converted filter through its dropdown API when available, so
    // the visible label falls back to the "All …/Any …" default exactly like
    // the native select it replaced (instead of leaving an empty box).
    const resetFilter = (type, hiddenEl, searchEl, fallbackLabel) => {
        if (hiddenEl) hiddenEl.value = '';
        if (searchDropdownApis[type]) {
            searchDropdownApis[type].setValue('');
        } else if (searchEl) {
            searchEl.value = fallbackLabel;
        }
    };
    resetFilter('genreFilter', genreFilter, genreFilterSearch, 'All Genres');
    resetFilter('platformFilter', platformFilter, platformFilterSearch, 'All computers');
    resetFilter('yearFilter', yearFilter, yearFilterSearch, 'Any year');
    resetFilter('requirementFilter', requirementFilter, requirementFilterSearch, 'All levels');
    // Sorting falls back to the default option rather than an empty box, so the
    // visible label always matches the stored value.
    if (sortOrder) sortOrder.value = 'newest';
    if (searchDropdownApis.sortOrder) {
        searchDropdownApis.sortOrder.setValue('newest');
    } else if (sortOrderSearch) {
        sortOrderSearch.value = 'Newest → Oldest';
    }
    if (noGameMessage) noGameMessage.style.display = 'none';

    // Also close any open dropdowns
    ['genreFilterDropdown', 'platformFilterDropdown', 'yearFilterDropdown', 'requirementFilterDropdown', 'sortOrderDropdown'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.remove('active');
    });

    filterGames();
}

function filterGames() {
    const searchTerm = document.getElementById('gameSearch')?.value.toLowerCase().trim() || '';
    const genreFilter = document.getElementById('genreFilter')?.value || '';
    const platformFilter = document.getElementById('platformFilter')?.value || '';
    const yearFilter = document.getElementById('yearFilter')?.value || '';
    const requirementFilter = document.getElementById('requirementFilter')?.value || '';
    const sortOrder = document.getElementById('sortOrder')?.value || 'newest';
    const noGameMessage = document.getElementById('noGameMessage');
    const grid = document.getElementById('gameGrid');
    const cards = Array.from(document.querySelectorAll('.game-card'));

    let found = false;

    cards.forEach(card => {
        const title = card.dataset.title || '';
        const desc = (card.dataset.description || '').toLowerCase();
        const year = parseInt(card.dataset.year, 10) || 2020;
        const gpuScore = parseInt(card.dataset.gpuScore, 10) || 0;

        // 1. Search Filter
        const matchesSearch = !searchTerm || title.includes(searchTerm);

        // 2. Genre Filter (matches any genre stored on the card)
        const filterKey = String(genreFilter).toLowerCase();
        const cardGenres = String(card.dataset.genre || '')
            .toLowerCase()
            .split(',')
            .map(value => value.trim())
            .filter(Boolean);
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
        let matchesGenre = true;
        if (filterKey) {
            if (cardGenres.length) {
                // A game may carry several genres, so it must match any of them.
                matchesGenre = cardGenres.includes(filterKey);
            } else {
                matchesGenre = keywords.length === 0 || keywords.some(k => title.includes(k) || desc.includes(k));
            }
        }

        // 3. Platform Filter (PC Windows supported)
        const matchesPlatform = !platformFilter || platformFilter === 'pc';

        // 4. Release Year Filter
        let matchesYear = true;
        if (yearFilter === 'before-2010') {
            matchesYear = year < 2010;
        } else if (yearFilter === '2010-2014') {
            matchesYear = year >= 2010 && year <= 2014;
        } else if (yearFilter === '2015-2019') {
            matchesYear = year >= 2015 && year <= 2019;
        } else if (yearFilter === '2020-2024') {
            matchesYear = year >= 2020 && year <= 2024;
        } else if (yearFilter === '2025-present') {
            matchesYear = year >= 2025;
        }

        // 5. Performance Requirement Filter
        // Uses the same frontend tier as the card badge (peak of CPU/GPU scores).
        let matchesReq = true;
        const cardRequirement = card.dataset.requirement || getBrowseRequirementInfo({ gpu_benchmark: gpuScore, cpu_benchmark: parseInt(card.dataset.cpuScore, 10) || 0 }).value;
        if (requirementFilter) {
            matchesReq = cardRequirement === requirementFilter;
        }

        const isVisible = matchesSearch && matchesGenre && matchesPlatform && matchesYear && matchesReq;
        card.style.display = isVisible ? '' : 'none';

        if (isVisible) found = true;
    });

    const visibleCards = cards.filter(card => card.style.display !== 'none');
    updateBrowseResultCount(visibleCards.length, cards.length);

    // 6. Sorting Logic
    cards.sort((a, b) => {
        const titleA = (a.dataset.displayTitle || a.dataset.title || '').toLowerCase();
        const titleB = (b.dataset.displayTitle || b.dataset.title || '').toLowerCase();
        const yearA = parseInt(a.dataset.year, 10) || 0;
        const yearB = parseInt(b.dataset.year, 10) || 0;

        if (sortOrder === 'oldest') {
            return yearA !== yearB ? yearA - yearB : titleA.localeCompare(titleB);
        } else if (sortOrder === 'az') {
            return titleA.localeCompare(titleB);
        } else if (sortOrder === 'za') {
            return titleB.localeCompare(titleA);
        } else {
            // Default: 'newest'
            return yearA !== yearB ? yearB - yearA : titleA.localeCompare(titleB);
        }
    });

    // Re-append cards in sorted order
    if (grid) {
        cards.forEach(card => grid.appendChild(card));
    }

    const isFiltering = searchTerm !== '' || genreFilter !== '' || platformFilter !== '' || yearFilter !== '' || requirementFilter !== '';
    if (noGameMessage) {
        noGameMessage.style.display = isFiltering && !found ? 'block' : 'none';
    }
}

let feedbackState = [];
let filteredFeedbackState = [];
let currentFeedbackPage = 1;
const FEEDBACK_PAGE_SIZE = 5;
// Relative URLs resolve against the PAGE (FRONT-END/HTML/User Side/*.php),
// not against this script's folder, so the API base must climb three levels
// to reach GameSpec-Optimizer/MODULES/api. Matches the other fetches in this file.
const FEEDBACK_API_BASE = "../../../MODULES/api";

// Performs a request and returns the parsed JSON body (or null) plus the raw
// response, so failures can be reported with real status/server detail.
async function requestFeedbackApi(url, options) {
    const response = await fetch(url, options);
    const raw = await response.text().catch(() => "");
    let result = null;

    // Only parse JSON. Apache error pages must not be dumped into the UI.
    if (raw && /^\s*[\{\[]/.test(raw)) {
        try {
            result = JSON.parse(raw);
        } catch (parseError) {
            result = null;
        }
    }

    return { response, result };
}

// Surfaces the actual HTTP status and any server-provided message so API
// problems (bad path, 404, validation, 500) are visible instead of a
// generic failure string. Server messages only; no credentials involved.
function describeFeedbackFailure(response, result, fallback) {
    const status = `HTTP ${response.status}${response.statusText ? " " + response.statusText : ""}`;

    let serverMessage = "";
    if (result && typeof result.message === "string" && result.message.trim()) {
        serverMessage = result.message.trim();
    } else if (result && typeof result.error === "string" && result.error.trim()) {
        serverMessage = result.error.trim();
    }

    return serverMessage
        ? `${fallback} [${status}: ${serverMessage}]`
        : `${fallback} [${status}]`;
}

function normalizeFeedbackRecord(item) {
    if (!item || typeof item !== "object") return null;
    const feedbackId = Number(item.feedback_id ?? item.review_id ?? item.id ?? 0) || 0;
    const rating = Number(item.rating) || 0;
    const isAnonymous = item.is_anonymous === true || item.is_anonymous === 1 || item.is_anonymous === "1";
    const username = isAnonymous ? "Anonymous" : String(item.username ?? item.display_name ?? "Guest");
    return {
        feedback_id: feedbackId,
        review_id: feedbackId,
        title: String(item.title ?? item.feedback_title ?? item.review_title ?? "Untitled feedback"),
        comment: String(item.comment ?? "No comment provided."),
        rating,
        username,
        is_anonymous: isAnonymous,
        created_at: item.created_at || "",
        database_utc_offset_minutes: Number(item.database_utc_offset_minutes) || 0,
        helpful_count: Number(item.helpful_count || 0),
        reported_count: Number(item.reported_count || 0),
        reported: Boolean(item.reported) || Number(item.reported_count || 0) > 0,
        is_approved: item.is_approved === undefined ? true : Boolean(item.is_approved),
    };
}

function getFeedbackIdentity(item) {
    if (!item || typeof item !== "object") return 0;
    return Number(item.feedback_id ?? item.review_id ?? item.id ?? 0) || 0;
}

function sortFeedbackState(items) {
    return items.slice().sort((a, b) => {
        const ratingDiff = Number(b.rating || 0) - Number(a.rating || 0);
        if (ratingDiff !== 0) return ratingDiff;

        const helpfulDiff = Number(b.helpful_count || 0) - Number(a.helpful_count || 0);
        if (helpfulDiff !== 0) return helpfulDiff;

        const createdA = parseDisplayDate(a.created_at, a.database_utc_offset_minutes)?.getTime() || 0;
        const createdB = parseDisplayDate(b.created_at, b.database_utc_offset_minutes)?.getTime() || 0;
        return createdB - createdA;
    });
}

function parseDisplayDate(value, databaseOffsetMinutes = 0) {
    if (!value) return null;
    const text = String(value);
    if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(text)) {
        const parsed = new Date(text);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    const parts = text.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
    if (!parts) return null;
    return new Date(Date.UTC(
        Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]),
        Number(parts[4]), Number(parts[5]), Number(parts[6] || 0)
    ) - Number(databaseOffsetMinutes || 0) * 60_000);
}

function formatDisplayDateTime(value, databaseOffsetMinutes = 0) {
    const date = parseDisplayDate(value, databaseOffsetMinutes);
    return date ? new Intl.DateTimeFormat('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit', hour12: true
    }).format(date) : 'Recently added';
}

feedbackState = sortFeedbackState(feedbackState);
filteredFeedbackState = feedbackState.map((item, index) => ({ item, index }));

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function buildFeedbackCardHtml(item, index = 0, { showDelete = false } = {}) {
    const feedbackId = getFeedbackIdentity(item);
    // Card actions resolve the real database row through feedback_id when
    // available, and fall back to the list index for legacy local entries.
    const actionKey = feedbackId > 0 ? feedbackId : index;
    const title = escapeHtml(item.title || "Untitled feedback");
    const comment = escapeHtml(item.comment || "No comment provided.");
    const rating = Number(item.rating) || 0;
    const username = item.is_anonymous ? "Anonymous" : escapeHtml(item.username || "Guest");
    const createdAt = formatDisplayDateTime(item.created_at, item.database_utc_offset_minutes);
    const stars = "★".repeat(rating) + "☆".repeat(5 - rating);
    const helpfulCount = Number(item.helpful_count || 0);
    const hasVotedHelpful = hasHelpfulVote(feedbackId);
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
                <span class="feedback-rating-badge" aria-label="Rated ${rating} out of 5 stars"><span class="feedback-rating-stars" aria-hidden="true">${stars}</span><span class="feedback-rating-value">${rating.toFixed(1)}</span></span>
            </div>
            <p class="feedback-comment">${comment}</p>
            <div class="feedback-card-footer">
                <span class="feedback-helpful-count">Helpful <strong>${helpfulCount}</strong></span>
                <div class="feedback-actions">
                    <button type="button" class="feedback-action-btn feedback-helpful-btn" onclick="markFeedbackHelpful(${actionKey})" ${hasVotedHelpful ? "disabled" : ""} aria-label="${hasVotedHelpful ? "You've already marked this feedback as helpful." : "Mark feedback as helpful"}">
                        <i class="fas fa-thumbs-up"></i> Helpful${hasVotedHelpful ? " ✓" : ""}
                    </button>
                    <button type="button" class="feedback-action-btn feedback-report-btn" onclick="reportFeedbackItem(${actionKey})" ${isReported ? "disabled" : ""}>
                        <i class="fas fa-flag"></i> ${isReported ? "Reported" : "Report"}
                    </button>
                    ${showDelete ? `<button type="button" class="feedback-action-btn feedback-delete-btn" onclick="deleteFeedbackItem(${actionKey})"><i class="fas fa-trash-alt"></i> Delete</button>` : ""}
                </div>
            </div>
        </div>
    `;
}

function renderFeedbackCards(feedbacks, container, { limit = null, showDelete = false, offset = 0 } = {}) {
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

    container.innerHTML = visibleItems.map((entry, idx) => {
        const item = entry?.item ?? entry;
        const itemIndex = typeof entry?.index === 'number' ? entry.index : offset + idx;
        return buildFeedbackCardHtml(item, itemIndex, { showDelete });
    }).join("");
}

function renderFeedbackPagination(totalItems) {
    const paginationContainer = document.getElementById("feedbackPagination");
    if (!paginationContainer) return;

    const totalPages = Math.max(1, Math.ceil(totalItems / FEEDBACK_PAGE_SIZE));
    currentFeedbackPage = Math.min(currentFeedbackPage, totalPages);

    if (totalPages <= 1) {
        paginationContainer.innerHTML = "";
        return;
    }

    let html = `<button class="pagination-btn" type="button" onclick="changeFeedbackPage(${currentFeedbackPage - 1})" ${currentFeedbackPage === 1 ? "disabled" : ""}>Prev</button>`;

    for (let page = 1; page <= totalPages; page += 1) {
        html += `<button class="pagination-btn ${page === currentFeedbackPage ? "active" : ""}" type="button" onclick="changeFeedbackPage(${page})">${page}</button>`;
    }

    html += `<button class="pagination-btn" type="button" onclick="changeFeedbackPage(${currentFeedbackPage + 1})" ${currentFeedbackPage === totalPages ? "disabled" : ""}>Next</button>`;

    paginationContainer.innerHTML = html;
}

function changeFeedbackPage(page) {
    const totalItems = filteredFeedbackState.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / FEEDBACK_PAGE_SIZE));
    if (page < 1 || page > totalPages) return;

    currentFeedbackPage = page;
    const listContainer = document.getElementById("feedbackList");
    if (listContainer) {
        renderFeedbackPage(listContainer, filteredFeedbackState);
    }
}

function renderFeedbackPage(container, feedbacks, { showDelete = false } = {}) {
    const totalItems = Array.isArray(feedbacks) ? feedbacks.length : 0;
    const totalPages = Math.max(1, Math.ceil(totalItems / FEEDBACK_PAGE_SIZE));
    currentFeedbackPage = Math.min(currentFeedbackPage, totalPages);

    const start = (currentFeedbackPage - 1) * FEEDBACK_PAGE_SIZE;
    const pagedItems = Array.isArray(feedbacks) ? feedbacks.slice(start, start + FEEDBACK_PAGE_SIZE) : [];

    renderFeedbackCards(pagedItems, container, { showDelete, offset: start });
    renderFeedbackPagination(totalItems);
}

function findFeedbackIndex(key) {
    const numericKey = Number(key);
    if (!Number.isFinite(numericKey)) return -1;
    // Prefer matching the MySQL feedback_id; fall back to the list index
    // so older local entries still respond to their card buttons.
    const byId = feedbackState.findIndex(item => getFeedbackIdentity(item) === numericKey && numericKey > 0);
    if (byId >= 0) return byId;
    if (Number.isInteger(numericKey) && numericKey >= 0 && numericKey < feedbackState.length) return numericKey;
    return -1;
}

async function postFeedbackAction(endpoint, feedbackId, reportReason) {
    const body = { feedback_id: feedbackId };
    if (endpoint === "helpful-feedback.php") body.voter_token = getHelpfulVoterToken();
    // report-feedback.php requires a reason; other endpoints ignore it.
    if (reportReason) body.report_reason = reportReason;

    const { response, result } = await requestFeedbackApi(`${FEEDBACK_API_BASE}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });

    if (!response.ok || !result || result.success === false) {
        throw new Error(describeFeedbackFailure(response, result, "Request failed."));
    }
    return result;
}

async function deleteFeedbackItem(key) {
    const index = findFeedbackIndex(key);
    if (index < 0) return;

    const feedbackId = getFeedbackIdentity(feedbackState[index]);
    if (feedbackId <= 0) return;

    if (!confirm("Delete this community feedback permanently?")) return;

    try {
        // MySQL is the source of truth: remove the row, then reload.
        await postFeedbackAction("delete-feedback.php", feedbackId);
    } catch (error) {
        console.warn("Unable to delete feedback.", error);
        alert(error.message || "Feedback could not be deleted. Please try again.");
        return;
    }

    await loadFeedbackData();
    filterFeedback();
    updateFeedbackSummary(feedbackState);

    if (typeof loadFeedbackPreview === "function") {
        loadFeedbackPreview();
    }
}

async function markFeedbackHelpful(key) {
    const index = findFeedbackIndex(key);
    if (index < 0) return;

    const feedbackId = getFeedbackIdentity(feedbackState[index]);
    if (feedbackId <= 0) return;
    if (hasHelpfulVote(feedbackId)) return;

    try {
        const result = await postFeedbackAction("helpful-feedback.php", feedbackId);
        feedbackState[index].helpful_count = Number(result.helpful_count ?? feedbackState[index].helpful_count ?? 0) + 0;
        localStorage.setItem(`gamespec.helpful-voted.${feedbackId}`, "1");
    } catch (error) {
        console.warn("Unable to mark feedback as helpful.", error);
        showModal('Notice', error.message || "Unable to mark feedback as helpful.");
        return;
    }
    filterFeedback();

    if (typeof loadFeedbackPreview === "function") {
        loadFeedbackPreview();
    }
}

// ---------------------------------------------------------------------------
// REPORT REASON MODAL
//
// A report is only sent after the user picks (or types) a reason, so the admin
// can judge whether the feedback should be removed.
// ---------------------------------------------------------------------------

const REPORT_REASONS = [
    "Offensive or abusive",
    "Spam",
    "Irrelevant",
    "Inappropriate content",
    "Other"
];

let pendingReportFeedbackId = 0;

function ensureReportReasonModal() {
    let overlay = document.getElementById("reportReasonModalOverlay");
    if (overlay) return overlay;

    overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.id = "reportReasonModalOverlay";
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = `
        <div class="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="reportReasonTitle">
            <div class="modal-header">
                <h2 id="reportReasonTitle">Why are you reporting this feedback?</h2>
                <button class="modal-close" type="button" onclick="closeReportReasonModal()" aria-label="Close report dialog">&times;</button>
            </div>
            <form class="modal-body report-reason-form" id="reportReasonForm" onsubmit="submitReportReason(event)">
                <p class="report-reason-intro">Your reason helps the admin decide whether this feedback should be removed.</p>
                <div class="report-reason-options" role="radiogroup" aria-label="Report reason">
                    ${REPORT_REASONS.map((reason, index) => `
                        <label class="report-reason-option">
                            <input type="radio" name="reportReasonChoice" value="${escapeHtml(reason)}" ${index === 0 ? "required" : ""}>
                            <span>${escapeHtml(reason)}</span>
                        </label>
                    `).join("")}
                </div>
                <label for="reportReasonOther">Or describe the problem in your own words:</label>
                <textarea id="reportReasonOther" maxlength="255" placeholder="Tell us what was wrong with this feedback..."></textarea>
                <p class="report-reason-error" id="reportReasonError" role="alert"></p>
                <div class="modal-footer">
                    <button class="modal-btn modal-btn-secondary" type="button" onclick="closeReportReasonModal()">Cancel</button>
                    <button class="modal-btn modal-btn-primary" type="submit">Submit Report</button>
                </div>
            </form>
        </div>
    `;

    document.body.appendChild(overlay);
    return overlay;
}

function openReportReasonModal(feedbackId) {
    pendingReportFeedbackId = Number(feedbackId) || 0;
    if (pendingReportFeedbackId <= 0) return;

    const overlay = ensureReportReasonModal();
    const errorEl = document.getElementById("reportReasonError");
    if (errorEl) errorEl.textContent = "";
    const textarea = document.getElementById("reportReasonOther");
    if (textarea) textarea.value = "";

    overlay.classList.add("active");
    overlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
}

function closeReportReasonModal() {
    const overlay = document.getElementById("reportReasonModalOverlay");
    if (overlay) {
        overlay.classList.remove("active");
        overlay.setAttribute("aria-hidden", "true");
    }
    document.body.classList.remove("modal-open");
    pendingReportFeedbackId = 0;
}

function submitReportReason(event) {
    event.preventDefault();

    const feedbackId = pendingReportFeedbackId;
    if (!feedbackId) {
        closeReportReasonModal();
        return;
    }

    const chosen = document.querySelector('input[name="reportReasonChoice"]:checked');
    const custom = document.getElementById("reportReasonOther")?.value.trim() || "";
    let reason = custom || (chosen ? chosen.value : "");

    if (!reason) {
        const errorEl = document.getElementById("reportReasonError");
        if (errorEl) errorEl.textContent = "Please choose or enter a reason before submitting the report.";
        return;
    }

    if (reason.length > 255) {
        const errorEl = document.getElementById("reportReasonError");
        if (errorEl) errorEl.textContent = "Please keep the reason under 255 characters.";
        return;
    }

    closeReportReasonModal();
    submitFeedbackReport(feedbackId, reason);
}

async function reportFeedbackItem(key) {
    const index = findFeedbackIndex(key);
    if (index < 0) return;

    const feedbackId = getFeedbackIdentity(feedbackState[index]);
    if (feedbackId <= 0) return;

    // Ask for a reason first; nothing is sent until one is provided.
    openReportReasonModal(feedbackId);
}

async function submitFeedbackReport(feedbackId, reason) {
    const index = feedbackState.findIndex(item => getFeedbackIdentity(item) === Number(feedbackId));
    if (index < 0) return;

    try {
        const result = await postFeedbackAction("report-feedback.php", feedbackId, reason);
        feedbackState[index].reported = true;
        feedbackState[index].reported_count = Number(result.reported_count ?? feedbackState[index].reported_count ?? 1);
    } catch (error) {
        console.warn("Unable to report feedback.", error);
        showModal('Error', error.message || "Feedback could not be reported. Please try again.");
        return;
    }
    filterFeedback();

    if (typeof loadFeedbackPreview === "function") {
        loadFeedbackPreview();
    }
}

function openFeedbackModal() {
    const overlay = document.getElementById("feedbackModalOverlay");
    if (overlay) {
        overlay.classList.add("active");
    }
    // Lock background page scroll while the modal is open. The page keeps
    // its scroll position and scrolling is restored on close.
    document.body.classList.add("modal-open");
}

function closeFeedbackModal() {
    const overlay = document.getElementById("feedbackModalOverlay");
    if (overlay) {
        overlay.classList.remove("active");
    }
    document.body.classList.remove("modal-open");
}

async function handleFeedbackSubmit(event) {
    event.preventDefault();

    const form = document.getElementById("feedbackForm");
    if (!form) return;

    const submitButton = form.querySelector('[type="submit"]');
    if (submitButton) submitButton.disabled = true;

    const formData = new FormData(form);
    const title = String(formData.get("title") || "").trim();
    const comment = String(formData.get("comment") || "").trim();
    const rating = Number(formData.get("rating") || 0);
    const username = String(formData.get("username") || "").trim();

    if (!title || !comment || !(rating >= 1 && rating <= 5)) {
        if (submitButton) submitButton.disabled = false;
        alert("Please add a title, comment, and a rating from 1 to 5 stars.");
        return;
    }

    try {
        // Keep this payload identical for the database save and email notice.
        const feedbackPayload = { title, comment, rating, username };

        // Keep the existing database-backed community feedback behavior.
        const { response: saveResponse, result: saveResult } = await requestFeedbackApi(`${FEEDBACK_API_BASE}/submit-feedback.php`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(feedbackPayload),
        });

        if (!saveResponse.ok || !saveResult || saveResult.success !== true) {
            throw new Error(describeFeedbackFailure(saveResponse, saveResult, "Feedback could not be submitted."));
        }

        // Email delivery is an additional notification. If Brevo is temporarily
        // unavailable, the already-saved feedback must not be resubmitted.
        let emailDeliveryFailed = false;
        try {
            const { response: emailResponse, result: emailResult } = await requestFeedbackApi(`${FEEDBACK_API_BASE}/send-feedback-email.php`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(feedbackPayload),
            });
            emailDeliveryFailed = !emailResponse.ok || !emailResult || emailResult.success !== true;
        } catch (emailError) {
            emailDeliveryFailed = true;
            console.warn("Feedback was saved, but its email notification could not be sent.", emailError);
        }

        // MySQL is the source of truth: reload the list from the server.
        await loadFeedbackData();
        filterFeedback();
        updateFeedbackSummary(feedbackState);

        if (typeof loadFeedbackPreview === "function") {
            loadFeedbackPreview();
        }

        form.reset();
        closeFeedbackModal();
        alert(emailDeliveryFailed
            ? "Your feedback was submitted, but its notification email could not be sent."
            : (saveResult.message || "Thank you! Your feedback has been submitted."));
    } catch (error) {
        console.warn("Unable to submit feedback.", error);
        alert(error.message || "Feedback could not be submitted. Please try again.");
    } finally {
        if (submitButton) submitButton.disabled = false;
    }
}

function updateFeedbackSummary(feedbacks) {
    const averageRatingEl = document.getElementById("averageRating");
    const averageStarsEl = document.getElementById("averageStars");
    const totalReviewsEl = document.getElementById("totalReviews");

    const items = Array.isArray(feedbacks) ? feedbacks : [];

    if (!items.length) {
        if (averageRatingEl) averageRatingEl.textContent = "0.0 / 5";
        if (averageStarsEl) averageStarsEl.textContent = "☆☆☆☆☆";
        if (totalReviewsEl) totalReviewsEl.textContent = "No reviews yet";
        return;
    }

    const average = (items.reduce((sum, item) => sum + (Number(item.rating) || 0), 0) / items.length).toFixed(1);
    const fullStars = Math.round(Number(average));

    if (averageRatingEl) averageRatingEl.textContent = `${average} / 5`;
    if (averageStarsEl) averageStarsEl.textContent = "★".repeat(fullStars) + "☆".repeat(5 - fullStars);
    if (totalReviewsEl) totalReviewsEl.textContent = `Based on ${items.length} community review${items.length === 1 ? "" : "s"}`;
}

async function loadFeedbackData() {
    const { response, result } = await requestFeedbackApi(`${FEEDBACK_API_BASE}/get-latest-feedback.php`);

    if (!response.ok || !Array.isArray(result)) {
        throw new Error(describeFeedbackFailure(response, result, "Feedback request failed"));
    }

    // MySQL is the source of truth. Never merge localStorage or samples here.
    feedbackState = result
        .map(normalizeFeedbackRecord)
        .filter(item => item !== null && item.is_approved !== false);
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

    const sortedFeedback = sortFeedbackState(feedbackState);

    filteredFeedbackState = sortedFeedback
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => {
            const title = String(item.title || "").toLowerCase();
            const comment = String(item.comment || "").toLowerCase();
            const username = String(item.username || "").toLowerCase();
            const createdAt = formatDisplayDateTime(item.created_at, item.database_utc_offset_minutes).toLowerCase();
            const rating = String(item.rating || "");

            const matchesSearch =
                title.includes(searchTerm) ||
                comment.includes(searchTerm) ||
                username.includes(searchTerm) ||
                createdAt.includes(searchTerm);

            const matchesRating =
                ratingFilter === "" ||
                rating === ratingFilter;

            return matchesSearch && matchesRating;
        });

    currentFeedbackPage = 1;
    const listContainer = document.getElementById("feedbackList");
    if (listContainer) {
        renderFeedbackPage(listContainer, filteredFeedbackState);
    }
}

async function loadFeedbackPage() {
    // Initialize the rating filter searchable dropdown
    initSearchDropdown('ratingFilter', [
        { label: 'All Ratings', value: '' },
        { label: '★★★★★ (5 Stars)', value: '5' },
        { label: '★★★★☆ (4 Stars)', value: '4' },
        { label: '★★★☆☆ (3 Stars)', value: '3' },
        { label: '★★☆☆☆ (2 Stars)', value: '2' },
        { label: '★☆☆☆☆ (1 Star)', value: '1' }
    ], item => item.label, item => item.value, filterFeedback);

    const listContainer = document.getElementById("feedbackList");

    if (listContainer) {
        listContainer.innerHTML = `
            <div class="results-placeholder">
                <div class="placeholder-icon"><i class="fas fa-comment-dots"></i></div>
                <p>Loading community feedback...</p>
            </div>
        `;
    }

    try {
        const feedbacks = await loadFeedbackData();

        updateFeedbackSummary(feedbacks);
        filterFeedback();
    } catch (error) {
        console.warn("Unable to load community feedback.", error);
        feedbackState = [];
        updateFeedbackSummary(feedbackState);
        if (listContainer) {
            listContainer.innerHTML = `
                <div class="results-placeholder">
                    <div class="placeholder-icon"><i class="fas fa-comment-dots"></i></div>
                    <p>Unable to load community feedback. Please try again.</p>
                </div>
            `;
        }
    }
}

function selectGame(title) {
    // Navigate to FPS prediction with selected game
    window.location.href = `fps-prediction.php?game=${encodeURIComponent(title)}`;
}

let isDetectingHardware = false;

function showHardwareDetectionLoading() {
    let overlay = document.getElementById('hardwareDetectionLoadingOverlay');

    if (!overlay) {
        const html = `
            <div id="hardwareDetectionLoadingOverlay" class="prediction-loading-overlay hardware-detection-overlay">
                <div class="prediction-loading-card hardware-detection-loading-card" role="status" aria-live="polite">
                    <div class="prediction-spinner hardware-detection-spinner" aria-hidden="true"></div>
                    <h3>Detecting hardware</h3>
                    <p id="hardwareDetectionLoadingStatus">Preparing benchmark data...</p>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);
        overlay = document.getElementById('hardwareDetectionLoadingOverlay');
    }

    overlay.classList.add('active');
    document.body.classList.add('hardware-detection-in-progress');

    const button = document.querySelector('.detect-hardware-btn');
    if (button) {
        button.disabled = true;
        button.dataset.originalText = button.textContent;
        button.textContent = 'Detecting...';
    }
}

function hideHardwareDetectionLoading() {
    const overlay = document.getElementById('hardwareDetectionLoadingOverlay');
    if (overlay) {
        overlay.classList.remove('active');
    }

    document.body.classList.remove('hardware-detection-in-progress');

    const button = document.querySelector('.detect-hardware-btn');
    if (button) {
        button.disabled = false;
        button.textContent = button.dataset.originalText || 'Detect My Hardware';
    }
}

function normalizeHardwareText(value) {
    return String(value || '')
        .toLowerCase()
        // Remove trademark markers while retaining meaningful qualifiers such
        // as (Laptop), (Mobile), and (Max-Q).
        .replace(/\((?:r|tm)\)/g, ' ')
        .replace(/\b(?:11th|12th|13th|14th|15th)\s*gen\b/g, '')
        .replace(/\b(?:processor|cpu|gpu|graphics|card|video|adapter|nvidia|amd|intel|geforce|radeon|quadro|tesla|rtx|gtx|rx|arc)\b/g, ' ')
        .replace(/\b(?:angle|direct3d(?:1[01])?|d3d(?:1[01])?|opengl|opengles|vs_\d+_\d+|ps_\d+_\d+)\b/g, ' ')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function getGpuBrandFamily(value) {
    const text = String(value || '').toLowerCase();
    if (/\b(?:nvidia|geforce|quadro|tesla)\b/.test(text)) return 'nvidia';
    if (/\b(?:amd|radeon)\b/.test(text)) return 'amd';
    if (/\b(?:intel|iris|uhd|arc)\b/.test(text)) return 'intel';
    return null;
}

function getGpuModelIdentifiers(normalized) {
    return normalized.split(/\s+/).filter(token =>
        token.length >= 3 && /\d/.test(token) && !/^0x[\da-f]+$/i.test(token)
    );
}

function getGpuVariantSignature(normalized) {
    const tokens = new Set(normalized.split(/\s+/));
    const variants = [];
    ['laptop', 'mobile', 'ti', 'super', 'xt', 'xtx', 'max', 'pro', 'workstation'].forEach(token => {
        if (tokens.has(token)) variants.push(token);
    });
    if (tokens.has('max') && tokens.has('q')) {
        variants.splice(variants.indexOf('max'), 1, 'max-q');
    }
    return variants.sort().join('|');
}

function analyzeGpuHardwareMatch(items, detectedModel) {
    const normalizedTarget = normalizeHardwareText(detectedModel);
    const targetIdentifiers = getGpuModelIdentifiers(normalizedTarget);
    const targetBrand = getGpuBrandFamily(detectedModel);
    const targetVariant = getGpuVariantSignature(normalizedTarget);

    const result = {
        normalized: normalizedTarget,
        model_identifiers: targetIdentifiers,
        reason: 'insufficient_model_detail',
        match: null,
        catalogue_candidates: []
    };
    if (!Array.isArray(items) || !normalizedTarget) return result;

    const catalogue = items.map(item => {
        const normalizedModel = normalizeHardwareText(item.model);
        return {
            item,
            normalized: normalizedModel,
            identifiers: getGpuModelIdentifiers(normalizedModel),
            brand: getGpuBrandFamily(item.model),
            variant: getGpuVariantSignature(normalizedModel)
        };
    });

    // Text-only devices such as Iris Xe can be identified only by their exact
    // normalized name. Do not use a family-token score for a fuzzy guess.
    if (!targetIdentifiers.length) {
        const exact = catalogue.filter(candidate => candidate.normalized === normalizedTarget);
        if (exact.length === 1) {
            result.reason = 'exact_normalized_model';
            result.match = exact[0].item;
        } else if (exact.length > 1) {
            result.reason = 'duplicate_catalogue_identity';
        }
        return result;
    }

    let identified = catalogue.filter(candidate =>
        candidate.identifiers.length === targetIdentifiers.length &&
        targetIdentifiers.every(identifier => candidate.identifiers.includes(identifier))
    );
    if (targetBrand) {
        identified = identified.filter(candidate => !candidate.brand || candidate.brand === targetBrand);
    }
    if (!identified.length) {
        const overlaps = catalogue.filter(candidate =>
            candidate.identifiers.some(identifier => targetIdentifiers.includes(identifier))
        );
        result.catalogue_candidates = overlaps.map(candidate => ({
            model: candidate.item.model,
            identifiers: candidate.identifiers,
            variant: candidate.variant,
            rejected: 'model_identifiers_conflict_or_are_incomplete'
        }));
        result.reason = overlaps.length ? 'model_identifiers_conflict_or_are_incomplete' : 'model_identifier_not_in_catalogue';
        return result;
    }

    result.catalogue_candidates = identified.map(candidate => ({
        model: candidate.item.model,
        identifiers: candidate.identifiers,
        variant: candidate.variant,
        rejected: null
    }));

    if (targetVariant) {
        identified = identified.filter(candidate => candidate.variant === targetVariant);
        if (!identified.length) {
            result.reason = 'variant_not_in_catalogue';
            result.catalogue_candidates = catalogue
                .filter(candidate => candidate.identifiers.length === targetIdentifiers.length &&
                    targetIdentifiers.every(identifier => candidate.identifiers.includes(identifier)))
                .map(candidate => ({
                    model: candidate.item.model,
                    identifiers: candidate.identifiers,
                    variant: candidate.variant,
                    rejected: 'variant_does_not_match'
                }));
            return result;
        }
    } else if (identified.some(candidate => candidate.variant)) {
        // If the renderer omits a mobile/desktop or performance variant, do
        // not silently choose one of the catalogue variants.
        result.reason = 'variant_not_exposed_by_browser';
        return result;
    }

    const normalizedModels = [...new Set(identified.map(candidate => candidate.normalized))];
    if (normalizedModels.length !== 1 || identified.length !== 1) {
        result.reason = 'ambiguous_catalogue_identity';
        return result;
    }

    result.reason = 'unique_model_identifier_and_variant';
    result.match = identified[0].item;
    return result;
}

function getHelpfulVoterToken() {
    const key = "gamespec.helpful-voter-token.v1";
    try {
        let token = localStorage.getItem(key);
        if (!/^[a-f0-9]{64}$/i.test(token || "")) {
            const bytes = new Uint8Array(32);
            if (window.crypto?.getRandomValues) window.crypto.getRandomValues(bytes);
            else for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
            token = Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
            localStorage.setItem(key, token);
        }
        return token;
    } catch (error) { return ""; }
}

function hasHelpfulVote(feedbackId) {
    if (!feedbackId) return false;
    try { return localStorage.getItem(`gamespec.helpful-voted.${feedbackId}`) === "1"; }
    catch (error) { return false; }
}

function findBestHardwareMatch(items, detectedModel, diagnostic = null) {
    const analysis = analyzeGpuHardwareMatch(items, detectedModel);
    if (diagnostic && typeof diagnostic === 'object') Object.assign(diagnostic, analysis);
    return analysis.match;
}

function findClosestRamOption(ramGb) {
    // Use capacities returned from the live benchmark table so newly maintained
    // RAM capacities are available to both selection and browser detection.
    const catalogCapacities = [...new Set((Array.isArray(ramBenchmarks) ? ramBenchmarks : [])
        .map(item => Number(item.capacity))
        .filter(value => Number.isFinite(value) && value > 0))];
    const options = catalogCapacities.length ? catalogCapacities : [4, 8, 16, 32, 64];

    if (!options.length || !Number.isFinite(ramGb)) return null;

    return options.reduce((closest, value) => {
        if (closest === null) return value;
        return Math.abs(value - ramGb) < Math.abs(closest - ramGb) ? value : closest;
    }, null);
}

// cpu_benchmarks has no thread-count column, so `threads` is always null and
// interpolating it produced labels like "16C/nullT". Only show a thread count
// when a real one exists, and fall back to the plain model name if neither
// count is usable.
function formatCpuCoreLabel(cpu) {
    if (!cpu) return '';

    const cores = Number(cpu.cores);
    const threads = Number(cpu.threads);
    const parts = [];

    if (Number.isFinite(cores) && cores > 0) parts.push(`${cores}C`);
    if (Number.isFinite(threads) && threads > 0) parts.push(`${threads}T`);

    return parts.length ? `${cpu.model} (${parts.join('/')})` : String(cpu.model);
}

// ============================================================================
// BROWSER-SIDE HARDWARE DETECTION
// ============================================================================
// Detection runs on the visitor's device. Browser APIs can expose limited GPU
// renderer/adapter information and an approximate RAM bucket, but do not expose
// an exact CPU model or a reliable list of every physical GPU.

// Renderer strings are vendor specific, and on Windows they arrive wrapped in
// ANGLE boilerplate, for example:
//   ANGLE (<vendor>, <real gpu model> Direct3D11 vs_5_0 ps_5_0, D3D11-...)
// where only the text inside the parentheses names the card. Split the string
// into ranked candidates and let findBestHardwareMatch() judge them, rather
// than hard-coding one vendor's layout.
function extractGpuRendererCandidates(rendererString) {
    const raw = String(rendererString || '').trim();
    if (!raw) return [];

    const noise = /\b(angle|direct3d(?:1[01])?|d3d(?:1[01])?|opengl|opengles|vs_\d+_\d+|ps_\d+_\d+|microsoft|basic render|software|swiftshader|llvmpipe|mesa)\b/gi;

    const candidates = [];
    const push = value => {
        const cleaned = String(value || '').replace(noise, ' ').replace(/\s+/g, ' ').trim();
        if (cleaned.length >= 4 && !candidates.includes(cleaned)) {
            candidates.push(cleaned);
        }
    };

    // 1. Text inside each (...) - where Windows/ANGLE keeps the real model name.
    (raw.match(/\(([^)]*)\)/g) || []).forEach(group => push(group.slice(1, -1)));

    // 2. Comma separated segments of the full string.
    raw.split(',').forEach(push);

    // 3. The whole string, as a last resort.
    push(raw);

    return candidates;
}

// Reads the GPU name straight from the graphics driver. Returns null when the
// browser refuses to share it - privacy settings, hardened profiles, or a
// blocked WEBGL_debug_renderer_info. Detection is best effort, so that is not
// fatal and must never surface as a hard failure.
function detectGpuRendererString() {
    try {
        const canvas = document.createElement('canvas');
        if (!canvas || typeof canvas.getContext !== 'function') return null;

        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
        if (!gl) return null;

        let renderer = '';

        try {
            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            if (debugInfo) {
                renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '';
            }
        } catch (error) {
            renderer = '';
        }

        if (!renderer) {
            try {
                renderer = gl.getParameter(gl.RENDERER) || '';
            } catch (error) {
                renderer = '';
            }
        }

        // Hand the context back instead of holding one of the browser's few
        // WebGL slots for the rest of the session.
        try {
            const release = gl.getExtension('WEBGL_lose_context');
            if (release && typeof release.loseContext === 'function') release.loseContext();
        } catch (error) {
            // Releasing is best effort only.
        }

        renderer = String(renderer || '').trim();
        return renderer || null;
    } catch (error) {
        return null;
    }
}

async function detectBrowserGpuInfo() {
    let webgpuAvailable = false;
    try {
        webgpuAvailable = Boolean(navigator.gpu && typeof navigator.gpu.requestAdapter === 'function');
    } catch (error) {
        // Treat a blocked or throwing WebGPU getter as unavailable.
    }

    const diagnostics = {
        webgl_renderer: null,
        webgpu_available: webgpuAvailable,
        webgpu_power_preference: 'high-performance',
        webgpu_adapter_info: null,
        match_attempts: [],
        match_status: 'browser_did_not_expose_identifying_gpu_model',
        selected_catalogue_gpu: null
    };
    const signals = [];

    // A high-performance preference asks the browser for its preferred
    // gaming adapter. It is a preference only: browsers may ignore it, hide
    // adapter details, or return the same adapter used by WebGL.
    try {
        if (navigator.gpu && typeof navigator.gpu.requestAdapter === 'function') {
            const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
            if (adapter) {
                let info = adapter.info || null;
                if (!info && typeof adapter.requestAdapterInfo === 'function') {
                    info = await adapter.requestAdapterInfo();
                }
                if (info) {
                    diagnostics.webgpu_adapter_info = {
                        vendor: String(info.vendor || '').trim() || null,
                        architecture: String(info.architecture || '').trim() || null,
                        device: String(info.device || '').trim() || null,
                        description: String(info.description || '').trim() || null
                    };
                    const identifyingText = [
                        diagnostics.webgpu_adapter_info.vendor,
                        diagnostics.webgpu_adapter_info.description
                    ].filter(Boolean).join(' ');
                    if (identifyingText) {
                        signals.push({
                            source: 'WebGPU high-performance preference',
                            value: identifyingText
                        });
                    }
                    // Some implementations provide a model only in device.
                    if (diagnostics.webgpu_adapter_info.device) {
                        signals.push({
                            source: 'WebGPU adapter device field',
                            value: [
                                diagnostics.webgpu_adapter_info.vendor,
                                diagnostics.webgpu_adapter_info.device
                            ].filter(Boolean).join(' ')
                        });
                    }
                }
            }
        }
    } catch (error) {
        diagnostics.webgpu_error = String(error && error.message || error);
        // WebGPU is optional and can be disabled by browser or privacy policy.
    }

    const renderer = detectGpuRendererString();
    diagnostics.webgl_renderer = renderer;
    if (renderer) signals.push({ source: 'WebGL renderer', value: renderer });

    // Evaluate every browser signal. A WebGPU high-performance preference is
    // useful, but it is not proof of which adapter a game will use. If signals
    // resolve to different catalogue rows, keep the user's current choice.
    const matchedRows = new Map();
    for (const signal of signals) {
        const candidates = extractGpuRendererCandidates(signal.value);
        candidates.push(signal.value);
        for (const candidate of candidates) {
            const matchDetails = {};
            const match = findBestHardwareMatch(gpus, candidate, matchDetails);
            diagnostics.match_attempts.push({
                source: signal.source,
                raw_signal: signal.value,
                candidate,
                normalized: matchDetails.normalized,
                model_identifiers: matchDetails.model_identifiers,
                reason: matchDetails.reason,
                catalogue_candidates: matchDetails.catalogue_candidates,
                catalogue_model: match ? match.model : null
            });
            if (match) {
                if (!matchedRows.has(match.model)) matchedRows.set(match.model, { signal, candidate, match });
            }
        }
    }

    if (matchedRows.size === 1) {
        const selected = [...matchedRows.values()][0];
        diagnostics.match_status = 'matched';
        diagnostics.selected_catalogue_gpu = selected.match.model;
        return { ...selected, diagnostics };
    }
    if (matchedRows.size > 1) {
        diagnostics.match_status = 'conflicting_browser_gpu_signals';
        diagnostics.conflicting_catalogue_gpus = [...matchedRows.keys()];
        return { signal: null, candidate: null, match: null, diagnostics };
    }

    const reasons = diagnostics.match_attempts.map(attempt => attempt.reason);
    if (reasons.includes('variant_not_exposed_by_browser') ||
        reasons.includes('ambiguous_catalogue_identity') ||
        reasons.includes('duplicate_catalogue_identity') ||
        reasons.includes('model_identifiers_conflict_or_are_incomplete')) {
        diagnostics.match_status = 'catalogue_match_ambiguous';
    } else if (reasons.includes('model_identifier_not_in_catalogue')) {
        diagnostics.match_status = 'model_not_found_in_catalogue';
    } else if (signals.length) {
        diagnostics.match_status = 'browser_signal_not_specific_enough';
    }

    return { signal: null, candidate: null, match: null, diagnostics };
}

// navigator.deviceMemory is bucketed and capped by browsers. Treat it only as
// an estimate, never as the computer's exact installed RAM.
function detectApproximateRamGb() {
    try {
        const gb = Number(navigator.deviceMemory);
        if (!Number.isFinite(gb) || gb <= 0) return null;
        return gb;
    } catch (error) {
        return null;
    }
}

// Populate helpers. Same behaviour as the previous inline blocks: prefer the
// searchable dropdown API, which keeps the visible label and the stored hidden
// score in sync, and fall back to writing the inputs directly.
function applyCpuSelection(match) {
    if (searchDropdownApis.cpu) {
        searchDropdownApis.cpu.setItem(match || null);
        return;
    }
    const search = document.getElementById('cpuSearch');
    const select = document.getElementById('cpuSelect');
    if (search) search.value = match ? match.model : '';
    if (select) select.value = match ? String(match.score) : '';
}

function applyGpuSelection(match) {
    if (searchDropdownApis.gpu) {
        searchDropdownApis.gpu.setItem(match || null);
        return;
    }
    const search = document.getElementById('gpuSearch');
    const select = document.getElementById('gpuSelect');
    if (search) search.value = match ? match.model : '';
    if (select) select.value = match ? String(match.score) : '';
}

function applyRamSelection(capacityGb) {
    if (searchDropdownApis.ram) {
        searchDropdownApis.ram.setValue(capacityGb === null ? '' : String(capacityGb));
        return;
    }
    const search = document.getElementById('ramSearch');
    const select = document.getElementById('ramSelect');
    if (search && capacityGb === null) search.value = '';
    if (select) select.value = capacityGb === null ? '' : String(capacityGb);
}

function getSelectedHardwareLabel(searchInputId) {
    const input = document.getElementById(searchInputId);
    const value = input ? String(input.value || '').trim() : '';
    return value || null;
}

function showHardwareDetectionSummary(components, title = 'Hardware Detected') {
    showModal(title, '');

    const body = document.getElementById('modalBody');
    if (!body) return;

    const summary = document.createElement('div');
    summary.className = 'hardware-detection-summary';

    components.forEach(({ label: component, result, status }) => {
        const row = document.createElement('section');
        row.className = 'hardware-detection-summary-row';

        const label = document.createElement('span');
        label.className = 'hardware-detection-summary-label';
        label.textContent = component;

        const value = document.createElement('strong');
        value.className = 'hardware-detection-summary-result';
        value.textContent = result;

        const detail = document.createElement('span');
        detail.className = 'hardware-detection-summary-status';
        detail.textContent = status;

        row.append(label, value, detail);
        summary.appendChild(row);
    });

    body.replaceChildren(summary);
}

async function detectHardware() {
    if (isDetectingHardware) return;

    isDetectingHardware = true;
    showHardwareDetectionLoading();

    try {
        await loadFPSPredictionDropdowns();
        detectedHardwareSelection = { cpu: null, gpu: null, ram: null };
        hardwareDetectionUsed = false;
        const loadingStatus = document.getElementById('hardwareDetectionLoadingStatus');
        if (loadingStatus) loadingStatus.textContent = 'Connecting to the local detector...';

        let response;
        try {
            response = await fetch('http://127.0.0.1:43127/v1/hardware-match', {
                method: 'GET',
                mode: 'cors',
                cache: 'no-store'
            });
        } catch (error) {
            throw new Error('Detector unavailable. Start GameSpec Hardware Detector and allow this website to access the local service. You can still select hardware manually.');
        }

        if (loadingStatus) loadingStatus.textContent = 'Reading exact hardware matches...';
        const result = await response.json().catch(() => null);
        if (result?.status === 'catalogue_unavailable') {
            showModal('Benchmark Catalogue Unavailable', 'The detector is running, but it could not load the GameSpec benchmark catalogue. Try again later or select your hardware manually.');
            return;
        }
        if (!response.ok || !result || !['matched', 'no_match'].includes(result.status)) {
            throw new Error('Detector unavailable or returned an invalid response. Start or restart GameSpec Hardware Detector. You can still select hardware manually.');
        }

        const readMatch = (component, name) => {
            if (!component || component.status === 'no_match') return null;
            const score = Number(component.score);
            if (component.status !== 'match' || !String(component.model || '').trim() || !Number.isSafeInteger(score) || score <= 0) {
                throw new Error(`The detector returned invalid ${name} benchmark data. Please select it manually.`);
            }
            return { model: String(component.model).trim(), score };
        };

        const cpuMatch = readMatch(result.cpu, 'CPU');
        const gpuMatch = readMatch(result.gpu, 'GPU');
        const ramMatch = readMatch(result.ram, 'RAM');
        if (gpuMatch) {
            gpuMatch.gpuId = Number(result.gpu.gpuId);
            if (!Number.isSafeInteger(gpuMatch.gpuId) || gpuMatch.gpuId <= 0) {
                throw new Error('The detector did not return a valid GPU catalogue reference. Please select your GPU manually.');
            }
            gpuMatch.gpu_id = gpuMatch.gpuId;
        }
        if (ramMatch) {
            ramMatch.capacityGb = Number(result.ram.capacityGb);
            ramMatch.speedMhz = Number(result.ram.speedMhz);
            if (!Number.isFinite(ramMatch.capacityGb) || ramMatch.capacityGb <= 0
                || !Number.isSafeInteger(ramMatch.speedMhz) || ramMatch.speedMhz <= 0) {
                throw new Error('The detector did not return a valid RAM capacity and speed. Please select RAM manually.');
            }
        }

        const allMatched = Boolean(cpuMatch && gpuMatch && ramMatch);
        if (result.status === 'matched' && !allMatched) {
            throw new Error('The detector reported a match but one or more component results were incomplete. Please select hardware manually.');
        }

        detectedHardwareSelection = { cpu: cpuMatch, gpu: gpuMatch, ram: ramMatch };
        applyCpuSelection(cpuMatch);
        applyGpuSelection(gpuMatch);
        applyRamSelection(ramMatch ? Math.round(ramMatch.capacityGb) : null);
        if (ramMatch) {
            document.getElementById('ramSearch').value = `${ramMatch.capacityGb} GB @ ${ramMatch.speedMhz} MHz`;
        }
        hardwareDetectionUsed = allMatched;

        const componentSummary = (label, match) => ({
            label,
            result: match ? match.model : 'Not found in catalogue',
            status: match ? 'Exact match \u00b7 score ' + match.score : 'Choose this component manually; no score was guessed.'
        });
        showHardwareDetectionSummary(
            [
                componentSummary('CPU', cpuMatch),
                componentSummary('GPU', gpuMatch),
                componentSummary('RAM', ramMatch)
            ],
            allMatched ? 'Hardware Detected' : 'Hardware Match Incomplete'
        );
    } catch (error) {
        console.error('Hardware detection failed:', error);
        showModal('Detector Unavailable', error.message || 'Start GameSpec Hardware Detector or select hardware manually.');
    } finally {
        isDetectingHardware = false;
        hideHardwareDetectionLoading();
    }
}

// --- HARDWARE BENCHMARK FUNCTIONALITY ---
// Current suggestion list for the hardware searchable dropdown. Rebuilt
// whenever the hardware type changes. Uses the same searchable dropdown
// component as the FPS Prediction page, so suggestions render BELOW the
// input, stay attached to it while the page scrolls, and remain above
// surrounding content instead of opening as a native select popup.
let hardwareOptions = [];

async function initHardwareBenchmark() {
    // Pre-load CPU and GPU data
    await Promise.all([loadCPUsFromCSV(), loadGPUsFromCSV()]);

    // Hardware type is now a searchable dropdown (same pattern as game/cpu/gpu/ram)
    initSearchDropdown('hardwareType', [
        { label: 'Select Hardware Type', value: '' },
        { label: 'CPU', value: 'cpu' },
        { label: 'GPU', value: 'gpu' },
        { label: 'RAM', value: 'ram' }
    ], item => item.label, item => item.value, () => {
        // When hardware type is selected, rebuild the hardware list dropdown
        loadHardwareOptions();
    });

    // Hardware options depend on the selected hardware type, so pass a
    // data provider function instead of a static array.
    initSearchDropdown('hardware', () => hardwareOptions, item => item.label, item => item.score);
}

function loadHardwareOptions() {
    // `hardwareTypeSearch` shows the label ("CPU"); the hidden input keeps the
    // real value ("cpu") that decides which suggestion list to build.
    const hardwareTypeSelect = document.getElementById('hardwareTypeSelect');
    const hardwareType = hardwareTypeSelect ? hardwareTypeSelect.value : '';
    const hardwareSelect = document.getElementById('hardwareSelect');
    const hardwareSearch = document.getElementById('hardwareSearch');
    const hardwareDropdown = document.getElementById('hardwareDropdown');

    // Close any open suggestion list when the hardware type changes.
    if (hardwareDropdown) {
        hardwareDropdown.classList.remove('active');
    }

    if (!hardwareType) {
        hardwareOptions = [];
        if (hardwareSelect) hardwareSelect.value = '';
        if (hardwareSearch) {
            hardwareSearch.value = '';
            hardwareSearch.disabled = true;
            hardwareSearch.placeholder = 'First select a hardware type above';
        }
        return;
    }

    if (hardwareSelect) hardwareSelect.value = '';
    if (hardwareSearch) {
        hardwareSearch.value = '';
        hardwareSearch.disabled = false;
    }

    if (hardwareType === 'cpu') {
        if (hardwareSearch) hardwareSearch.placeholder = 'Search CPUs...';
        hardwareOptions = cpus.map(cpu => ({
            label: formatCpuCoreLabel(cpu),
            model: cpu.model,
            score: cpu.score
        }));
    } else if (hardwareType === 'gpu') {
        if (hardwareSearch) hardwareSearch.placeholder = 'Search GPUs...';
        hardwareOptions = gpus.map(gpu => ({
            label: gpu.model,
            model: gpu.model,
            score: gpu.score
        }));
    } else if (hardwareType === 'ram') {
        if (hardwareSearch) hardwareSearch.placeholder = 'Search RAM sizes...';
        hardwareOptions = [
            { size: 4, score: 1000 },
            { size: 8, score: 2000 },
            { size: 16, score: 4000 },
            { size: 32, score: 8000 },
            { size: 64, score: 16000 }
        ].map(ram => ({
            label: `${ram.size} GB DDR4/DDR5`,
            model: `${ram.size} GB`,
            score: ram.score
        }));
    }
}

function getBenchmarkScore() {
    // Read the stored value ("cpu"/"gpu"/"ram") from the hidden input — the
    // visible search box only holds the label.
    const hardwareTypeSelect = document.getElementById('hardwareTypeSelect');
    const hardwareType = hardwareTypeSelect ? hardwareTypeSelect.value : '';
    const hardwareSelect = document.getElementById('hardwareSelect');
    
    if (!hardwareType) {
        return showModal('Warning', 'Please select a hardware type first.');
    }
    
    if (!hardwareSelect.value) {
        return showModal('Warning', 'Please select a hardware model.');
    }
    
    const score = parseInt(hardwareSelect.value);
    const hardwareSearchInput = document.getElementById('hardwareSearch');
    const name = (hardwareSearchInput && hardwareSearchInput.value.trim()) || 'Selected hardware';
    
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

// --- LEGACY SIMPLE HARDWARE SCORING (For demonstration only) #ToRemove  ---
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

const graphicsSettingBudget = [
    { name: 'Bloom', fps: 6, direction: 'up', visual: 'high', description: 'Adds a soft glow around bright lights. It looks more cinematic but uses a little extra performance.' },
    { name: 'Anti-Aliasing', fps: 5, direction: 'up', visual: 'high', description: 'Smooths jagged edges on objects. Higher settings make the image cleaner but can reduce performance.' },
    { name: 'Shadow Quality', fps: 8, direction: 'up', visual: 'high', description: 'Controls how detailed and realistic shadows look. Higher settings can use a lot of performance.' },
    { name: 'Ambient Occlusion', fps: 7, direction: 'up', visual: 'medium', description: 'Adds soft shadows where objects meet, making the world look more three-dimensional. It costs some performance.' },
    { name: 'Texture Quality', fps: 4, direction: 'up', visual: 'medium', description: 'Controls the sharpness of surfaces such as walls and clothing. Higher settings use more video memory and a little more performance.' },
    { name: 'VSync', fps: 2, direction: 'down', visual: 'low', description: 'Matches the game frame rate to your monitor to reduce visible image tearing. Turning it off may improve performance but can cause tearing.' },
    { name: 'Motion Blur', fps: 3, direction: 'down', visual: 'low', description: 'Adds blur during fast camera movement. Turning it off usually makes the image clearer and can improve performance slightly.' }
];

function formatGraphicsSetting(name) {
    const setting = graphicsSettingBudget.find(item => item.name === name);
    if (!setting) return name;

    return `<span class="graphics-setting" title="${setting.description}" tabindex="0">${setting.name}</span>`;
}

function buildGraphicsSuggestions(fpsDelta, currentQuality, compatibilityIssues = []) {
    const suggestions = [];
    Math.round(fpsDelta * 100) / 100;

    if (compatibilityIssues.length > 0) {
        suggestions.push('Your hardware does not meet the game\'s minimum benchmark requirements.');
        compatibilityIssues.forEach(issue => {
            suggestions.push(
                `${issue.type}: ${issue.name} is below the minimum requirement ` +
                `(${issue.userScore.toLocaleString()} vs ${issue.required.toLocaleString()}).`
            );
        });
        suggestions.push('Select lower graphics settings or use hardware that meets the minimum requirements.');
        return suggestions;
    }

    if (fpsDelta >= 15) {
        suggestions.push(`You have enough headroom to raise visuals by about ${fpsDelta} FPS.`);
        suggestions.push(`Enable ${formatGraphicsSetting('Bloom')} and move ${formatGraphicsSetting('Anti-Aliasing')} up to TAA.`);
        suggestions.push(`Increase ${formatGraphicsSetting('Shadow Quality')} and consider ${formatGraphicsSetting('Ambient Occlusion')}.`);

        if (currentQuality === 'low') {
            suggestions.push('Increase Graphics Quality from Low to Medium.');
        } else if (currentQuality === 'medium') {
            suggestions.push('Try High graphics quality if you want a sharper image.');
        }

        const upgradeChoices = graphicsSettingBudget
            .filter(setting => setting.direction === 'up' && setting.fps <= fpsDelta)
            .sort((a, b) => b.fps - a.fps)
            .map(setting => `Raise ${formatGraphicsSetting(setting.name)} (+~${setting.fps} FPS headroom needed)`);

        suggestions.push(...upgradeChoices.slice(0, 3));
    } else if (fpsDelta >= 5) {
        suggestions.push(`You have a small buffer of about ${fpsDelta} FPS.`);
        suggestions.push(`You can safely raise ${formatGraphicsSetting('Anti-Aliasing')} or ${formatGraphicsSetting('Texture Quality')}.`);
        suggestions.push(`If you want more visual clarity, try ${formatGraphicsSetting('Bloom')} or a higher preset.`);

        if (currentQuality === 'low') {
            suggestions.push('Increase Graphics Quality from Low to Medium first.');
        }
    } else if (fpsDelta > 0) {
        suggestions.push(`You are only ${fpsDelta} FPS above the target, so keep settings conservative.`);
        suggestions.push(`Prefer small changes like ${formatGraphicsSetting('Texture Quality')} or ${formatGraphicsSetting('Anti-Aliasing')} only.`);
    } else {
        const deficit = Math.round(Math.abs(fpsDelta) * 100 / 100); 
        suggestions.push(`You are about ${deficit} FPS below the target.`);
        suggestions.push(`Lower ${formatGraphicsSetting('Shadow Quality')} first, then disable ${formatGraphicsSetting('Bloom')} if needed.`);
        suggestions.push(`Reduce ${formatGraphicsSetting('Anti-Aliasing')} or switch to FXAA for a quick gain.`);

        const downgradeChoices = graphicsSettingBudget
            .filter(setting => setting.direction === 'down' && setting.fps <= deficit)
            .sort((a, b) => b.fps - a.fps)
            .map(setting => `Lower or disable ${formatGraphicsSetting(setting.name)} (recover ~${setting.fps} FPS)`);

        suggestions.push(...downgradeChoices.slice(0, 3));

        if (currentQuality === 'high') {
            suggestions.push('If needed, step Graphics Quality down from High to Medium.');
        } else if (currentQuality === 'medium') {
            suggestions.push('If the deficit remains, step Graphics Quality down from Medium to Low.');
        }
    }

    return suggestions;
}

// --- FPS PREDICTION FUNCTIONALITY (ML-backed + Loading Screen while predicting) ---
let isPredictingFPS = false;
let hardwareDetectionUsed = false;
let detectedHardwareSelection = { cpu: null, gpu: null, ram: null };

function clearDetectedHardwareSelection(component) {
    if (!['cpu', 'gpu', 'ram'].includes(component)) return;
    detectedHardwareSelection[component] = null;
    hardwareDetectionUsed = false;
}

function showPredictionLoading() {
    let overlay = document.getElementById('performanceAnalysisLoadingOverlay');

    if (!overlay) {
        const html = `
            <div id="performanceAnalysisLoadingOverlay" class="prediction-loading-overlay">
                <div class="prediction-loading-card">
                    <div class="prediction-spinner performance-analysis-spinner" aria-hidden="true"></div>
                    <h3>Analyzing Performance</h3>
                    <p>Please wait while the ML model evaluates your setup.</p>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);
        overlay = document.getElementById('performanceAnalysisLoadingOverlay');
    }

    overlay.classList.add('active');
    document.body.classList.add('performance-analysis-in-progress');

    const analyzeButton = document.querySelector('button[onclick="predictFPS()"]');
    if (analyzeButton) {
        analyzeButton.disabled = true;
        analyzeButton.dataset.originalText = analyzeButton.textContent;
        analyzeButton.textContent = 'Analyzing...';
    }
}

function hidePredictionLoading() {
    const overlay = document.getElementById('performanceAnalysisLoadingOverlay');
    if (overlay) {
        overlay.classList.remove('active');
    }

    document.body.classList.remove('performance-analysis-in-progress');

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

    const cpuScore = detectedHardwareSelection.cpu?.score ?? document.getElementById("cpuSelect").value;
    const gpuScore = detectedHardwareSelection.gpu?.score ?? document.getElementById("gpuSelect").value;
    const ramSelect = document.getElementById("ramSelect");
    
    if (!cpuScore) return showModal('Warning', 'Please select a CPU.');
    if (!gpuScore) return showModal('Warning', 'Please select a GPU.');
    if (!ramSelect.value) return showModal('Warning', 'Please select RAM.');

    const cpuScoreNum = parseInt(cpuScore, 10);
    const gpuScoreNum = parseInt(gpuScore, 10);
    const ramGB = detectedHardwareSelection.ram
        ? Math.round(detectedHardwareSelection.ram.capacityGb)
        : parseInt(ramSelect.value, 10);
    let ramScoreNum;
    if (detectedHardwareSelection.ram) {
        // The detector matched capacity and speed against one exact catalogue row.
        // Keep its score; do not replace it with the manual capacity-only fallback.
        ramScoreNum = detectedHardwareSelection.ram.score;
    } else {
        if (!ramBenchmarks.length) await loadRAMBenchmarks();
        const ramOptions = ramBenchmarks
            .filter(item => Number(item.capacity) === ramGB)
            .sort((a, b) => Number(a.score) - Number(b.score));
        ramScoreNum = Number(ramOptions[0]?.score);
    }
    if (!Number.isFinite(ramScoreNum)) {
        return showModal('Warning', `No benchmark score is available for ${ramGB} GB RAM.`);
    }

    // --- PREDICTION GUARD -------------------------------------------------
    // Invalid hardware / benchmark values must never reach the prediction
    // process. The server repeats these checks; this stops the request early
    // and gives the user a clear message.
    if (!Number.isFinite(cpuScoreNum) || cpuScoreNum <= 0) {
        return showModal('Warning', 'The selected CPU has no valid benchmark score. Please choose a different CPU.');
    }
    if (!Number.isFinite(gpuScoreNum) || gpuScoreNum <= 0) {
        return showModal('Warning', 'The selected GPU has no valid benchmark score. Please choose a different GPU.');
    }
    if (!Number.isFinite(ramGB) || ramGB <= 0) {
        return showModal('Warning', 'The selected RAM capacity is not valid. Please choose a different RAM option.');
    }
    if (!Number.isFinite(ramScoreNum) || ramScoreNum <= 0) {
        return showModal('Warning', 'The selected RAM has no valid benchmark score. Please choose a different RAM option.');
    }
    // ----------------------------------------------------------------------

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

    // A game's minimum requirement only has a score once the benchmark resolver
    // has matched it. When it never resolved, cpu_benchmark is null, parseInt()
    // turns that into NaN, and JSON.stringify() sends it as null - which the PHP
    // gate rejects as "Missing or invalid field: game_cpu_min". Stop here and
    // explain the real reason instead of sending a value we do not have. No
    // default is invented: the number must come from the database.
    const unresolvedRequirements = [
        ['CPU', selectedGame.cpu_benchmark],
        ['GPU', selectedGame.gpu_benchmark],
        ['RAM', selectedGame.ram_benchmark]
    ].filter(([, value]) => {
        const score = parseInt(value, 10);
        return !Number.isFinite(score) || score <= 0;
    });

    if (unresolvedRequirements.length) {
        return showModal(
            'Benchmark data missing',
            `We do not have a benchmark score for the minimum ${unresolvedRequirements.map(([label]) => label).join(' and ')} requirement of "${selectedGame.title}".\n\n`
            + 'Those scores come from matching the game\'s requirement text against the benchmark tables, and this game has not been matched yet, so there is nothing to compare your hardware against.\n\n'
            + 'Please choose a different game, or resolve this one with:\n'
            + 'php MODULES/resolve-game-benchmarks.php'
        );
    }

    const payload = {
        game_title: selectedGame.title_raw || selectedGame.title || game,
        game_cpu_min: parseInt(selectedGame.cpu_benchmark, 10),
        game_gpu_min: parseInt(selectedGame.gpu_benchmark, 10),
        game_ram_min: parseInt(selectedGame.ram_benchmark, 10),
        cpu_score: cpuScoreNum,
        gpu_score: gpuScoreNum,
        gpu_benchmark_id: detectedHardwareSelection.gpu?.gpuId
            || Number(document.getElementById("gpuSelect").dataset.benchmarkId)
            || null,
        ram_score: ramScoreNum,
        res_width: 1920,
        res_height: 1080,
        graphics_preset: presetMap[quality] || 'Medium',
        shadow_quality: presetMap[quality] || 'Medium',
        texture_quality: presetMap[quality] || 'Medium',
        anti_aliasing: antiAliasMap[quality] || 'Off',
        vsync: 'Off',
        performance_mode: performanceMode,
        cpu_model: cpuName === 'Selected CPU' ? '' : cpuName,
        gpu_model: gpuName === 'Selected GPU' ? '' : gpuName,
        ram_gb: ramGB,
        hardware_input_method: hardwareDetectionUsed ? 'detected' : 'manually entered'
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
            // hardware-specs-input.php reports failures in `message`; prefer it
            // over the generic `error` so the real reason reaches the user.
            return showModal('Error', result.message || result.error || 'ML prediction failed.');
        }

        const estimatedFPS = Number(result.predicted_fps) || 0;
        const targetFPS = 60;
        const fpsDelta = estimatedFPS - targetFPS;
        const cpuOK = cpuScoreNum >= selectedGame.cpu_benchmark;
        const gpuOK = gpuScoreNum >= selectedGame.gpu_benchmark;
        const ramOK = selectedGame.ram_benchmark !== null && ramScoreNum >= selectedGame.ram_benchmark;

        const bottlenecks = [];
        if (!cpuOK) bottlenecks.push({ type: 'CPU', name: cpuName, userScore: cpuScoreNum, required: selectedGame.cpu_benchmark });
        if (!gpuOK) bottlenecks.push({ type: 'GPU', name: gpuName, userScore: gpuScoreNum, required: selectedGame.gpu_benchmark });
        if (!ramOK) bottlenecks.push({ type: 'RAM', name: `${ramGB} GB`, userScore: ramScoreNum, required: selectedGame.ram_benchmark });

        let fpsClass = 'fps-ok';
        if (estimatedFPS >= 75) fpsClass = 'fps-good';
        else if (estimatedFPS < 45) fpsClass = 'fps-bad';

        const performanceSummary = estimatedFPS >= 75
            ? 'Your PC should run this game smoothly.'
            : estimatedFPS >= 45
                ? 'Your PC should run this game with some settings adjustments.'
                : 'Your PC may need lower settings or a hardware upgrade.';

        const performanceTitle = estimatedFPS >= 75
            ? 'Excellent performance'
            : estimatedFPS >= 45
                ? 'Playable performance'
                : 'Performance may be limited';

        let html = '';

        html += `
            <div class="fps-legend" aria-label="FPS performance legend">
                <strong>FPS rating</strong>
                <span><i class="fps-legend-dot good"></i> Good: 75+</span>
                <span><i class="fps-legend-dot ok"></i> Playable: 45-74</span>
                <span><i class="fps-legend-dot bad"></i> Low: below 45</span>
            </div>
            <div class="fps-display ${fpsClass}">
                <div class="fps-summary-title">${performanceTitle}</div>
                <div class="fps-value">${estimatedFPS}</div>
                <div class="fps-label">Estimated frames per second</div>
                <p class="fps-summary-text">${performanceSummary}</p>
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

        const requiredScores = [selectedGame.cpu_benchmark, selectedGame.gpu_benchmark, selectedGame.ram_benchmark]
            .filter(score => Number.isFinite(Number(score)));
        const maxScore = Math.max(cpuScoreNum, gpuScoreNum, ramScoreNum, ...requiredScores);

        html += `
            <div class="result-section">
                <h4>Can your PC run this game?</h4>
                <p class="result-explanation">The comparison below shows whether each part of your PC meets the game's minimum requirement.</p>
                <details class="technical-details">
                    <summary>View hardware comparison</summary>
                    <div class="bar-chart">
                    <div class="bar-item">
                        <div class="bar-label">
                            <span>CPU</span>
                            <span>${cpuOK ? 'Meets requirement' : 'Needs attention'}</span>
                        </div>
                        <div class="bar-row">
                            <span class="bar-model-name">Your CPU: ${cpuName}</span>
                            <div class="bar-container">
                                <div class="bar-fill user" style="width: ${(cpuScoreNum / maxScore) * 100}%">${cpuScoreNum}</div>
                            </div>
                        </div>
                        <div class="bar-row">
                            <span class="bar-model-name">Minimum needed: ${selectedGame.cpu_model || 'Required level'}</span>
                            <div class="bar-container">
                                <div class="bar-fill game" style="width: ${(selectedGame.cpu_benchmark / maxScore) * 100}%">${selectedGame.cpu_benchmark}</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="bar-item">
                        <div class="bar-label">
                            <span>GPU</span>
                            <span>${gpuOK ? 'Meets requirement' : 'Needs attention'}</span>
                        </div>
                        <div class="bar-row">
                            <span class="bar-model-name">Your graphics card: ${gpuName}</span>
                            <div class="bar-container">
                                <div class="bar-fill user" style="width: ${(gpuScoreNum / maxScore) * 100}%">${gpuScoreNum}</div>
                            </div>
                        </div>
                        <div class="bar-row">
                            <span class="bar-model-name">Minimum needed: ${selectedGame.gpu_model || 'Required level'}</span>
                            <div class="bar-container">
                                <div class="bar-fill game" style="width: ${(selectedGame.gpu_benchmark / maxScore) * 100}%">${selectedGame.gpu_benchmark}</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="bar-item">
                        <div class="bar-label">
                            <span>RAM</span>
                            <span>${ramOK ? 'Meets requirement' : 'Needs attention'}</span>
                        </div>
                        <div class="bar-row">
                            <span class="bar-model-name">Your memory: ${ramGB} GB</span>
                            <div class="bar-container">
                                <div class="bar-fill user" style="width: ${(ramScoreNum / maxScore) * 100}%">${ramScoreNum}</div>
                            </div>
                        </div>
                        <div class="bar-row">
                            <span class="bar-model-name">Minimum needed: ${selectedGame.ram_model || (selectedGame.ram_capacity_gb || 'Unknown') + ' GB'}</span>
                            <div class="bar-container">
                                <div class="bar-fill game" style="width: ${selectedGame.ram_benchmark === null ? 0 : (selectedGame.ram_benchmark / maxScore) * 100}%">${selectedGame.ram_benchmark === null ? 'Unavailable' : selectedGame.ram_benchmark}</div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="bar-legend">
                    <span><span class="legend-dot user"></span> Your Hardware</span>
                    <span><span class="legend-dot game"></span> Game Requirement</span>
                </div>
                </details>
            </div>
        `;

        const graphicsSuggestions = buildGraphicsSuggestions(fpsDelta, quality, bottlenecks);
        const hasCompatibilityIssues = bottlenecks.length > 0;
        const suggestionTone = !hasCompatibilityIssues && fpsDelta >= 0 ? 'success' : 'warning';
        const suggestionHeading = hasCompatibilityIssues
            ? 'Hardware below minimum requirements'
            : fpsDelta >= 15
                ? 'Your PC can handle higher graphics settings'
                : fpsDelta >= 5
                    ? 'You can improve the graphics a little'
                    : fpsDelta > 0
                        ? 'Your PC is close to the recommended performance'
                        : 'How to improve game performance';

        html += `
            <div class="result-section ${suggestionTone}">
                <h4>${suggestionHeading}</h4>
                <ul class="suggestion-list ${fpsDelta < 0 ? 'downgrade' : ''}">
                    ${graphicsSuggestions.map(item => `<li>${item}</li>`).join('')}
                </ul>
            </div>
        `;

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
                                            <span>${formatCpuCoreLabel(c)}</span>
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
                    const requiredRAM = Number(selectedGame.ram_capacity_gb) || 0;
                    const ramOptions = [8, 16, 32, 64].filter(r => r > currentRAM && r >= requiredRAM).slice(0, 3);
                    if (ramOptions.length > 0) {
                        html += `
                            <div class="upgrade-category">
                                <h5>RAM Alternatives:</h5>
                                <div class="upgrade-options">
                                    ${ramOptions.map(r => `
                                        <div class="upgrade-option">
                                            <span>${r} GB DDR4/DDR5</span>
                                            <span class="score">Capacity: ${r} GB</span>
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

        recordPredictionHistory({
            game: selectedGame,
            fps: estimatedFPS,
            quality,
            performanceMode
        });

        document.getElementById("fpsResultsPanel").innerHTML = html;
        renderPredictionHistory();
        scheduleSyncFpsTopPanels();
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

    try {
        const feedbacks = await loadFeedbackData();
        // Compact preview: latest 3 only. Existing header "View All Reviews"
        // link (feedback.php) covers the full list — no duplicate control added.
        renderFeedbackCards(feedbacks, container, { limit: 3 });
    } catch (error) {
        console.warn("Unable to load feedback preview.", error);
        container.innerHTML = `
            <div class="results-placeholder">
                <div class="placeholder-icon"><i class="fas fa-comment-dots"></i></div>
                <p>No feedback available yet.</p>
            </div>
        `;
    }
}

function getPredictionHistoryKey() {
    return 'gamespecPredictionHistory';
}

function getPredictionHistory() {
    try {
        const stored = localStorage.getItem(getPredictionHistoryKey());
        const parsed = stored ? JSON.parse(stored) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.warn('Unable to read prediction history.', error);
        return [];
    }
}

function friendlyQualityLabel(quality) {
    const labels = { low: 'Low', medium: 'Medium', high: 'High' };
    return labels[String(quality || '').toLowerCase()] || 'Medium';
}

function friendlyPerformanceModeLabel(mode) {
    const labels = { battery: 'Battery Saver', balanced: 'Balanced', performance: 'Performance' };
    return labels[String(mode || '').toLowerCase()] || 'Balanced';
}

function friendlyHistoryDate(value) {
    if (!value) return 'Recently checked';
    const date = parseDisplayDate(value);
    if (!date) return 'Recently checked';
    return new Intl.DateTimeFormat('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit', hour12: true
    }).format(date);
}

function predictionHistoryCard(entry) {
    const game = escapeHtml(entry.game || 'Unknown game');
    const fps = Number(entry.fps) || 0;
    const quality = escapeHtml(friendlyQualityLabel(entry.quality));
    const mode = escapeHtml(friendlyPerformanceModeLabel(entry.performanceMode));
    const date = escapeHtml(friendlyHistoryDate(entry.createdAt));
    const tone = fps >= 75 ? 'good' : fps >= 45 ? 'playable' : 'low';
    return `
        <div class="prediction-history-item prediction-${tone}">
            <div class="prediction-history-main">
                <strong>${game}</strong>
                <span>${quality} graphics · ${mode}</span>
            </div>
            <div class="prediction-history-side">
                <span class="prediction-history-fps">${fps} FPS</span>
                <span class="prediction-history-date">${date}</span>
            </div>
        </div>
    `;
}

function renderPredictionHistory() {
    const list = document.getElementById('predictionHistoryList');
    if (!list) return;
    // Compact preview: latest 3 only. Older records stay in storage.
    const PREVIEW_COUNT = 3;
    const fullHistory = getPredictionHistory();
    const preview = fullHistory.slice(0, PREVIEW_COUNT);
    if (!fullHistory.length) {
        list.innerHTML = `
            <div class="prediction-history-empty">
                <p><strong>No prediction history yet.</strong></p>
                <p>Your previous performance checks will appear here.</p>
            </div>
        `;
        return;
    }
    list.innerHTML = preview.map(predictionHistoryCard).join('')
        + (fullHistory.length > PREVIEW_COUNT
            ? `<button type="button" class="history-view-all-btn" onclick="openPredictionHistoryModal()">View All &rarr;</button>`
            : '');
}

function openPredictionHistoryModal() {
    const existing = document.getElementById('predictionHistoryModal');
    if (existing) {
        existing.classList.add('active');
        existing.setAttribute('aria-hidden', 'false');
        return;
    }
    const fullHistory = getPredictionHistory();
    const html = `
        <div class="history-modal-overlay" id="predictionHistoryModal" aria-hidden="false">
            <div class="history-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="predictionHistoryModalTitle">
                <button type="button" class="history-modal-close" id="predictionHistoryModalClose" aria-label="Close prediction history">&times;</button>
                <h3 id="predictionHistoryModalTitle">Prediction History</h3>
                <p class="history-modal-subtitle">All your previous performance checks.</p>
                <div class="prediction-history-list">
                    ${fullHistory.map(predictionHistoryCard).join('')}
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
    const overlay = document.getElementById('predictionHistoryModal');
    document.getElementById('predictionHistoryModalClose')?.addEventListener('click', () => {
        document.getElementById('predictionHistoryModal')?.remove();
    });
    overlay?.addEventListener('click', (event) => {
        if (event.target === overlay) overlay.remove();
    });
    document.addEventListener('keydown', function escHandler(event) {
        if (event.key === 'Escape') {
            document.getElementById('predictionHistoryModal')?.remove();
            document.removeEventListener('keydown', escHandler);
        }
    });
    requestAnimationFrame(() => overlay?.classList.add('active'));
}

function recordPredictionHistory({ game, fps, quality, performanceMode }) {
    try {
        const history = getPredictionHistory();
        history.unshift({
            game: game?.title || game?.title_raw || 'Unknown game',
            fps: Number(fps) || 0,
            quality,
            performanceMode,
            createdAt: new Date().toISOString()
        });
        localStorage.setItem(getPredictionHistoryKey(), JSON.stringify(history.slice(0, 8)));
    } catch (error) {
        console.warn('Unable to save prediction history.', error);
    }
    renderPredictionHistory();
}

/* Layout-only sync: keep the FPS Results panel visually aligned with the
   naturally-sized Hardware Configuration panel. The input panel grows with
   its content (no internal scroll); the results panel is capped to that
   height and scrolls internally. Runs on resize/font load; never touches
   prediction data, history storage, or hardware detection. */
function syncFpsTopPanels() {
    try {
        const layout = document.querySelector('.fps-layout');
        const input = document.querySelector('.fps-input-panel');
        const results = document.getElementById('fpsResultsPanel');
        if (!layout || !input || !results) return;
        if (window.innerWidth <= 900) {
            results.style.maxHeight = '';
            return;
        }
        // Clear any previous cap so the input panel measures naturally.
        results.style.maxHeight = 'none';
        const target = input.getBoundingClientRect().height;
        // Match the input panel height (min 320px guard for empty states).
        results.style.maxHeight = Math.max(320, Math.round(target)) + 'px';
    } catch (error) {
        // Layout-only helper: never break prediction flow.
    }
}

let syncFpsTopPanelsTimer = null;
function scheduleSyncFpsTopPanels() {
    if (syncFpsTopPanelsTimer) clearTimeout(syncFpsTopPanelsTimer);
    syncFpsTopPanelsTimer = setTimeout(syncFpsTopPanels, 60);
}

window.addEventListener('resize', scheduleSyncFpsTopPanels);
window.addEventListener('load', syncFpsTopPanels);
document.addEventListener('DOMContentLoaded', syncFpsTopPanels);
if (document.fonts?.ready) {
    document.fonts.ready.then(() => syncFpsTopPanels()).catch(() => {});
}
syncFpsTopPanels();

loadFeedbackPreview();
renderPredictionHistory();
