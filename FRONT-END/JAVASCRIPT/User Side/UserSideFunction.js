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
async function loadFPSPredictionDropdowns() {
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
                '<img src="../../RES/Tutorials/browse-games/filter_genre.png" '  +
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
                '<img src="../../RES/Tutorials/browse-games/game_info.png" '  +
                    'alt="Game Details view opened with View Details">' +
            '</div>' +
            '<p>The Game Details view shows, from top to bottom: the game type, the game title, the requirement level badge, the game image, the game description, <strong>What you&apos;ll need</strong> (memory, graphics, and processor in plain language), and <strong>View detailed specifications</strong>. Open <strong>View detailed specifications</strong> to see the exact processor, graphics, and memory details.</p>' +
            '<p>Select <strong>Can I Run This?</strong> to continue to FPS Prediction and check how the game may perform on your computer. The game you selected is already filled in there.</p>' +
            '<div class="help-image">' +
                '<img src="../../RES/Tutorials/browse-games/fps_prediction.png" '  +
                    'alt="FPS Prediction page after selecting Can I Run This">' +
            '</div>' +
            '<p>To return to the Browse Games page, select <strong>Back to games</strong> or the <strong>X</strong> close button at the top of the Game Details view.</p>'
    },
    {
        id: 'hardware-detection',
        toc: 'Hardware Detection',
        icon: 'fa-search',
        title: 'Hardware Detection',
        content:
            '<p>GameSpec Optimizer can detect your Windows CPU, GPU, and installed RAM automatically. On the FPS Prediction page, click the <strong>Detect Hardware</strong> button and your components are filled in for you.</p>' +
            '<p>If automatic detection is unavailable (for example on a non-Windows system, or when permissions are restricted), you can <strong>select your hardware manually</strong> from the searchable dropdowns instead.</p>' +
            '<h3>Find your hardware manually</h3>' +
            '<p>To look up your specs without the auto-detect feature:</p>' +
            '<ol class="help-steps">' +
            '<li><strong>Open Windows Run</strong> by pressing <kbd>Windows</kbd> + <kbd>R</kbd>.</li>' +
            helpImagePlaceholder('Windows Run dialog') +
            '<li><strong>Type <code>dxdiag</code> and press Enter</strong> to open the DirectX Diagnostic Tool.</li>' +
            helpImagePlaceholder('dxdiag command') +
            '<li><strong>Check the System and Display tabs</strong> for your processor, memory, and graphics card.</li>' +
            helpImagePlaceholder('dxdiag System/Display information') +
            '</ol>' +
            '<ul>' +
            '<li><strong>System tab</strong> &mdash; find your CPU (Processor) and installed RAM (Memory).</li>' +
            '<li><strong>Display tab</strong> &mdash; find your graphics card (Name under Device).</li>' +
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
            helpImagePlaceholder('Hardware Benchmark page screenshot') +
            helpCaption('Example: Looking up a hardware benchmark score')
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
            '<p>When you click <strong>Analyze Performance</strong>, the application compares your hardware against the game&rsquo;s requirements and returns an estimated FPS value.</p>' +
            helpImagePlaceholder('FPS Prediction configuration screenshot') +
            helpCaption('Example: Configuring hardware and graphics settings')
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
            helpImagePlaceholder('FPS Results screenshot') +
            helpCaption('Example: Understanding an FPS prediction result')
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
            helpImagePlaceholder('Hardware comparison screenshot') +
            helpCaption('Example: Comparing your hardware with game requirements')
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
            helpImagePlaceholder('Bottleneck result screenshot') +
            helpCaption('Example: Identifying a limiting hardware component')
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
            '<p>If your FPS is too low, the opposite adjustments are offered (lowering or disabling those same settings). All suggestions aim to <strong>balance visual quality and FPS</strong>.</p>' +
            helpImagePlaceholder('Graphics recommendations screenshot') +
            helpCaption('Example: Recommended graphics adjustments')
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
            '<p>Review the limiting component first, then compare the suggested upgrade scores. After upgrading, re-run the prediction to confirm the improvement.</p>' +
            helpImagePlaceholder('Upgrade recommendation screenshot') +
            helpCaption('Example: Understanding a hardware upgrade recommendation')
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
            helpImagePlaceholder('Community Feedback screenshot') +
            helpCaption('Example: Reading and submitting community feedback')
    }
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

