# TerraMind – AI-Based Environmental Change Detection Platform

> **A scientifically honest, university-demonstration-ready environmental intelligence system powered by RGB-based VARI, RGB Optical Water Index Estimation, and EuroSAT ResNet-50 deep neural network classification.**

---

## 1. Project Overview & Purpose

TerraMind is an AI-powered environmental monitoring platform designed to quantify ecological and spatial transitions between two multi-temporal observation epochs:
- **Earlier Observation (T0)** – Baseline raster imagery
- **Later Observation (T1)** – Follow-up raster imagery

The application performs three dedicated, scientifically grounded environmental analyses:
1. **Vegetation Change Detection** – Estimates canopy cover dynamics using visible green reflectance resistance (VARI).
2. **Water Body Change Detection** – Estimates surface hydrology dynamics and recession/expansion using visible spectrum absorption.
3. **Land Cover Change Detection** – Evaluates macro-scene land cover categories and a 3×3 spatial patch grid using a pretrained EuroSAT ResNet-50 convolutional neural network, paired with RGB pixel differential sensitivity.

---

## 2. Demonstration Case Studies

The platform provides predefined demonstration study areas with verified multi-temporal tiles, alongside full custom upload capabilities:

- **Case 1: Regional Landscape** (`area_01`) – Regional survey spanning woodland canopy, agricultural parcels, and a central river corridor.
- **Case 2: River Basin & Water Change** (`area_02`) – Surface hydrology corridor tracking seasonal water expansion and channel dynamics.
- **Case 3: Vegetation Change** (`area_03`) – Woodland canopy tracking timber clear-cut, vegetation dynamics, and ground disturbance.
- **Custom: Upload Images** (`custom`) – Allows users to upload their own T0 (Earlier) and T1 (Later) raster scenes directly from desktop storage.

---

## 3. Three Environmental Analysis Modules

### Module 1: Vegetation Change Detection
- **Methodology:** RGB-based VARI Estimation (Visible Atmospherically Resistant Index).
- **Mathematical Formula:** `VARI = (Green − Red) / (Green + Red − Blue)`
- **Calculated Metrics:**
  - *Possible Vegetation Reduction (%)* – Reduction in estimated green vegetation.
  - *Possible Vegetation Increase (%)* – Increase in estimated green vegetation.
  - *Stable Vegetation Pixels (%)* – Persistent green canopy vegetation pixels.
  - *Net Vegetation Change (%)* – Overall canopy trajectory (T1 cover minus T0 cover).
- **Scientific Limitation:** VARI is not NDVI. Accurate NDVI analysis requires calibrated Near-Infrared (NIR) satellite data.

### Module 2: Water Body Change Detection
- **Methodology:** RGB Optical Water Index Estimation.
- **Principle:** Evaluates visible blue/green absorption signatures with shadow and dark soil exclusion heuristics.
- **Calculated Metrics:**
  - *Possible Water Increase (%)* – Increase in estimated water coverage.
  - *Possible Water Reduction (%)* – Reduction in estimated water coverage.
  - *Stable Water Pixels (%)* – Persistent surface water maintaining optical absorption signature.
  - *Net Water Change (%)* – Net hydrological shift (T1 coverage minus T0 coverage).
- **Scientific Limitation:** This method is not NDWI. Accurate NDWI analysis requires suitable Near-Infrared (NIR) satellite bands. Water increase indicates higher estimated water coverage, not verified flooding.

### Module 3: Land Cover Change Detection
- **Model:** EuroSAT ResNet-50 Deep Convolutional Neural Network (fine-tuned on 10 EuroSAT Sentinel-2 classes).
- **Supported Classes:** AnnualCrop, Forest, HerbaceousVegetation, Highway, Industrial, Pasture, PermanentCrop, Residential, River, SeaLake.
- **Calculated Outputs:**
  - *Baseline Classification (T0)* & Model Confidence score (%).
  - *Follow-up Classification (T1)* & Model Confidence score (%).
  - *3×3 Spatial Patch Transition Grid* – Evaluates 9 spatial quadrants to localize class shifts across the image.
  - *RGB Pixel Difference (%)* – Proportion of pixels exceeding the selected RGB delta threshold.
  - *RGB Pixel Stability (%)* – Proportion of spectrally consistent background pixels.
- **Important Disclosure:**
  - ResNet-50 is a pretrained deep learning model that classifies image patches into land-cover categories.
  - Confidence is the model's prediction score, not guaranteed ground-truth accuracy.
  - The 3×3 grid represents image patch classification; it is not pixel-level semantic segmentation.
  - RGB pixel difference and AI land-cover classification are two separate calculations.

---

## 4. Scientific Limitations & Disclosures

TerraMind adheres to scientific honesty:
1. **Visible RGB Imagery:** Uploaded images contain visible RGB information only.
2. **No NIR Bands:** RGB imagery does not provide Near-Infrared (NIR) or Short-Wave Infrared (SWIR) bands.
3. **VARI is Not NDVI:** VARI is an optical greenness approximation. True NDVI requires calibrated NIR sensors.
4. **Optical Water is Not NDWI:** RGB water estimation is not NDWI. Accurate NDWI requires NIR sensors.
5. **Pixel vs Ground Truth:** Image pixel differences do not prove actual geographical environmental changes; illumination variations can cause false deltas.
6. **Geographical Co-Registration:** Images must be geographically aligned for reliable comparisons. Rescaling does not establish co-registration.
7. **Pixel Proportions:** Calculated percentages represent image pixel proportions, not actual physical land area in hectares.
8. **Demonstration Imagery:** Predefined demonstration imagery does not have ground-truth verified geographical coordinates or observation dates.

