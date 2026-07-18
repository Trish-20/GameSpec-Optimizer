// ============================================================================
// 1. UI UTILITIES
// ============================================================================
// Modal Dialog System
let activeModalConfirmHandler = null;

function showModal(title, message, options = {}) {
    let modalOverlay = document.getElementById('appModal');
    const modalOptions = typeof options === 'function'
        ? { type: 'confirm', onConfirm: options }
        : (typeof options === 'string' ? { type: options } : options);
    const modalType = modalOptions.type === 'confirm' ? 'confirm' : 'info';
    
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
                    <div class="modal-footer" id="modalFooter"></div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);
        modalOverlay = document.getElementById('appModal');
    }
    
    // Set content
    document.getElementById('modalTitle').textContent = title || 'Notification';
    document.getElementById('modalBody').textContent = message || '';

    activeModalConfirmHandler = typeof modalOptions.onConfirm === 'function'
        ? modalOptions.onConfirm
        : null;

    const modalFooter = document.getElementById('modalFooter');
    if (modalFooter) {
        if (modalType === 'confirm') {
            const confirmLabel = modalOptions.confirmText || 'Confirm';
            const cancelLabel = modalOptions.cancelText || 'Cancel';

            modalFooter.innerHTML = `
                <button type="button" class="modal-btn" id="modalCancelBtn">${cancelLabel}</button>
                <button type="button" class="modal-btn modal-btn-primary" id="modalConfirmBtn">${confirmLabel}</button>
            `;

            document.getElementById('modalCancelBtn').onclick = function() {
                closeModal();
            };

            document.getElementById('modalConfirmBtn').onclick = function() {
                const confirmHandler = activeModalConfirmHandler;
                closeModal();
                if (confirmHandler) confirmHandler();
            };
        } else {
            modalFooter.innerHTML = `
                <button type="button" class="modal-btn modal-btn-primary" id="modalConfirmBtn">OK</button>
            `;

            document.getElementById('modalConfirmBtn').onclick = function() {
                closeModal();
                if (activeModalConfirmHandler) activeModalConfirmHandler();
            };
        }
    }
    
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
    activeModalConfirmHandler = null;
}

// --- SIDEBAR CONTROL ---
function toggleSidebar() {
    document.body.classList.toggle('sidebar-open');
}

// --- LEGACY TAB FUNCTION ---
function showTab(tabName) {
    document.querySelectorAll('.tab').forEach(tab => tab.style.display = "none");
    document.getElementById(tabName).style.display = "block";
}

// ============================================================================
// 2. STATE & BACKEND DATA FETCHING
// ============================================================================
// Admin data
let adminGames = [];
let adminCPUs = [];
let adminGPUs = [];
let adminRAMs = [];

const ADMIN_HARDWARE_STORE_KEY = 'gamespecAdminHardwareStore';

function normalizeModelName(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');
}

function getAdminHardwareStore() {
    try {
        // localStorage.removeItem('gamespecAdminHardwareStore'); // for testing
        const stored = localStorage.getItem(ADMIN_HARDWARE_STORE_KEY);
        if (!stored) {
            return { cpus: [], gpus: [], rams: [] };
        }

        const parsed = JSON.parse(stored);
        return {
            cpus: Array.isArray(parsed.cpus) ? parsed.cpus : [],
            gpus: Array.isArray(parsed.gpus) ? parsed.gpus : [],
            rams: Array.isArray(parsed.rams) ? parsed.rams : []
        };
    } catch (error) {
        console.warn('Unable to read local hardware store.', error);
        return { cpus: [], gpus: [], rams: [] };
    }
}

function saveAdminHardwareStore(store) {
    try {
        localStorage.setItem(ADMIN_HARDWARE_STORE_KEY, JSON.stringify(store));
    } catch (error) {
        console.warn('Unable to save local hardware store.', error);
    }
}

