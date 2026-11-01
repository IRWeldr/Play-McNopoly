# 🤖 AGENTS.md — Autonomous Agent Operational & Troubleshooting Playbook
## Play-McNopoly (Port 8085) • Canadian Monopoly Automation, 5-Mascot 3D Arena & Vision Benchmark

> **For Future Coding Agents (Antigravity, Cursor, Claude Code, Aider, Devin, etc.):**  
> This file is your operational instruction manual. It equips you to diagnose, run, repair, and extend **Play-McNopoly** across any host OS (Linux, macOS, Windows), mobile ecosystem (Android, iOS, Chromebook), and local Vision LLM setup.

---

## 🎯 Fundamental Invariant: The "App + Sign-In" Guarantee

> **The User Contract**:  
> If the user can **(1) download the official McDonald's app** and **(2) sign in to their account on any connected phone**, the system **must** handle everything else end-to-end without manual code typing.

If this contract breaks for any reason, use the diagnostic state machine below to identify and fix the issue.

---

## 🧭 Architecture at a Glance

```text
Play-McNopoly/
├── manage.py                     # Django server (Port 8085)
├── LICENSE                       # MIT Open-Source License
├── README.md                     # Human user overview & quickstart
├── AGENTS.md                     # Machine & Agent operational directives (THIS FILE)
├── Error-Handling.md             # Detailed troubleshooting guide & diagnostic logs
├── benchmark.py                  # Vision evaluation tool across models (LM Studio / Ollama)
├── dataset/                      # Clean 300 DPI benchmark scans & mascot reference images
│   ├── MONOPOLY-gameboard.pdf    # Official 2026 Canadian Golden Edition Game Board PDF
│   ├── annotations.json          # Ground-truth: 127 verified pieces
│   ├── page1.png                 # Structured grid sheet (grid challenges)
│   ├── page2.png                 # Unstructured scattered stamps (odd-angles)
│   ├── Grimace.jpg               # Reference image for 3D Grimace
│   ├── Birdie_Profile.webp       # Reference image for 3D Birdie
│   ├── Hamburgler.jpeg           # Reference image for 3D Hamburglar
│   └── Ronald_McDonald.webp      # Reference image for 3D Ronald McDonald
├── automation/
│   ├── adb_manager.py            # Unified backend service for Django Web UI & Sovereign E-Stop
│   ├── cli_runner.py             # Headless terminal CLI entry runner
│   └── sync_board_from_pdf.py    # 4-Quadrant rotational PDF board ingestion & calibration
├── game/                         # Django App (Views, Models, 3D Arena)
│   ├── board_data.py             # Official 40-square 2026 Canadian Golden Edition properties
│   ├── extractor.py              # Hybrid HSV Color-Bar CV (<2ms) + Local Vision LLM OCR
│   ├── management/commands/
│   │   └── seed_board.py         # Clean 40-square board seeder (`python3 manage.py seed_board`)
│   ├── static/game/js/           # Air-gapped Three.js & 5-Mascot Procedural 3D Engine
│   │   ├── grimace/
│   │   │   ├── grimace-mesh.js   # 🟣 Grimace (16-shell curly fur shader)
│   │   │   └── grimace-particles.js # 11-color Multi-Character & Monopoly particle vortex
│   │   └── mascot/
│   │       ├── mascot-core.js    # Unified 3D controller, pointer tracking, wave rig & mode switcher
│   │       ├── birdie-mesh.js    # 🐤 Birdie the Early Bird (14-shell feather shader)
│   │       ├── hamburglar-mesh.js # 🍔 Hamburglar (GLSL prison-stripe suit + Hamburger SDF tie)
│   │       ├── ronald-mesh.js    # 🤡 Ronald McDonald (Skinny jumpsuit + giant glossy red clown shoes)
│   │       └── monopoly-mesh.js  # 🎩 Mr. Monopoly (Tuxedo, top hat, cane + Mandela Monocle toggle)
│   └── templates/game/           # 40-Square Boardroom & AMOLED mobile portal
└── mcnopoly_core/                # Django project settings & URLs
```

---

## 🎭 3D Mascot Arena Architecture & Invariants

