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

// --- FPS PREDICTION: Load all dropdowns ---
async function loadFPSPredictionDropdowns() {
    // Load all data in parallel
    await Promise.all([
        loadGamesFromCSV(),
        loadCPUsFromCSV(),
        loadGPUsFromCSV()
    ]);
    
    // Populate game dropdown
    const gameSelect = document.getElementById('selectedGame');
    if (gameSelect) {
        gameSelect.innerHTML = '<option value="">Select a Game</option>';
        games.forEach(game => {
            gameSelect.innerHTML += `<option value="${game.title_raw}">${game.title}</option>`;
        });
        
        // Check if game was passed via URL
        const urlParams = new URLSearchParams(window.location.search);
        const preselectedGame = urlParams.get('game');
        if (preselectedGame) {
            gameSelect.value = preselectedGame;
        }
    }
    
    // Populate CPU dropdown
    const cpuSelect = document.getElementById('cpuSelect');
    if (cpuSelect) {
        cpuSelect.innerHTML = '<option value="">Select a CPU</option>';
        cpus.forEach(cpu => {
            cpuSelect.innerHTML += `<option value="${cpu.score}">${cpu.model} (${cpu.cores}C/${cpu.threads}T)</option>`;
        });
    }
    
    // Populate GPU dropdown
    const gpuSelect = document.getElementById('gpuSelect');
    if (gpuSelect) {
        gpuSelect.innerHTML = '<option value="">Select a GPU</option>';
        gpus.forEach(gpu => {
            gpuSelect.innerHTML += `<option value="${gpu.score}">${gpu.model}</option>`;
        });
    }
}

