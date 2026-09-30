# 11 — User Experience Flows

The user-facing application consists of four primary flows across `browse-games.php`, `fps-prediction.php`, `hardware-benchmark.php`, and `feedback.php`.

---

## 1. Flow 1: Catalog Exploration & Can-I-Run-This

```
[User visits browse-games.php]
  │
  ├─ Search & Genre Filter: Client-side filtering across games[] cache
  │
  ├─ Click "View Details" Modal:
  │   ├─ Shows cover, description, release date, genres, platforms
  │   └─ Displays Minimum and Recommended specs side-by-side
  │
  └─ Click "Can I Run This?":
      └─ Navigates to: fps-prediction.php?game=<slug>
```

When navigating via `fps-prediction.php?game=<slug>`, `UserSideFunction.js` reads the URL parameter on init, finds the matching game, and automatically selects it in the game dropdown.

---

## 2. Flow 2: FPS Prediction & Bottleneck Analysis

```
[User on fps-prediction.php]
  │
  ├─ Select Game (manual dropdown or prefilled via ?game=)
  │
  ├─ Hardware Configuration:
  │   ├─ Option A: Click "Detect Hardware" (auto-populates CPU, GPU, RAM)
  │   └─ Option B: Manual searchable dropdown selection
  │
  ├─ Quality Settings:
  │   ├─ Graphics Preset: Low, Medium, High, Ultra
  │   └─ Power Mode: Battery, Balanced, Performance
  │
  └─ Click "Analyze Performance":
      │
      ├─ POST payload to MODULES/hardware-specs-input.php
      ├─ Python runs ML inference
      ├─ Returns predicted FPS
      │
      ├─ Verdict Calculation:
      │   ├─ FPS >= 75: "Good / Excellent performance" (Green)
      │   ├─ 45 <= FPS < 75: "Playable performance" (Yellow)
      │   └─ FPS < 45: "Performance may be limited" (Red)
      │
      ├─ Bottleneck Diagnosis (if FPS < 45):
      │   └─ Evaluates CPU score, GPU score, RAM score against required
      │
      └─ History Persistence:
          └─ Saves run to localStorage (max 8 records)
```

---

## 3. Flow 3: Hardware Benchmark Lookup (`hardware-benchmark.php`)

Allows standalone comparison of components without selecting a game:

1. **Select Component Type:** CPU, GPU, or RAM.
2. **Search Component:** Searchable dropdown queries cached CSV/MySQL benchmark datasets.
3. **Display Stats:**
   - **Score:** Direct passmark/timespy equivalent benchmark score.
   - **Tier Badge:** High-end, mid-range, budget based on score thresholds.
   - **Relative Progress Bar:** Visual representation compared against highest hardware score in the database.

---

## 4. Flow 4: Community Feedback Submission (`feedback.php`)

1. User views paginated list of existing community feedback.
2. User clicks "Leave Feedback" button, opening modal.
3. User selects star rating (1–5) and inputs title, comment, and optional name.
4. If name is omitted, server flags as anonymous.
5. On submission, review immediately appears on page (default `is_approved = 1`).
6. Users can click "Helpful" (thumbs-up counter increments) or "Report" (flag count increments).