All five 3D mascots inside `game/static/game/js/` are controlled by [`mascot-core.js`](file:///home/metanet/Pictures/Play-McNopoly/game/static/game/js/mascot/mascot-core.js) and share a strict procedural contract:
1. **Unified Builder Signature**:
   - Every mascot builder (`buildGrimaceMesh`, `buildBirdieMesh`, `buildHamburglarMesh`, `buildRonaldMesh`, `buildMonopolyMesh`) takes `(THREE)` and returns:
     ```javascript
     {
         root: THREE.Group,
         baseY: number, // Optional vertical framing offset preserved during idle breathing bob
         parts: {
             head: THREE.Group,
             body: THREE.Group,
             leftArm: THREE.Group,   // Shoulder pivot for idle sway
             rightArm: THREE.Group,  // Shoulder pivot for wave(duration) gesture
             armRest: number,        // Resting Z-rotation angle (e.g., 0.30 - 0.42)
             waveLift: number,       // Raised Z-rotation angle during wave (e.g., 2.30 - 2.55)
             setFurColor: Function,
             lookAt: Function,       // (mx, my) normalized pointer tracking
             update: Function        // (elapsed) per-frame secondary motion & blinking
         },
         setFurColor,
         lookAt,
         update
     }
     ```
2. **Texture-Driven Shells vs. Pattern-Driven GLSL Shaders**:
   - **Grimace (`grimace-mesh.js`) & Birdie (`birdie-mesh.js`)**: Use multi-pass extruded shell shaders (`uShell`, `uLen`) for volumetric curly fur and overlapping downward-pointing feathers.
   - **Preventing Shell Poke-Through Behind Clothing**: When a shell-extruded torso (`chestGeo`) sits behind a thin clothing mesh (such as Birdie's pink bib), recess the underlying front chest vertices slightly inward in $Z$ and apply `uFaceCenter` / `uFaceRadius` shell suppression so outer shells never poke through the seam while keeping side-torso feathers 100% full under the wings.
   - **Hamburglar (`hamburglar-mesh.js`) & Ronald (`ronald-mesh.js`)**: Use single-pass **Pattern-Driven GLSL Fragment Shaders** (anti-aliased `smoothstep` horizontal stripes and 2D SDF Hamburger motifs) on smooth costume geometry rather than extruded shells.
3. **Neutral-White Particle Sprite Invariant (`grimace-particles.js`)**:
   - `THREE.PointsMaterial` multiplies the canvas sprite texture (`map`) by `vertexColors`. Always keep the canvas radial gradient pure neutral white (`rgba(255,255,255,*)`) so the 11-color multi-character vertex palette renders at full saturation without a purple cast.

---

## 🧠 Hybrid Color-Bar CV + Rotational VLM Ingestion

1. **Deterministic Color-Bar Anchor (<2ms) in [`game/extractor.py`](file:///home/metanet/Pictures/Play-McNopoly/game/extractor.py)**:
   - `detect_color_bar_from_image(image_bytes)` samples the top $8\%\text{–}28\%$ header strip of a stamp crop in HSV space to classify the official Monopoly color group (`brown`, `light_blue`, `pink`, `orange`, `red`, `yellow`, `green`, `dark_blue`, `railroad`).
   - Cross-validates the VLM's extracted `stamp_number` against `COLOR_BY_STAMP`: if the VLM misreads a stamp number across color sets, the piece is automatically flagged `is_unsure = True` for human review.
2. **4-Quadrant Rotational PDF Board Calibration ([`automation/sync_board_from_pdf.py`](file:///home/metanet/Pictures/Play-McNopoly/automation/sync_board_from_pdf.py))**:
   - Monopoly board spaces along the 4 outer edges face outward at $0^\circ, 90^\circ, 180^\circ, 270^\circ$.
   - `sync_board_from_pdf.py` slices the 4 border strips, rotates each edge upright ($0^\circ, 90^\circ\text{ CW}, 180^\circ, 270^\circ\text{ CW}$), segments the 9 non-corner property cells per side, and cross-checks VLM OCR against HSV color-bar detection.

---

## 🛠️ Step-by-Step Onboarding Playbook for Agents

When a user asks you to *"make this work for my phone"*, execute these steps in order:

### Step 1: Healthcheck Host Server & Local Vision Model
1. Check if Django is running on port 8085:
   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8085/
   # If not 200: python3 manage.py runserver 0.0.0.0:8085 (Daemon)
   ```
2. Check if local Vision LLM is active on port 1234 (LM Studio) or port 11434 (Ollama):
   ```bash
   curl -s http://localhost:1234/v1/models | grep "qwen"
   ```

### Step 2: Auto-Detect Connected Mobile Device
Run dynamic device enumeration:
```bash
adb devices -l
```
* **If output is empty**:
  - Run `lsusb | grep -i samsung` (or generic phone brand).
  - If phone is in `(MTP mode)`, guide user: *"Please unlock your phone, tap USB Settings in the notification drawer, and toggle 'USB Debugging' ON in Developer Options."*
  - Run `adb kill-server && adb start-server && adb devices`.

### Step 3: Verify McDonald's App Package
Check if the official app is installed on the target device:
```bash
adb -s <SERIAL> shell pm list packages mcdonalds
```
* **If NOT FOUND**:
  - Deep-link directly to the app page:
    ```bash
    # Via Aurora Store (deGoogled phones):
    adb -s <SERIAL> shell am start -a android.intent.action.VIEW -d "market://details?id=ca.mcdonalds.app" com.aurora.store
    # Or standard market intent:
    adb -s <SERIAL> shell am start -a android.intent.action.VIEW -d "market://details?id=ca.mcdonalds.app"
    ```

### Step 4: Verify Android System WebView Version (CRITICAL)
Older or deGoogled devices (e.g. Galaxy S8+, Android 9) may freeze on the jumping Mr. Monopoly screen if Chromium is outdated.
```bash
adb -s <SERIAL> shell dumpsys webviewupdate | grep "Current WebView package"
```
* **If WebView version < 100** (e.g. Chrome 79):
  - The embedded 2026 Monopoly portal **will not load**.
  - **Fix**: Open Aurora Store / Play Store on the device and update **"Android System WebView"** (`com.google.android.webview`) to version 110+.

### Step 5: Execute Automated Entry
Once app is verified:
```bash
# 1. Preview queued codes safely:
python3 automation/cli_runner.py --dry-run

# 2. Execute batch entry:
python3 automation/cli_runner.py
```

---

## 🧮 Screen Coordinate Calibration Matrix

$$\text{Target}_X = \frac{X_{\text{base}}}{W_{\text{base}}} \times W_{\text{device}}, \quad \text{Target}_Y = \frac{Y_{\text{base}}}{H_{\text{base}}} \times H_{\text{device}}$$

| Action Element | Base Ratio ($X / W$, $Y / H$) | Galaxy S23 (1080×2340) | Galaxy S20 (1440×3200) | Galaxy S8+ (1080×2220) |
| :--- | :--- | :--- | :--- | :--- |
| **Play Now Banner** | `(0.276, 0.293)` | `(298, 686)` | `(390, 850)` | `(295, 620)` |
| **+ Add Code Overlay** | `(0.500, 0.858)` | `(540, 2009)` | `(720, 2726)` | `(540, 1899)` |
| **Add Code Manually** | `(0.344, 0.880)` | `(372, 2061)` | `(496, 2816)` | `(372, 1954)` |
| **14-Digit EditText** | `(0.500, 0.352)` | `(540, 825)` | `(720, 955)` | `(540, 725)` |
| **Submit Code Button** | `(0.500, 0.449)` | `(540, 1052)` | `(720, 1255)` | `(540, 935)` |
| **Add New Code Button** | `(0.500, 0.522)` | `(540, 1223)` | `(720, 1450)` | `(540, 1100)` |
| **Safety Warning OK** | `(0.814, 0.559)` | `(880, 1310)` | `(1170, 1790)` | `(880, 1240)` |

---

## 🚨 Common Bugs & Agent Fixes

| Observed Symptom | Underlying Cause | Agent Action / Patch |
| :--- | :--- | :--- |
| **Stuck on Mr. Monopoly jumping screen** | WebView version < 100 on device | Check `dumpsys webviewupdate`. Instruct user to update Android System WebView via Aurora/Play Store. |
| **3D Mascot fails to render (blank particle arena)** | Calling `.position.set()` on a `THREE.BufferGeometry` instead of `THREE.Mesh` or `.translate()` | Use `geo.translate(x, y, z)` on geometries or `mesh.position.set(x, y, z)` on meshes; verify via headless Chrome screenshot. |
| **Mascot hat clipped at top of 3D viewport** | `mascot-core.js` bob animation overwrote `root.position.y` | Export `baseY` on the mascot return object (e.g. `baseY: -0.24` in `monopoly-mesh.js`) so `mascot-core.js` bobs around `baseY`. |
| **Feathers/fur poking through bib or goggles** | Outer shell extrusions (`uShell * uLen`) exceed clothing radius | Recess front torso vertices behind the bib and pass `faceCenter` / `faceRadius` to suppress shell length in covered zones. |
| **Code submitted with 13 characters or wrong color set** | Dot-matrix misread or VLM stamp number hallucination | `extractor.py` cross-validates HSV color bar against `COLOR_BY_STAMP` and flags `is_unsure=True` for docket review. |

---

## 🔒 Code Integrity & Licensing Rules
1. **Zero External CDNs**: Never inject external CDN scripts or remote fonts into `index.html` or `mobile.html`. All Three.js, CSS, and procedural shader assets must remain air-gapped in `static/game/`.
2. **Never Commit PII or Backup Databases**: Never commit personal account names, hardware serial numbers, backup SQLite files (`db.sqlite3.backup`), or real scanned photos of user tickets (`media/scans/*`, `media/entry_logs/*`). Keep them ignored in `.gitignore`.