---

## 5. Direct PDF Report Generation (6 Pages)

Replacing legacy CSV exports, TerraMind features an in-browser direct PDF report generator built with `jsPDF` and `jspdf-autotable`. Clicking **"Download PDF Report"** immediately downloads `TerraMind_Environmental_Report.pdf` without opening a browser print dialog.

The report includes:
- **Page 1:** Project Information, academic metadata, and executive scope table.
- **Page 2:** Multi-Temporal Observation Imagery (actual T0 and T1 images rendered side-by-side with dimensions).
- **Page 3:** Vegetation Analysis (quantitative metrics table, actual VARI change detection map, formula, limitations).
- **Page 4:** Water Body Analysis (quantitative metrics table, actual water change detection map, method notes).
- **Page 5:** Land Cover Analysis (EuroSAT ResNet-50 classification, 3×3 spatial patch transition table, RGB pixel difference map).
- **Page 6:** Synthesis & Scientific Limitations (cross-modular summary, complete 8-point scientific disclosure, academic conclusion).

---

## 6. Technologies Used

| Tier | Technologies |
|---|---|
| **Backend** | Python 3.10+, FastAPI, Uvicorn, Pillow (PIL), NumPy |
| **Deep Learning** | PyTorch, Torchvision (ResNet-50 architecture) |
| **Frontend** | React 19, Vite 6, CSS3 (Modern Dark Navy & Teal GIS Theme) |
| **Reporting** | jsPDF, jspdf-autotable (Client-side 6-page A4 PDF rendering) |
| **Architecture** | REST API (`/api/study-areas`, `/api/study-areas/{id}/load`, `/api/analyze`) |

---

## 7. Folder Structure

```
TerraMind/
├── server.py               # FastAPI backend with VARI, Optical Water & ResNet-50 endpoints
├── ai_model.py             # EuroSAT ResNet-50 loader & 3×3 patch-grid inference
├── requirements.txt        # Python backend dependencies
├── start.bat               # Windows one-click startup batch script
├── README.md               # Project documentation
│
├── models/
│   └── eurosat_resnet50.pt # Pretrained PyTorch ResNet-50 model weights (10 classes)
│
├── demo_datasets/
│   ├── area_01/            # Case 1: Regional Landscape (t0.jpg, t1.jpg)
│   ├── area_02/            # Case 2: River Basin & Water Change (t0.jpg, t1.jpg)
│   └── area_03/            # Case 3: Vegetation Change (t0.jpg, t1.jpg)
│
└── frontend/
    ├── package.json        # Frontend dependencies (React, Vite, jsPDF, jspdf-autotable)
    ├── vite.config.js      # Vite proxy to FastAPI backend (:8000)
    └── src/
        ├── App.jsx         # Main dashboard component (Case tabs, Uploads, 3 Modules)
        ├── App.css         # Dark navy GIS theme stylesheet
        ├── reportGenerator.js # 6-page academic PDF report builder
        └── main.jsx        # React root entry
```

---

## 8. Installation & Setup

### Prerequisites
- **Python 3.9+** with pip
- **Node.js 18+** with npm

### 1. Python Environment
In the root directory `TerraMind/`:
```bash
pip install fastapi uvicorn pillow numpy torch torchvision
```

### 2. Frontend Dependencies
In `TerraMind/frontend/`:
```bash
npm install
```

---

## 9. How to Run TerraMind

### Option 1: One-Click Startup (Recommended for Windows)
Double-click **`start.bat`** in the root directory.
- Checks Python and Node.js availability.
- Launches the FastAPI backend on port 8000.
- Launches the React/Vite development server on port 3000.
- Automatically opens your default browser at `http://localhost:3000`.

### Option 2: Manual Terminal Startup

**Terminal 1 — Backend:**
```bash
cd C:\Users\HP\Downloads\TerraMind
python -m uvicorn server:app --port 8000 --reload
```

**Terminal 2 — Frontend:**
```bash
cd C:\Users\HP\Downloads\TerraMind\frontend
npm run dev
```

Then navigate to: **`http://localhost:3000`** in your web browser.

---

## 10. Demonstration Workflow for College Presentation

1. **Open Application:** Navigate to `http://localhost:3000`.
2. **Review Case Studies:**
   - Click **Case 1: Regional Landscape** → Inspect Earlier (T0) and Later (T1) baseline scenes.
   - Click **Case 2: River Basin & Water Change** → View hydrological dynamics.
   - Click **Case 3: Vegetation Change** → View canopy cover variations.
   - Or click **Custom: Upload Images** → Drop two desktop images to analyse.
3. **Set Threshold:** Adjust the *RGB Pixel Difference Threshold (Land Cover)* slider (default: 30 / 255).
4. **Execute Analysis:** Click **"Analyse Environmental Changes"**.
5. **Inspect Three Output Modules:**
   - **Module 1 (Vegetation):** View Possible Vegetation Reduction %, Increase %, Stable %, and VARI change map.
   - **Module 2 (Water):** View Possible Water Increase %, Reduction %, Stable %, and optical water map.
   - **Module 3 (Land Cover):** View EuroSAT classifications, 3×3 patch transition grid, and RGB pixel difference map.
6. **Download Report:** Click **"Download PDF Report"** to instantly generate and download the comprehensive 6-page academic report.
