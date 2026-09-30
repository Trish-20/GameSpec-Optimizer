# 03 — Game Management (Add / Edit / Delete)

All three operations flow through **one** admin page and **two** API endpoints.

---

## 1. The moving parts

| Step | File | Location |
|---|---|---|
| Admin form | `FRONT-END/HTML/Admin Side/game-management.php` | `<form id="gameForm">` |
| JS submit handler | `FRONT-END/JAVASCRIPT/Admin Side/AdminSideFunction.js` | line 787 |
| JS edit button | same file | `editGame(index)` line 386 |
| JS delete button | same file | `deleteGame(index)` line 439 |
| Add/Edit API | `MODULES/api/update-games.php` | 495 lines |
| Delete API | `MODULES/api/delete-games.php` | 140 lines |
| Data reload | `AdminSideFunction.js` | `loadAdminGames()` line 252 |

**Important:** `update-games.php` handles **both** add and edit. The mode is decided by one thing — the presence of `gameId` in the JSON body (`update-games.php:20`):

```php
// gameId is only present when EDITING.
$gameId = isset($input['gameId']) ? (int) $input['gameId'] : 0;
```

---

## 2. ADD GAME — complete trace

### Step 1 — Form fields

`game-management.php` provides exactly 7 inputs:

| Element id | Field | HTML `required` |
|---|---|---|
| `#gameTitle` | title | yes |
| `#gameDescription` | description | no |
| `#gameCPU` | min CPU requirement | yes |
| `#gameGPU` | min GPU requirement | yes |
| `#gameRAM` | min RAM capacity (GB) | yes (number) |
| `#gameRAMSpeed` | min RAM speed (MHz) | yes (number) |
| `#gameCover` | cover image file | no |

There is **no** input for RAWG id, Steam id, release date, genres, platforms, storage, OS, or recommended requirements.

### Step 2 — JS validation (`AdminSideFunction.js:798-812`)

```js
if (!title || !cpuModel || !gpuModel ||
    !Number.isFinite(ramGB) || ramGB <= 0 ||
    !Number.isFinite(ramSpeedMhz) || ramSpeedMhz <= 0) {
    showModal('Warning', 'Please complete all game and hardware requirement fields.');
    return;
}
```

### Step 3 — Client-side duplicate check (lines 822-836)

Only when **not** editing; compares against the already-loaded `adminGames` using `normalizeModelName()` (line 174 — lowercase, trim, collapse whitespace):

```js
if (!isEditing) {
    const duplicate = adminGames.some(game =>
        normalizeModelName(game.title) === normalizeModelName(title));
    if (duplicate) { showModal('Warning', 'A game with that title already exists.'); return; }
}
```

> This check is only as fresh as the last `loadAdminGames()` call. The server check (Step 8) is authoritative.

### Step 4 — Image → base64 (lines 760-780)

```js
if (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) { ... return; }
selectedGameCoverData = await readFileAsDataUrl(file);   // FileReader, line 165
```

The file becomes a **Data URL** in the browser and is sent as a string.

### Step 5 — POST (lines 838-873)

```js
const payload = { title, description, cpuModel, gpuModel,
                  ramCapacityGb: ramGB, ramSpeedMhz, imageData: selectedGameCoverData };
if (isEditing) payload.gameId = adminGames[editingGameIndex].game_id;

fetch('../../../MODULES/api/update-games.php', { method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload) });
```

### Step 6 — PHP validation (`update-games.php:22-37`)

Returns **400** unless all five are present:

```php
if ($title === '' || $cpuModel === '' || $gpuModel === '' ||
    $ramCapacityGb <= 0 || $ramSpeedMhz <= 0) {
    http_response_code(400);
    echo json_encode(['success'=>false,
        'message'=>'Title, CPU, GPU, RAM capacity, and RAM speed are required.']);
    exit;
}
```

---
### Step 7 — Image handling (`update-games.php:60-189`)

