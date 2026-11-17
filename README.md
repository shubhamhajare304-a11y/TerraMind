# TerraMind – AI Environmental Change Detection Platform

> **A science-honest, college-demonstration-ready environmental intelligence platform powered by VARI, RGB Optical Water Index, and EuroSAT ResNet-50.**

---

## Project Overview

TerraMind is an AI-powered platform for detecting environmental changes between two satellite or aerial images captured at different times. It compares an **Earlier Observation (T0)** and a **Later Observation (T1)** and runs three specialised analysis modules to quantify:

1. **Vegetation Change** – how much forest or green cover was lost, gained, or remained stable.
2. **Water Body Change** – how surface water expanded, receded, or remained stable.
3. **Land Cover Change** – how the dominant land cover category shifted between epochs.

The platform is designed to be honest: every result displayed comes from actual backend calculations using real images. No hardcoded numbers, no fake maps, no fabricated satellite coordinates.

---

## Main Objectives

- Provide a professional, single-page environmental monitoring dashboard.
- Display predefined demonstration datasets automatically on startup.
- Allow custom image uploads (T0 + T1) for ad-hoc analysis.
- Produce honest, explainable results with scientific method notes.
- Run with one double-click (`start.bat`) — no IDE required.

---

## Three Analysis Modules

### Module 1 – Vegetation Change Detection
- **Index:** VARI (Visible Atmospherically Resistant Index)
- **Formula:** `VARI = (Green − Red) / (Green + Red − Blue)`
- **Why VARI, not NDVI:** NDVI requires calibrated Near-Infrared (NIR) bands which are not available in standard RGB imagery. VARI works within the visible spectrum.
- **Outputs:** Vegetation Loss %, Vegetation Growth %, Stable Vegetation %, Net Canopy Shift, change map image.
- **Label displayed:** *RGB-based VARI Estimation*

### Module 2 – Water Body Change Detection
- **Index:** RGB Optical Water Index (blue-dominant absorption detection)
- **Why not NDWI:** NDWI requires NIR bands. This method uses visible-spectrum blue-channel dominance with shadow/soil exclusion heuristics.
- **Outputs:** Water Expansion %, Water Reduction %, Stable Water Areas %, Net Water Dynamics, change map image.
- **Label displayed:** *RGB Optical Water Index Estimation*

### Module 3 – Land Cover Change Detection
- **Model:** EuroSAT ResNet-50 (10-class patch/scene classifier)
- **Classes:** Annual Crop, Forest, Herbaceous Vegetation, Highway, Industrial, Pasture, Permanent Crop, Residential, River, Sea Lake
- **Method:** Scene-level classification of T0 and T1 separately; 3×3 spatial patch grid for spatial transition analysis; physical pixel spectral delta map.
- **Important limitation:** ResNet-50 performs patch/image-level classification — it does NOT perform sub-pixel semantic segmentation.
- **Label displayed:** *EuroSAT ResNet-50 Deep Classification*

---

## Technologies Used

| Layer | Technology |
|---|---|
| Backend | Python 3.10, FastAPI, Uvicorn |
| Image Processing | Pillow (PIL), NumPy |
| AI Model | PyTorch, ResNet-50 (EuroSAT-pretrained) |
| Frontend | React 19, Vite 6, CSS3 |
| API Communication | REST (JSON + multipart/form-data) |
| Export | CSV report download |

---

## Folder Structure

```
TerraMind/
├── server.py               # FastAPI backend – all three analysis modules
├── ai_model.py             # EuroSAT ResNet-50 model loader and inference
├── requirements.txt        # Python dependencies
├── start.bat               # One-click Windows launcher
├── README.md               # This file
│
├── models/
│   └── eurosat_resnet50.pt # Pretrained EuroSAT ResNet-50 model weights
│
├── demo_datasets/
│   ├── area_01/            # Demo Study Area 01 (t0.jpg, t1.jpg)
│   ├── area_02/            # Demo Study Area 02 (t0.jpg, t1.jpg)
│   └── area_03/            # Demo Study Area 03 (t0.jpg, t1.jpg)
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx         # Main React component – full 6-step workflow
│   │   ├── App.css         # TerraMind dark GIS theme stylesheet
│   │   └── index.css       # Base reset and root variables
│   ├── vite.config.js      # Vite + API proxy configuration
│   └── package.json
│
└── test_images/            # Additional test images
```

