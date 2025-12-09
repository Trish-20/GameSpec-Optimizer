<?php 
header('Content-Type: application/json');

$inputs = json_decode(file_get_contents('php://input'), true);
if (!$inputs) {
    die(json_encode(['success' => false, 'message' => 'Invalid JSON data']));
}

// Expected input fields:
// game_title, game_cpu_min, game_gpu_min, game_ram_min, cpu_score, gpu_score, ram_score,
// res_width, res_height, graphics_preset, shadow_quality, texture_quality, 
// anti_aliasing, vsync, performance_mode

// Validate required fields
$required = ['game_cpu_min', 'game_gpu_min', 'game_ram_min', 'cpu_score', 'gpu_score', 'ram_score'];
foreach ($required as $field) {
    if (!isset($inputs[$field]) || !is_numeric($inputs[$field])) {
        die(json_encode(['success' => false, 'message' => "Missing or invalid field: $field"]));
    }
}

// Set defaults for optional fields
$inputs['res_width'] = $inputs['res_width'] ?? 1920;
$inputs['res_height'] = $inputs['res_height'] ?? 1080;
$inputs['graphics_preset'] = $inputs['graphics_preset'] ?? 'Medium';
$inputs['shadow_quality'] = $inputs['shadow_quality'] ?? 'Medium';
$inputs['texture_quality'] = $inputs['texture_quality'] ?? 'Medium';
$inputs['anti_aliasing'] = $inputs['anti_aliasing'] ?? 'Off';
$inputs['vsync'] = $inputs['vsync'] ?? 'Off';
$inputs['performance_mode'] = $inputs['performance_mode'] ?? 'balanced';

// Path to Python script (adjust if needed)
$scriptPath = __DIR__ . '/ml-predict.py';

// Escape the JSON input for shell
$jsonInput = escapeshellarg(json_encode($inputs));

// Run Python prediction script
// Use 'python' on Windows, 'python3' on Linux/Mac
$pythonCmd = (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN') ? 'python' : 'python3';
$command = "$pythonCmd " . escapeshellarg($scriptPath) . " $jsonInput 2>&1";

$output = shell_exec($command);

if ($output === null) {
    die(json_encode(['success' => false, 'message' => 'Failed to execute Python script']));
}

// Parse and return the result
$result = json_decode($output, true);
if ($result === null) {
    die(json_encode([
        'success' => false, 
        'message' => 'Invalid response from ML model',
        'raw_output' => $output
    ]));
}

echo json_encode($result);
?>