1. Regex must match (line 68): `^data:image/(jpeg|jpg|png|webp|gif|avif);base64,(.+)$` → else **400** *"Invalid game cover image."*
2. `base64_decode($base64Data, true)` (line 89) → else **400** *"Unable to decode game cover image."*
3. `@getimagesizefromstring($imageBinary)` (line 105) → else **400** *"The selected game cover is not a valid image."*
4. Size ≤ 5 MB (line 121) → else **400** *"Game cover image must be smaller than 5 MB."*
5. `jpeg` normalised to `jpg` (lines 135–139)
6. Directory created if missing: `<projectRoot>/uploads/game-covers` with mode `0755` (lines 155–164)
7. Filename: `'game_' . bin2hex(random_bytes(16)) . '.' . $extension` (line 169) — 32 random hex chars, unpredictable
8. `file_put_contents()` (line 176)
9. **Only the relative path is stored**: `$coverUrl = 'uploads/game-covers/' . $filename` (line 188)

If no image was supplied, `$coverUrl` stays `null` and `cover_url` is NULL in the row.

The frontend rebuilds an usable URL in `getGameImageUrl()` (`UserSideFunction.js:28-40`) and `resolveAdminGameImageUrl()` (`AdminSideFunction.js:372`): a `uploads/…` value becomes `../../../uploads/…` from `FRONT-END/HTML/*/`.

### Step 8 — Duplicate check (authoritative, lines 271-294)

```php
SELECT game_id FROM games WHERE LOWER(title) = LOWER(:title) LIMIT 1
```
→ **409** *"A game with that title already exists."*

### Step 9 — Slug generation (lines 307-349)

```php
$slug = strtolower($title);
$slug = preg_replace('/[^a-z0-9]+/i', '-', $slug);
$slug = trim((string) $slug, '-');
if ($slug === '') $slug = 'game-' . time();      // fallback
```
Then a uniqueness loop: if taken, append `-2`, `-3`, … (lines 327–349).

Examples: `Grand Theft Auto V` → `grand-theft-auto-v`. `GrandTheftAutoV` → `grandtheftautov`.

**The slug is written once at insert time and is never updated on edit** (see §3).

### Step 10 — INSERT games (lines 357-387)

```php
INSERT INTO games (title, slug, description, cover_url, is_active, created_at, updated_at)
VALUES (:title, :slug, :description, :cover_url, 1, NOW(), NOW())
```

- **`rawg_id` is not in the column list.**
- **`steam_app_id` is not in the column list.**
- `is_active` is set to `1` here — but the resolver overwrites it later (§5).
- `$currentGameId = (int) $database->lastInsertId();`
- Success message: *"Game added successfully. Benchmark resolution queued."*

> ⚠️ **CONTRADICTION C1.** `mysql-schema.sql:64` declares `rawg_id BIGINT UNSIGNED NOT NULL` with no default, so this INSERT should fail under strict mode. The code comment at line 355 asserts the values "remain NULL". **Live behaviour: NOT VERIFIED FROM SOURCE.** Check `SHOW CREATE TABLE games` first — see `16-Troubleshooting.md`.

### Step 11 — UPSERT requirements (lines 399-442)

```php
INSERT INTO game_requirements
    (game_id, requirement_type, cpu_text, gpu_text, ram_text,
     ram_capacity_gb, ram_speed_mhz, source, synced_at)
VALUES (:game_id, "minimum", :cpu_text, :gpu_text, :ram_text,
        :ram_capacity_gb, :ram_speed_mhz, "admin", NOW())
ON DUPLICATE KEY UPDATE
    cpu_text = VALUES(cpu_text), gpu_text = VALUES(gpu_text),
    ram_text = VALUES(ram_text), ram_capacity_gb = VALUES(ram_capacity_gb),
    ram_speed_mhz = VALUES(ram_speed_mhz), source = "admin",
    synced_at = NOW(), updated_at = NOW()
```

Bound values (lines 435–442):

