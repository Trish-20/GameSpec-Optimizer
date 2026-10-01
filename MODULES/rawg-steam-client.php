<?php

declare(strict_types=1);

require_once __DIR__ . '/benchmark-resolver.php';

function loadProjectEnv(): array
{
    $envFile = __DIR__ . '/../.env.local';
    $values = [];

    // Local development (XAMPP): read the ignored .env.local file.
    if (is_readable($envFile)) {
        foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
            $line = trim($line);

            if ($line === '' || str_starts_with($line, '#')) {
                continue;
            }

            $separator = strpos($line, '=');
            if ($separator === false) {
                $separator = strpos($line, ':');
            }

            if ($separator === false) {
                continue;
            }

            $name = trim(substr($line, 0, $separator));
            $value = trim(substr($line, $separator + 1));
            $values[$name] = trim($value, " \t\r\n\"'");
        }
    }

    // Cloud hosts and CI supply secrets as real environment variables. These
    // take precedence over the file.
    foreach (['RAW_API_KEY', 'DB_CONNECTION_STRING', 'APP_ENV', 'PYTHON_BIN'] as $name) {
        $value = getenv($name);
        if ($value !== false && $value !== '') {
            $values[$name] = $value;
        }
    }

    if ($values === []) {
        throw new RuntimeException(
            'No configuration found. Set the RAW_API_KEY environment variable, '
            . 'or provide a .env.local file.'
        );
    }

    return $values;
}

function httpJsonRequest(string $url, array $headers = []): array
{
    $handle = curl_init($url);
    curl_setopt_array($handle, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 20,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_USERAGENT => 'GameSpec-Optimizer/1.0',
    ]);

    $body = curl_exec($handle);
    $error = curl_error($handle);
    $status = (int) curl_getinfo($handle, CURLINFO_HTTP_CODE);
    curl_close($handle);

    if ($body === false) {
        throw new RuntimeException('External request failed: ' . $error);
    }

    $decoded = json_decode($body, true);
    if (!is_array($decoded)) {
        throw new RuntimeException('External service returned invalid JSON.');
    }

    if ($status < 200 || $status >= 300) {
        $message = $decoded['detail'] ?? $decoded['error'] ?? 'External service error.';
        throw new RuntimeException($message, $status);
    }

    return $decoded;
}

function rawgRequest(string $path, array $query = []): array
{
    $env = loadProjectEnv();
    $apiKey = $env['RAW_API_KEY'] ?? $env['RAWG_API_KEY'] ?? '';

    if ($apiKey === '') {
        throw new RuntimeException('RAWG API key is not configured.');
    }

    $query['key'] = $apiKey;
    $url = 'https://api.rawg.io/api/' . ltrim($path, '/') . '?' . http_build_query($query);

    return httpJsonRequest($url, ['Accept: application/json']);
}

function steamAppDetailsRequest(int $steamAppId): array
{
    $url = 'https://store.steampowered.com/api/appdetails?appids=' . $steamAppId . '&l=english';
    $response = httpJsonRequest($url, ['Accept: application/json']);
    $app = $response[(string) $steamAppId] ?? null;

    if (!is_array($app) || ($app['success'] ?? false) !== true) {
        throw new RuntimeException('Steam could not find this game.');
    }

    return $app['data'] ?? [];
}

function findSteamAppIdByTitle(string $title): ?int
{
    $url = 'https://store.steampowered.com/api/storesearch/?term=' . rawurlencode($title) . '&l=english&cc=us';
    $response = httpJsonRequest($url, ['Accept: application/json']);
    $firstResult = $response['items'][0] ?? null;

    return is_array($firstResult) && isset($firstResult['id'])
        ? (int) $firstResult['id']
        : null;
}

function extractRequirementLines(string $html): array
{
    if ($html === '') {
        return [];
    }

    $document = new DOMDocument();
    libxml_use_internal_errors(true);
    $document->loadHTML('<?xml encoding="UTF-8">' . $html);
    libxml_clear_errors();

    $lines = [];
    foreach ($document->getElementsByTagName('li') as $item) {
        $text = trim(preg_replace('/\s+/', ' ', $item->textContent));
        if ($text !== '') {
            $lines[] = $text;
        }
    }

    return $lines;
}

