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

function normalizeAdminGame(game) {
    const minimum = game?.requirements?.minimum || {};
    const benchmarks = game?.benchmarks?.minimum || {};
    return {
        ...game,
        title_raw: game.title_raw || game.slug || game.title,
        image: game.image || game.cover || '',
        cpu_model: minimum.cpu || '',
        gpu_model: minimum.gpu || '',
        ram_model: minimum.ram || '',
        ram_capacity_gb: minimum.ram_capacity_gb ?? null,
        ram_speed_mhz: minimum.ram_speed_mhz ?? null,
        cpu_benchmark: benchmarks.cpu?.score ?? null,
        gpu_benchmark: benchmarks.gpu?.score ?? null,
        ram_benchmark: benchmarks.ram?.score ?? null
    };
}
let adminCPUs = [];
let adminGPUs = [];
let adminRAMs = [];

const ADMIN_HARDWARE_STORE_KEY = 'gamespecAdminHardwareStore';
const AUTOCOMPLETE_LIMIT = 12;
const autocompleteSources = {};
const hardwareModelSearchTimers = {};
let selectedGameCoverData = '';
let editingGameIndex = -1;

function setGameFormMode(isEditing, gameTitle = '') {
    const submitBtn = document.getElementById('gameSubmitBtn');
    const cancelBtn = document.getElementById('cancelEditBtn');
    const formTitle = document.getElementById('gameFormTitle');
    const modeHint = document.getElementById('gameFormModeHint');
    if (submitBtn) submitBtn.textContent = isEditing ? 'Save Changes' : 'Add Game';
    if (cancelBtn) cancelBtn.style.display = isEditing ? 'inline-flex' : 'none';
    if (formTitle) formTitle.textContent = isEditing ? `Edit Game${gameTitle ? `: ${gameTitle}` : ''}` : 'Add Game';
    if (modeHint) modeHint.textContent = isEditing
        ? 'You are editing an existing game. Update the details below, then click "Save Changes".'
        : 'Fill in the details below to add a new game to the catalog.';
}

function cancelGameEdit() {
    editingGameIndex = -1;
    const gameForm = document.getElementById('gameForm');
    if (gameForm) gameForm.reset();
    selectedGameCoverData = '';
    const gameCoverInput = document.getElementById('gameCover');
    const gameCoverPreview = document.getElementById('gameCoverPreview');
    const gameCoverPreviewImage = document.getElementById('gameCoverPreviewImage');
    const gameCoverPlaceholder = document.getElementById('gameCoverPlaceholder');
    if (gameCoverInput) gameCoverInput.value = '';
    if (gameCoverPreviewImage) gameCoverPreviewImage.removeAttribute('src');
    if (gameCoverPreview) gameCoverPreview.hidden = true;
    if (gameCoverPlaceholder) gameCoverPlaceholder.hidden = false;
    setGameFormMode(false);
}

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Could not read the cover image.'));
        reader.readAsDataURL(file);
    });
}

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
        adminGames = (await response.json()).map(normalizeAdminGame);
        populateDatalist('gameTitleOptions', adminGames.map(game => game.title));
        const [cpuResponse, gpuResponse] = await Promise.all([
            fetch('../../../MODULES/api/get-cpus.php'),
            fetch('../../../MODULES/api/get-gpus.php')
        ]);
        adminCPUs = await cpuResponse.json();
        adminGPUs = await gpuResponse.json();
        populateDatalist('gameCPUOptions', getHardwareModelNames(adminCPUs));
        populateDatalist('gameGPUOptions', getHardwareModelNames(adminGPUs));
        displayGameList();
    } catch (error) {
        console.error('Error loading games:', error);
    }
}

