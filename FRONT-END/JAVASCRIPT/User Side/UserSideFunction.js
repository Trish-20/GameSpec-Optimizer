// Fake example game data
const games = [
    { title: "Cyberpunk 2077", cpu: "i5", gpu: "GTX 1060", ram: 8 },
    { title: "Valorant", cpu: "i3", gpu: "GTX 750", ram: 4 },
    { title: "GTA V", cpu: "i5", gpu: "GTX 660", ram: 8 },
    { title: "Red Dead Redemption 2", cpu: "i7", gpu: "RTX 2070", ram: 16 },
    { title: "Minecraft", cpu: "i3", gpu: "Integrated", ram: 4 },
    { title: "Elden Ring", cpu: "i5", gpu: "RTX 3060", ram: 16 },
    { title: "The Witcher 3", cpu: "i5", gpu: "GTX 970", ram: 8 }
];

// --- SIDEBAR CONTROL ---
function toggleSidebar() {
    document.body.classList.toggle('sidebar-open');
}

// --- TAB NAVIGATION ---
function showTab(tabName, button) {
    // 1. Hide all tabs and show the selected tab
    document.querySelectorAll('.tab').forEach(tab => tab.style.display = "none");
    document.getElementById(tabName).style.display = "block";
    
    // 2. Set the active state on the button
    document.querySelectorAll('.sidebar button').forEach(btn => btn.classList.remove('active'));
    if (button) {
        button.classList.add('active');
    }
}

// --- GAME DATA LOADING ---
function loadGames() {
    const div = document.getElementById('gameList');
    const select = document.getElementById('selectedGame');
    
    // Clear existing content and set placeholder
    div.innerHTML = '';
    select.innerHTML = '<option value="">Select a Game</option>';

    games.forEach(game => {
        // Create game card
        div.innerHTML += `
            <div class="game-box">
                <strong>${game.title}</strong>
                <p>CPU: ${game.cpu}</p>
                <p>GPU: ${game.gpu}</p>
                <p>RAM: ${game.ram} GB</p>
            </div>
        `;
        // Populate game selection dropdown
        select.innerHTML += `<option value="${game.title}">${game.title}</option>`;
    });
    
    // Set initial tab and active state on load
    const initialButton = document.querySelector('.sidebar button');
    showTab('browse', initialButton); 
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