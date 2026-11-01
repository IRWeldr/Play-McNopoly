# 🎩 Play-McNopoly (Port 8085)
### 2026 Canadian Golden Edition Boardroom, 5-Mascot 3D WebGL Arena, Multi-Model Vision Benchmark & ADB Automation Hub

**Play-McNopoly** is an open-source visual McDonald's Monopoly board tracker, deterministic Color-Bar CV + Vision LLM ingestion pipeline, and Android ADB redemption hub featuring five procedural 3D mascots.

---

## 🧭 Architecture & Project Layout

```text
Play-McNopoly/
├── manage.py                     # Django management CLI (Port 8085)
├── LICENSE                       # MIT Open-Source License
├── README.md                     # Main setup & architecture guide
├── AGENTS.md                     # Autonomous Agent & LLM operational playbook
├── Error-Handling.md             # Multi-layer failure recovery & troubleshooting guide
├── benchmark.py                  # Multi-model vision benchmark CLI (LM Studio / Ollama / OpenAI)
├── automation/                   # Android ADB Automation & Board Calibration
│   ├── adb_manager.py            # Unified backend service for Django Web UI & Sovereign E-Stop
│   ├── cli_runner.py             # Standalone CLI runner with auto-device detection (S23, S20, S8+)
│   ├── sync_board_from_pdf.py    # 4-Quadrant rotational PDF board ingestion & calibration script
│   └── legacy/                   # Sanitized reference scripts (relative paths + env vars)
├── dataset/                      # Clean 300 DPI benchmark testbed & reference assets
│   ├── README.md                 # Dataset documentation & benchmark specs
│   ├── MONOPOLY-gameboard.pdf    # Official 2026 Canadian Golden Edition Game Board & Rules PDF
│   ├── annotations.json          # Ground-truth: 127 verified pieces & 14-char codes
│   ├── page1.png (8.2 MB)        # Structured orthogonal flatbed sheet
│   ├── page2.png (2.8 MB)        # 16 scattered, rotated, in-the-wild stamps
│   ├── Grimace.jpg               # Reference asset for 3D Grimace
│   ├── Birdie_Profile.webp       # Reference asset for 3D Birdie the Early Bird
│   ├── Hamburgler.jpeg           # Reference asset for 3D Hamburglar
│   └── Ronald_McDonald.webp      # Reference asset for 3D Ronald McDonald
├── data/                         # Benchmark datasets (personal redemption logs git-ignored)
│   ├── monopoly_codes.json       # Pages 1-4 benchmark dataset (103 codes)
│   └── monopoly_codes_page5.json # Page 5 scrambled benchmark dataset (16 codes)
├── game/                         # Django App (Views, Models, Templates, 3D Arena)
│   ├── board_data.py             # Official 40-square 2026 Golden Edition board definition (#801-#828)
│   ├── models.py                 # MonopolyProperty & CollectedGamePiece models
│   ├── extractor.py              # Hybrid HSV Color-Bar CV (<2ms) + Qwen3-VL Vision OCR (Port 1234)
│   ├── management/commands/
│   │   └── seed_board.py         # Clean 40-square board seeder (`python3 manage.py seed_board`)
│   ├── static/game/js/           # Air-gapped Three.js & 5-Mascot Procedural 3D Engine
│   │   ├── three.min.js
│   │   ├── grimace/
│   │   │   ├── grimace-mesh.js   # 🟣 Grimace (16-shell GLSL curly fur shader + 1971 4-arm mode)
│   │   │   └── grimace-particles.js # 11-color Multi-Character & Monopoly particle vortex
│   │   └── mascot/
│   │       ├── mascot-core.js    # Unified 3D controller, pointer tracking, wave rig & mode switcher
│   │       ├── birdie-mesh.js    # 🐤 Birdie the Early Bird (14-shell feather shader, pink coveralls, scarf)
│   │       ├── hamburglar-mesh.js # 🍔 Hamburglar (GLSL prison-stripe suit + SDF Hamburger necktie)
│   │       ├── ronald-mesh.js    # 🤡 Ronald McDonald (Skinny yellow jumpsuit + giant glossy red clown shoes)
│   │       └── monopoly-mesh.js  # 🎩 Mr. Monopoly (Tuxedo, top hat, cane + Mandela Effect Monocle toggle)
│   └── templates/game/
│       ├── index.html            # 40-Square Boardroom with 5-Mascot 3D Arena Center Stage
│       ├── mobile.html           # True-Black (#000000) Pocket Super AMOLED Portal
│       ├── nav_bar.html          # Telemetry nav bar (8085 / 1234 / ADB / Sovereign E-Stop)
│       └── ingestion_modal.html  # Drag & drop photo upload studio
└── mcnopoly_core/                # Django project settings & URL configuration
```

