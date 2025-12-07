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

// --- SIDEBAR CONTROL ---
function toggleSidebar() {
    document.body.classList.toggle('sidebar-open');
}

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
        
        card.innerHTML = `
            <div class="game-image">
                🎮
            </div>
            <div class="game-name">${game.title}</div>
        `;
        
        card.onclick = () => selectGame(game.title_raw);
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
        // Genre filter disabled for now since CSV doesn't have genre data
        const matchesGenre = !genreFilter || true;
        
        card.style.display = (matchesSearch && matchesGenre) ? 'block' : 'none';
    });
}

function selectGame(title) {
    // Navigate to FPS prediction with selected game
    window.location.href = `fps-prediction.php?game=${encodeURIComponent(title)}`;
}

// --- GAME DROPDOWN: Load for FPS Prediction ---
async function loadGameDropdown() {
    await loadGamesFromCSV();
    
    const select = document.getElementById('selectedGame');
    if (!select) return;
    
    select.innerHTML = '<option value="">Select a Game</option>';
    
    games.forEach(game => {
        select.innerHTML += `<option value="${game.title_raw}">${game.title}</option>`;
    });
    
    // Check if game was passed via URL
    const urlParams = new URLSearchParams(window.location.search);
    const preselectedGame = urlParams.get('game');
    if (preselectedGame) {
        select.value = preselectedGame;
    }
}

// --- LEGACY: TAB NAVIGATION (for old UserSide.html) ---
function showTab(tabName, button) {
    document.querySelectorAll('.tab').forEach(tab => tab.style.display = "none");
    document.getElementById(tabName).style.display = "block";
    
    document.querySelectorAll('.sidebar button').forEach(btn => btn.classList.remove('active'));
    if (button) {
        button.classList.add('active');
    }
}

// --- LEGACY: Load games for old structure ---
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

// --- BENCHMARK FUNCTIONALITY ---
function runBenchmark() {
    const cpuScore = scoreCPU(document.getElementById("cpu").value);
    const gpuScore = scoreGPU(document.getElementById("gpu").value);
    // Limit RAM score to a max of 10 for balancing the total score
    const ramScore = Math.min(10, document.getElementById("ram").value / 4); 

    const total = Math.round(cpuScore + gpuScore + ramScore);
    const maxScore = 30; // 10 (CPU) + 10 (GPU) + 10 (RAM)
    
    document.getElementById("benchResult").innerText = 
        `Your System Score: ${total}/${maxScore}`;
}

// --- FPS PREDICTION FUNCTIONALITY ---
function predictFPS() {
    const game = document.getElementById("selectedGame").value;
    if (!game) return alert("Please select a game first.");

    const cpuScore = scoreCPU(document.getElementById("cpu2").value);
    const gpuScore = scoreGPU(document.getElementById("gpu2").value);
    const ramScore = Math.min(10, document.getElementById("ram2").value / 4);

    // Calculation: Base FPS determined by total hardware score
    let baseFPS = (cpuScore + gpuScore + ramScore) * 5; 

    const quality = document.getElementById("graphicsQuality").value;
    if (quality === "medium") baseFPS *= 0.8; // 20% penalty
    if (quality === "high") baseFPS *= 0.6; // 40% penalty
    
    // Simple cap/floor for realistic range
    baseFPS = Math.max(30, baseFPS); 

    document.getElementById("fpsResult").innerText =
        `Estimated FPS for ${game} on ${quality} settings: ${Math.round(baseFPS)} FPS`;
}

// Initialize the application
loadGames();