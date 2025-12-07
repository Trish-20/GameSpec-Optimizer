<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GameBoost AI - Admin Panel</title>
    <link rel="stylesheet" href="../../CSS/Admin Side/AdminSideStyle.css">
</head>
<body>

<div class="sidebar">
    <h2>Admin Panel</h2>
    <button onclick="showTab('games')">Games</button>
    <button onclick="showTab('hardware')">Hardware</button>
</div>

<div class="content">

    <!-- GAMES TAB -->
    <div id="games" class="tab">
        <h2>Game Management</h2>

        <form id="gameForm">
            <input type="text" placeholder="Game Title" required>
            <input type="text" placeholder="Min CPU Requirement" required>
            <input type="text" placeholder="Min GPU Requirement" required>
            <input type="text" placeholder="Min RAM Requirement" required>
            <button type="submit">Add / Update Game</button>
        </form>

        <div id="gameList"></div>
    </div>

    <!-- HARDWARE TAB -->
    <div id="hardware" class="tab" style="display:none;">
        <h2>Hardware Management</h2>

        <h3>Add or Update CPU</h3>
        <form id="cpuForm">
            <input type="text" placeholder="CPU Model" required>
            <input type="number" placeholder="Benchmark Score" required>
            <button type="submit">Save CPU</button>
        </form>

        <h3>Add or Update GPU</h3>
        <form id="gpuForm">
            <input type="text" placeholder="GPU Model" required>
            <input type="number" placeholder="Benchmark Score" required>
            <button type="submit">Save GPU</button>
        </form>

        <h3>Add or Update RAM</h3>
        <form id="ramForm">
            <input type="text" placeholder="RAM Model" required>
            <input type="number" placeholder="Benchmark Score" required>
            <button type="submit">Save RAM</button>
        </form>
    </div>

</div>
<script src="../../JAVASCRIPT/Admin Side/AdminSideFunction.js"></script>
</body>
</html>