---

## 🎭 The 5-Mascot Procedural 3D Arena

All 3D characters are 100% procedural Three.js + custom GLSL shaders (zero external textures or network dependencies):

| Mascot | URL Hash | Procedural Shader & Rig Highlights |
| :--- | :--- | :--- |
| **🟣 Grimace** | `#grimace` | 16-shell GLSL curly fur shader, shortened eyelids for clear pupil visibility, and 3 generational modes (`1971 4-Arms`, `1980s Classic`, `2026 Overdrive`). |
| **🐤 Birdie the Early Bird** | `#birdie` | 14-shell staggered feather-lattice shader, slimmed pear torso, seamless magenta-pink shortall coveralls with Golden Arches `"M"`, white aviator scarf, and flying goggles. |
| **🍔 Hamburglar** | `#hamburglar` | Pattern-driven GLSL horizontal black-and-white prison-stripe suit, double-layered red necktie with a procedural SDF Hamburger pattern, black/yellow cape, 1-tooth grin, and **3-finger + thumb** red gloves. |
| **🤡 Ronald McDonald** | `#ronald` | Tall, skinny yellow jumpsuit with red zipper placket, diagonal slash pockets, left-chest `"M"` badge, red-and-white striped sleeves/socks, 5-finger yellow gloves, and **giant glossy red clown shoes**. |
| **🎩 Mr. Monopoly** | `#monopoly` / `#monopoly-monocle` | Portly morning-coat tuxedo, white V-plastron with studs, red bow tie, sweeping white handlebar mustache, stovepipe top hat, gold cane, and an interactive **🧐 Mandela Effect Monocle Toggle**. |

---

## ⚡ Quick Start

### 1. Initialize Clean Database & Seed the 40 Official Spaces
```bash
python3 manage.py migrate
python3 manage.py seed_board
```
*(To wipe all collected pieces back to a clean 0/100 baseline before a release, run `python3 manage.py seed_board --reset-pieces`).*

### 2. Launch the Django Web Dashboard
```bash
python3 manage.py runserver 0.0.0.0:8085
```
Open **`http://localhost:8085`** in your browser to view:
* **The 40-Square Boardroom**: All 28 official Canadian properties (`#801` Rideau Canal through `#828` TransCan Highway) plus 12 corner/tax/chance spaces synced from `dataset/MONOPOLY-gameboard.pdf`.
* **5-Mascot 3D Arena**: Switch instantaneously between **🟣 Grimace**, **🐤 Birdie**, **🍔 Hamburglar**, **🤡 Ronald**, and **🎩 Monopoly** (with the **🧐 Monocle: OFF / ON (Mandela)** toggle).
* **Super AMOLED Mobile Portal**: Pocket view accessible at `http://<IP>:8085/mobile/`.
* **Sovereign E-Stop**: Instant red kill switch that aborts ADB execution safely.

### 3. Re-Sync Game Board from Official PDF (4-Quadrant Rotational Pipeline)
```bash
# Dry-run deterministic verification of all 40 perimeter spaces:
python3 automation/sync_board_from_pdf.py --pdf dataset/MONOPOLY-gameboard.pdf --dry-run

# Apply updates to SQLite and run live VLM OCR on the 4 rotated board edges:
python3 automation/sync_board_from_pdf.py --pdf dataset/MONOPOLY-gameboard.pdf --use-vlm --apply
```

### 4. Run Android Auto-Entry via CLI
```bash
# Auto-detect connected phone (S23, S20, or S8+) and enter queued codes:
python3 automation/cli_runner.py

# Dry-run preview without submitting:
python3 automation/cli_runner.py --dry-run
```

### 5. Evaluate Vision Models Against Benchmark Dataset
```bash
# Benchmark local Qwen3-VL (4B or 8B) in LM Studio:
python3 benchmark.py --model qwen3-vl-4b-instruct --input dataset/page2.png

# Benchmark local Ollama vision model:
python3 benchmark.py --backend ollama --model llama3.2-vision --input dataset/page2.png
```
