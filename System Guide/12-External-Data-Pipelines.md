# 12 — External Data Pipelines

GameSpec Optimizer supports ingesting external game metadata and hardware requirements directly from the **RAWG Video Games Database API** and **Steam Store API**.

---

## 1. Components

- **Client Wrapper:** `MODULES/rawg-steam-client.php`
- **Catalog Ingestion Script:** `MODULES/import-rawg-catalog.php` (CLI executable)
- **Cursor State Table:** `game_sync_state`

---

## 2. API Sources & Rate Limits

| Service | Used For | Endpoint | Rate Limits & Auth |
|---|---|---|---|
| **RAWG API** | Catalog discovery, game descriptions, release dates, platforms, genres, default requirements | `https://api.rawg.io/api/games` | Requires API key (`RAWG_API_KEY`); ~20,000 requests/month free tier |
| **Steam Store API** | Detailed PC requirements (Minimum & Recommended) | `https://store.steampowered.com/api/appdetails` | Rate limited to ~200 requests per 5 minutes; no key required |

---

## 3. Data Flow & Normalization

```
MODULES/import-rawg-catalog.php
  │
  ├─ 1. Query game_sync_state for 'rawg_catalog' last_cursor (page number)
  │
  ├─ 2. Fetch page of games from RAWG API
  │
  ├─ 3. For each game:
  │   ├─ Check if steam_app_id exists in RAWG stores payload
  │   │
  │   ├─ If Steam ID found:
  │   │   └─ Query Steam appdetails API for clean PC requirements
  │   │
  │   ├─ Fallback: Extract requirements from RAWG platforms.pc.requirements
  │   │
  │   ├─ Insert/Update row in games table
  │   ├─ Insert Minimum & Recommended rows in game_requirements
  │   └─ Enqueue job in sync_jobs for benchmark resolution
  │
  └─ 4. Update game_sync_state.last_cursor with next page URL
```

---

## 4. Requirement Parsing (`rawg-steam-client.php`)

Steam returns requirements as raw HTML snippets:
```html
<strong>Minimum:</strong><br><ul class="bb_ul"><li><strong>OS:</strong> Windows 10 64-bit<br></li><li><strong>Processor:</strong> Intel Core i5-2500K / AMD FX-6300<br></li><li><strong>Memory:</strong> 8 GB RAM<br></li><li><strong>Graphics:</strong> NVIDIA GeForce GTX 770 2GB / AMD Radeon R9 280 3GB<br></li>...</ul>
```

`parseSteamRequirementsHtml()` cleans and parses these strings:
- Strips tags using regex / `strip_tags()`.
- Extracts individual hardware fields:
  - `OS`
  - `Processor` (CPU)
  - `Memory` (RAM in GB)
  - `Graphics` (GPU)
  - `Storage` (Disk space)
- Standardizes delimiters (converting `"or"`, `"/"`, `","` into canonical slash separators).

---

## 5. Execution

Run the import pipeline from CLI:

```bash
cd C:\xampp\htdocs\New\GameSpec-Optimizer\MODULES
php import-rawg-catalog.php --pages=1
```

After running, new games will sit with `is_active = 0` until `resolve-game-benchmarks.php` is executed.
