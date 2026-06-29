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

// Setting defaults for proper handling
$inputs['res_width'] = $inputs['res_width'] ?? 1920;
$inputs['res_height'] = $inputs['res_height'] ?? 1080;
$inputs['graphics_preset'] = $inputs['graphics_preset'] ?? 'Medium';
$inputs['shadow_quality'] = $inputs['shadow_quality'] ?? 'Medium';
$inputs['texture_quality'] = $inputs['texture_quality'] ?? 'Medium';
$inputs['anti_aliasing'] = $inputs['anti_aliasing'] ?? 'Off';
$inputs['vsync'] = $inputs['vsync'] ?? 'Off';
$inputs['performance_mode'] = $inputs['performance_mode'] ?? 'balanced';

// Path to Python script 
$scriptPath = __DIR__ . '/ml-predict.py';

// Uses exact Python interpreter path used by this python environment.
// Use the project virtual environment interpreter
$pythonCmd = __DIR__ . '/../.venv/Scripts/python.exe';
$command = $pythonCmd . ' ' . escapeshellarg($scriptPath);

$descriptors = [
    0 => ['pipe', 'r'],
    1 => ['pipe', 'w'],
    2 => ['pipe', 'w']
];

$process = proc_open($command, $descriptors, $pipes, __DIR__);

if (!is_resource($process)) {
    die(json_encode(['success' => false, 'message' => 'Failed to start Python prediction process']));
}

$payload = json_encode($inputs);
fwrite($pipes[0], $payload);
fclose($pipes[0]);

$stdout = stream_get_contents($pipes[1]);
fclose($pipes[1]);

$stderr = stream_get_contents($pipes[2]);
fclose($pipes[2]);

$exitCode = proc_close($process);

if ($exitCode !== 0) {
    die(json_encode([
        'success' => false,
        'message' => 'Python prediction process failed',
        'exit_code' => $exitCode,
        'stderr' => trim($stderr)
    ]));
}

// Parse and return the result from stdout only
$result = json_decode($stdout, true);
if ($result === null) {
    die(json_encode([
        'success' => false,
        'message' => 'Invalid response from ML model',
        'raw_output' => $stdout,
        'stderr' => trim($stderr)
    ]));
}

echo json_encode($result);
?>