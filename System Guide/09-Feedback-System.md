# 09 — Feedback System

The feedback system provides community reviews and ratings across the web app. It is independent of game records and has its own dedicated table, APIs, and user/admin interfaces.

---

## 1. End-to-end trace

```
[User on feedback.php]
  │
  ├─ View Reviews: fetch('../../../MODULES/api/get-latest-feedback.php')
  │   └─ renders cards with rating stars, title, comment, username
  │
  ├─ Submit Review: POST to '../../../MODULES/api/submit-feedback.php'
  │   └─ inserts into site_feedback with is_approved = 1
  │
  ├─ Mark Helpful: POST to '../../../MODULES/api/helpful-feedback.php'
  │   └─ increments helpful_count by 1
  │
  ├─ Report Review: POST to '../../../MODULES/api/report-feedback.php'
  │   └─ increments reported_count by 1
  │
  └─ Delete Review (Admin or Client): POST to '../../../MODULES/api/delete-feedback.php'
      └─ deletes row by feedback_id
```

---

## 2. API inventory

| Endpoint | Method | Input Parameters | Action |
|---|---|---|---|
| `MODULES/api/submit-feedback.php` | POST | `title` (max 150), `comment`, `rating` (1–5), optional `username` | Inserts new row with default `is_approved = 1` |
| `MODULES/api/get-latest-feedback.php` | GET | None | Returns up to 100 newest approved items (`LIMIT 100`) |
| `MODULES/api/get-feedback.php` | GET | `search`, `rating`, `page`, `limit` | Full server-side search/filter/pagination (orphaned, not called by JS) |
| `MODULES/api/helpful-feedback.php` | POST/GET | `feedback_id` | Increments `helpful_count` |
| `MODULES/api/report-feedback.php` | POST/GET | `feedback_id` | Increments `reported_count` |
| `MODULES/api/delete-feedback.php` | POST/GET | `feedback_id` | Permanently deletes row |

---

## 3. Server-side validation rules (`submit-feedback.php`)

1. **Title and comment required:** lines 24–28 verify non-empty strings.
2. **Rating bounds:** lines 30–34 enforce `rating >= 1 && rating <= 5`.
3. **Title length:** lines 36–40 enforce max 150 characters (`mb_strlen`).
4. **Anonymity rule:** lines 18–19 server-side determine anonymity:
   ```php
   $isAnonymous = $username === '' ? 1 : 0;
   ```
   The client-sent flag is ignored; if no display name is provided, `is_anonymous` is set to `1`.

---

## 4. Uncommitted Schema (CONTRADICTION C6)

`site_feedback` is used across 7 PHP files and 2 JavaScript files, but its `CREATE TABLE` is omitted from `mysql-schema.sql` and `gamespec_export.sql`.

To ensure the table exists on any environment:

```sql
CREATE TABLE IF NOT EXISTS `site_feedback` (
  `feedback_id` INT AUTO_INCREMENT PRIMARY KEY,
  `rating` INT NOT NULL,
  `feedback_title` VARCHAR(150) NOT NULL,
  `comment` TEXT NOT NULL,
  `display_name` VARCHAR(100) DEFAULT NULL,
  `is_anonymous` TINYINT(1) DEFAULT 0,
  `helpful_count` INT DEFAULT 0,
  `reported_count` INT DEFAULT 0,
  `is_approved` TINYINT(1) DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 5. Verification (read-only)

```sql
-- Check total reviews and approval status
SELECT is_approved, COUNT(*) AS count, AVG(rating) AS avg_rating
FROM site_feedback
GROUP BY is_approved;

-- View top 5 most helpful reviews
SELECT feedback_id, feedback_title, rating, display_name, helpful_count, reported_count
FROM site_feedback
ORDER BY helpful_count DESC
LIMIT 5;
```
