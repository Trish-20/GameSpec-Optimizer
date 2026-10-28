<?php

declare(strict_types=1);

/** Read a local benchmark CSV as associative rows without changing its source. */
function readUpgradeCatalogue(string $path): array
{
    if (!is_readable($path)) {
        return [];
    }

    $handle = fopen($path, 'r');
    if ($handle === false) {
        return [];
    }

    $headers = fgetcsv($handle);
    if (!is_array($headers)) {
        fclose($handle);
        return [];
    }

    $headers[0] = preg_replace('/^\xEF\xBB\xBF/', '', (string) $headers[0]);
    $rows = [];
    while (($values = fgetcsv($handle)) !== false) {
        if (count($values) !== count($headers)) {
            continue;
        }
        $rows[] = array_combine($headers, $values);
    }

    fclose($handle);
    return $rows;
}

function upgradeNumber($value): ?float
{
    if (!is_numeric($value)) {
        return null;
    }
    $number = (float) $value;
    return is_finite($number) && $number > 0 ? $number : null;
}

function upgradeModelKey(string $model): string
{
    return strtolower((string) preg_replace('/[^a-z0-9]+/i', '', $model));
}

function upgradeCsvPrice($value): ?float
{
    // Only a finite positive value is usable for ranking. The CSV does not
    // establish its currency or source, so callers must label it unverified.
    return upgradeNumber(trim((string) $value));
}

function upgradePriceLabel(?float $price): string
{
    return $price === null
        ? 'Price unavailable.'
        : 'Recorded price: ' . number_format($price, 2, '.', ',');
}

function upgradeCandidate(array $row, string $modelKey, string $scoreKey, string $priceKey, string $currentModel, float $currentScore): ?array
{
    $model = trim((string) ($row[$modelKey] ?? ''));
    $score = upgradeNumber($row[$scoreKey] ?? null);
    if ($model === '' || $score === null || upgradeModelKey($model) === upgradeModelKey($currentModel) || $score <= $currentScore) {
        return null;
    }

    $price = upgradeCsvPrice($row[$priceKey] ?? null);
    return [
        'model' => $model,
        'score' => (int) $score,
        'price' => $price,
        'price_label' => upgradePriceLabel($price),
        'gain' => (int) $score - (int) $currentScore,
    ];
}

function rankUpgradeCandidates(array $candidates): array
{
    $priced = array_values(array_filter($candidates, static fn(array $item): bool => $item['price'] !== null));
    usort($priced, static function (array $left, array $right): int {
        $leftValue = $left['gain'] / $left['price'];
        $rightValue = $right['gain'] / $right['price'];
        return ($rightValue <=> $leftValue) ?: ($left['price'] <=> $right['price']) ?: ($left['score'] <=> $right['score']);
    });

    $unpriced = array_values(array_filter($candidates, static fn(array $item): bool => $item['price'] === null));
    usort($unpriced, static fn(array $left, array $right): int => $left['score'] <=> $right['score']);
    return [$priced, $unpriced];
}