| Bound name | Value |
|---|---|
| `cpu_text` | the raw CPU string **exactly as typed** |
| `gpu_text` | the raw GPU string **exactly as typed** |
| `ram_text` | `"<capacity> GB RAM"` → e.g. `"16 GB RAM"` |
| `ram_capacity_gb` | the number |
| `ram_speed_mhz` | the number |
| `source` | **`'admin'`** |
| `requirement_type` | **always `'minimum'`** |

The `ON DUPLICATE KEY UPDATE` keys on `uq_game_requirement_type (game_id, requirement_type)` — this is why re-saving an edited game updates rather than duplicates.

**No `recommended` row is ever created by the admin flow.** No OS, no storage, no `raw_html`.

### Step 12 — Queue benchmark resolution (lines 450-469)

```php
INSERT INTO sync_jobs (game_id, job_type, status, run_after)
VALUES (:game_id, "benchmark_resolution", "queued", NOW())
```

**That is the end of the request.** Response: `{success: true, game_id, message}`.

---

## 3. What happens to each field on EDIT

Edit starts at `editGame(index)` (`AdminSideFunction.js:386`), which fills the form, calls `setGameFormMode(true, title)` (line 426), and sets `editingGameIndex`. The submit handler then adds `payload.gameId` (line 861) and reuses the same endpoint.

`update-games.php` branch `$gameId > 0` (lines 199–256):

| Field | Behaviour |
|---|---|
| **Existing image** | Preserved: `if ($coverUrl === null) $coverUrl = $game['cover_url'];` (lines 229–231). **The old file is never deleted on edit** — there is no `unlink()` in this branch, so replaced covers accumulate on disk. |
| **Description** | `UPDATE games SET description = :description`; **NULL if left empty** (line 247) |
| **Title** | Updated (line 246) |
| **Slug** | **Not updated.** Not in the `UPDATE` column list. |
| **RAWG ID** | **Not touched** — not in the UPDATE list, so preserved |
| **Steam ID** | **Not touched** — preserved |
| **Release / genres / platforms** | **Not touched** — not editable from this form |
| **Requirements** | Same UPSERT as Step 11 (lines 399–442), matching `(game_id, 'minimum')` — overwrites CPU/GPU/RAM text and numbers, sets `source='admin'` |
| **Benchmark matches** | **Not deleted.** Existing `game_benchmark_matches` rows stay as-is (stale) until a resolver run overwrites them. |
| **New job** | Another `sync_jobs` row is queued (lines 450–469). **No dedup guard** — editing 5 times queues 5 jobs. |

Edit success message: *"Game updated successfully. Benchmark resolution queued."*

### Not-found path
`SELECT game_id, cover_url FROM games WHERE game_id = :game_id` (lines 201–212) → no row → **404** *"The game you are trying to edit does not exist."*

---


## 4. DELETE GAME — complete trace

### Client (`AdminSideFunction.js:439-501`)

1. Resolves the game by index; requires `game.game_id` (lines 446–449) → else *"Unable to determine which game is being deleted."*
2. Confirmation modal (line 451)
3. `fetch('../../../MODULES/api/delete-games.php', {method:'POST', body: JSON.stringify({gameId: game.game_id)})` (lines 457–466)
4. On success: exits edit mode if that game was being edited (lines 477–481), re-runs `loadAdminGames()` (line 484)

### Server (`delete-games.php`)

| Lines | Behaviour |
|---|---|
| 15–37 | Accepts the id from **JSON body, `$_POST`, or `$_GET`**, trying keys `gameId`, `game_id`, `id` in that order |
| 39–48 | `gameId <= 0` → **400** *"A valid gameId is required to delete a game."* |
| 53–75 | `SELECT game_id, title, cover_url` → no row → **404** *"…does not exist."* |
| 89–96 | `DELETE FROM games WHERE game_id = :game_id` — **one statement, hard delete** |
| 98–107 | `rowCount() === 0` → **404** (race with the earlier SELECT) |
| 110–122 | Deletes the local cover file **only if** the path starts with `uploads/game-covers/` and is not `http(s)`, with a `realpath()` containment check |
| 124–128 | `{success: true, game_id, message: 'Game deleted successfully.'}` |