---

## Installation

### Prerequisites
- Python 3.9 or higher (with pip)
- Node.js 18 or higher (with npm)

### Step 1 – Install Python Dependencies
```bash
cd TerraMind
pip install -r requirements.txt
```

### Step 2 – Install Frontend Dependencies
```bash
cd frontend
npm install
```

---

## How to Run TerraMind

### Option A – Double-Click (Recommended)
1. Double-click `start.bat` in the TerraMind folder.
2. Two terminal windows will open (backend + frontend).
3. Your browser opens automatically at `http://localhost:3000`.

### Option B – Manual (Two Terminals)
**Terminal 1 – Backend:**
```bash
cd TerraMind
uvicorn server:app --port 8000 --reload
```

**Terminal 2 – Frontend:**
```bash
cd TerraMind/frontend
npm run dev
```

Then open: `http://localhost:3000`

---

## How Image Comparison Works

1. **Select Analysis Area** – choose a predefined study area from the dropdown or use Custom Upload.
2. **Load Images** – T0 (Earlier Observation) and T1 (Later Observation) display side by side.
3. **Validation** – The backend checks image format, dimensions, and readability before analysis.
4. **Run Analysis** – Click **"Analyse Environmental Changes"** to send the image pair to the backend.
5. **Results** – All three modules render simultaneously with change maps, metrics, and method notes.

> **Important:** Resizing two images to the same dimensions does NOT guarantee geographic co-registration. For genuine change detection, images should come from the same sensor, same geographic extent, and be orthorectified. TerraMind displays a warning for custom uploads.

---

## Analysis Methods

| Module | Method | Bands Required | Limitation |
|---|---|---|---|
| Vegetation | VARI | RGB | Not NDVI; NIR unavailable |
| Water | RGB Optical Index | RGB | Not NDWI; NIR unavailable |
| Land Cover | EuroSAT ResNet-50 | RGB | Patch-level, not pixel-level segmentation |

---

## AI Model Information

- **Model:** ResNet-50 fine-tuned on the EuroSAT dataset
- **Dataset:** EuroSAT – 27,000 Sentinel-2 satellite image patches across 10 land use/cover classes
- **Input size:** 224×224 px per patch
- **Output:** 10-class probability distribution
- **Inference:** Scene-level (full image) + 3×3 spatial grid (9 sub-patches) for spatial transition detection
- **Hardware:** Runs on CPU (no GPU required)

---

## Current Limitations

| Limitation | Explanation |
|---|---|
| No true NDVI | Requires calibrated NIR sensor bands not present in RGB images |
| No true NDWI | Same reason – NIR required |
| No sub-pixel segmentation | EuroSAT ResNet-50 is a classifier, not a semantic segmenter |
| No geographic metadata | Demo datasets have no verified coordinates or projection info |
| No radiometric calibration | RGB images are not atmospherically corrected |
| No temporal metadata | Demo observation dates are unverified |

---

## Example Demonstration Workflow

1. Launch with `start.bat`.
2. Select **Demo Study Area 01** (pre-loaded).
3. See Earlier (T0) and Later (T1) images side by side.
4. Click **Analyse Environmental Changes**.
5. Review:
   - Vegetation Change map (red = loss, green = growth)
   - Water Body Change map (cyan = expansion, amber = reduction)
   - Land Cover 3×3 patch grid (class transitions per spatial zone)
6. Click **Export Report (CSV)** to download full results.
7. Switch to **Demo Study Area 02** or **03** using the dropdown.
8. Use **Custom Image Upload** to analyse your own image pairs.

---

## API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/study-areas` | GET | List all predefined study areas |
| `/api/study-areas/{area_id}/load` | GET | Load T0+T1 images for a study area |
| `/api/analyze` | POST | Run all three analysis modules |

---

*TerraMind was developed as a college project demonstrating AI-powered environmental change detection using honest, scientifically-labelled methods.*
