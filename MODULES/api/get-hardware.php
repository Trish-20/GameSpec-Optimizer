<?php
header('Content-Type: application/json');

try {
    $pythonScript = realpath(__DIR__ . '/../detect-hardware.py');

    if ($pythonScript === false || !file_exists($pythonScript)) {
        throw new Exception('Hardware detection script not found');
    }

    $pythonBinary = (PHP_OS_FAMILY === 'Windows') ? 'python' : 'python3';
    $command = escapeshellcmd($pythonBinary) . ' ' . escapeshellarg($pythonScript) . ' 2>&1';
    $output = shell_exec($command);

    if ($output === null || trim($output) === '') {
        throw new Exception('No output returned from hardware detection script');
    }

    $result = json_decode($output, true);
    if (!is_array($result)) {
        throw new Exception('Invalid JSON returned from hardware detection script: ' . $output);
    }

    echo json_encode($result);
} catch (Throwable $e) {
    echo json_encode([
        'success' => false,
        'error' => 'Failed to detect hardware',
        'message' => $e->getMessage()
    ]);
}


?>