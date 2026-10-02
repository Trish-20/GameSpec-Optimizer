<?php

declare(strict_types=1);

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/admin-auth.php';

header('Content-Type: application/json; charset=utf-8');

$input = json_decode(file_get_contents('php://input'), true);

$title = trim((string) ($input['title'] ?? ''));
$description = trim((string) ($input['description'] ?? ''));
$cpuModel = trim((string) ($input['cpuModel'] ?? ''));
$gpuModel = trim((string) ($input['gpuModel'] ?? ''));
$ramCapacityGb = (int) ($input['ramCapacityGb'] ?? 0);
$ramSpeedMhz = (int) ($input['ramSpeedMhz'] ?? 0);
$imageData = trim((string) ($input['imageData'] ?? ''));

// gameId is only present when EDITING.
$gameId = isset($input['gameId']) ? (int) $input['gameId'] : 0;

/* ---------------------------------------------------------------------------
 * BROWSE GAMES FILTER FIELDS
 *
 * The user-side Browse Games page filters on genre and release year. Values
 * are therefore restricted to a fixed list that matches those filters exactly,
 * so an admin-entered game can always be found by users.
 * ------------------------------------------------------------------------ */

$allowedGenres = ['Action', 'RPG', 'Shooter', 'Adventure', 'Sports', 'Racing', 'Strategy', 'Sandbox', 'Simulation', 'Puzzle', 'Indie', 'Survival'];
$allowedPlatforms = ['PC', 'macOS', 'Linux'];

$genres = [];
$rawGenres = $input['genres'] ?? [];
if (is_string($rawGenres)) {
    $rawGenres = $rawGenres === '' ? [] : explode(',', $rawGenres);
}
if (is_array($rawGenres)) {
    foreach ($rawGenres as $genre) {
        $genre = trim((string) $genre);
        foreach ($allowedGenres as $allowed) {
            if (strcasecmp($genre, $allowed) === 0 && !in_array($allowed, $genres, true)) {
                $genres[] = $allowed;
            }
        }
    }
}

$platforms = ['PC'];
$rawPlatforms = $input['platforms'] ?? [];
if (is_string($rawPlatforms)) {
    $rawPlatforms = $rawPlatforms === '' ? [] : explode(',', $rawPlatforms);
}
if (is_array($rawPlatforms) && count($rawPlatforms)) {
    $platforms = [];
    foreach ($rawPlatforms as $platform) {
        $platform = trim((string) $platform);
        foreach ($allowedPlatforms as $allowed) {
            if (strcasecmp($platform, $allowed) === 0 && !in_array($allowed, $platforms, true)) {
                $platforms[] = $allowed;
            }
        }
    }
    if (!$platforms) {
        $platforms = ['PC'];
    }
}

// Release year drives the "Released" filter on the Browse Games page.
$currentYear = (int) date('Y');
$releaseYear = isset($input['releaseYear']) && $input['releaseYear'] !== ''
    ? (int) $input['releaseYear']
    : 0;
if ($releaseYear > 0 && ($releaseYear < 1970 || $releaseYear > $currentYear + 2)) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => "Release year must be between 1970 and " . ($currentYear + 2) . '.',
    ]);
    exit;
}
if ($releaseYear <= 0) {
    $releaseYear = $currentYear;
}

if (
    $title === '' ||
    $cpuModel === '' ||
    $gpuModel === '' ||
    $ramCapacityGb <= 0 ||
    $ramSpeedMhz <= 0
) {
    http_response_code(400);

    echo json_encode([
        'success' => false,
        'message' => 'Title, CPU, GPU, RAM capacity, and RAM speed are required.'
    ]);

    exit;
}