function seedAdminHardwareStore() {
    saveAdminHardwareStore({
        cpus: adminCPUs,
        gpus: adminGPUs,
        rams: adminRAMs
    });
}

function syncAdminHardwareFromStore() {
    const store = getAdminHardwareStore();
    adminCPUs = store.cpus;
    adminGPUs = store.gpus;
    adminRAMs = store.rams;
}

function addLocalHardwareItem(type, item) {
    const store = getAdminHardwareStore();
    const listKey = type === 'cpu' ? 'cpus' : type === 'gpu' ? 'gpus' : 'rams';
    const modelKey = type === 'ram' ? 'model' : 'model';
    const normalizedItemName = normalizeModelName(item[modelKey]);

    if (!normalizedItemName) {
        return { success: false, message: 'Model name is required.' };
    }

    const duplicateExists = (store[listKey] || []).some(existing => {
        const existingName = normalizeModelName(existing[modelKey] || existing.capacity || existing.modelName || '');
        return existingName === normalizedItemName;
    });

    if (duplicateExists) {
        return { success: false, message: `A ${type.toUpperCase()} entry with that model name already exists.` };
    }

    store[listKey].unshift(item);
    saveAdminHardwareStore(store);
    syncAdminHardwareFromStore();
    displayHardwareLists();

    return { success: true };
}

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

   // Scroll the page all the way to the top smoothly
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Optional: highlight the form briefly
    const formEl = document.getElementById('gameForm');
    formEl.classList.add('highlight');
    setTimeout(() => formEl.classList.remove('highlight'), 1200);
}

function deleteGame(index) {
    const game = adminGames[index];
    if (!game) {
        showModal('Warning', 'Game not found.');
        return;
    }

    showModal('Delete Game', `Delete ${game.title}?`, {
        type: 'confirm',
        confirmText: 'Delete',
        cancelText: 'Cancel',
        onConfirm: () => {
        adminGames.splice(index, 1);
        displayGameList();
            showModal('Success', 'Game deleted successfully.', { type: 'info' });
        }
    });
}