### What is deleted automatically, and why

| Record | Mechanism |
|---|---|
| `game_requirements` | FK `fk_requirements_game … ON DELETE CASCADE` (`mysql-schema.sql:103-106`) |
| `game_benchmark_matches` | **Transitively** — its own FK cascades from `game_requirements` (`mysql-schema.sql:122-125`) |
| `sync_jobs` | FK `fk_sync_jobs_game … ON DELETE CASCADE` (`mysql-schema.sql:151-154`) |
| `uploads/game-covers/<file>` | PHP `unlink()`, path-guarded (not DB-driven) |
| `reviews` | Would cascade — but that table is never written |
| `site_feedback` | **Not affected** — no `game_id` column |

The reasoning is spelled out in the comment at `delete-games.php:82-88`.

**User-side visibility:** immediate — `get-games.php:18` filters `g.is_active = 1`, and the row no longer exists.

> Deleting the cover file only triggers when `cover_url` starts with `uploads/game-covers/`. A **remote** RAWG/Steam cover (`https://media.rawg.io/...`) is deliberately never deleted (guard at line 110).

---

## 5. Explicit answers

### Does adding a game require RAWG?
**No.** `update-games.php` does not `require` `rawg-steam-client.php`, never calls `rawgRequest()`, and never reads `RAW_API_KEY`. RAWG is used only by `import-rawg-catalog.php`, `enrich-games.php` and `get-game-details.php`.

### Does adding a game require Steam?
**No.** `steamAppDetailsRequest()` and `findSteamAppIdByTitle()` are not reachable from the add path.

**Contrast:** in the *import* path, a Steam import that fails to find a `steam_app_id` explicitly sets `is_active = 0` and skips requirements (`enrich-games.php:60-76`). That penalty applies only to the import path.

### Does adding a game require ML retraining?
**No.** See `07-ML-Training.md` — the model has no per-game parameters.

### Does a new game become usable for prediction immediately?
**Not reliably.** Two conditions must hold:
1. It must be visible — `is_active = 1` (it starts that way, but a resolver run can flip it to 0).
2. Its `minimum` requirement must have numeric `benchmark_score` for CPU, GPU **and** RAM, otherwise `game_cpu_min` arrives as `null`, `parseInt(null)` → `NaN`, and `hardware-specs-input.php` rejects it with *"Missing or invalid field: game_cpu_min"*.

### What happens before benchmark resolution?
- `games` row exists, `is_active = 1`
- One `game_requirements` row (`minimum`, `source='admin'`)
- **Zero** `game_benchmark_matches` rows
- One `sync_jobs` row, `status='queued'`
- Game **is** visible in the browser, but `cpu_benchmark`/`gpu_benchmark`/`ram_benchmark` are `null` in the JSON

### What happens after benchmark resolution?
- 3 `game_benchmark_matches` rows written (or `unresolved` with NULL scores)
- `games.is_active` recomputed
- `sync_jobs.status` → `'complete'`, or `'failed'` with `last_error`
- Only if all 3 scores are non-NULL does the game stay/become predictively usable

---


## 6. Image handling — complete summary