try {

    $database = databaseConnection();

    /*
     * ============================================================
     * HANDLE COVER IMAGE
     * ============================================================
     *
     * The frontend sends the image as a Data URL.
     *
     * Example:
     * data:image/jpeg;base64,/9j/4AAQSkZJRg...
     *
     * We save the actual image file into:
     *
     * /uploads/game-covers/
     *
     * Then we store only the file path in games.cover_url.
     */

    $coverUrl = null;

    if ($imageData !== '') {

        /*
         * Validate the Data URL format.
         * Allowed types match the admin form accept list.
         */
        if (!preg_match(
            '/^data:image\/(jpeg|jpg|png|webp|gif|avif);base64,(.+)$/is',
            $imageData,
            $matches
        )) {
            http_response_code(400);

            echo json_encode([
                'success' => false,
                'message' => 'Invalid game cover image.'
            ]);

            exit;
        }

        $imageType = strtolower($matches[1]);
        $base64Data = $matches[2];

        /*
         * Convert base64 into binary image data.
         */
        $imageBinary = base64_decode($base64Data, true);

        if ($imageBinary === false) {
            http_response_code(400);

            echo json_encode([
                'success' => false,
                'message' => 'Unable to decode game cover image.'
            ]);

            exit;
        }

        /*
         * Check that the uploaded data is actually an image.
         */
        $imageInfo = @getimagesizefromstring($imageBinary);

        if ($imageInfo === false) {
            http_response_code(400);

            echo json_encode([
                'success' => false,
                'message' => 'The selected game cover is not a valid image.'
            ]);

            exit;
        }

        /*
         * Maximum image size: 5 MB.
         */
        if (strlen($imageBinary) > 5 * 1024 * 1024) {
            http_response_code(400);

            echo json_encode([
                'success' => false,
                'message' => 'Game cover image must be smaller than 5 MB.'
            ]);

            exit;
        }

        $cloudinaryName = trim((string) (getenv('CLOUDINARY_CLOUD_NAME') ?: ''));
        $cloudinaryKey = trim((string) (getenv('CLOUDINARY_API_KEY') ?: ''));
        $cloudinarySecret = trim((string) (getenv('CLOUDINARY_API_SECRET') ?: ''));

        if ($cloudinaryName !== '' && $cloudinaryKey !== '' && $cloudinarySecret !== '') {
            $timestamp = time();
            $folder = 'gamespec-covers';
            $signatureBase = 'folder=' . $folder . '&timestamp=' . $timestamp . $cloudinarySecret;
            $signature = sha1($signatureBase);
            $cloudinaryUrl = 'https://api.cloudinary.com/v1_1/' . rawurlencode($cloudinaryName) . '/image/upload';
            $cloudinaryPayload = [
                'file' => 'data:image/' . strtolower($matches[1]) . ';base64,' . base64_encode($imageBinary),
                'api_key' => $cloudinaryKey,
                'timestamp' => $timestamp,
                'folder' => $folder,
                'signature' => $signature,
            ];

            $curl = curl_init($cloudinaryUrl);
            curl_setopt_array($curl, [
                CURLOPT_POST => true,
                CURLOPT_POSTFIELDS => $cloudinaryPayload,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT => 30,
            ]);
            $cloudinaryResponse = curl_exec($curl);
            $cloudinaryStatus = (int) curl_getinfo($curl, CURLINFO_HTTP_CODE);
            $cloudinaryError = curl_error($curl);
            curl_close($curl);

            $cloudinaryResult = is_string($cloudinaryResponse)
                ? json_decode($cloudinaryResponse, true)
                : null;
            if ($cloudinaryError !== '' || $cloudinaryStatus < 200 || $cloudinaryStatus >= 300 || !is_array($cloudinaryResult) || empty($cloudinaryResult['secure_url'])) {
                error_log('Cloudinary upload failed: HTTP ' . $cloudinaryStatus . '; cURL: ' . $cloudinaryError . '; response: ' . (is_string($cloudinaryResponse) ? $cloudinaryResponse : 'none'));
                throw new RuntimeException('Unable to upload game cover to Cloudinary.');
            }

            $coverUrl = (string) $cloudinaryResult['secure_url'];
        } else {

        /*
         * Normalize extension (use jpg rather than jpeg for filenames).
         */
        $extension = $imageType;

        if ($extension === 'jpeg') {
            $extension = 'jpg';
        }

        /*
         * Create the upload directory.
         *
         * PHP file:
         *     GameSpec-Optimizer/MODULES/api/update-games.php
         *
         * Upload directory:
         *     GameSpec-Optimizer/uploads/game-covers/
         *
         * Web URL stored in games.cover_url:
         *     GameSpec-Optimizer/uploads/game-covers/<file>
         * stored as a project-relative path so it works whether the
         * project is served from the document root or a subfolder.
         */
        $projectRoot = dirname(__DIR__, 2);
        $uploadDirectory = $projectRoot . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . 'game-covers';

        if (!is_dir($uploadDirectory)) {
            if (!mkdir($uploadDirectory, 0755, true) && !is_dir($uploadDirectory)) {
                throw new RuntimeException(
                    'Unable to create game cover upload directory.'
                );
            }
        }

        /*
         * Generate a unique filename.
         */
        $filename = 'game_' . bin2hex(random_bytes(16)) . '.' . $extension;

        $filePath = $uploadDirectory . DIRECTORY_SEPARATOR . $filename;

        /*
         * Save the image.
         */
        if (file_put_contents($filePath, $imageBinary) === false) {
            throw new RuntimeException(
                'Unable to save game cover image.'
            );
        }

        /*
         * Store only the relative/web path in the database.
         *
         * This is much smaller than storing base64 and stays under
         * the VARCHAR(1000) limit for games.cover_url.
         */
        $coverUrl = 'uploads/game-covers/' . $filename;
        }
    }

    /*
     * ============================================================
     * EDIT EXISTING GAME
     * ============================================================
     *
     * If gameId was supplied by JavaScript, this is EDIT mode.
     */

    if ($gameId > 0) {

        $gameStatement = $database->prepare(
            'SELECT game_id, cover_url
             FROM games
             WHERE game_id = :game_id
             LIMIT 1'
        );

        $gameStatement->execute([
            'game_id' => $gameId
        ]);

        $game = $gameStatement->fetch();

        if (!$game) {

            http_response_code(404);

            echo json_encode([
                'success' => false,
                'message' => 'The game you are trying to edit does not exist.'
            ]);

            exit;
        }

        /*
         * If no new image was selected, keep the existing image.
         */
        if ($coverUrl === null) {
            $coverUrl = $game['cover_url'];
        }

        /*
         * Update game information.
         */
        $updateGame = $database->prepare(
            'UPDATE games
             SET title = :title,
                 description = :description,
                 cover_url = :cover_url,
                 release_date = :release_date,
                 release_year = :release_year,
                 genres = :genres,
                 platforms = :platforms,
                 updated_at = NOW()
             WHERE game_id = :game_id'
        );

        $updateGame->execute([
            'title' => $title,
            'description' => $description !== '' ? $description : null,
            'cover_url' => $coverUrl,
            'release_date' => $releaseYear . '-01-01',
            'release_year' => $releaseYear,
            'genres' => $genres ? json_encode($genres) : null,
            'platforms' => json_encode($platforms),
            'game_id' => $gameId
        ]);

        $currentGameId = $gameId;

        $successMessage =
            'Game updated successfully. Benchmark resolution queued.';
    }

    /*
     * ============================================================
     * ADD NEW GAME
     * ============================================================
     *
     * No gameId means this is ADD mode.
     */

    else {

        /*
         * Make sure a game with the same title does not already exist.
         */
        $duplicateStatement = $database->prepare(
            'SELECT game_id
             FROM games
             WHERE LOWER(title) = LOWER(:title)
             LIMIT 1'
        );

        $duplicateStatement->execute([
            'title' => $title
        ]);

        $existingGame = $duplicateStatement->fetch();

        if ($existingGame) {

            http_response_code(409);

            echo json_encode([
                'success' => false,
                'message' => 'A game with that title already exists.'
            ]);

            exit;
        }

        /*
         * Create a simple slug.
         *
         * Example:
         *
         * Grand Theft Auto V
         *
         * becomes:
         *
         * grand-theft-auto-v
         */
        $slug = strtolower($title);

        $slug = preg_replace(
            '/[^a-z0-9]+/i',
            '-',
            $slug
        );

        $slug = trim((string) $slug, '-');

        /*
         * Make sure the slug is not empty.
         */
        if ($slug === '') {
            $slug = 'game-' . time();
        }

        /*
         * Make the slug unique if necessary.
         */
        $originalSlug = $slug;
        $slugNumber = 2;

        while (true) {

            $slugStatement = $database->prepare(
                'SELECT game_id
                 FROM games
                 WHERE slug = :slug
                 LIMIT 1'
            );

            $slugStatement->execute([
                'slug' => $slug
            ]);

            if (!$slugStatement->fetch()) {
                break;
            }

            $slug = $originalSlug . '-' . $slugNumber;
            $slugNumber++;
        }

        /*
         * Insert the new game.
         *
         * rawg_id and steam_app_id remain NULL because
         * this is a manually added game.
         */
        $insertGame = $database->prepare(
            'INSERT INTO games
                (
                    title,
                    slug,
                    description,
                    cover_url,
                    release_date,
                    release_year,
                    genres,
                    platforms,
                    is_active,
                    created_at,
                    updated_at
                )
             VALUES
                (
                    :title,
                    :slug,
                    :description,
                    :cover_url,
                    :release_date,
                    :release_year,
                    :genres,
                    :platforms,
                    1,
                    NOW(),
                    NOW()
                )'
        );

        $insertGame->execute([
            'title' => $title,
            'slug' => $slug,
            'description' => $description !== '' ? $description : null,
            'cover_url' => $coverUrl,
            'release_date' => $releaseYear . '-01-01',
            'release_year' => $releaseYear,
            'genres' => $genres ? json_encode($genres) : null,
            'platforms' => json_encode($platforms)
        ]);

        $currentGameId = (int) $database->lastInsertId();

        $successMessage =
            'Game added successfully. Benchmark resolution queued.';
    }

    /*
     * ============================================================
     * SAVE GAME REQUIREMENTS
     * ============================================================
     */

    $requirement = $database->prepare(
        'INSERT INTO game_requirements
            (
                game_id,
                requirement_type,
                cpu_text,
                gpu_text,
                ram_text,
                ram_capacity_gb,
                ram_speed_mhz,
                source,
                synced_at
            )
         VALUES
            (
                :game_id,
                "minimum",
                :cpu_text,
                :gpu_text,
                :ram_text,
                :ram_capacity_gb,
                :ram_speed_mhz,
                "admin",
                NOW()
            )
         ON DUPLICATE KEY UPDATE
            cpu_text = VALUES(cpu_text),
            gpu_text = VALUES(gpu_text),
            ram_text = VALUES(ram_text),
            ram_capacity_gb = VALUES(ram_capacity_gb),
            ram_speed_mhz = VALUES(ram_speed_mhz),
            source = "admin",
            synced_at = NOW(),
            updated_at = NOW()'
    );

    $requirement->execute([
        'game_id' => $currentGameId,
        'cpu_text' => $cpuModel,
        'gpu_text' => $gpuModel,
        'ram_text' => $ramCapacityGb . ' GB RAM',
        'ram_capacity_gb' => $ramCapacityGb,
        'ram_speed_mhz' => $ramSpeedMhz
    ]);

    /*
     * ============================================================
     * QUEUE BENCHMARK RESOLUTION
     * ============================================================
     */

    $syncJob = $database->prepare(
        'INSERT INTO sync_jobs
            (
                game_id,
                job_type,
                status,
                run_after
            )
         VALUES
            (
                :game_id,
                "benchmark_resolution",
                "queued",
                NOW()
            )'
    );

    $syncJob->execute([
        'game_id' => $currentGameId
    ]);

    /*
     * ============================================================
     * SUCCESS
     * ============================================================
     */

    echo json_encode([
        'success' => true,
        'game_id' => $currentGameId,
        'message' => $successMessage
    ]);

} catch (Throwable $error) {

    error_log(
        'update-games.php error: ' . $error->getMessage()
    );

    http_response_code(500);

    echo json_encode([
        'success' => false,
        'message' => 'Unable to save game.'
    ]);
}