# 10 — Admin Panel Deep Dive

The Admin panel provides catalog management, hardware addition, feedback moderation, and aggregate system metrics.

---

## 1. Page Inventory & Routes

All admin views are located in `FRONT-END/HTML/Admin Side/`:

| File | Page Title | Primary Operations |
|---|---|---|
| `dashboard-admin.php` | Admin Dashboard | System KPI stats cards, top-10 hardware ranking tables, CSV report exports |
| `game-management.php` | Game Management | Add, edit, and delete game entries and hardware requirement strings |
| `hardware-management.php` | Hardware Management | Direct insert for CPU, GPU, and RAM benchmark records |
| `ml-training.php` | ML Model Training | **Client-side simulation shell** (see `07-ML-Training.md`) |
| `feedback-management.php` | Feedback Management | Overview counts, keyword search, report badges, and review deletion |

---

## 2. Dashboard KPIs & Aggregations (`dashboard-admin.php`)

On load, `loadDashboardStats()` in `AdminSideFunction.js` fetches `/api/get-games.php`, `/api/get-cpus.php`, and `/api/get-gpus.php`:

1. **Total Games:** Count of returned games.
2. **Total CPUs / GPUs:** Total benchmark inventory.
3. **Average CPU / GPU Score:** Sum of benchmark scores divided by total count.
4. **Top 10 Tables:** Slices the top 10 items sorted descending by score.
5. **CSV Reports:** Handled by `export-games.php`, `export-cpus.php`, and `export-gpus.php` via standard `Content-Disposition: attachment` headers.

---

## 3. Feedback Moderation (`feedback-management.php`)

Unlike the user view which only shows approved feedback, the admin panel allows full moderation:

- **Source API:** Fetches `/api/get-latest-feedback.php`.
- **Search & Filtering:** Client-side filtering via `filterFeedbackAdmin()` on title, comment, and username.
- **Report Badges:** Highlights items where `reported_count > 0` with `.feedback-admin-badge-danger`.
- **Deletion:** Invokes `/api/delete-feedback.php` with `feedback_id`.

---

## 4. Hardware Management UI Bugs (CONTRADICTIONS C7 & C9)

In `hardware-management.php`:
- The submit button on the **GPU form** (`#gpuForm`) is mislabeled as **"Save CPU"**.
- The submit button on the **RAM form** (`#ramForm`) is also mislabeled as **"Save CPU"**.

Both forms route to their correct API endpoints (`update-gpus.php` and `update-ram.php`); only the button text is erroneous.

---

## 5. Security & Access Control

> ⚠️ **NO AUTHENTICATION LAYER:**
>
> 1. There are **no session checks, logins, or HTTP basic auth** on any page in `FRONT-END/HTML/Admin Side/`.
> 2. Administrative pages and administrative API endpoints are protected by the shared session guard in `MODULES/auth.php`. State-changing admin requests also require the session CSRF token.
> 3. Navigation to admin remains discoverable through the direct URL or the hidden triple-click trigger, but direct access now redirects unauthenticated visitors to `login.php`.

## 7. Authentication and Authorization

Admin authentication uses the existing PHP/PDO architecture and the `users` table defined in `DATA/auth-migration.sql`.

- `FRONT-END/HTML/Admin Side/login.php` accepts admin credentials and verifies them with `password_verify()`.
- Passwords are stored only as `password_hash()` output. Use `tools/create-admin.php` from the CLI to provision an administrator.
- `MODULES/auth.php` owns the `gamespec_admin` session, session timeout, session regeneration, logout, CSRF token, and role checks.
- `FRONT-END/HTML/Admin Side/admin-guard.php` protects every server-rendered admin page.
- `MODULES/api/admin-auth.php` protects admin API requests with `401` (not authenticated) and `403` (not an administrator).
- Non-GET admin API requests require `X-CSRF-Token` matching the current session token.
- `logout.php` accepts only a CSRF-protected POST request and destroys the session.
- The login page includes password visibility, Remember me, and password recovery controls.
- Remember me stores only a hashed validator in `admin_auth_tokens` and uses an HttpOnly, SameSite cookie.
- Password recovery stores only hashed, expiring reset tokens in `admin_password_resets`.
- Recovery email delivery requires `APP_BASE_URL` and `MAIL_FROM` in `.env.local`, plus a configured PHP mail transport.

Apply the migration before first login:

```text
mysql gamespec_optimizer < DATA/auth-migration.sql
php tools/create-admin.php
```

The initial administrator password must be supplied interactively and must not be committed to source control.
