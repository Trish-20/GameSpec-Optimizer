<?php

declare(strict_types=1);

function normalizeBenchmarkName(string $value): string
{
    $value = strtolower($value);
    $value = str_replace(['(r)', '(tm)', '™', '®'], '', $value);
    $value = preg_replace('/\b(nvidia|amd|intel|geforce|radeon)\b/', '', $value);
    $value = preg_replace('/[^a-z0-9]+/', ' ', $value);
    return trim(preg_replace('/\s+/', ' ', $value));
}

function readBenchmarkCsv(string $file): array
{
    if (!is_readable($file)) {
        throw new RuntimeException('Benchmark file not found: ' . basename($file));
    }

    $rows = [];
    $handle = fopen($file, 'r');
    fgetcsv($handle);

    while (($row = fgetcsv($handle)) !== false) {
        $rows[] = $row;
    }

    fclose($handle);
    return $rows;
}

function getCpuBenchmarks(): array
{
    static $cpus;
    if ($cpus !== null) {
        return $cpus;
    }

    $cpus = [];
    foreach (readBenchmarkCsv(__DIR__ . '/../DATA/CPU-benchmarks-v4.csv') as $row) {
        if (($row[0] ?? '') === '' || strtolower(trim($row[11] ?? '')) !== 'desktop') {
            continue;
        }

        $cpus[] = [
            'model' => trim($row[0]),
            'score' => (int) ($row[2] ?? 0),
        ];
    }

    return $cpus;
}

function getGpuBenchmarks(): array
{
    static $gpus;
    if ($gpus !== null) {
        return $gpus;
    }

    $gpus = [];
    foreach (readBenchmarkCsv(__DIR__ . '/../DATA/GPU-benchmarks-v7.csv') as $row) {
        $model = trim($row[0] ?? '');
        if ($model === '' || strtolower(trim($row[8] ?? '')) !== 'desktop') {
            continue;
        }

        if (preg_match('/\b(quadro|tesla|titan|rtx a)\b/i', $model)) {
            continue;
        }

        $gpus[] = [
            'model' => $model,
            'score' => (int) ($row[1] ?? 0),
        ];
    }

    return $gpus;
}

function getRamBenchmarks(): array
{
    static $ram;
    if ($ram !== null) {
        return $ram;
    }

    $ram = [];
    foreach (readBenchmarkCsv(__DIR__ . '/../DATA/RAM-benchmarks.csv') as $row) {
        if (($row[0] ?? '') === '') {
            continue;
        }

        $ram[] = [
            'capacity_gb' => (int) ($row[0] ?? 0),
            'speed_mhz' => (int) ($row[1] ?? 0),
            'score' => (int) ($row[2] ?? 0),
        ];
    }

    return $ram;
}

function resolveModelBenchmark(string $requiredModel, array $benchmarks): array
{
    $required = normalizeBenchmarkName($requiredModel);
    if ($required === '') {
        return ['required_model' => $requiredModel, 'matched_model' => null, 'score' => null, 'match_status' => 'unresolved'];
    }

    foreach ($benchmarks as $benchmark) {
        if (normalizeBenchmarkName($benchmark['model']) === $required) {
            return [
                'required_model' => $requiredModel,
                'matched_model' => $benchmark['model'],
                'score' => $benchmark['score'],
                'match_status' => 'exact',
            ];
        }
    }

    $requiredTokens = array_values(array_filter(explode(' ', $required), static fn (string $token): bool => strlen($token) > 1));
    $candidates = [];
    foreach ($benchmarks as $benchmark) {
        $candidateTokens = array_values(array_filter(explode(' ', normalizeBenchmarkName($benchmark['model'])), static fn (string $token): bool => strlen($token) > 1));
        $hits = count(array_intersect($requiredTokens, $candidateTokens));
        $coverage = count($requiredTokens) > 0 ? $hits / count($requiredTokens) : 0;

        if ($coverage >= 0.5) {
            $candidates[] = ['benchmark' => $benchmark, 'coverage' => $coverage];
        }
    }

    if ($candidates === []) {
        return ['required_model' => $requiredModel, 'matched_model' => null, 'score' => null, 'match_status' => 'unresolved'];
    }

    usort($candidates, static function (array $left, array $right): int {
        if ($left['coverage'] === $right['coverage']) {
            return $left['benchmark']['score'] <=> $right['benchmark']['score'];
        }
        return $right['coverage'] <=> $left['coverage'];
    });

    $best = $candidates[0]['benchmark'];
    return [
        'required_model' => $requiredModel,
        'matched_model' => $best['model'],
        'score' => $best['score'],
        'match_status' => 'nearest',
    ];
}

function resolveRamBenchmark(int $capacityGb, int $speedMhz): array
{
    if ($capacityGb <= 0) {
        return [
            'capacity_gb' => $capacityGb,
            'speed_mhz' => $speedMhz,
            'matched_capacity_gb' => null,
            'matched_speed_mhz' => null,
            'score' => null,
            'match_status' => 'unresolved',
        ];
    }

    $ram = getRamBenchmarks();
    foreach ($ram as $benchmark) {
        if ($benchmark['capacity_gb'] === $capacityGb && $benchmark['speed_mhz'] === $speedMhz) {
            return [
                'capacity_gb' => $capacityGb,
                'speed_mhz' => $speedMhz,
                'matched_capacity_gb' => $benchmark['capacity_gb'],
                'matched_speed_mhz' => $benchmark['speed_mhz'],
                'score' => $benchmark['score'],
                'match_status' => 'exact',
            ];
        }
    }

    $candidates = array_values(array_filter($ram, static fn (array $benchmark): bool => $benchmark['capacity_gb'] === $capacityGb));
    if ($candidates === []) {
        $candidates = $ram;
    }

    usort($candidates, static function (array $left, array $right) use ($capacityGb, $speedMhz): int {
        $leftDistance = abs($left['capacity_gb'] - $capacityGb) * 10000 + abs($left['speed_mhz'] - $speedMhz);
        $rightDistance = abs($right['capacity_gb'] - $capacityGb) * 10000 + abs($right['speed_mhz'] - $speedMhz);
        return $leftDistance <=> $rightDistance;
    });

    $best = $candidates[0] ?? null;
    return [
        'capacity_gb' => $capacityGb,
        'speed_mhz' => $speedMhz,
        'matched_capacity_gb' => $best['capacity_gb'] ?? null,
        'matched_speed_mhz' => $best['speed_mhz'] ?? null,
        'score' => $best['score'] ?? null,
        'match_status' => $best ? ($speedMhz > 0 ? 'nearest' : 'estimated') : 'unresolved',
    ];
}

function resolveGameBenchmarks(string $cpuModel, string $gpuModel, int $ramCapacityGb, int $ramSpeedMhz): array
{
    $cpu = resolveModelBenchmark($cpuModel, getCpuBenchmarks());
    $gpu = resolveModelBenchmark($gpuModel, getGpuBenchmarks());
    $ram = resolveRamBenchmark($ramCapacityGb, $ramSpeedMhz);

    return [
        'cpu' => $cpu,
        'gpu' => $gpu,
        'ram' => $ram,
        'cpu_benchmark' => $cpu['score'],
        'gpu_benchmark' => $gpu['score'],
        'ram_benchmark' => $ram['score'],
    ];
}