function getBrowseGenreTags(game) {
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
    const imageUrl = game.image ? `../../RES/${game.image}` : '';
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
        const releaseYear = knownReleaseYears[rawKey] || knownReleaseYears[game.title_raw] || 2020;
        card.dataset.year = releaseYear;
        card.dataset.gpuScore = parseInt(game.gpu_benchmark, 10) || 0;
        card.dataset.cpuScore = parseInt(game.cpu_benchmark, 10) || 0;
        card.dataset.displayTitle = game.title;

        const requirement = getBrowseRequirementInfo(game);
        const genreTags = getBrowseGenreTags(game);
        card.dataset.requirement = requirement.value;
        card.dataset.genre = guessBrowseGenre(game);

        const imageUrl = game.image ? `../../RES/${game.image}` : '';
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
    const platformFilter = document.getElementById('platformFilter');
    const yearFilter = document.getElementById('yearFilter');
    const requirementFilter = document.getElementById('requirementFilter');
    const sortOrder = document.getElementById('sortOrder');
    const noGameMessage = document.getElementById('noGameMessage');

    if (searchInput) searchInput.value = '';
    if (genreFilter) genreFilter.value = '';
    if (platformFilter) platformFilter.value = '';
    if (yearFilter) yearFilter.value = '';
    if (requirementFilter) requirementFilter.value = '';
    if (sortOrder) sortOrder.value = 'newest';
    if (noGameMessage) noGameMessage.style.display = 'none';

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

        // 2. Genre Filter (matches card's stored genre tag when available)
        const filterKey = String(genreFilter).toLowerCase();
        const cardGenre = String(card.dataset.genre || '').toLowerCase();
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
            if (cardGenre) {
                matchesGenre = cardGenre === filterKey;
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
let filteredFeedbackState = [];
let currentFeedbackPage = 1;
const FEEDBACK_PAGE_SIZE = 5;

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

function sortFeedbackState(items) {
    return items.slice().sort((a, b) => {
        const ratingDiff = Number(b.rating || 0) - Number(a.rating || 0);
        if (ratingDiff !== 0) return ratingDiff;

        const helpfulDiff = Number(b.helpful_count || 0) - Number(a.helpful_count || 0);
        if (helpfulDiff !== 0) return helpfulDiff;

        const createdA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const createdB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return createdB - createdA;
    });
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
                <span class="feedback-rating-badge" aria-label="Rated ${rating} out of 5 stars"><span class="feedback-rating-stars" aria-hidden="true">${stars}</span><span class="feedback-rating-value">${rating.toFixed(1)}</span></span>
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
        renderFeedbackPage(listContainer, filteredFeedbackState, { showDelete: true });
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
    filterFeedback();

    updateFeedbackSummary(feedbackState);

    if (typeof loadFeedbackPreview === "function") {
        loadFeedbackPreview();
    }
}

function markFeedbackHelpful(index) {
    if (!Number.isInteger(index) || index < 0 || index >= feedbackState.length) return;

    feedbackState[index].helpful_count = Number(feedbackState[index].helpful_count || 0) + 1;
    persistFeedbackState();
    filterFeedback();

    if (typeof loadFeedbackPreview === "function") {
        loadFeedbackPreview();
    }
}

function reportFeedbackItem(index) {
    if (!Number.isInteger(index) || index < 0 || index >= feedbackState.length) return;

    feedbackState[index].reported = true;
    persistFeedbackState();
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

    filterFeedback();
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

    const sortedFeedback = sortFeedbackState(feedbackState);

    filteredFeedbackState = sortedFeedback
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => {
            const title = String(item.title || "").toLowerCase();
            const comment = String(item.comment || "").toLowerCase();
            const username = String(item.username || "").toLowerCase();
            const createdAt = item.created_at ? new Date(item.created_at).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" }).toLowerCase() : "";
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
        renderFeedbackPage(listContainer, filteredFeedbackState, { showDelete: true });
    }
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
    filterFeedback();
}

function selectGame(title) {
    // Navigate to FPS prediction with selected game
    window.location.href = `fps-prediction.php?game=${encodeURIComponent(title)}`;
}

function normalizeHardwareText(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/\b(11th|12th|13th|14th|15th)\s*gen\b/g, '')
        .replace(/\bcore\s*tm\b/g, '')
        .replace(/\br\s*\(r\)\b/g, 'r')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function findBestHardwareMatch(items, detectedModel) {
    if (!Array.isArray(items) || !detectedModel) return null;

    const target = normalizeHardwareText(detectedModel);
    const targetTokens = target.split(/\s+/).filter(token => token.length > 1);

    const scoredMatches = items.map(item => {
        const model = normalizeHardwareText(item.model);
        const modelTokens = model.split(/\s+/).filter(token => token.length > 1);

        const tokenHits = modelTokens.filter(token => targetTokens.includes(token)).length;
        const tokenCoverage = modelTokens.length ? tokenHits / modelTokens.length : 0;
        const targetCoverage = targetTokens.length ? tokenHits / targetTokens.length : 0;
        const exact = model === target ? 1 : 0;

        return {
            item,
            score: exact ? 100 : (tokenCoverage * 70) + (targetCoverage * 30)
        };
    }).sort((a, b) => b.score - a.score);

    const best = scoredMatches[0];
    return best && best.score >= 25 ? best.item : null;
}

function findClosestRamOption(ramGb) {
    const options = Array.from(document.getElementById('ramSelect')?.options || [])
        .map(option => Number(option.value))
        .filter(value => Number.isFinite(value) && value > 0);

    if (!options.length || !Number.isFinite(ramGb)) return null;

    return options.reduce((closest, value) => {
        if (closest === null) return value;
        return Math.abs(value - ramGb) < Math.abs(closest - ramGb) ? value : closest;
    }, null);
}

async function detectHardware() {
    try {
        if (!cpus.length) await loadCPUsFromCSV();
        if (!gpus.length) await loadGPUsFromCSV();

        const response = await fetch('../../../MODULES/api/get-hardware.php');
        const result = await response.json();

        if (!response.ok || result.success === false) {
            throw new Error(result.error || result.message || 'Hardware detection failed');
        }

        const cpuMatch = findBestHardwareMatch(cpus, result.cpu_model);
        const gpuMatch = findBestHardwareMatch(gpus, result.gpu_model);
        const ramClosest = findClosestRamOption(Number(result.ram_gb));

        const cpuSearch = document.getElementById('cpuSearch');
        const cpuSelect = document.getElementById('cpuSelect');
        if (cpuSearch) cpuSearch.value = cpuMatch?.model || result.cpu_model || '';
        if (cpuSelect) cpuSelect.value = cpuMatch ? cpuMatch.score : '';

        const gpuSearch = document.getElementById('gpuSearch');
        const gpuSelect = document.getElementById('gpuSelect');
        if (gpuSearch) gpuSearch.value = gpuMatch?.model || result.gpu_model || '';
        if (gpuSelect) gpuSelect.value = gpuMatch ? gpuMatch.score : '';

        if (ramClosest !== null) {
            const ramSelect = document.getElementById('ramSelect');
            if (ramSelect) ramSelect.value = String(ramClosest);
        }

        const detectedParts = [];
        if (result.cpu_model) detectedParts.push(`CPU: ${result.cpu_model}`);
        if (result.gpu_model) detectedParts.push(`GPU: ${result.gpu_model}`);
        if (result.ram_gb) detectedParts.push(`RAM: ${result.ram_gb} GB`);

        showModal(
            'Hardware Detected',
            detectedParts.length ? detectedParts.join('\n') : 'Hardware detected successfully.'
        );
    } catch (error) {
        console.error('Hardware detection failed:', error);
        showModal('Error', error.message || 'Unable to detect hardware automatically.');
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

    // Hardware options depend on the selected hardware type, so pass a
    // data provider function instead of a static array.
    initSearchDropdown('hardware', () => hardwareOptions, item => item.label, item => item.score);
}

function loadHardwareOptions() {
    const hardwareType = document.getElementById('hardwareType').value;
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
            label: `${cpu.model} (${cpu.cores}C/${cpu.threads}T)`,
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
    const hardwareType = document.getElementById('hardwareType').value;
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

function buildGraphicsSuggestions(fpsDelta, currentQuality) {
    const suggestions = [];

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
    if (!ramBenchmarks.length) await loadRAMBenchmarks();
    const ramOptions = ramBenchmarks
        .filter(item => Number(item.capacity) === ramGB)
        .sort((a, b) => Number(a.score) - Number(b.score));
    const ramScoreNum = Number(ramOptions[0]?.score);
    if (!Number.isFinite(ramScoreNum)) {
        return showModal('Warning', `No benchmark score is available for ${ramGB} GB RAM.`);
    }

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

        const graphicsSuggestions = buildGraphicsSuggestions(fpsDelta, quality);
        const suggestionTone = fpsDelta >= 0 ? 'success' : 'warning';
        const suggestionHeading = fpsDelta >= 15
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

    const feedbacks = await loadFeedbackData();
    // Compact preview: latest 3 only. Existing header "View All Reviews"
    // link (feedback.php) covers the full list — no duplicate control added.
    renderFeedbackCards(feedbacks, container, { limit: 3 });
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
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Recently checked';
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    if (sameDay(date, today)) return 'Today';
    if (sameDay(date, yesterday)) return 'Yesterday';
    return date.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' });
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