function recommendCostEffectiveUpgrades(array $input, string $dataDirectory): array
{
    $requiredCpu = upgradeNumber($input['required_cpu_score'] ?? null);
    $requiredGpu = upgradeNumber($input['required_gpu_score'] ?? null);
    $requiredRamScore = upgradeNumber($input['required_ram_score'] ?? null);
    $currentCpu = upgradeNumber($input['cpu_score'] ?? null);
    $currentGpu = upgradeNumber($input['gpu_score'] ?? null);
    $currentRamScore = upgradeNumber($input['ram_score'] ?? null);
    $currentRamCapacity = upgradeNumber($input['ram_capacity_gb'] ?? null);

    $missing = [];
    foreach ([
        'CPU' => [$requiredCpu, $currentCpu],
        'GPU' => [$requiredGpu, $currentGpu],
        'RAM' => [$requiredRamScore, $currentRamScore],
    ] as $component => [$required, $current]) {
        if ($required === null || $current === null) {
            $missing[] = $component;
        }
    }
    if ($currentRamCapacity === null) {
        $missing[] = 'RAM capacity';
    }

    if ($missing !== []) {
        return [
            'status' => 'unavailable',
            'message' => 'Upgrade suggestions cannot be determined because valid current and game requirement benchmark data is missing for ' . implode(', ', $missing) . '.',
            'components' => [],
        ];
    }

    $requiredRamCapacity = upgradeNumber($input['required_ram_capacity_gb'] ?? null) ?? 0;
    $needs = [
        'cpu' => $currentCpu < $requiredCpu,
        'gpu' => $currentGpu < $requiredGpu,
        'ram' => $currentRamScore < $requiredRamScore || ($requiredRamCapacity > 0 && $currentRamCapacity < $requiredRamCapacity),
    ];
    $components = [];
    if (!in_array(true, $needs, true)) {
        return [
            'status' => 'not-needed',
            'message' => 'Your selected hardware meets the recorded minimum benchmarks. No upgrade is recommended for this game.',
            'components' => [],
        ];
    }

    $cpuRows = array_values(array_filter(
        readUpgradeCatalogue($dataDirectory . '/CPU-benchmarks-v4.csv'),
        static fn(array $row): bool => strtolower(trim((string) ($row['category'] ?? ''))) === 'desktop'
    ));
    $currentCpuRow = null;
    foreach ($cpuRows as $row) {
        if (upgradeModelKey((string) ($row['cpuName'] ?? '')) === upgradeModelKey((string) ($input['cpu_model'] ?? ''))) {
            $currentCpuRow = $row;
            break;
        }
    }

    if ($needs['cpu']) {
        $items = [];
        foreach ($cpuRows as $row) {
            $candidate = upgradeCandidate($row, 'cpuName', 'cpuMark', 'price', (string) ($input['cpu_model'] ?? ''), $currentCpu);
            if ($candidate === null || $candidate['score'] < $requiredCpu) {
                continue;
            }
            $candidateSocket = trim((string) ($row['socket'] ?? ''));
            $currentSocket = trim((string) ($currentCpuRow['socket'] ?? ''));
            if ($currentSocket !== '' && strtolower($candidateSocket) !== strtolower($currentSocket)) {
                continue;
            }
            $candidate['reason'] = 'Its recorded CPU benchmark meets the game requirement and improves on your current score. This is benchmark evidence, not an FPS estimate.';
            $candidate['compatibility'] = $currentSocket !== ''
                ? 'The catalogue lists the same socket as your selected CPU. Motherboard support and BIOS compatibility are not verified.'
                : 'CPU socket compatibility cannot be verified from the selected model. Check your motherboard and BIOS before purchasing.';
            $candidate['details'] = $candidateSocket !== '' ? 'Recorded socket: ' . $candidateSocket : '';
            $items[] = $candidate;
        }
        [$priced, $unpriced] = rankUpgradeCandidates($items);
        $recommended = $priced[0] ?? $unpriced[0] ?? null;
        if ($recommended !== null) {
            $alternatives = $recommended['price'] !== null
                ? array_slice(array_values(array_filter($priced, static fn(array $item): bool => $item['price'] < $recommended['price'])), 0, 2)
                : array_slice(array_values(array_filter($unpriced, static fn(array $item): bool => $item['model'] !== $recommended['model'])), 0, 2);
            $components[] = ['type' => 'CPU', 'current' => trim((string) ($input['cpu_model'] ?? 'Selected CPU')), 'current_score' => (int) $currentCpu, 'required_score' => (int) $requiredCpu, 'recommended' => $recommended, 'alternatives' => $alternatives];
        } else {
            $components[] = ['type' => 'CPU', 'unavailable' => 'No desktop CPU candidate in the local dataset both meets the game benchmark and matches the selected CPU socket.'];
        }
    }

    $gpuRows = readUpgradeCatalogue($dataDirectory . '/GPU-benchmarks-v7.csv');
    $currentGpuRow = null;
    foreach ($gpuRows as $row) {
        if (upgradeModelKey((string) ($row['gpuName'] ?? '')) === upgradeModelKey((string) ($input['gpu_model'] ?? ''))) {
            $currentGpuRow = $row;
            break;
        }
    }

    if ($needs['gpu']) {
        $currentGpuCategory = strtolower(trim((string) ($currentGpuRow['category'] ?? '')));
        $items = [];
        if (in_array($currentGpuCategory, ['desktop', 'mobile'], true)) {
            foreach ($gpuRows as $row) {
                if (strtolower(trim((string) ($row['category'] ?? ''))) !== $currentGpuCategory) {
                    continue;
                }
                $candidate = upgradeCandidate($row, 'gpuName', 'G3Dmark', 'price', (string) ($input['gpu_model'] ?? ''), $currentGpu);
                if ($candidate === null || $candidate['score'] < $requiredGpu) {
                    continue;
                }
                $candidate['reason'] = 'Its recorded GPU benchmark meets the game requirement and improves on your current score. This is benchmark evidence, not an FPS estimate.';
                $candidate['compatibility'] = ucfirst($currentGpuCategory) . ' catalogue category matches your selected GPU. Power supply, case clearance, and laptop upgradeability are not verified.';
                $candidateTdp = upgradeNumber($row['TDP'] ?? null);
                $currentTdp = upgradeNumber($currentGpuRow['TDP'] ?? null);
                $candidate['details'] = $candidateTdp !== null ? 'Recorded TDP: ' . (int) $candidateTdp . ' W' : '';
                if ($candidateTdp !== null && $currentTdp !== null && $candidateTdp > $currentTdp) {
                    $candidate['compatibility'] .= ' The candidate has a higher recorded TDP; verify PSU capacity.';
                }
                $items[] = $candidate;
            }
        }
        [$priced, $unpriced] = rankUpgradeCandidates($items);
        $recommended = $priced[0] ?? $unpriced[0] ?? null;
        if ($recommended !== null) {
            $alternatives = $recommended['price'] !== null
                ? array_slice(array_values(array_filter($priced, static fn(array $item): bool => $item['price'] < $recommended['price'])), 0, 2)
                : array_slice(array_values(array_filter($unpriced, static fn(array $item): bool => $item['model'] !== $recommended['model'])), 0, 2);
            $components[] = ['type' => 'GPU', 'current' => trim((string) ($input['gpu_model'] ?? 'Selected GPU')), 'current_score' => (int) $currentGpu, 'required_score' => (int) $requiredGpu, 'recommended' => $recommended, 'alternatives' => $alternatives];
        } else {
            $reason = in_array($currentGpuCategory, ['desktop', 'mobile'], true)
                ? 'No GPU candidate in the local dataset both matches the selected device category and meets the game benchmark.'
                : 'GPU form factor cannot be determined from the selected hardware record, so compatible candidates cannot be selected safely.';
            $components[] = ['type' => 'GPU', 'unavailable' => $reason];
        }
    }

    if ($needs['ram']) {
        $ramRows = readUpgradeCatalogue($dataDirectory . '/RAM-benchmarks.csv');
        $items = [];
        foreach ($ramRows as $row) {
            $capacity = upgradeNumber($row['ram_capacity_gb'] ?? null);
            $speed = upgradeNumber($row['ram_speed_mhz'] ?? null);
            $score = upgradeNumber($row['ram_score'] ?? null);
            if (
                $capacity === null || $speed === null || $score === null
                || $capacity < max($currentRamCapacity, $requiredRamCapacity)
                || $score < $requiredRamScore || $score <= $currentRamScore
            ) {
                continue;
            }
            $items[] = [
                'model' => (int) $capacity . ' GB at ' . (int) $speed . ' MHz',
                'score' => (int) $score,
                'price' => null,
                'price_label' => 'Price unavailable.',
                'gain' => (int) $score - (int) $currentRamScore,
                'reason' => 'This RAM benchmark row meets the recorded game capacity and score requirements and improves on your current score. It does not predict FPS.',
                'compatibility' => 'The dataset contains capacity and speed only; memory type, motherboard limits, and configuration compatibility are not verified.',
                'details' => 'Benchmark capacity/speed: ' . (int) $capacity . ' GB / ' . (int) $speed . ' MHz',
            ];
        }
        usort($items, static fn(array $left, array $right): int => ($left['score'] <=> $right['score']) ?: strcmp($left['model'], $right['model']));
        $recommended = $items[0] ?? null;
        if ($recommended !== null) {
            $components[] = ['type' => 'RAM', 'current' => (int) $currentRamCapacity . ' GB', 'current_score' => (int) $currentRamScore, 'required_score' => (int) $requiredRamScore, 'recommended' => $recommended, 'alternatives' => array_slice($items, 1, 2)];
        } else {
            $components[] = ['type' => 'RAM', 'unavailable' => 'The RAM dataset has no higher capacity/speed row that meets the game requirement. Prices and platform compatibility are not present in this dataset.'];
        }
    }

    return ['status' => 'ok', 'message' => '', 'components' => $components];
}
