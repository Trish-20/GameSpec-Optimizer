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

/* ============================================================================
 * INPUT VALIDATION HELPERS
 *
 * These only decide whether a value is acceptable. They never alter a value
 * that already passes, so the resolution and prediction behaviour above is
 * unchanged for valid input.
 * ========================================================================= */

/**
 * Reject values that are obviously not hardware identifiers, e.g.
 * "123456akwjhrofhaeb", while still accepting every real model name in the
 * benchmark catalogue.
 *
 * The rules were calibrated against the existing cpu_benchmarks /
 * gpu_benchmarks rows, so ordinary part numbers ("i7-12700K", "RTX 4090",
 * "16GB DDR4-3200", "P104-100") always pass and only long, single-blob
 * keyboard-mash strings are refused.
 */
function isPlausibleHardwareModel(string $model): bool
{
    $model = trim((string) preg_replace('/\s+/', ' ', $model));
    $length = strlen($model);

    if ($length < 3 || $length > 120) {
        return false;
    }

    // Real model names always contain letters.
    if (!preg_match('/[A-Za-z]/', $model)) {
        return false;
    }

    // Allow only the characters that appear in real model names.
    if (!preg_match('#^[A-Za-z0-9 .()\-_+,/@]+$#', $model)) {
        return false;
    }

    // Reject low character-diversity blobs such as "xx11xx22xx" or "zzz9999".
    if ($length >= 6) {
        $uniqueCharacters = count(array_unique(preg_split('//u', $model, -1, PREG_SPLIT_NO_EMPTY)));
        if (($uniqueCharacters / $length) < 0.30) {
            return false;
        }
    }

    // Known hardware vocabulary always wins.
    if (preg_match(HARDWARE_MODEL_VOCABULARY, $model)) {
        return true;
    }

    // Otherwise accept short part numbers and multi-word descriptions, and
    // refuse a single long unrecognised blob.
    return $length <= 13 || strpos($model, ' ') !== false;
}

/**
 * Vendor, family and memory vocabulary used by real model names. Matching any
 * of these means the value is recognisably hardware even if it is long.
 */
const HARDWARE_MODEL_VOCABULARY = '/\b(intel|amd|ryzen|threadripper|epyc|athlon|phenom|sempron|celeron|pentium|atom|core|xeon|pro|fx|apu|nvidia|geforce|radeon|gtx|rtx|quadro|tesla|titan|iris|uhd|hd|graphics|arc|firepro|instinct|ddr[345]?|sdram|gb|mb|tb|mhz|ghz|xmp|expo|vengeance|trident|ripjaws|fury|ballistix|dominator|hyperx|kingston|corsair|crucial|gskill|samsung|hynix|teamgroup|lexar|sabrent|adata|barco|carrizo|via|abit|aspeed|matrox|mxgpu|opengl|vanta|mobile|embedded|express|chipset|controller|display|family|edition|directx|d3d|parhelia|qxl|ion|dual|plus|xtx|xti|super|max|ti|gt|gs|workstation|professional|server|oem|asic|integrated|vega|duo|wx|gl|gh|ssg|internal|extreme|accelerator|coffee|lake|media|poison|ivy|incredible|infoshock|modded|release|ceo|collectors|devastator|scrapper|trinity|park)\b/i';

/**
 * Validate a benchmark score: must be a finite positive number inside a sane
 * range, and not a value produced by a typo.
 */
function isValidBenchmarkScore($score): bool
{
    if (!is_numeric($score)) {
        return false;
    }

    $value = (float) $score;

    // Reject NaN / INF and non-positive values.
    if (!is_finite($value) || $value <= 0) {
        return false;
    }

    // Real CPU/GPU/RAM benchmark scores stay well inside this window.
    return $value >= 1 && $value <= 1000000;
}