// --- GAME DROPDOWN: Load for FPS Prediction (legacy) ---
async function loadGameDropdown() {
    await loadFPSPredictionDropdowns();
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

// --- HARDWARE BENCHMARK FUNCTIONALITY ---
async function initHardwareBenchmark() {
    // Pre-load CPU and GPU data
    await Promise.all([loadCPUsFromCSV(), loadGPUsFromCSV()]);
}

function loadHardwareOptions() {
    const hardwareType = document.getElementById('hardwareType').value;
    const hardwareSelect = document.getElementById('hardwareSelect');
    
    if (!hardwareType) {
        hardwareSelect.innerHTML = '<option value="">First select a hardware type above</option>';
        hardwareSelect.disabled = true;
        return;
    }
    
    hardwareSelect.disabled = false;
    
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
}

function getBenchmarkScore() {
    const hardwareType = document.getElementById('hardwareType').value;
    const hardwareSelect = document.getElementById('hardwareSelect');
    
    if (!hardwareType) {
        return alert('Please select a hardware type first.');
    }
    
    if (!hardwareSelect.value) {
        return alert('Please select a hardware model.');
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

// --- LEGACY BENCHMARK (for old structure) ---
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

// --- FPS PREDICTION FUNCTIONALITY (Placeholder for ML model) ---
function predictFPS() {
    const game = document.getElementById("selectedGame").value;
    if (!game) return alert("Please select a game first.");

    const cpuSelect = document.getElementById("cpuSelect");
    const gpuSelect = document.getElementById("gpuSelect");
    const ramSelect = document.getElementById("ramSelect");
    
    if (!cpuSelect.value) return alert("Please select a CPU.");
    if (!gpuSelect.value) return alert("Please select a GPU.");
    if (!ramSelect.value) return alert("Please select RAM.");

    const cpuScore = parseInt(cpuSelect.value);
    const gpuScore = parseInt(gpuSelect.value);
    const ramGB = parseInt(ramSelect.value);
    const ramScore = ramGB * 250;

    // Get selected hardware names
    const cpuName = cpuSelect.options[cpuSelect.selectedIndex].text;
    const gpuName = gpuSelect.options[gpuSelect.selectedIndex].text;

    // Find selected game requirements
    const selectedGame = games.find(g => g.title_raw === game);
    if (!selectedGame) return alert("Game not found.");
    
    const quality = document.getElementById("graphicsQuality").value;
    
    // Simple benchmark comparison: user hardware vs game requirements
    const cpuOK = cpuScore >= selectedGame.cpu_benchmark;
    const gpuOK = gpuScore >= selectedGame.gpu_benchmark;
    const ramOK = ramScore >= selectedGame.ram_benchmark;
    
    // Identify bottlenecks (hardware below game requirements)
    const bottlenecks = [];
    if (!cpuOK) bottlenecks.push({ type: 'CPU', name: cpuName, userScore: cpuScore, required: selectedGame.cpu_benchmark });
    if (!gpuOK) bottlenecks.push({ type: 'GPU', name: gpuName, userScore: gpuScore, required: selectedGame.gpu_benchmark });
    if (!ramOK) bottlenecks.push({ type: 'RAM', name: `${ramGB} GB`, userScore: ramScore, required: selectedGame.ram_benchmark });
    
    // Calculate estimated FPS based on how many requirements are met
    let baseFPS;
    if (bottlenecks.length === 0) {
        baseFPS = 90; // All requirements met
    } else if (bottlenecks.length === 1) {
        baseFPS = 50; // One component below
    } else if (bottlenecks.length === 2) {
        baseFPS = 35; // Two components below
    } else {
        baseFPS = 20; // All components below
    }
    
    // Quality multiplier
    const qualityMult = { low: 1.5, medium: 1.0, high: 0.6 };
    
    // Performance mode multiplier
    const performanceMode = document.getElementById("performanceMode").value;
    const perfMult = { battery: 0.85, balanced: 1.0, performance: 1.15 };
    
    let estimatedFPS = Math.round(baseFPS * qualityMult[quality] * perfMult[performanceMode]);
    estimatedFPS = Math.max(10, Math.min(estimatedFPS, 240)); // Clamp between 10-240
    
    // Determine FPS status
    let fpsClass = 'fps-ok';
    if (estimatedFPS >= 60) fpsClass = 'fps-good';
    else if (estimatedFPS < 45) fpsClass = 'fps-bad';
    
    // Build results HTML
    let html = '';
    
    // 1. FPS Display
    html += `
        <div class="fps-display ${fpsClass}">
            <div class="fps-value">${estimatedFPS}</div>
            <div class="fps-label">Estimated FPS</div>
        </div>
    `;
    
    // 2. Bottleneck Warning (if FPS < 45)
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
    
    // 3. Bar Chart Comparison
    const maxScore = Math.max(cpuScore, gpuScore, ramScore, selectedGame.cpu_benchmark, selectedGame.gpu_benchmark, selectedGame.ram_benchmark);
    
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
                            <div class="bar-fill user" style="width: ${(cpuScore / maxScore) * 100}%">${cpuScore}</div>
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
                            <div class="bar-fill user" style="width: ${(gpuScore / maxScore) * 100}%">${gpuScore}</div>
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
                            <div class="bar-fill user" style="width: ${(ramScore / maxScore) * 100}%">${ramScore}</div>
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
    
    // 4. Settings Suggestions
    if (estimatedFPS >= 60) {
        // Suggest turning UP settings
        html += `
            <div class="result-section success">
                <h4>You can improve graphics!</h4>
                <ul class="suggestion-list">
                    ${quality === 'low' ? '<li>Increase Graphics Quality to Medium or High</li>' : ''}
                    ${quality === 'medium' ? '<li>Try High graphics quality</li>' : ''}
                    <li>Enable Anti-Aliasing (MSAA 4x)</li>
                    <li>Increase Texture Quality</li>
                    <li>Enable Ambient Occlusion</li>
                    <li>Increase Shadow Quality</li>
                    ${estimatedFPS >= 100 ? '<li>Enable Ray Tracing (if supported)</li>' : ''}
                </ul>
            </div>
        `;
    } else if (estimatedFPS < 50) {
        // Suggest turning DOWN settings
        html += `
            <div class="result-section warning">
                <h4>Suggested Settings to Improve FPS</h4>
                <ul class="suggestion-list downgrade">
                    ${quality !== 'low' ? '<li>Lower Graphics Quality preset</li>' : ''}
                    <li>Disable Anti-Aliasing or use FXAA</li>
                    <li>Lower Shadow Quality</li>
                    <li>Reduce View Distance</li>
                    <li>Disable Motion Blur</li>
                    <li>Lower Texture Quality</li>
                    <li>Disable Ambient Occlusion</li>
                </ul>
            </div>
        `;
    }
    
    // 5. Hardware Upgrade Suggestions (if FPS < 50)
    if (estimatedFPS < 50 && bottlenecks.length > 0) {
        html += `<div class="result-section danger">
            <h4>Recommended Hardware Upgrades</h4>
        `;
        
        // For each bottleneck category, suggest 3 alternatives
        bottlenecks.forEach(b => {
            if (b.type === 'CPU' && cpus.length > 0) {
                const betterCPUs = cpus.filter(c => c.score >= selectedGame.cpu_benchmark && c.score > cpuScore)
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
                const betterGPUs = gpus.filter(g => g.score >= selectedGame.gpu_benchmark && g.score > gpuScore)
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
    
    // Display results
    document.getElementById("fpsResultsPanel").innerHTML = html;
}

// Initialize the application
loadGames();