function normalizeRequirements(string $html): array
{
    $requirements = [
        'os' => null,
        'cpu' => null,
        'gpu' => null,
        'ram' => null,
        'storage' => null,
        'raw' => $html,
    ];

    foreach (extractRequirementLines($html) as $line) {
        $separator = strpos($line, ':');
        if ($separator === false) {
            continue;
        }

        $label = strtolower(trim(substr($line, 0, $separator)));
        $value = trim(substr($line, $separator + 1));

        if (str_contains($label, 'os')) {
            $requirements['os'] = $value;
        } elseif (str_contains($label, 'processor') || str_contains($label, 'cpu')) {
            $requirements['cpu'] = $value;
        } elseif (str_contains($label, 'graphics') || str_contains($label, 'video')) {
            $requirements['gpu'] = $value;
        } elseif (str_contains($label, 'memory') || str_contains($label, 'ram')) {
            $requirements['ram'] = $value;
        } elseif (str_contains($label, 'storage') || str_contains($label, 'hard disk')) {
            $requirements['storage'] = $value;
        }
    }

    return $requirements;
}

function extractRamSpec(?string $requirement): array
{
    $text = (string) $requirement;
    preg_match('/(\d+)\s*GB/i', $text, $capacityMatch);
    preg_match('/(\d{4,5})\s*MHz/i', $text, $speedMatch);

    return [
        'capacity_gb' => (int) ($capacityMatch[1] ?? 0),
        'speed_mhz' => (int) ($speedMatch[1] ?? 0),
    ];
}

function findSteamAppId(array $rawgGame): ?int
{
    foreach ($rawgGame['stores'] ?? [] as $store) {
        if (($store['store']['slug'] ?? '') === 'steam' && isset($store['store_id'])) {
            return (int) $store['store_id'];
        }
    }

    return null;
}

function getGameCachePath(string $search): string
{
    $cacheDirectory = __DIR__ . '/../DATA/rawg-steam-cache';
    if (!is_dir($cacheDirectory)) {
        mkdir($cacheDirectory, 0755, true);
    }

    return $cacheDirectory . '/v2-' . hash('sha256', strtolower(trim($search))) . '.json';
}

function getGameFromRawgAndSteam(string $search): array
{
    $search = trim($search);
    $cachePath = getGameCachePath($search);
    $cacheLifetime = 30 * 24 * 60 * 60;

    if (is_readable($cachePath) && filemtime($cachePath) + $cacheLifetime > time()) {
        $cached = json_decode((string) file_get_contents($cachePath), true);
        if (is_array($cached)) {
            return $cached;
        }
    }

    $results = rawgRequest('games', [
        'search' => $search,
        'search_precise' => 'true',
        'page_size' => 5,
    ]);

    $rawgGame = $results['results'][0] ?? null;
    if (!is_array($rawgGame)) {
        throw new RuntimeException('No game was found in RAWG.');
    }

    $rawgDetails = rawgRequest('games/' . (int) $rawgGame['id']);
    $title = (string) ($rawgDetails['name'] ?? $rawgGame['name'] ?? $search);
    $steamAppId = findSteamAppId($rawgDetails)
        ?? findSteamAppId($rawgGame)
        ?? findSteamAppIdByTitle($title);
    if ($steamAppId === null) {
        throw new RuntimeException('RAWG found the game, but no Steam App ID is available.');
    }

    $steamGame = steamAppDetailsRequest($steamAppId);
    $pcRequirements = $steamGame['pc_requirements'] ?? [];
    $minimumRequirements = normalizeRequirements((string) ($pcRequirements['minimum'] ?? ''));
    $ramSpec = extractRamSpec($minimumRequirements['ram'] ?? null);
    $benchmarks = resolveGameBenchmarks(
        (string) ($minimumRequirements['cpu'] ?? ''),
        (string) ($minimumRequirements['gpu'] ?? ''),
        $ramSpec['capacity_gb'],
        $ramSpec['speed_mhz']
    );

    $game = [
        'rawg_id' => (int) $rawgDetails['id'],
        'steam_app_id' => $steamAppId,
        'title' => $title,
        'genres' => array_values(array_filter(array_map(
            static fn (array $genre): string => (string) ($genre['name'] ?? ''),
            $rawgDetails['genres'] ?? []
        ))),
        'description' => $rawgDetails['description_raw'] ?? strip_tags((string) ($rawgDetails['description'] ?? '')),
        'cover' => $rawgDetails['background_image'] ?? null,
        'benchmark_matches' => $benchmarks,
        'requirements' => [
            'minimum' => $minimumRequirements,
            'recommended' => normalizeRequirements((string) ($pcRequirements['recommended'] ?? '')),
        ],
    ];

    file_put_contents($cachePath, json_encode($game, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
    return $game;
}