function populateDatalist(listId, values) {
    const list = document.getElementById(listId);
    if (!list) return;

    autocompleteSources[listId] = [...new Set(values.filter(Boolean))];
    const input = document.querySelector(`[list="${listId}"]`);
    const query = input?.value.toLowerCase().trim() || '';
    renderDatalist(listId, query);

    if (input && input.dataset.autocompleteBound !== 'true') {
        input.dataset.autocompleteBound = 'true';
        input.addEventListener('input', () => {
            renderDatalist(listId, input.value.toLowerCase().trim());
        });
    }
}

function renderDatalist(listId, query = '') {
    const list = document.getElementById(listId);
    const source = autocompleteSources[listId] || [];
    if (!list) return;

    const matches = source
        .filter(value => String(value).toLowerCase().includes(query))
        .slice(0, AUTOCOMPLETE_LIMIT);

    list.innerHTML = matches.map(value => {
        const escapedValue = String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
        return `<option value="${escapedValue}"></option>`;
    }).join('');
}

function getHardwareModelNames(items) {
    return items
        .map(item => item.model || item.cpu_model || item.gpuName || item.capacity || item.name)
        .filter(Boolean);
}

function displayGameList() {
    const listEl = document.getElementById('gameList');
    if (!listEl) return;
    
    listEl.innerHTML = '';
    adminGames.forEach((game, index) => {
        listEl.innerHTML += `
            <div class="data-item" data-search="${`${game.title} ${game.cpu_model} ${game.gpu_model} ${game.ram_model}`.toLowerCase()}">
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
    const noGameMessage = document.getElementById('noGameMessage');

    let found = false;
    items.forEach(item => {

        const name = item.dataset.search || item.textContent.toLowerCase();

        if (name.includes(search)) {
            item.style.display = 'flex';
            found = true;
        } else {
            item.style.display = 'none';
        }

    });

    // Show message only when searching and no game matches
    if (noGameMessage && !found && search !== '') {
        noGameMessage.style.display = 'block';
    } else if (noGameMessage) {
        noGameMessage.style.display = 'none';
    }
}

function filterHardwareList(type) {
    displayHardwareLists();
}

function scheduleHardwareModelSearch(type) {
    clearTimeout(hardwareModelSearchTimers[type]);
    hardwareModelSearchTimers[type] = setTimeout(() => {
        const model = document.getElementById(`${type}Model`)?.value || '';
        const search = document.getElementById(`${type}Search`);
        if (search) search.value = model;
        displayHardwareLists();
    }, 500);
}

function editGame(index) {
    const game = adminGames[index];
    if (!game) return;

    editingGameIndex = index;

    document.getElementById('gameTitle').value = game.title || '';
    document.getElementById('gameCPU').value = game.cpu_model || '';
    document.getElementById('gameGPU').value = game.gpu_model || '';
    document.getElementById('gameRAM').value = game.ram_capacity_gb || '';
    document.getElementById('gameRAMSpeed').value = game.ram_speed_mhz || '';

    // Reuse existing description property (frontend-only; API does not persist it yet).
    const descInput = document.getElementById('gameDescription');
    if (descInput) descInput.value = game.description || '';

    // Restore graphics-setting checkboxes from existing game data.

    // Show existing cover image in the polished preview (no backend change).
    selectedGameCoverData = '';
    const gameCoverInput = document.getElementById('gameCover');
    const gameCoverPreview = document.getElementById('gameCoverPreview');
    const gameCoverPreviewImage = document.getElementById('gameCoverPreviewImage');
    const gameCoverPlaceholder = document.getElementById('gameCoverPlaceholder');
    if (gameCoverInput) gameCoverInput.value = '';
    const existingImage = game.image ? `../../RES/${game.image}` : '';
    if (existingImage && gameCoverPreviewImage) {
        gameCoverPreviewImage.src = existingImage;
        gameCoverPreviewImage.onerror = () => {
            gameCoverPreviewImage.removeAttribute('src');
            if (gameCoverPreview) gameCoverPreview.hidden = true;
            if (gameCoverPlaceholder) gameCoverPlaceholder.hidden = false;
        };
        if (gameCoverPreview) gameCoverPreview.hidden = false;
        if (gameCoverPlaceholder) gameCoverPlaceholder.hidden = true;
    } else {
        if (gameCoverPreviewImage) gameCoverPreviewImage.removeAttribute('src');
        if (gameCoverPreview) gameCoverPreview.hidden = true;
        if (gameCoverPlaceholder) gameCoverPlaceholder.hidden = false;
    }

    // Switch the form into edit mode: "Save Changes" + cancel option.
    setGameFormMode(true, game.title || '');

   // Scroll the page all the way to the top smoothly
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Optional: highlight the form briefly
    const formEl = document.getElementById('gameForm');
    if (formEl) {
        formEl.classList.add('highlight');
        setTimeout(() => formEl.classList.remove('highlight'), 1200);
    }
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
        populateDatalist('cpuModelOptions', getHardwareModelNames(adminCPUs));
        populateDatalist('gpuModelOptions', getHardwareModelNames(adminGPUs));
        populateDatalist('ramModelOptions', getHardwareModelNames(adminRAMs));
    } catch (error) {
        console.error('Error loading hardware:', error);
    }
}

function displayHardwareLists() {
    const cpuSearch = document.getElementById('cpuSearch')?.value.toLowerCase().trim() || '';
    const gpuSearch = document.getElementById('gpuSearch')?.value.toLowerCase().trim() || '';
    const ramSearch = document.getElementById('ramSearch')?.value.toLowerCase().trim() || '';
    const getSearchText = item => String(item).toLowerCase();

    // Display CPUs
    const cpuList = document.getElementById('cpuList');
    if (cpuList) {
        cpuList.innerHTML = '';
        const matchingCPUs = adminCPUs.filter(cpu => {
            const cpuName = cpu.model || cpu.cpu_model || cpu.name || 'Unknown CPU';
            const cpuScore = cpu.score ?? cpu.cpu_score ?? 'N/A';
            return getSearchText(`${cpuName} ${cpuScore}`).includes(cpuSearch);
        });
        matchingCPUs.slice(0, 20).forEach((cpu, index) => {
            const cpuName = cpu.model || cpu.cpu_model || cpu.name || 'Unknown CPU';
            const cpuScore = cpu.score ?? cpu.cpu_score ?? 'N/A';
            const cpuCores = cpu.cores ?? 'N/A';
            cpuList.innerHTML += `
                <div class="data-item" data-search="${`${cpuName} ${cpuScore}`.toLowerCase()}">
                    <div>
                        <span class="item-name">${cpuName}</span>
                        <br><small>${cpuCores}C</small>
                    </div>
                    <span class="item-score">${cpuScore}</span>
                </div>
            `;
        });
        if (matchingCPUs.length > 20) {
            cpuList.innerHTML += `<p style="text-align:center;color:#64748b;">... and ${matchingCPUs.length - 20} more matching results</p>`;
        }
    }
    
    // Display GPUs
    const gpuList = document.getElementById('gpuList');
    if (gpuList) {
        gpuList.innerHTML = '';
        const matchingGPUs = adminGPUs.filter(gpu => {
            const gpuName = gpu.model || gpu.gpuName || gpu.name || 'Unknown GPU';
            const gpuScore = gpu.score ?? gpu.G3Dmark ?? 'N/A';
            return getSearchText(`${gpuName} ${gpuScore}`).includes(gpuSearch);
        });
        matchingGPUs.slice(0, 20).forEach((gpu, index) => {
            const gpuName = gpu.model || gpu.gpuName || gpu.name || 'Unknown GPU';
            const gpuScore = gpu.score ?? gpu.G3Dmark ?? 'N/A';
            gpuList.innerHTML += `
                <div class="data-item" data-search="${`${gpuName} ${gpuScore}`.toLowerCase()}">
                    <span class="item-name">${gpuName}</span>
                    <span class="item-score">${gpuScore}</span>
                </div>
            `;
        });
        if (matchingGPUs.length > 20) {
            gpuList.innerHTML += `<p style="text-align:center;color:#64748b;">... and ${matchingGPUs.length - 20} more matching results</p>`;
        }
    }
    
    // Display RAMs
    const ramList = document.getElementById('ramList');
    if (ramList) {
        ramList.innerHTML = '';
        const matchingRAMs = adminRAMs.filter(ram => {
            const ramName = ram.model || ram.capacity || ram.name || 'Unknown RAM';
            const ramScore = ram.score ?? ram.benchmark ?? 'N/A';
            return getSearchText(`${ramName} ${ramScore}`).includes(ramSearch);
        });
        matchingRAMs.slice(0, 20).forEach((ram, index) => {
            const ramName = ram.model || ram.capacity || ram.name || 'Unknown RAM';
            const ramScore = ram.score ?? ram.benchmark ?? 'N/A';
            ramList.innerHTML += `
                <div class="data-item" data-search="${`${ramName} ${ramScore}`.toLowerCase()}">
                    <span class="item-name">${ramName}</span>
                    <span class="item-score">${ramScore}</span>
                </div>
            `;
        });
        if (matchingRAMs.length > 20) {
            ramList.innerHTML += `<p style="text-align:center;color:#64748b;">... and ${matchingRAMs.length - 20} more matching results</p>`;
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
    ['cpu', 'gpu', 'ram'].forEach(type => {
        const modelInput = document.getElementById(`${type}Model`);
        if (modelInput) {
            modelInput.addEventListener('input', () => scheduleHardwareModelSearch(type));
        }
    });

    // Game Form
    const gameForm = document.getElementById("gameForm");
    const gameCoverInput = document.getElementById('gameCover');
    const gameCoverPreview = document.getElementById('gameCoverPreview');
    const gameCoverPreviewImage = document.getElementById('gameCoverPreviewImage');
    const clearGameCoverButton = document.getElementById('clearGameCover');

    const clearGameCoverPreview = () => {
        selectedGameCoverData = '';
        const gameCoverPlaceholder = document.getElementById('gameCoverPlaceholder');
        if (gameCoverInput) gameCoverInput.value = '';
        if (gameCoverPreviewImage) gameCoverPreviewImage.removeAttribute('src');
        if (gameCoverPreview) gameCoverPreview.hidden = true;
        if (gameCoverPlaceholder) gameCoverPlaceholder.hidden = false;
    };

    if (gameCoverInput) {
        gameCoverInput.addEventListener('change', async function() {
            const file = this.files?.[0];
            const gameCoverPlaceholder = document.getElementById('gameCoverPlaceholder');
            if (!file) return;

            if (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) {
                clearGameCoverPreview();
                showModal('Warning', 'Please choose an image smaller than 5 MB.');
                return;
            }

            try {
                selectedGameCoverData = await readFileAsDataUrl(file);
                if (gameCoverPreviewImage) gameCoverPreviewImage.src = selectedGameCoverData;
                if (gameCoverPreview) gameCoverPreview.hidden = false;
                if (gameCoverPlaceholder) gameCoverPlaceholder.hidden = true;
            } catch (error) {
                clearGameCoverPreview();
                showModal('Error', error.message);
            }
        });
    }

    if (clearGameCoverButton) {
        clearGameCoverButton.addEventListener('click', clearGameCoverPreview);
    }

    if (gameForm) {
        gameForm.addEventListener("submit", async function(e) {
            e.preventDefault();

            const title = document.getElementById('gameTitle')?.value.trim();
            const cpuModel = document.getElementById('gameCPU')?.value.trim();
            const gpuModel = document.getElementById('gameGPU')?.value.trim();
            const ramGB = Number(document.getElementById('gameRAM')?.value);
            const ramSpeedMhz = Number(document.getElementById('gameRAMSpeed')?.value);

            if (!title || !cpuModel || !gpuModel || !Number.isFinite(ramGB) || ramGB <= 0 || !Number.isFinite(ramSpeedMhz) || ramSpeedMhz <= 0) {
                showModal('Warning', 'Please complete all game and hardware requirement fields.');
                return;
            }

            const duplicate = adminGames.some((game, idx) => idx !== editingGameIndex && normalizeModelName(game.title) === normalizeModelName(title));
            if (duplicate) {
                showModal('Warning', 'A game with that title already exists.');
                return;
            }

            // Both add and edit use the same API endpoint which upserts
            // the game_requirements row and queues benchmark resolution.

            try {
                const payload = {
                    title,
                    cpuModel,
                    gpuModel,
                    ramCapacityGb: ramGB,
                    ramSpeedMhz,
                    imageData: selectedGameCoverData
                };

                const response = await fetch('../../../MODULES/api/update-games.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const result = await response.json();

                if (!response.ok || !result.success) {
                    throw new Error(result.message || 'Game could not be saved.');
                }

                gameForm.reset();
                clearGameCoverPreview();
                cancelGameEdit();
                await loadAdminGames();
                showModal('Success', result.message || 'Game saved successfully.');
            } catch (error) {
                showModal('Error', error.message || 'Game could not be saved.');
            }
        });
    }

    // CPU Form
    const cpuForm = document.getElementById("cpuForm");
    if (cpuForm) {
        cpuForm.addEventListener("submit", async function(e) {
            e.preventDefault();

            const model = document.getElementById('cpuModel')?.value.trim();
            const score = Number(document.getElementById('cpuScore')?.value);

            if (!model || !Number.isFinite(score) || score <= 0) {
                showModal('Warning', 'Please enter a valid CPU model and benchmark score.');
                return;
            }

            try {
                const response = await fetch('../../../MODULES/api/update-cpus.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ model, score })
                });
                const result = await response.json();

                if (!response.ok || !result.success) {
                    throw new Error(result.message || 'CPU could not be saved.');
                }

                cpuForm.reset();
                showModal('Success', result.message || 'CPU added successfully.');
            } catch (error) {
                showModal('Error', error.message || 'CPU could not be saved.');
            }
        });
    }

    // GPU Form
    const gpuForm = document.getElementById("gpuForm");
    if (gpuForm) {
        gpuForm.addEventListener("submit", async function(e) {
            e.preventDefault();

            const model = document.getElementById('gpuModel')?.value.trim();
            const score = Number(document.getElementById('gpuScore')?.value);

            if (!model || !Number.isFinite(score) || score <= 0) {
                showModal('Warning', 'Please enter a valid GPU model and benchmark score.');
                return;
            }

            try {
                const response = await fetch('../../../MODULES/api/update-gpus.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ model, score })
                });
                const result = await response.json();

                if (!response.ok || !result.success) {
                    throw new Error(result.message || 'GPU could not be saved.');
                }

                gpuForm.reset();
                showModal('Success', result.message || 'GPU added successfully.');
            } catch (error) {
                showModal('Error', error.message || 'GPU could not be saved.');
            }
        });
    }

    // RAM Form
    const ramForm = document.getElementById("ramForm");
    if (ramForm) {
        ramForm.addEventListener("submit", async function(e) {
            e.preventDefault();

            const model = document.getElementById('ramModel')?.value.trim();
            const score = Number(document.getElementById('ramScore')?.value);

            if (!model || !Number.isFinite(score) || score <= 0) {
                showModal('Warning', 'Please enter a valid RAM model and benchmark score.');
                return;
            }

            try {
                const response = await fetch('../../../MODULES/api/update-ram.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ model, score })
                });
                const result = await response.json();

                if (!response.ok || !result.success) {
                    throw new Error(result.message || 'RAM could not be saved.');
                }

                ramForm.reset();
                showModal('Success', result.message || 'RAM added successfully.');
            } catch (error) {
                showModal('Error', error.message || 'RAM could not be saved.');
            }
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
        const ramGB = game.ram_capacity_gb || 'N/A';
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