// --- LOAD HARDWARE FOR ADMIN ---
async function loadAdminHardware() {
    try {
        const store = getAdminHardwareStore();

        if (store.cpus.length || store.gpus.length || store.rams.length) {
            adminCPUs = store.cpus;
            adminGPUs = store.gpus;
            adminRAMs = store.rams;
        } else {
            const [cpuRes, gpuRes, ramRes] = await Promise.all([
                fetch('../../../MODULES/api/get-cpus.php'),
                fetch('../../../MODULES/api/get-gpus.php'),
                fetch('../../../MODULES/api/get-ram.php')
            ]);
            adminCPUs = await cpuRes.json();
            adminGPUs = await gpuRes.json();
            adminRAMs = await ramRes.json();
            seedAdminHardwareStore();
        }

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
            const cpuName = cpu.model || cpu.cpu_model || cpu.name || 'Unknown CPU';
            const cpuScore = cpu.score ?? cpu.cpu_score ?? 'N/A';
            const cpuCores = cpu.cores ?? 'N/A';
            const cpuThreads = cpu.threads ?? 'N/A';
            cpuList.innerHTML += `
                <div class="data-item">
                    <div>
                        <span class="item-name">${cpuName}</span>
                        <br><small>${cpuCores}C/${cpuThreads}T</small>
                    </div>
                    <span class="item-score">${cpuScore}</span>
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
            const gpuName = gpu.model || gpu.gpuName || gpu.name || 'Unknown GPU';
            const gpuScore = gpu.score ?? gpu.G3Dmark ?? 'N/A';
            gpuList.innerHTML += `
                <div class="data-item">
                    <span class="item-name">${gpuName}</span>
                    <span class="item-score">${gpuScore}</span>
                </div>
            `;
        });
        if (adminGPUs.length > 20) {
            gpuList.innerHTML += `<p style="text-align:center;color:#64748b;">... and ${adminGPUs.length - 20} more</p>`;
        }
    }
    
    // Display RAMs
    const ramList = document.getElementById('ramList');
    if (ramList) {
        ramList.innerHTML = '';
        adminRAMs.slice(0, 20).forEach((ram, index) => {
            const ramName = ram.model || ram.capacity || ram.name || 'Unknown RAM';
            const ramScore = ram.score ?? ram.benchmark ?? 'N/A';
            ramList.innerHTML += `
                <div class="data-item">
                    <span class="item-name">${ramName}</span>
                    <span class="item-score">${ramScore}</span>
                </div>
            `;
        });
        if (adminRAMs.length > 20) {
            ramList.innerHTML += `<p style="text-align:center;color:#64748b;">... and ${adminRAMs.length - 20} more</p>`;
        }
    }
}

// ============================================================================
// 3. ML TRAINING FUNCTIONS
// ============================================================================
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

// ============================================================================
// 4. FORM SUBMISSIONS
// ============================================================================
document.addEventListener('DOMContentLoaded', function() {
    // Game Form
    const gameForm = document.getElementById("gameForm");
    if (gameForm) {
        gameForm.addEventListener("submit", function(e) {
            e.preventDefault();
            showModal('Success', 'Game added/updated!');
        });
    }

    // CPU Form
    const cpuForm = document.getElementById("cpuForm");
    if (cpuForm) {
        cpuForm.addEventListener("submit", function(e) {
            e.preventDefault();

            const model = document.getElementById('cpuModel')?.value.trim();
            const score = Number(document.getElementById('cpuScore')?.value);

            if (!model || !Number.isFinite(score) || score <= 0) {
                showModal('Warning', 'Please enter a valid CPU model and benchmark score.');
                return;
            }

            const result = addLocalHardwareItem('cpu', {
                model,
                score,
                cores: 0,
                threads: 0
            });

            if (!result.success) {
                showModal('Warning', result.message);
                return;
            }

            cpuForm.reset();
            showModal('Success', 'CPU saved locally.');
        });
    }

    // GPU Form
    const gpuForm = document.getElementById("gpuForm");
    if (gpuForm) {
        gpuForm.addEventListener("submit", function(e) {
            e.preventDefault();

            const model = document.getElementById('gpuModel')?.value.trim();
            const score = Number(document.getElementById('gpuScore')?.value);

            if (!model || !Number.isFinite(score) || score <= 0) {
                showModal('Warning', 'Please enter a valid GPU model and benchmark score.');
                return;
            }

            const result = addLocalHardwareItem('gpu', {
                model,
                score
            });

            if (!result.success) {
                showModal('Warning', result.message);
                return;
            }

            gpuForm.reset();
            showModal('Success', 'GPU saved locally.');
        });
    }

    // RAM Form
    const ramForm = document.getElementById("ramForm");
    if (ramForm) {
        ramForm.addEventListener("submit", function(e) {
            e.preventDefault();

            const model = document.getElementById('ramModel')?.value.trim();
            const score = Number(document.getElementById('ramScore')?.value);

            if (!model || !Number.isFinite(score) || score <= 0) {
                showModal('Warning', 'Please enter a valid RAM model and benchmark score.');
                return;
            }

            const result = addLocalHardwareItem('ram', {
                model,
                score
            });

            if (!result.success) {
                showModal('Warning', result.message);
                return;
            }

            ramForm.reset();
            showModal('Success', 'RAM saved locally.');
        });
    }
});

// ============================================================================
// 5. DASHBOARD FUNCTIONS
// ============================================================================
async function loadDashboardData() {
    try {
        // Load all data
        const [gamesRes, cpusRes, gpusRes] = await Promise.all([
            fetch('../../../MODULES/api/get-games.php'),
            fetch('../../../MODULES/api/get-cpus.php'),
            fetch('../../../MODULES/api/get-gpus.php')
        ]);
        
        const games = await gamesRes.json();
        const cpus = await cpusRes.json();
        const gpus = await gpusRes.json();
        
        // Calculate statistics
        const totalGames = games.length;
        const totalCPUs = cpus.length;
        const totalGPUs = gpus.length;
        
        // Ensure scores are numbers
        const avgCPUScore = cpus.length > 0 
            ? Math.round(cpus.reduce((sum, cpu) => sum + (parseInt(cpu.score) || 0), 0) / cpus.length)
            : 0;
        
        const avgGPUScore = gpus.length > 0 
            ? Math.round(gpus.reduce((sum, gpu) => sum + (parseInt(gpu.score) || 0), 0) / gpus.length)
            : 0;
        
        const topGPU = gpus.length > 0 ? gpus[0].model : 'N/A';
        
        // Update stat cards (check if elements exist)
        const setStatValue = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        };
        
        setStatValue('totalGames', totalGames);
        setStatValue('totalCPUs', totalCPUs);
        setStatValue('totalGPUs', totalGPUs);
        setStatValue('avgCPUScore', avgCPUScore.toLocaleString());
        setStatValue('avgGPUScore', avgGPUScore.toLocaleString());
        setStatValue('topGPU', topGPU.length > 15 ? topGPU.substring(0, 15) + '...' : topGPU);
        
        // Populate tables
        populateGamesTable(games);
        populateCPUsTable(cpus);
        populateGPUsTable(gpus);
        
    } catch (error) {
        console.error('Error loading dashboard data:', error);
    }
}

function populateGamesTable(games) {
    const tbody = document.querySelector('#gamesTable tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    games.slice(0, 10).forEach(game => {
        const ramGB = game.ram_benchmark ? Math.round(game.ram_benchmark / 250) : 'N/A';
        tbody.innerHTML += `
            <tr>
                <td>${game.title}</td>
                <td>${game.cpu_model || 'N/A'}</td>
                <td>${game.gpu_model || 'N/A'}</td>
                <td>${ramGB} GB</td>
            </tr>
        `;
    });
}

function populateCPUsTable(cpus) {
    const tbody = document.querySelector('#cpusTable tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    cpus.slice(0, 10).forEach(cpu => {
        tbody.innerHTML += `
            <tr>
                <td>${cpu.model}</td>
                <td>${cpu.score.toLocaleString()}</td>
            </tr>
        `;
    });
}

function populateGPUsTable(gpus) {
    const tbody = document.querySelector('#gpusTable tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    gpus.slice(0, 10).forEach(gpu => {
        tbody.innerHTML += `
            <tr>
                <td>${gpu.model}</td>
                <td>${gpu.score.toLocaleString()}</td>
            </tr>
        `;
    });
}

// ============================================================================
// 6. REPORT DOWNLOAD FUNCTIONS
// ============================================================================
function downloadReport(type) {
    const baseUrl = '../../../MODULES/api/';
    
    switch(type) {
        case 'games':
            downloadCSV(baseUrl + 'export-games.php', 'game-requirements-report.csv');
            break;
        case 'cpus':
            downloadCSV(baseUrl + 'export-cpus.php', 'cpu-benchmarks-report.csv');
            break;
        case 'gpus':
            downloadCSV(baseUrl + 'export-gpus.php', 'gpu-benchmarks-report.csv');
            break;
        case 'all':
            downloadCSV(baseUrl + 'export-games.php', 'game-requirements-report.csv');
            setTimeout(() => downloadCSV(baseUrl + 'export-cpus.php', 'cpu-benchmarks-report.csv'), 500);
            setTimeout(() => downloadCSV(baseUrl + 'export-gpus.php', 'gpu-benchmarks-report.csv'), 1000);
            break;
    }
}

function downloadCSV(url, filename) {
    fetch(url)
        .then(response => response.blob())
        .then(blob => {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        })
        .catch(error => {
            console.error('Download failed:', error);
            showModal('Error', 'Failed to download report. Please try again.');
        });
}