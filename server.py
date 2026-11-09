"""FastAPI backend for TerraMind - Enterprise Geospatial Change Intelligence."""

import base64
import io
from pathlib import Path

from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, ImageChops
import numpy as np

from ai_model import predict_land_cover

app = FastAPI(title="TerraMind Geospatial Intelligence API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).parent


def img_to_base64(img: Image.Image) -> str:
    """Convert PIL image to base64 string."""
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("utf-8")


def compute_vegetation_mask(rgb_arr: np.ndarray) -> np.ndarray:
    """Compute vegetation mask using Visible Atmospherically Resistant Index (VARI)."""
    r = rgb_arr[:, :, 0].astype(float)
    g = rgb_arr[:, :, 1].astype(float)
    b = rgb_arr[:, :, 2].astype(float)
    denom = g + r - b
    denom[denom == 0] = 1e-5
    vari = (g - r) / denom
    return (vari > 0.10) & (g > r * 1.05) & (g > b * 1.02)


def compute_water_mask(rgb_arr: np.ndarray) -> np.ndarray:
    """Compute optical surface water mask."""
    r = rgb_arr[:, :, 0].astype(float)
    g = rgb_arr[:, :, 1].astype(float)
    b = rgb_arr[:, :, 2].astype(float)
    total = r + g + b
    return (
        (b >= r * 0.95)
        & (g >= r * 0.90)
        & (r < 110)
        & (total < 320)
        & (b > 20)
    )


def process_comparison(old_img: Image.Image, new_img: Image.Image, old_name: str, new_name: str, threshold: int = 30):
    orig_old_size = list(old_img.size)
    orig_new_size = list(new_img.size)

    # Uniform grid comparison size
    new_img_resized = new_img.resize(old_img.size)

    old_np = np.array(old_img)
    new_np = np.array(new_img_resized)
    total_pixels = float(old_np.shape[0] * old_np.shape[1])

    # 1. VEGETATION CHANGE
    veg_old = compute_vegetation_mask(old_np)
    veg_new = compute_vegetation_mask(new_np)

    veg_loss_mask = veg_old & (~veg_new)
    veg_gain_mask = (~veg_old) & veg_new
    veg_stable_mask = veg_old & veg_new

    veg_loss_pct = float(veg_loss_mask.sum() / total_pixels * 100)
    veg_gain_pct = float(veg_gain_mask.sum() / total_pixels * 100)
    veg_old_pct = float(veg_old.sum() / total_pixels * 100)
    veg_new_pct = float(veg_new.sum() / total_pixels * 100)
    veg_net_change = veg_new_pct - veg_old_pct

    veg_map = np.zeros_like(old_np)
    veg_map[:] = (old_np * 0.25).astype(np.uint8)
    veg_map[veg_stable_mask] = [20, 110, 45]     # Dark green
    veg_map[veg_gain_mask] = [34, 197, 94]       # Vibrant green
    veg_map[veg_loss_mask] = [239, 68, 68]       # Red loss
    veg_overlay = Image.fromarray(veg_map)

    # 2. WATER CHANGE
    water_old = compute_water_mask(old_np)
    water_new = compute_water_mask(new_np)

    water_loss_mask = water_old & (~water_new)
    water_gain_mask = (~water_old) & water_new
    water_stable_mask = water_old & water_new

    water_old_pct = float(water_old.sum() / total_pixels * 100)
    water_new_pct = float(water_new.sum() / total_pixels * 100)
    water_loss_pct = float(water_loss_mask.sum() / total_pixels * 100)
    water_gain_pct = float(water_gain_mask.sum() / total_pixels * 100)
    water_net_change = water_new_pct - water_old_pct

    water_map = np.zeros_like(old_np)
    water_map[:] = (old_np * 0.25).astype(np.uint8)
    water_map[water_stable_mask] = [14, 116, 144] # Deep cyan/blue
    water_map[water_gain_mask] = [6, 182, 212]    # Cyan flooded
    water_map[water_loss_mask] = [245, 158, 11]   # Amber dried
    water_overlay = Image.fromarray(water_map)

    # 3. LAND COVER CHANGE
    difference = ImageChops.difference(old_img, new_img_resized)
    diff_arr = np.array(difference)
    pixel_changed = np.max(diff_arr, axis=2) > threshold
    change_pct = float(pixel_changed.mean() * 100)
    stable_pct = 100.0 - change_pct

    lc_map = old_np.copy()
    lc_map[pixel_changed] = [225, 29, 72]  # Crimson highlight
    lc_overlay = Image.fromarray(lc_map)

    old_preds = predict_land_cover(old_img)
    new_preds = predict_land_cover(new_img_resized)

    return {
        "dimensions": [old_img.width, old_img.height],
        "origOldSize": orig_old_size,
        "origNewSize": orig_new_size,
        "oldFilename": old_name,
        "newFilename": new_name,
        "threshold": threshold,
        "baselineImage": img_to_base64(old_img),
        "followupImage": img_to_base64(new_img_resized),

        "vegetation": {
            "baselinePct": round(veg_old_pct, 2),
            "followupPct": round(veg_new_pct, 2),
            "netChangePct": round(veg_net_change, 2),
            "lossPct": round(veg_loss_pct, 2),
            "gainPct": round(veg_gain_pct, 2),
            "mapImage": img_to_base64(veg_overlay),
        },

        "water": {
            "baselinePct": round(water_old_pct, 2),
            "followupPct": round(water_new_pct, 2),
            "netChangePct": round(water_net_change, 2),
            "lossPct": round(water_loss_pct, 2),
            "gainPct": round(water_gain_pct, 2),
            "mapImage": img_to_base64(water_overlay),
        },

        "landCover": {
            "surfaceShiftPct": round(change_pct, 2),
            "stabilityPct": round(stable_pct, 2),
            "baselineClass": old_preds[0]["class"],
            "baselineConf": round(old_preds[0]["confidence"], 1),
            "followupClass": new_preds[0]["class"],
            "followupConf": round(new_preds[0]["confidence"], 1),
            "oldPredictions": old_preds,
            "newPredictions": new_preds,
            "mapImage": img_to_base64(lc_overlay),
            "diffImage": img_to_base64(difference),
        },
    }


@app.post("/api/analyze")
async def analyze(
    old_image: UploadFile = File(...),
    new_image: UploadFile = File(...),
    threshold: int = Form(30),
):
    old_img = Image.open(old_image.file).convert("RGB")
    new_img = Image.open(new_image.file).convert("RGB")
    return process_comparison(old_img, new_img, old_image.filename, new_image.filename, threshold)


@app.get("/api/demo")
async def demo():
    old_path = BASE_DIR / "test_images" / "older.jpg"
    new_path = BASE_DIR / "test_images" / "new.jpg"
    if not old_path.exists() or not new_path.exists():
        return {"error": "Demo images not found on server"}
    old_img = Image.open(old_path).convert("RGB")
    new_img = Image.open(new_path).convert("RGB")
    return process_comparison(old_img, new_img, "Sentinel2_Scene_T0.jpg", "Sentinel2_Scene_T1.jpg", threshold=30)
