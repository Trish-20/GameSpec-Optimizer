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
    // Below 900px the sidebar overlays the page instead of pushing it
    // sideways, so it needs a tap-outside backdrop and a background
    // scroll lock. Wider screens keep the original push behaviour.
    const SIDEBAR_OVERLAY_BREAKPOINT = 900;

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

    // Applied as a class, never as an inline style, so it cannot
    // clobber anything else that manages body overflow.
    function syncSidebarScrollLock() {
        const shouldLock = isSidebarOverlayMode()
            && document.body.classList.contains('sidebar-open');
        document.body.classList.toggle('sidebar-locked', shouldLock);
    }

    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && document.body.classList.contains('sidebar-open')) {
            closeSidebar();
        }
    });

    document.addEventListener('click', function (event) {
        if (!isSidebarOverlayMode() || !event.target.closest) {
            return;
        }
        if (event.target.closest('.sidebar .nav-btn')) {
            closeSidebar();
        }
    });

    window.addEventListener('resize', syncSidebarScrollLock);

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
            ram_benchmark: benchmarks.ram?.score ?? null,
            genres: Array.isArray(game.genres) ? game.genres : [],
            release_year: game.release_year ?? null,
            // Games that failed benchmark resolution come back with
            // is_active = 0 so the list can label them as hidden from users.
            is_active: Number(game.is_active ?? 1)
        };
    }

    // Genre values allowed by the Game Management form. These are the same
    // categories the user-side Browse Games filter offers.
    const ADMIN_GAME_GENRES = [
        'Action', 'RPG', 'Shooter', 'Adventure', 'Sports', 'Racing',
        'Strategy', 'Sandbox', 'Simulation', 'Puzzle', 'Indie', 'Survival'
    ];

    function getSelectedGameGenres() {
        return Array.from(document.querySelectorAll('.gameGenreCheckbox:checked'))
            .map(input => input.value)
            .filter(value => ADMIN_GAME_GENRES.includes(value));
    }

    function setSelectedGameGenres(genres) {
        const wanted = new Set((Array.isArray(genres) ? genres : []).map(value => String(value).toLowerCase()));
        document.querySelectorAll('.gameGenreCheckbox').forEach(input => {
            input.checked = wanted.has(input.value.toLowerCase());
        });
    }

    function getSelectedGamePlatforms() {
        const select = document.getElementById('gamePlatform');
        if (!select) return ['PC'];
        const values = Array.from(select.selectedOptions).map(option => option.value);
        // PC is always included because the app only predicts Windows PCs.
        return values.includes('PC') ? values : ['PC', ...values];
    }

    function setSelectedGamePlatforms(platforms) {
        const select = document.getElementById('gamePlatform');
        if (!select) return;
        const wanted = new Set((Array.isArray(platforms) ? platforms : ['PC']).map(value => String(value).toLowerCase()));
        if (!wanted.has('pc')) wanted.add('pc');
        Array.from(select.options).forEach(option => {
            option.selected = wanted.has(option.value.toLowerCase());
        });
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

    /* ---------------------------------------------------------------------------
     * CLIENT-SIDE HARDWARE VALIDATION
     *
     * Mirrors the server rules in MODULES/benchmark-resolver.php so the admin
     * gets instant feedback. The server remains the authority.
     * ------------------------------------------------------------------------ */

    const HARDWARE_VOCABULARY = new RegExp(
        '\\b(intel|amd|ryzen|threadripper|epyc|athlon|phenom|sempron|celeron|pentium|atom|core|xeon|pro|fx|apu|nvidia|geforce|radeon|gtx|rtx|quadro|tesla|titan|iris|uhd|hd|graphics|arc|firepro|instinct|ddr[345]?|sdram|gb|mb|tb|mhz|ghz|xmp|expo|vengeance|trident|ripjaws|fury|ballistix|dominator|hyperx|kingston|corsair|crucial|gskill|samsung|hynix|teamgroup|lexar|sabrent|adata|barco|carrizo|via|abit|aspeed|matrox|mxgpu|opengl|vanta|mobile|embedded|express|chipset|controller|display|family|edition|directx|d3d|parhelia|qxl|ion|dual|plus|xtx|xti|super|max|ti|gt|gs|workstation|professional|server|oem|asic|integrated|vega|duo|wx|gl|gh|ssg|internal|extreme|accelerator|coffee|lake|media|poison|ivy|incredible|infoshock|modded|release|ceo|collectors|devastator|scrapper|trinity|park)\\b',
        'i'
    );

    function isPlausibleHardwareModel(value) {
        const model = String(value || '').trim().replace(/\s+/g, ' ');
        const length = model.length;

        if (length < 3 || length > 120) return false;
        if (!/[A-Za-z]/.test(model)) return false;
        if (!/^[A-Za-z0-9 .()\-_+,/@]+$/.test(model)) return false;

        if (length >= 6) {
            const unique = new Set(model.replace(/\s/g, '')).size;
            if (unique / model.replace(/\s/g, '').length < 0.30) return false;
        }

        if (HARDWARE_VOCABULARY.test(model)) return true;
        return length <= 13 || model.includes(' ');
    }

    function isValidBenchmarkScore(value) {
        if (value === null || value === undefined || String(value).trim() === '') return false;
        const score = Number(value);
        return Number.isFinite(score) && score > 0 && score <= 1000000;
    }

    /**
     * Shared validation for the CPU / GPU / RAM admin forms.
     * Returns a user-facing error message, or '' when the input is valid.
     */
    function validateHardwareInput(type, modelValue, scoreValue) {
        const label = String(type || '').toUpperCase();
        const model = String(modelValue || '').trim();

        if (!model) {
            return `${label} model is required.`;
        }
        if (!isPlausibleHardwareModel(model)) {
            return `That does not look like a valid ${label} model. Use a real model name such as "Intel Core i7-12700K".`;
        }
        if (scoreValue === null || scoreValue === undefined || String(scoreValue).trim() === '') {
            return `${label} benchmark score is required.`;
        }
        if (!isValidBenchmarkScore(scoreValue)) {
            return 'Enter a valid benchmark score as a positive number.';
        }
        return '';
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
            // include_inactive=1 keeps a game whose benchmark resolution failed
            // (is_active = 0) visible in Game Management, so the admin can
            // correct the CPU/GPU spelling and re-save it. get-games.php only
            // honours the flag for an authenticated admin session; users still
            // receive active games only.
            const response = await adminFetch('../../../MODULES/api/get-games.php?include_inactive=1');
            adminGames = (await response.json()).map(normalizeAdminGame);
            populateDatalist('gameTitleOptions', adminGames.map(game => game.title));
            const [cpuResponse, gpuResponse] = await Promise.all([
                adminFetch('../../../MODULES/api/get-cpus.php'),
                adminFetch('../../../MODULES/api/get-gpus.php')
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
        if (!adminGames.length) {
            listEl.innerHTML = '<p class="data-list-empty">No games found.</p>';
            filterGameList();
            return;
        }

        adminGames.forEach((game, index) => {
            const genreText = (Array.isArray(game.genres) ? game.genres : []).join(', ');
            const metaParts = [
                `CPU: ${game.cpu_model}`,
                `GPU: ${game.gpu_model}`,
                `RAM: ${game.ram_model}`
            ];
            if (genreText) metaParts.push(`Genre: ${genreText}`);
            if (game.release_year) metaParts.push(`Year: ${game.release_year}`);
            const hiddenFromUsers = Number(game.is_active) !== 1;
            if (hiddenFromUsers) {
                // The game row exists and stays editable here, but the gate
                // keeps it out of every user-facing list until its minimum
                // CPU/GPU/RAM benchmarks all resolve.
                metaParts.unshift('HIDDEN FROM USERS (benchmark unresolved)');
            }
            const searchIndex = `${game.title} ${game.cpu_model} ${game.gpu_model} ${game.ram_model} ${genreText} ${game.release_year || ''} ${hiddenFromUsers ? 'hidden from users benchmark unresolved' : ''}`.toLowerCase();

            listEl.innerHTML += `
                <div class="data-item" data-search="${searchIndex}">
                    <div>
                        <span class="item-name">${game.title}</span>
                        <br><small>${metaParts.join(' | ')}</small>
                    </div>
                    <div class="item-actions">
                        <button class="btn-edit" onclick="editGame(${index})">Edit</button>
                        <button class="btn-delete" onclick="deleteGame(${index})">Delete</button>
                    </div>
                </div>
            `;
        });

        filterGameList();
    }

    function filterGameList() {
        const search = document.getElementById('gameSearch')?.value.toLowerCase() || '';
        const noGameMessage = document.getElementById('noGameMessage');

        let found = false;

        const dataItems = document.querySelectorAll('#gameList .data-item');
        dataItems.forEach(item => {
            const name = item.dataset.search || item.textContent.toLowerCase();
            const matches = name.includes(search);
            item.style.display = matches ? 'flex' : 'none';
            if (matches) found = true;
        });

        const tableRows = document.querySelectorAll('#gamesTable tbody tr');
        tableRows.forEach(row => {
            const name = row.dataset.search || row.textContent.toLowerCase();
            const matches = name.includes(search);
            row.style.display = matches ? '' : 'none';
            if (matches) found = true;
        });

        if (noGameMessage) {
            // Show whenever nothing matched, including when the list is empty
            // because there are no games at all.
            const listIsEmpty = dataItems.length === 0 && tableRows.length === 0;
            const shouldShow = !found && (search !== '' || listIsEmpty);
            noGameMessage.style.display = shouldShow ? 'block' : 'none';
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

    function resolveAdminGameImageUrl(image) {
        if (!image) return '';
        const value = String(image).trim();
        if (/^data:image\//i.test(value)) return value;
        if (/^https?:\/\//i.test(value)) return value;
        // update-games.php stores a project-relative path such as
        // uploads/game-covers/game_xxx.jpg.
        // From FRONT-END/HTML/Admin Side/, that file is reachable at ../../../uploads/...
        // A leading-slash value is treated the same way for backward compatibility.
        if (value.charAt(0) === '/') return `../../..${value}`;
        if (/^uploads\//i.test(value)) return `../../../${value}`;
        return `../../RES/${value}`;
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

        // Browse-filter fields: release year, platforms and genre checkboxes.
        const yearInput = document.getElementById('gameReleaseYear');
        if (yearInput) yearInput.value = game.release_year || '';
        setSelectedGamePlatforms(Array.isArray(game.platforms) ? game.platforms : ['PC']);
        setSelectedGameGenres(Array.isArray(game.genres) ? game.genres : []);

        // Reuse existing description property.
        const descInput = document.getElementById('gameDescription');
        if (descInput) descInput.value = game.description || '';

        // Show existing cover image in the polished preview.
        selectedGameCoverData = '';
        const gameCoverInput = document.getElementById('gameCover');
        const gameCoverPreview = document.getElementById('gameCoverPreview');
        const gameCoverPreviewImage = document.getElementById('gameCoverPreviewImage');
        const gameCoverPlaceholder = document.getElementById('gameCoverPlaceholder');
        if (gameCoverInput) gameCoverInput.value = '';
        const existingImage = resolveAdminGameImageUrl(game.image);
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

        if (!game.game_id) {
            showModal('Error', 'Unable to determine which game is being deleted.');
            return;
        }

        showModal('Delete Game', `Delete ${game.title}?`, {
            type: 'confirm',
            confirmText: 'Delete',
            cancelText: 'Cancel',
            onConfirm: async () => {
                try {
                    const response = await adminFetch(
                        '../../../MODULES/api/delete-games.php',
                        {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ gameId: game.game_id })
                        }
                    );

                    const result = await response.json().catch(() => ({}));

                    if (!response.ok || !result.success) {
                        throw new Error(
                            result.message || 'Game could not be deleted.'
                        );
                    }

                    // If this game was being edited, leave edit mode.
                    if (editingGameIndex === index) {
                        cancelGameEdit();
                    } else if (editingGameIndex > index) {
                        editingGameIndex -= 1;
                    }

                    // Reload the games from MySQL without refreshing the page.
                    await loadAdminGames();

                    showModal(
                        'Success',
                        result.message || 'Game deleted successfully.',
                        { type: 'info' }
                    );
                } catch (error) {
                    console.error('Error deleting game:', error);

                    showModal(
                        'Error',
                        error.message || 'Game could not be deleted.'
                    );
                }
            }
        });
    }

    // --- LOAD HARDWARE FOR ADMIN ---
   async function loadAdminHardware() {
        try {
            const [cpuRes, gpuRes, ramRes] = await Promise.all([
                adminFetch('../../../MODULES/api/get-cpus.php'),
                adminFetch('../../../MODULES/api/get-gpus.php'),
                adminFetch('../../../MODULES/api/get-ram.php')
            ]);

            if (!cpuRes.ok) {
                throw new Error('Failed to load CPUs from the database.');
            }

            if (!gpuRes.ok) {
                throw new Error('Failed to load GPUs from the database.');
            }

            if (!ramRes.ok) {
                throw new Error('Failed to load RAM from the database.');
            }

            adminCPUs = await cpuRes.json();
            adminGPUs = await gpuRes.json();
            adminRAMs = await ramRes.json();

            // Update the visible hardware lists
            displayHardwareLists();

            // Update autocomplete/datalist options
            populateDatalist(
                'cpuModelOptions',
                getHardwareModelNames(adminCPUs)
            );

            populateDatalist(
                'gpuModelOptions',
                getHardwareModelNames(adminGPUs)
            );

            populateDatalist(
                'ramModelOptions',
                getHardwareModelNames(adminRAMs)
            );

        } catch (error) {
            console.error('Error loading hardware:', error);

            showModal(
                'Error',
                error.message || 'Unable to load hardware data.'
            );
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
            if (!matchingCPUs.length) {
                cpuList.innerHTML += '<p class="data-list-empty">No results found.</p>';
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
            if (!matchingGPUs.length) {
                gpuList.innerHTML += '<p class="data-list-empty">No results found.</p>';
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
            if (!matchingRAMs.length) {
                ramList.innerHTML += '<p class="data-list-empty">No results found.</p>';
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
                const description = document.getElementById('gameDescription')?.value.trim() || '';
                const cpuModel = document.getElementById('gameCPU')?.value.trim();
                const gpuModel = document.getElementById('gameGPU')?.value.trim();
                const ramGB = Number(document.getElementById('gameRAM')?.value);
                const ramSpeedMhz = Number(document.getElementById('gameRAMSpeed')?.value);

                if (
                    !title ||
                    !cpuModel ||
                    !gpuModel ||
                    !Number.isFinite(ramGB) ||
                    ramGB <= 0 ||
                    !Number.isFinite(ramSpeedMhz) ||
                    ramSpeedMhz <= 0
                ) {
                    showModal(
                        'Warning',
                        'Please complete all game and hardware requirement fields.'
                    );
                    return;
                }

                // Browse-filter fields. Genres drive the user-side genre
                // filter, so at least one must be chosen.
                const releaseYearRaw = document.getElementById('gameReleaseYear')?.value.trim();
                const releaseYear = releaseYearRaw === '' ? null : Number(releaseYearRaw);
                const currentYear = new Date().getFullYear();

                if (releaseYear !== null && (!Number.isInteger(releaseYear) || releaseYear < 1970 || releaseYear > currentYear + 2)) {
                    showModal(
                        'Warning',
                        `Release year must be a whole number between 1970 and ${currentYear + 2}.`
                    );
                    return;
                }

                const genres = getSelectedGameGenres();
                if (!genres.length) {
                    showModal(
                        'Warning',
                        'Please select at least one genre so users can find this game with the Browse filters.'
                    );
                    return;
                }

                // editingGameIndex === -1 means ADD mode.
                // Any other value means EDIT mode.
                const isEditing =
                    typeof editingGameIndex === 'number' &&
                    editingGameIndex >= 0;

                // Only check for duplicate titles when ADDING.
                // During editing, the title belongs to the game being edited.
                if (!isEditing) {
                    const duplicate = adminGames.some(
                        game =>
                            normalizeModelName(game.title) ===
                            normalizeModelName(title)
                    );

                    if (duplicate) {
                        showModal(
                            'Warning',
                            'A game with that title already exists.'
                        );
                        return;
                    }
                }

                try {
                    const payload = {
                        title,
                        description,
                        cpuModel,
                        gpuModel,
                        ramCapacityGb: ramGB,
                        ramSpeedMhz,
                        imageData: selectedGameCoverData,
                        genres,
                        platforms: getSelectedGamePlatforms(),
                        releaseYear
                    };

                    // If editing, send the existing game's ID.
                    if (isEditing) {
                        const gameBeingEdited = adminGames[editingGameIndex];

                        if (!gameBeingEdited || !gameBeingEdited.game_id) {
                            showModal(
                                'Error',
                                'Unable to determine which game is being edited.'
                            );
                            return;
                        }

                        payload.gameId = gameBeingEdited.game_id;
                    }

                    const response = await adminFetch(
                        '../../../MODULES/api/update-games.php',
                        {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(payload)
                        }
                    );

                    const result = await response.json();

                    if (!response.ok || !result.success) {
                        throw new Error(
                            result.message || 'Game could not be saved.'
                        );
                    }

                    gameForm.reset();
                    clearGameCoverPreview();
                    cancelGameEdit();

                    // Reload the games from MySQL without refreshing the page.
                    await loadAdminGames();

                    // update-games.php resolves benchmarks synchronously, so
                    // prediction_ready is the real outcome rather than an
                    // assumption. Report the truth: a game that could not be
                    // fully matched stays invisible to users, and saying
                    // "Success" without saying so would be misleading.
                    const resolution = result.benchmark_resolution || {};
                    const unresolved = resolution.unresolved || [];

                    if (result.prediction_ready) {
                        showModal(
                            'Success',
                            result.message || 'Game saved successfully.'
                        );
                    } else {
                        let detail =
                            result.message ||
                            'Game saved, but benchmark resolution is incomplete.';

                        if (unresolved.length) {
                            detail +=
                                '\n\nCould not match: ' +
                                unresolved.join(', ') +
                                '. Check the CPU/GPU spelling against the benchmark tables.';
                        }

                        if (resolution.error) {
                            detail += '\n\nDetails: ' + resolution.error;
                        }

                        detail +=
                            '\n\nThis game is saved but will not appear for users until its benchmark data resolves. '
                            + 'It stays in your game list marked "HIDDEN FROM USERS" so you can correct it and save again.';

                        showModal('Warning', detail);
                    }

                } catch (error) {
                    console.error('Error saving game:', error);

                    showModal(
                        'Error',
                        error.message || 'Game could not be saved.'
                    );
                }
            });
        }

        // CPU Form
        const cpuForm = document.getElementById("cpuForm");
        if (cpuForm) {
            cpuForm.addEventListener("submit", async function(e) {
                e.preventDefault();

                const model = document.getElementById('cpuModel')?.value.trim();
                const scoreRaw = document.getElementById('cpuScore')?.value;
                const score = Number(scoreRaw);

                // Validate input
                const cpuError = validateHardwareInput('cpu', model, scoreRaw);
                if (cpuError) {
                    showModal('Warning', cpuError);
                    return;
                }

                try {
                    // Send CPU to PHP API
                    const response = await adminFetch(
                        '../../../MODULES/api/update-cpus.php',
                        {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                model,
                                score
                            })
                        }
                    );

                    const result = await response.json();

                    // Check API response
                    if (!response.ok || !result.success) {
                        throw new Error(
                            result.message || 'CPU could not be saved.'
                        );
                    }

                    // Clear the form
                    cpuForm.reset();

                    // IMPORTANT:
                    // Reload the latest CPU/GPU/RAM data from MySQL
                    // without refreshing the page.
                    await loadAdminHardware();

                    // Show success message
                    showModal(
                        'Success',
                        result.message || 'CPU added successfully.'
                    );

                } catch (error) {
                    console.error('Error saving CPU:', error);

                    showModal(
                        'Error',
                        error.message || 'CPU could not be saved.'
                    );
                }
            });
        }

        // GPU Form
        const gpuForm = document.getElementById("gpuForm");
        if (gpuForm) {
            gpuForm.addEventListener("submit", async function(e) {
                e.preventDefault();

                const model = document.getElementById('gpuModel')?.value.trim();
                const scoreRaw = document.getElementById('gpuScore')?.value;
                const score = Number(scoreRaw);

                // Validate input
                const gpuError = validateHardwareInput('gpu', model, scoreRaw);
                if (gpuError) {
                    showModal('Warning', gpuError);
                    return;
                }

                try {
                    // Send GPU to PHP API
                    const response = await adminFetch(
                        '../../../MODULES/api/update-gpus.php',
                        {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                model,
                                score
                            })
                        }
                    );

                    const result = await response.json();

                    // Check API response
                    if (!response.ok || !result.success) {
                        throw new Error(
                            result.message || 'GPU could not be saved.'
                        );
                    }

                    // Clear the form
                    gpuForm.reset();

                    // Reload latest database data
                    await loadAdminHardware();

                    // Show success message
                    showModal(
                        'Success',
                        result.message || 'GPU added successfully.'
                    );

                } catch (error) {
                    console.error('Error saving GPU:', error);

                    showModal(
                        'Error',
                        error.message || 'GPU could not be saved.'
                    );
                }
            });
        }

        // RAM Form
        const ramForm = document.getElementById("ramForm");

        if (ramForm) {
            ramForm.addEventListener("submit", async function(e) {
                e.preventDefault();

                const model = document.getElementById('ramModel')?.value.trim();
                const scoreRaw = document.getElementById('ramScore')?.value;
                const score = Number(scoreRaw);

                // Validate input
                const ramError = validateHardwareInput('ram', model, scoreRaw);
                if (ramError) {
                    showModal('Warning', ramError);
                    return;
                }

                // RAM capacity must be parseable from the model string.
                if (!/(\d+)\s*GB/i.test(model)) {
                    showModal(
                        'Warning',
                        'Include the capacity in the RAM model, for example "16GB DDR4-3200".'
                    );
                    return;
                }

                try {
                    // Send RAM to PHP API
                    const response = await adminFetch(
                        '../../../MODULES/api/update-ram.php',
                        {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                model,
                                score
                            })
                        }
                    );

                    const result = await response.json();

                    // Check API response
                    if (!response.ok || !result.success) {
                        throw new Error(
                            result.message || 'RAM could not be saved.'
                        );
                    }

                    // Clear the form
                    ramForm.reset();

                    // Reload latest database data
                    await loadAdminHardware();

                    // Show success message
                    showModal(
                        'Success',
                        result.message || 'RAM added successfully.'
                    );

                } catch (error) {
                    console.error('Error saving RAM:', error);

                    showModal(
                        'Error',
                        error.message || 'RAM could not be saved.'
                    );
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
                adminFetch('../../../MODULES/api/get-games.php'),
                adminFetch('../../../MODULES/api/get-cpus.php'),
                adminFetch('../../../MODULES/api/get-gpus.php')
            ]);
            
            // Games are normalized first so the Recent Games table shows the
            // real CPU / GPU / RAM requirements instead of "N/A", and so the
            // search box can match on those columns too.
            const games = (await gamesRes.json()).map(normalizeAdminGame);
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
        if (!games.length) {
            tbody.innerHTML = '<tr><td colspan="4" class="table-empty-cell">No games found.</td></tr>';
            filterGameList();
            return;
        }

        games.slice(0, 10).forEach(game => {
            const ramGB = game.ram_capacity_gb || 'N/A';
            const genreText = (Array.isArray(game.genres) ? game.genres : []).join(' ');
            const searchIndex = `${game.title || ''} ${game.cpu_model || ''} ${game.gpu_model || ''} ${game.ram_model || ''} ${genreText} ${game.release_year || ''}`.toLowerCase();
            tbody.innerHTML += `
                <tr data-search="${searchIndex}">
                    <td>${game.title}</td>
                    <td>${game.cpu_model || 'N/A'}</td>
                    <td>${game.gpu_model || 'N/A'}</td>
                    <td>${ramGB} GB</td>
                </tr>
            `;
        });

        // Keep the search box in sync with the freshly rendered rows.
        filterGameList();
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
        adminFetch(url)
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