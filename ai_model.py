
from functools import lru_cache
from pathlib import Path

import torch
import torchvision.models as models
from torch import nn
from torchvision import transforms

CLASSES = [
    "AnnualCrop",
    "Forest",
    "HerbaceousVegetation",
    "Highway",
    "Industrial",
    "Pasture",
    "PermanentCrop",
    "Residential",
    "River",
    "SeaLake",
]

MODEL_PATH = Path(__file__).parent / "models" / "eurosat_resnet50.pt"

PREPROCESS = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225],
    ),
])


@lru_cache(maxsize=1)
def load_model():
    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Model weights not found: {MODEL_PATH}"
        )

    model = models.resnet50(weights=None)
    model.fc = nn.Linear(model.fc.in_features, len(CLASSES))

    weights = torch.load(
        MODEL_PATH,
        map_location="cpu",
        weights_only=True,
    )

    model.load_state_dict(weights)
    model.eval()

    return model


def predict_land_cover(image):
    """Predict land cover using nine image patches."""

    image = image.convert("RGB")
    width, height = image.size

    model = load_model()
    patch_probabilities = []

    for row in range(3):
        for col in range(3):
            left = col * width // 3
            upper = row * height // 3
            right = (col + 1) * width // 3
            lower = (row + 1) * height // 3

            patch = image.crop((left, upper, right, lower))
            tensor = PREPROCESS(patch).unsqueeze(0)

            with torch.no_grad():
                probabilities = torch.softmax(
                    model(tensor), dim=1
                )[0]

            patch_probabilities.append(probabilities)

    # Average the probabilities across all nine patches.
    average_probabilities = torch.stack(
        patch_probabilities
    ).mean(dim=0)

    top_values, top_indices = torch.topk(
        average_probabilities, 3
    )

    return [
        {
            "class": CLASSES[index.item()],
            "confidence": value.item() * 100,
        }
        for value, index in zip(top_values, top_indices)
    ]