```
Admin selects file (#gameCover)
   │  AdminSideFunction.js:760-780
   ├─ rejects non-image/* types and >5 MB client-side
   └─ readFileAsDataUrl(file)  →  "data:image/jpeg;base64,/9j/4AAQ…"  (line 165)
          │
          │  sent as payload.imageData
          ▼
update-games.php
   ├─ regex  ^data:image/(jpeg|jpg|png|webp|gif|avif);base64,(.+)$   (line 68)
   ├─ base64_decode(strict)                                          (line 89)
   ├─ getimagesizefromstring()  ← real image validation              (line 105)
   ├─ strlen <= 5 MB                                                 (line 121)
   ├─ mkdir uploads/game-covers 0755 if absent                       (line 158)
   ├─ file_put_contents(  'game_' + bin2hex(random_bytes(16)) + '.'+ext )
   └─ cover_url = 'uploads/game-covers/' . $filename                 (line 188)
          │
          ▼
MySQL games.cover_url VARCHAR(1000)   ← relative path only, never base64
          │
          ▼
Frontend: getGameImageUrl()  /  resolveAdminGameImageUrl()
          "uploads/game-covers/x.jpg"  →  "../../../uploads/game-covers/x.jpg"
```

**Storage decisions worth knowing:**
- The **base64 is never persisted** — good, it keeps rows small and stays under the `VARCHAR(1000)` limit.
- Filenames are cryptographically random → no overwrite, no traversal via filename.
- The 5 MB check happens **twice** (client line 765, server line 121). Only the server one is authoritative.
- **On edit with a new image, the previous file is orphaned** — no `unlink()` in the edit branch (contrast `delete-games.php:110-122`).

---

## 7. Verification queries (read-only)

```sql
-- The new game
SELECT game_id, title, slug, rawg_id, steam_app_id, cover_url, is_active, created_at
FROM games ORDER BY game_id DESC LIMIT 3;

-- Its requirement (expect exactly one 'minimum' row, source='admin')
SELECT requirement_id, game_id, requirement_type, cpu_text, gpu_text, ram_text,
       ram_capacity_gb, ram_speed_mhz, source, synced_at
FROM game_requirements WHERE game_id = <game_id>;

-- The queued job
SELECT job_id, game_id, job_type, status, attempts, run_after, last_error, created_at
FROM sync_jobs WHERE game_id = <game_id> ORDER BY job_id DESC;

-- After running the resolver CLI
SELECT hardware_type, matched_model, matched_capacity_gb, matched_speed_mhz,
       benchmark_score, match_status, benchmark_source_version, resolved_at
FROM game_benchmark_matches
WHERE requirement_id = (SELECT requirement_id FROM game_requirements
                        WHERE game_id = <game_id>);

-- Visibility check (the exact gate condition)
SELECT g.game_id, g.title, g.is_active,
       COUNT(DISTINCT CASE WHEN m.benchmark_score IS NOT NULL THEN m.hardware_type END) AS resolved_of_3
FROM games g
LEFT JOIN game_requirements r ON r.game_id = g.game_id AND r.requirement_type = 'minimum'
LEFT JOIN game_benchmark_matches m ON m.requirement_id = r.requirement_id
WHERE g.game_id = <game_id>
GROUP BY g.game_id, g.title, g.is_active;
```

All of the above are `SELECT` only.

**Destructive — clearly labelled:** `DELETE FROM games WHERE game_id = <id>` cascades to `game_requirements`, `game_benchmark_matches`, and `sync_jobs`, and does **not** remove the cover file (that only happens via the API). Prefer the admin delete button.

---

## 8. Quick failure reference

| Symptom | Most likely cause | Check |
|---|---|---|
| *"Unable to save game."* (500) | `rawg_id` NOT NULL contradiction (C1) | `SHOW CREATE TABLE games` |
| *"A game with that title already exists."* (409) | Case-insensitive title collision | `SELECT game_id,title FROM games WHERE LOWER(title)=LOWER('<t>')` |
| *"Invalid game cover image."* (400) | Data URL regex failed | `payload.imageData` prefix in browser dev tools |
| Game saved but invisible to users | Resolver not run, or 1 of 3 matches failed | `sync_jobs.status`, then `game_benchmark_matches` |
| Game saved but prediction says missing field | `benchmark_score IS NULL` for CPU/GPU/RAM | see the gate query above |
| Edit did not change the URL | `slug` is not updated by design | §3 |

Fuller troubleshooting: `16-Troubleshooting.md`.

