    function showTab(tabName) {
    document.querySelectorAll('.tab').forEach(tab => tab.style.display = "none");
    document.getElementById(tabName).style.display = "block";
    }

    // Fake saving function (replace with backend later)
    document.getElementById("gameForm").addEventListener("submit", function(e){
        e.preventDefault();
        alert("Game added or updated!");
    });

    document.getElementById("cpuForm").addEventListener("submit", function(e){
        e.preventDefault();
        alert("CPU saved!");
    });

    document.getElementById("gpuForm").addEventListener("submit", function(e){
        e.preventDefault();
        alert("GPU saved!");
    });

    document.getElementById("ramForm").addEventListener("submit", function(e){
        e.preventDefault();
        alert("RAM saved!");
    });