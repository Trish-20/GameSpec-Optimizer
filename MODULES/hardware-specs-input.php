<?php 
header('Content-Type: application/json');

// Shared helpers (DB connection + hardware model / score validators) are
// needed by the validation gate below, so load them up front.
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/benchmark-resolver.php';

$inputs = json_decode(file_get_contents('php://input'), true);
if (!$inputs) {
    die(json_encode(['success' => false, 'message' => 'Invalid JSON data']));
}

// Expected input fields:
// game_title, game_cpu_min, game_gpu_min, game_ram_min, cpu_score, gpu_score, ram_score,
// res_width, res_height, graphics_preset, shadow_quality, texture_quality, 
// anti_aliasing, vsync, performance_mode

// ============================================================================
// VALIDATION GATE
//
// Everything below this block is the UNCHANGED prediction pipeline. These
// checks only stop invalid hardware / benchmark data from ever reaching it.
// ============================================================================

/**
 * Convert an incoming value to a usable positive number, or null when the
 * value cannot be trusted (missing, non-numeric, NaN, zero or negative).
 */
function readPositiveNumber($value): ?float
{
    if (is_bool($value) || $value === null || $value === '') {
        return null;
    }

    if (!is_numeric($value)) {
        return null;
    }

    $number = (float) $value;

    if (!is_finite($number) || $number <= 0) {
        return null;
    }

    return $number;
}

$required = ['game_cpu_min', 'game_gpu_min', 'game_ram_min', 'cpu_score', 'gpu_score', 'ram_score'];
foreach ($required as $field) {
    if (!array_key_exists($field, $inputs)) {
        die(json_encode(['success' => false, 'message' => "Missing or invalid field: $field"]));
    }

    if (readPositiveNumber($inputs[$field]) === null) {
        die(json_encode([
            'success' => false,
            'message' => "Missing or invalid field: $field",
        ]));
    }
}

// Hardware and benchmark values must stay inside a believable range, otherwise
// the model receives nonsense and the result is meaningless.
foreach ($required as $field) {
    if (readPositiveNumber($inputs[$field]) > 1000000) {
        die(json_encode([
            'success' => false,
            'message' => "Value out of range for $field.",
        ]));
    }
}

// If a hardware model string was supplied it must look like a real part,
// otherwise the request is rejected before any prediction runs.
foreach (['cpu_model', 'gpu_model', 'ram_model'] as $modelField) {
    if (!isset($inputs[$modelField]) || $inputs[$modelField] === '') {
        continue;
    }

    if (!is_string($inputs[$modelField]) || !isPlausibleHardwareModel((string) $inputs[$modelField])) {
        die(json_encode([
            'success' => false,
            'message' => 'The selected hardware is not a valid model. Please choose your hardware from the list.',
        ]));
    }
}

try {
    $validateBenchmark = function (string $tableName, string $label, $score) {
        $pdo = databaseConnection();
        $statement = $pdo->prepare("SELECT score FROM {$tableName} WHERE score = :score LIMIT 1");
        $statement->execute(['score' => (int) $score]);
        if (!$statement->fetch()) {
            throw new InvalidArgumentException("Invalid {$label} benchmark selection.");
        }
    };

    $validateBenchmark('cpu_benchmarks', 'CPU', $inputs['cpu_score']);
    $validateBenchmark('gpu_benchmarks', 'GPU', $inputs['gpu_score']);
    $validateBenchmark('ram_benchmarks', 'RAM', $inputs['ram_score']);
} catch (Throwable $error) {
    die(json_encode(['success' => false, 'message' => 'Selected hardware does not match a known benchmark entry.']));
}

if (isset($inputs['gpu_benchmark_id']) && $inputs['gpu_benchmark_id'] !== null) {
    $gpuBenchmarkId = filter_var($inputs['gpu_benchmark_id'], FILTER_VALIDATE_INT);
    if ($gpuBenchmarkId === false || $gpuBenchmarkId < 1) {
        die(json_encode(['success' => false, 'message' => 'Invalid GPU benchmark reference']));
    }

    try {
        require_once __DIR__ . '/db.php';
        $gpuStatement = databaseConnection()->prepare(
            'SELECT score FROM gpu_benchmarks WHERE gpu_id = :gpu_id LIMIT 1'
        );
        $gpuStatement->execute(['gpu_id' => $gpuBenchmarkId]);
        $gpuRecord = $gpuStatement->fetch();
    } catch (Throwable $error) {
        die(json_encode(['success' => false, 'message' => 'Unable to verify GPU benchmark reference']));
    }

    if (!$gpuRecord || (int) $gpuRecord['score'] !== (int) $inputs['gpu_score']) {
        die(json_encode(['success' => false, 'message' => 'GPU benchmark reference does not match the selected score']));
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

$mlServiceUrl = rtrim((string) (getenv('ML_SERVICE_URL') ?: ''), '/');
if ($mlServiceUrl !== '') {
    $headers = ['Content-Type: application/json'];
    $mlServiceToken = (string) (getenv('ML_SERVICE_TOKEN') ?: '');
    if ($mlServiceToken !== '') {
        $headers[] = 'Authorization: Bearer ' . $mlServiceToken;
    }

    $context = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => implode("\r\n", $headers),
            'content' => json_encode($inputs),
            'timeout' => 60,
            'ignore_errors' => true,
        ],
    ]);
    $remoteResponse = @file_get_contents($mlServiceUrl . '/predict', false, $context);
    $remoteResult = $remoteResponse !== false ? json_decode($remoteResponse, true) : null;
    if (is_array($remoteResult)) {
        echo json_encode($remoteResult);
        exit;
    }

    error_log('ML service returned an invalid response.');
    die(json_encode(['success' => false, 'message' => 'The performance check could not be completed. Please try again.']));
}

// Path to Python script
$scriptPath = __DIR__ . '/ml-predict.py';

/*
 * Locate the Python interpreter.
 *
 * The project virtualenv is called "Scripts/python.exe" on Windows but
 * "bin/python" on Linux/macOS, so try both. A PYTHON_BIN environment
 * variable (set on the cloud host) wins, and we finally fall back to the
 * interpreter on PATH.
 *
 * Only how the interpreter is FOUND changes - the script it runs and
 * everything it computes are untouched.
 */
$pythonCandidates = array_filter([
    getenv('PYTHON_BIN') ?: null,
    __DIR__ . '/../.venv/bin/python',
    __DIR__ . '/../.venv/Scripts/python.exe',
]);

$pythonCmd = null;
foreach ($pythonCandidates as $candidate) {
    if (is_file($candidate)) {
        $pythonCmd = $candidate;
        break;
    }
}

if ($pythonCmd === null) {
    // No project venv: fall back to the interpreter on PATH.
    $pythonCmd = (PHP_OS_FAMILY === 'Windows') ? 'python' : 'python3';
}

$command = escapeshellcmd($pythonCmd) . ' ' . escapeshellarg($scriptPath);

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
    // Log the technical detail for the developer, but never send raw Python /
    // path output to the browser.
    error_log('ml-predict.py exited with code ' . $exitCode . ': ' . trim($stderr));
    die(json_encode([
        'success' => false,
        'message' => 'The performance check could not be completed. Please try again.',
    ]));
}

// Parse and return the result from stdout only
$result = json_decode($stdout, true);
if ($result === null) {
    error_log('ml-predict.py returned non-JSON output: ' . trim($stdout) . ' | stderr: ' . trim($stderr));
    die(json_encode([
        'success' => false,
        'message' => 'The performance check returned an unexpected result. Please try again.',
    ]));
}

echo json_encode($result);
?>