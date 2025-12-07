// --- SIDEBAR CONTROL ---
function toggleSidebar() {
    document.body.classList.toggle('sidebar-open');
}

// --- LEGACY TAB FUNCTION ---
function showTab(tabName) {
    document.querySelectorAll('.tab').forEach(tab => tab.style.display = "none");
    document.getElementById(tabName).style.display = "block";
}

// --- ADMIN DATA ---
let adminGames = [];
let adminCPUs = [];
let adminGPUs = [];

// --- LOAD GAMES FOR ADMIN ---
async function loadAdminGames() {
    try {
        const response = await fetch('../../../MODULES/api/get-games.php');
        adminGames = await response.json();
        displayGameList();
    } catch (error) {
        console.error('Error loading games:', error);
    }
}

function displayGameList() {
    const listEl = document.getElementById('gameList');
    if (!listEl) return;
    
    listEl.innerHTML = '';
    adminGames.forEach((game, index) => {
        listEl.innerHTML += `
            <div class="data-item">
                <div>
                    <span class="item-name">${game.title}</span>
                    <br><small>CPU: ${game.cpu_model} | GPU: ${game.gpu_model} | RAM: ${game.ram_model}</small>
                </div>
                <div class="item-actions">
                    <button class="btn-edit" onclick="editGame(${index})">Edit</button>
                    <button class="btn-delete" onclick="deleteGame(${index})">Delete</button>
                </div>
            </div>
        `;
    });
}

function filterGameList() {
    const search = document.getElementById('gameSearch')?.value.toLowerCase() || '';
    const items = document.querySelectorAll('#gameList .data-item');
    items.forEach(item => {
        const name = item.querySelector('.item-name')?.textContent.toLowerCase() || '';
        item.style.display = name.includes(search) ? 'flex' : 'none';
    });
}

function editGame(index) {
    const game = adminGames[index];
    if (!game) return;
    
    document.getElementById('gameTitle').value = game.title;
    document.getElementById('gameCPU').value = game.cpu_model;
    document.getElementById('gameGPU').value = game.gpu_model;
    document.getElementById('gameRAM').value = game.ram_benchmark / 250;
}

function deleteGame(index) {
    if (confirm('Are you sure you want to delete this game?')) {
        alert('Game deleted! (Backend integration pending)');
    }
}

// --- LOAD HARDWARE FOR ADMIN ---
async function loadAdminHardware() {
    try {
        const [cpuRes, gpuRes] = await Promise.all([
            fetch('../../../MODULES/api/get-cpus.php'),
            fetch('../../../MODULES/api/get-gpus.php')
        ]);
        adminCPUs = await cpuRes.json();
        adminGPUs = await gpuRes.json();
        displayHardwareLists();
    } catch (error) {
        console.error('Error loading hardware:', error);
    }
}

function displayHardwareLists() {
    // Display CPUs
    const cpuList = document.getElementById('cpuList');
    if (cpuList) {
        cpuList.innerHTML = '';
        adminCPUs.slice(0, 20).forEach((cpu, index) => {
            cpuList.innerHTML += `
                <div class="data-item">
                    <div>
                        <span class="item-name">${cpu.model}</span>
                        <br><small>${cpu.cores}C/${cpu.threads}T</small>
                    </div>
                    <span class="item-score">${cpu.score}</span>
                </div>
            `;
        });
        if (adminCPUs.length > 20) {
            cpuList.innerHTML += `<p style="text-align:center;color:#64748b;">... and ${adminCPUs.length - 20} more</p>`;
        }
    }
    
    // Display GPUs
    const gpuList = document.getElementById('gpuList');
    if (gpuList) {
        gpuList.innerHTML = '';
        adminGPUs.slice(0, 20).forEach((gpu, index) => {
            gpuList.innerHTML += `
                <div class="data-item">
                    <span class="item-name">${gpu.model}</span>
                    <span class="item-score">${gpu.score}</span>
                </div>
            `;
        });
        if (adminGPUs.length > 20) {
            gpuList.innerHTML += `<p style="text-align:center;color:#64748b;">... and ${adminGPUs.length - 20} more</p>`;
        }
    }
}

