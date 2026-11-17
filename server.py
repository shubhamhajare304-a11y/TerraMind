"""FastAPI backend for TerraMind – AI Environmental Change Detection Platform.

Provides exactly three core environmental analysis modules:
1. Vegetation Change Detection (RGB-based VARI Estimation)
2. Water Body Change Detection (RGB Optical Water Index Estimation)
3. Land Cover Change Detection (EuroSAT ResNet-50 Deep Classification)
"""

import base64
import io
from pathlib import Path
from typing import Dict, Any, Optional

from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, ImageChops
import numpy as np

from ai_model import predict_land_cover_detailed

app = FastAPI(
    title="TerraMind Environmental Intelligence API",
    description="Automated satellite change detection platform (Vegetation, Water, Land Cover)",
    version="2.5.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).parent
DEMO_DIR = BASE_DIR / "demo_datasets"

# Predefined Study Areas matching required case study names
STUDY_AREAS = {
    "area_01": {
        "id": "area_01",
        "title": "Case 1: Regional Landscape",
        "description": "Regional survey across forest canopy, agricultural parcels, and river corridor.",
        "dir": DEMO_DIR / "area_01",
        "t0_filename": "RegionalLandscape_Observation_T0.jpg",
        "t1_filename": "RegionalLandscape_Observation_T1.jpg",
        "provenance": "Demonstration Archive Tile (Unverified Regional Coordinates)",
        "observationDates": "Demonstration Epochs (Unrecorded)",
    },
    "area_02": {
        "id": "area_02",
        "title": "Case 2: River Basin & Water Change",
        "description": "River basin and drainage corridor tracking seasonal surface water dynamics.",
        "dir": DEMO_DIR / "area_02",
        "t0_filename": "RiverBasin_Observation_T0.jpg",
        "t1_filename": "RiverBasin_Observation_T1.jpg",
        "provenance": "Demonstration Archive Tile (Unverified Regional Coordinates)",
        "observationDates": "Demonstration Epochs (Unrecorded)",
    },
    "area_03": {
        "id": "area_03",
        "title": "Case 3: Vegetation Change",
        "description": "Woodland canopy tracking vegetation dynamics and surface disturbance.",
        "dir": DEMO_DIR / "area_03",
        "t0_filename": "VegetationChange_Observation_T0.jpg",
        "t1_filename": "VegetationChange_Observation_T1.jpg",
        "provenance": "Demonstration Archive Tile (Unverified Regional Coordinates)",
        "observationDates": "Demonstration Epochs (Unrecorded)",
    },
}

# In-memory cache for fast, seamless study area switching
STUDY_CACHE: Dict[str, Any] = {}


def img_to_base64(img: Image.Image) -> str:
    """Convert PIL image to base64 string."""
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("utf-8")


# ─────────────────────────────────────────────────────────────────────────────
# STEP 4: IMAGE VALIDATION
# ─────────────────────────────────────────────────────────────────────────────

def validate_image_pair(
    img_t0: Image.Image,
    img_t1: Image.Image,
    name_t0: str,
    name_t1: str,
    is_predefined: bool = False,
) -> Dict[str, Any]:
    """Validate format, dimensions, readability, and spatial alignment warnings."""
    checks = []
    warnings = []

    # 1. Readability & Format
    checks.append({"name": "Raster Format", "status": "Passed", "detail": f"T0: {img_t0.format or 'RGB'}, T1: {img_t1.format or 'RGB'}"})
    checks.append({"name": "Channel Integrity", "status": "Passed", "detail": f"Channels: {img_t0.mode}"})

    # 2. Dimensions check
    w0, h0 = img_t0.size
    w1, h1 = img_t1.size
    dims_match = (w0 == w1) and (h0 == h1)
    if dims_match:
        checks.append({"name": "Dimensions Matching", "status": "Passed", "detail": f"{w0} × {h0} pixels"})
    else:
        checks.append({
            "name": "Dimensions Mismatch",
            "status": "Resampled",
            "detail": f"T0: {w0}×{h0} px, T1: {w1}×{h1} px. T1 resampled to T0 grid for differential analysis.",
        })
        warnings.append(
            f"Image dimensions differ (T0: {w0}×{h0}, T1: {w1}×{h1}). Images are rescaled to a common grid. "
            "Rescaling alone does not establish true geographic co-registration."
        )

    # 3. Geographical co-registration & alignment notice
    if is_predefined:
        warnings.append(
            "Demo Study Area: Geographical coordinates are uncalibrated archive imagery. "
            "Surface differences describe visual and spectral variation, not ground-truth verified coordinates."
        )
    else:
        warnings.append(
            "Custom Upload: Images are treated as aligned 2D rasters. "
            "Ensure both scenes represent the exact same geographic bounding box. "
            "Differences in camera angle, sun elevation, or clouds can affect change metrics."
        )

    return {
        "isValid": True,
        "dimensionsT0": [w0, h0],
        "dimensionsT1": [w1, h1],
        "dimsMatch": dims_match,
        "checks": checks,
        "warnings": warnings,
    }


# ─────────────────────────────────────────────────────────────────────────────
# STEP 6: THREE ENVIRONMENTAL ANALYSIS MODULES
# ─────────────────────────────────────────────────────────────────────────────

def compute_vegetation_vari(rgb_arr: np.ndarray) -> np.ndarray:
    """Compute vegetation mask using Visible Atmospherically Resistant Index (VARI).

    Formula: VARI = (Green - Red) / (Green + Red - Blue + eps)
    Healthy green canopy exhibits VARI > 0.10 with Green distinctly greater than Red and Blue.
    Note: Real NDVI requires Near-Infrared (NIR) band. This is strictly labeled VARI.
    """
    r = rgb_arr[:, :, 0].astype(float)
    g = rgb_arr[:, :, 1].astype(float)
    b = rgb_arr[:, :, 2].astype(float)
    denom = g + r - b
    denom[denom == 0] = 1e-5
    vari = (g - r) / denom
    return (vari > 0.10) & (g > r * 1.05) & (g > b * 1.02)


def compute_water_optical_index(rgb_arr: np.ndarray) -> np.ndarray:
    """Compute optical surface water mask based on visible spectrum absorption.

    Water strongly absorbs Red light and reflects modest Blue-Green light.
    To avoid confusion with dark shadows, soil, or vegetation:
    1. Water must have Blue >= Red * 0.95 and Green >= Red * 0.90 (not reddish).
    2. Total intensity must be under 320 (excluding bright sand/concrete).
    3. Blue intensity must be above 25 (excluding deep shadow voids).
    4. Green/Blue ratio must be < 1.35 (excluding dense green vegetation).
    """
    r = rgb_arr[:, :, 0].astype(float)
    g = rgb_arr[:, :, 1].astype(float)
    b = rgb_arr[:, :, 2].astype(float)
    total = r + g + b
    not_vegetation = (g / (b + 1e-5)) < 1.35
    not_pure_shadow = total > 40
    water_spectral = (
        (b >= r * 0.95)
        & (g >= r * 0.90)
        & (r < 110)
        & (total < 320)
        & (b > 25)
    )
    return water_spectral & not_vegetation & not_pure_shadow


def perform_environmental_analysis(
    old_img: Image.Image,
    new_img: Image.Image,
    name_t0: str,
    name_t1: str,
    threshold: int = 30,
    area_id: Optional[str] = None,
    is_predefined: bool = False,
) -> Dict[str, Any]:
    """Execute all three core environmental analysis modules."""
    validation = validate_image_pair(old_img, new_img, name_t0, name_t1, is_predefined)

    # Rescale T1 to T0 size for consistent pixel comparison
    new_img_rescaled = new_img.resize(old_img.size)

    old_np = np.array(old_img)
    new_np = np.array(new_img_rescaled)
    total_valid_pixels = float(old_np.shape[0] * old_np.shape[1])

    # ─────────────────────────────────────────────────────────────
    # MODULE A: VEGETATION CHANGE DETECTION (VARI)
    # ─────────────────────────────────────────────────────────────
    veg_t0 = compute_vegetation_vari(old_np)
    veg_t1 = compute_vegetation_vari(new_np)

    veg_loss_mask = veg_t0 & (~veg_t1)       # Canopy Loss / Clearing
    veg_growth_mask = (~veg_t0) & veg_t1     # Canopy Growth / Planting
    veg_stable_mask = veg_t0 & veg_t1        # Stable Canopy

    veg_t0_pct = float(veg_t0.sum() / total_valid_pixels * 100)
    veg_t1_pct = float(veg_t1.sum() / total_valid_pixels * 100)
    veg_loss_pct = float(veg_loss_mask.sum() / total_valid_pixels * 100)
    veg_growth_pct = float(veg_growth_mask.sum() / total_valid_pixels * 100)
    veg_stable_pct = float(veg_stable_mask.sum() / total_valid_pixels * 100)
    veg_net_shift = veg_t1_pct - veg_t0_pct

    # Vegetation change visualization map
    veg_map = (old_np * 0.28).astype(np.uint8)
    veg_map[veg_stable_mask] = [20, 110, 45]     # Dark Forest Green (Stable)
    veg_map[veg_growth_mask] = [34, 197, 94]     # Vibrant Green (Growth)
    veg_map[veg_loss_mask] = [239, 68, 68]       # Crimson Red (Loss)
    veg_overlay = Image.fromarray(veg_map)

    # ─────────────────────────────────────────────────────────────
    # MODULE B: WATER BODY CHANGE DETECTION (RGB Optical Index)
    # ─────────────────────────────────────────────────────────────
    water_t0 = compute_water_optical_index(old_np)
    water_t1 = compute_water_optical_index(new_np)

    water_recession_mask = water_t0 & (~water_t1)  # Water Reduction / Drying
    water_expansion_mask = (~water_t0) & water_t1  # Water Expansion / Flooding
    water_stable_mask = water_t0 & water_t1        # Stable Water Areas

    water_t0_pct = float(water_t0.sum() / total_valid_pixels * 100)
    water_t1_pct = float(water_t1.sum() / total_valid_pixels * 100)
    water_loss_pct = float(water_recession_mask.sum() / total_valid_pixels * 100)
    water_gain_pct = float(water_expansion_mask.sum() / total_valid_pixels * 100)
    water_stable_pct = float(water_stable_mask.sum() / total_valid_pixels * 100)
    water_net_shift = water_t1_pct - water_t0_pct

    # Water change visualization map
    water_map = (old_np * 0.28).astype(np.uint8)
    water_map[water_stable_mask] = [14, 116, 144]   # Deep Cyan/Navy (Stable)
    water_map[water_expansion_mask] = [6, 182, 212] # Bright Cyan (Expansion)
    water_map[water_recession_mask] = [245, 158, 11] # Amber (Reduction)
    water_overlay = Image.fromarray(water_map)

    # ─────────────────────────────────────────────────────────────
    # MODULE C: LAND COVER CHANGE DETECTION (EuroSAT ResNet-50)
    # ─────────────────────────────────────────────────────────────
    # Neural network inference on both scenes
    ai_t0 = predict_land_cover_detailed(old_img)
    ai_t1 = predict_land_cover_detailed(new_img_rescaled)

    # Physical spectral difference (distinct from AI classification)
    diff = ImageChops.difference(old_img, new_img_rescaled)
    diff_arr = np.array(diff)
    pixel_changed = np.max(diff_arr, axis=2) > threshold
    pixel_shift_pct = float(pixel_changed.mean() * 100)
    pixel_stable_pct = 100.0 - pixel_shift_pct

    # Structural difference map
    lc_map = old_np.copy()
    lc_map[pixel_changed] = [225, 29, 72]  # Crimson highlight on altered pixels
    lc_overlay = Image.fromarray(lc_map)

    # 3x3 Spatial Grid categorical transition
    grid_transitions = []
    for g0, g1 in zip(ai_t0["patchGrid"], ai_t1["patchGrid"]):
        grid_transitions.append({
            "row": g0["row"],
            "col": g0["col"],
            "t0Class": g0["topClass"],
            "t0Confidence": g0["confidence"],
            "t1Class": g1["topClass"],
            "t1Confidence": g1["confidence"],
            "isChanged": g0["topClass"] != g1["topClass"],
        })

    changed_patches = sum(1 for g in grid_transitions if g["isChanged"])

    # Categorical transition description
    t0_top_class = ai_t0["topPredictions"][0]["class"]
    t0_top_conf = ai_t0["topPredictions"][0]["confidence"]
    t1_top_class = ai_t1["topPredictions"][0]["class"]
    t1_top_conf = ai_t1["topPredictions"][0]["confidence"]

    if t0_top_class == t1_top_class:
        class_transition_desc = f"Primary classification consistent as {t0_top_class} ({t0_top_conf}% → {t1_top_conf}%)."
    else:
        class_transition_desc = f"Categorical transition detected from {t0_top_class} ({t0_top_conf}%) to {t1_top_class} ({t1_top_conf}%)."

    return {
        "areaId": area_id,
        "isPredefined": is_predefined,
        "t0Filename": name_t0,
        "t1Filename": name_t1,
        "gridDimensions": [old_img.width, old_img.height],
        "threshold": threshold,
        "validation": validation,

        "baselineImage": img_to_base64(old_img),
        "followupImage": img_to_base64(new_img_rescaled),

        # Module 1
        "vegetation": {
            "method": "RGB-based VARI Estimation",
            "methodNote": "VARI (Visible Atmospherically Resistant Index) estimates vegetation using visible RGB image bands. Formula: VARI = (G - R) / (G + R - B). Limitation: VARI is not NDVI. Accurate NDVI analysis requires calibrated Near-Infrared (NIR) satellite data.",
            "baselineCoverPct": round(veg_t0_pct, 2),
            "followupCoverPct": round(veg_t1_pct, 2),
            "lossPct": round(veg_loss_pct, 2),
            "growthPct": round(veg_growth_pct, 2),
            "stablePct": round(veg_stable_pct, 2),
            "netShiftPct": round(veg_net_shift, 2),
            "lossLabel": "Possible Vegetation Reduction",
            "growthLabel": "Possible Vegetation Increase",
            "stableLabel": "Stable Vegetation Pixels",
            "netShiftLabel": "Net Vegetation Change",
            "lossDescription": "Reduction in estimated green vegetation.",
            "growthDescription": "Increase in estimated green vegetation.",
            "mapImage": img_to_base64(veg_overlay),
        },

        # Module 2
        "water": {
            "method": "RGB Optical Water Index Estimation",
            "methodNote": "The system estimates possible water areas using visible RGB image information. Limitation: This method is not NDWI. Accurate NDWI analysis requires suitable Near-Infrared (NIR) satellite bands. Water increase indicates higher estimated water coverage, not verified flooding.",
            "baselineCoverPct": round(water_t0_pct, 2),
            "followupCoverPct": round(water_t1_pct, 2),
            "expansionPct": round(water_gain_pct, 2),
            "reductionPct": round(water_loss_pct, 2),
            "stablePct": round(water_stable_pct, 2),
            "netShiftPct": round(water_net_shift, 2),
            "expansionLabel": "Possible Water Increase",
            "reductionLabel": "Possible Water Reduction",
            "stableLabel": "Stable Water Pixels",
            "netShiftLabel": "Net Water Change",
            "expansionDescription": "Increase in estimated water coverage.",
            "reductionDescription": "Reduction in estimated water coverage.",
            "mapImage": img_to_base64(water_overlay),
        },

        # Module 3
        "landCover": {
            "method": "EuroSAT ResNet50 Deep Classification",
            "methodNote": "ResNet50 is a pretrained deep learning model that classifies image patches into land-cover categories. Confidence is the model's prediction score, not guaranteed accuracy. The 3×3 grid represents image patch classification, not pixel-level semantic segmentation. RGB pixel difference and AI land-cover classification are two separate calculations.",
            "baselineClass": t0_top_class,
            "baselineConfidence": t0_top_conf,
            "followupClass": t1_top_class,
            "followupConfidence": t1_top_conf,
            "transitionSummary": class_transition_desc,
            "t0TopPredictions": ai_t0["topPredictions"],
            "t1TopPredictions": ai_t1["topPredictions"],
            "patchGridTransitions": grid_transitions,
            "changedPatchesCount": changed_patches,
            "totalPatches": 9,
            "pixelShiftPct": round(pixel_shift_pct, 2),
            "pixelStablePct": round(pixel_stable_pct, 2),
            "pixelShiftLabel": "RGB Pixel Difference",
            "pixelStableLabel": "RGB Pixel Stability",
            "patchChangeLabel": "Patch Classification Changes",
            "spectralDeltaMap": img_to_base64(lc_overlay),
        },
    }


# ─────────────────────────────────────────────────────────────────────────────
# API ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/api/study-areas")
async def get_study_areas():
    """List predefined demonstration study areas (Step 2)."""
    return [
        {
            "id": a["id"],
            "title": a["title"],
            "description": a["description"],
            "provenance": a["provenance"],
            "observationDates": a["observationDates"],
        }
        for a in STUDY_AREAS.values()
    ]


@app.get("/api/study-areas/{area_id}/load")
async def load_study_area_images(area_id: str):
    """Load T0 and T1 images for a study area before running analysis (Step 3 & 4)."""
    if area_id not in STUDY_AREAS:
        raise HTTPException(status_code=404, detail="Study area not found")

    area = STUDY_AREAS[area_id]
    t0_path = area["dir"] / "t0.jpg"
    t1_path = area["dir"] / "t1.jpg"

    if not t0_path.exists() or not t1_path.exists():
        raise HTTPException(status_code=404, detail="Study area imagery files not found")

    img_t0 = Image.open(t0_path).convert("RGB")
    img_t1 = Image.open(t1_path).convert("RGB")

    validation = validate_image_pair(img_t0, img_t1, area["t0_filename"], area["t1_filename"], is_predefined=True)

    return {
        "areaId": area_id,
        "title": area["title"],
        "description": area["description"],
        "provenance": area["provenance"],
        "observationDates": area["observationDates"],
        "t0Filename": area["t0_filename"],
        "t1Filename": area["t1_filename"],
        "baselineImage": img_to_base64(img_t0),
        "followupImage": img_to_base64(img_t1),
        "dimensionsT0": list(img_t0.size),
        "dimensionsT1": list(img_t1.size),
        "validation": validation,
    }


@app.post("/api/analyze")
async def analyze_images(
    area_id: Optional[str] = Form(None),
    threshold: int = Form(30),
    old_image: Optional[UploadFile] = File(None),
    new_image: Optional[UploadFile] = File(None),
):
    """Run environmental analysis on predefined study area or custom upload (Step 5)."""
    # 1. Predefined Study Area
    if area_id and area_id in STUDY_AREAS:
        cache_key = f"{area_id}_{threshold}"
        if cache_key in STUDY_CACHE:
            return STUDY_CACHE[cache_key]

        area = STUDY_AREAS[area_id]
        t0_path = area["dir"] / "t0.jpg"
        t1_path = area["dir"] / "t1.jpg"
        if not t0_path.exists() or not t1_path.exists():
            raise HTTPException(status_code=404, detail="Study area files missing")

        img_t0 = Image.open(t0_path).convert("RGB")
        img_t1 = Image.open(t1_path).convert("RGB")

        result = perform_environmental_analysis(
            img_t0, img_t1, area["t0_filename"], area["t1_filename"],
            threshold=threshold, area_id=area_id, is_predefined=True
        )
        STUDY_CACHE[cache_key] = result
        return result

    # 2. Custom Upload
    if old_image and new_image:
        try:
            img_t0 = Image.open(old_image.file).convert("RGB")
            img_t1 = Image.open(new_image.file).convert("RGB")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid image format: {str(e)}")

        result = perform_environmental_analysis(
            img_t0, img_t1, old_image.filename or "Custom_T0.jpg", new_image.filename or "Custom_T1.jpg",
            threshold=threshold, is_predefined=False
        )
        return result

    raise HTTPException(status_code=400, detail="Provide either a valid area_id or both old_image and new_image.")


# Backwards compatibility endpoints
@app.get("/api/cases")
async def get_cases_legacy():
    return await get_study_areas()


@app.get("/api/demo")
async def demo_legacy(case: str = "area_01", threshold: int = 30):
    # Map legacy case1, case2, case3 to area_01, area_02, area_03
    mapped_id = {
        "case1": "area_01",
        "case2": "area_02",
        "case3": "area_03",
    }.get(case, case)

    if mapped_id not in STUDY_AREAS:
        mapped_id = "area_01"

    cache_key = f"{mapped_id}_{threshold}"
    if cache_key in STUDY_CACHE:
        return STUDY_CACHE[cache_key]

    area = STUDY_AREAS[mapped_id]
    img_t0 = Image.open(area["dir"] / "t0.jpg").convert("RGB")
    img_t1 = Image.open(area["dir"] / "t1.jpg").convert("RGB")

    res = perform_environmental_analysis(
        img_t0, img_t1, area["t0_filename"], area["t1_filename"],
        threshold=threshold, area_id=mapped_id, is_predefined=True
    )
    STUDY_CACHE[cache_key] = res
    return res


@app.on_event("startup")
def preload_cache():
    """Precompute analysis for the 3 demo study areas on startup for instantaneous UI response."""
    for aid in ["area_01", "area_02", "area_03"]:
        try:
            area = STUDY_AREAS[aid]
            t0 = Image.open(area["dir"] / "t0.jpg").convert("RGB")
            t1 = Image.open(area["dir"] / "t1.jpg").convert("RGB")
            res = perform_environmental_analysis(t0, t1, area["t0_filename"], area["t1_filename"], threshold=30, area_id=aid, is_predefined=True)
            STUDY_CACHE[f"{aid}_30"] = res
        except Exception as e:
            print(f"Startup preload note for {aid}: {e}")