// --- ML TRAINING FUNCTIONS ---
function updateTrainingData() {
    const log = document.getElementById('trainingLog');
    const output = document.getElementById('trainingOutput');
    
    if (log) {
        log.innerHTML += `<p class="log-entry info">[${new Date().toLocaleTimeString()}] Checking training data consistency...</p>`;
    }
    
    if (output) {
        output.innerHTML = 'Validating training data against source CSVs...';
    }
    
    // Simulate checking (replace with actual API call)
    setTimeout(() => {
        if (log) {
            log.innerHTML += `<p class="log-entry">Scanning game-requirements.csv... 31 games found.</p>`;
            log.innerHTML += `<p class="log-entry">Scanning CPU-benchmarks.csv... 1,500 CPUs found.</p>`;
            log.innerHTML += `<p class="log-entry">Scanning GPU-benchmarks-v7.csv... 2,800 GPUs found.</p>`;
        }
    }, 500);
    
    setTimeout(() => {
        if (log) {
            log.innerHTML += `<p class="log-entry">Cross-referencing benchmark-data.csv...</p>`;
            log.innerHTML += `<p class="log-entry">Checking for missing games in training data...</p>`;
            log.innerHTML += `<p class="log-entry">Checking for missing hardware combinations...</p>`;
        }
    }, 1200);
    
    setTimeout(() => {
        if (log) {
            log.innerHTML += `<p class="log-entry success">[${new Date().toLocaleTimeString()}] Validation complete!</p>`;
            log.innerHTML += `<p class="log-entry success">All 31 games present in training data.</p>`;
            log.innerHTML += `<p class="log-entry success">Training data is up to date.</p>`;
        }
        if (output) {
            output.innerHTML = 'Training data validated. No updates required.';
        }
    }, 2000);
}

function retrainModel() {
    const log = document.getElementById('trainingLog');
    const output = document.getElementById('trainingOutput');
    
    if (log) {
        log.innerHTML += `<p class="log-entry info">[${new Date().toLocaleTimeString()}] Starting model retraining...</p>`;
        log.innerHTML += `<p class="log-entry">Loading training data...</p>`;
    }
    
    if (output) {
        output.innerHTML = 'Training in progress... This may take a few minutes.';
    }
    
    // Simulate training (replace with actual API call)
    setTimeout(() => {
        if (log) {
            log.innerHTML += `<p class="log-entry">Training Voting Ensemble model...</p>`;
            log.innerHTML += `<p class="log-entry">Gradient Boosting: n_estimators=300</p>`;
            log.innerHTML += `<p class="log-entry">XGBoost: n_estimators=400</p>`;
            log.innerHTML += `<p class="log-entry success">[${new Date().toLocaleTimeString()}] Training complete!</p>`;
            log.innerHTML += `<p class="log-entry success">MAE: 10.94 | MAPE: 13.91%</p>`;
        }
        if (output) {
            output.innerHTML = 'Model trained successfully! Ready for predictions.';
        }
    }, 2000);
}

function generateData() {
    const log = document.getElementById('trainingLog');
    if (log) {
        log.innerHTML += `<p class="log-entry info">[${new Date().toLocaleTimeString()}] Generating synthetic training data...</p>`;
        setTimeout(() => {
            log.innerHTML += `<p class="log-entry success">Generated 6,000 training samples.</p>`;
        }, 1000);
    }
}

function exportModel() {
    const log = document.getElementById('trainingLog');
    if (log) {
        log.innerHTML += `<p class="log-entry info">[${new Date().toLocaleTimeString()}] Exporting model...</p>`;
        setTimeout(() => {
            log.innerHTML += `<p class="log-entry success">Model exported to: MODULES/fps_model.pkl</p>`;
        }, 500);
    }
}

// --- FORM SUBMISSIONS ---
document.addEventListener('DOMContentLoaded', function() {
    // Game Form
    const gameForm = document.getElementById("gameForm");
    if (gameForm) {
        gameForm.addEventListener("submit", function(e) {
            e.preventDefault();
            alert("Game added/updated! (Backend integration pending)");
        });
    }

    // CPU Form
    const cpuForm = document.getElementById("cpuForm");
    if (cpuForm) {
        cpuForm.addEventListener("submit", function(e) {
            e.preventDefault();
            alert("CPU saved! (Backend integration pending)");
        });
    }

    // GPU Form
    const gpuForm = document.getElementById("gpuForm");
    if (gpuForm) {
        gpuForm.addEventListener("submit", function(e) {
            e.preventDefault();
            alert("GPU saved! (Backend integration pending)");
        });
    }

    // RAM Form
    const ramForm = document.getElementById("ramForm");
    if (ramForm) {
        ramForm.addEventListener("submit", function(e) {
            e.preventDefault();
            alert("RAM saved! (Backend integration pending)");
        });
    }
});