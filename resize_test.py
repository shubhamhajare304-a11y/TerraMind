
import torch
from PIL import Image
from torchvision import transforms
from ai_model import load_model, CLASSES
from pathlib import Path

IMAGE_PATHS = [
    Path("test_images/older.jpg"),
    Path("test_images/new.jpg"),
]

PREPROCESS = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225],
    ),
])

model = load_model()

def predict(image):
    tensor = PREPROCESS(image.convert("RGB")).unsqueeze(0)

    with torch.no_grad():
        probabilities = torch.softmax(model(tensor), dim=1)[0]

    index = probabilities.argmax().item()
    return CLASSES[index], probabilities[index].item() * 100

for path in IMAGE_PATHS:
    image = Image.open(path).convert("RGB")
    width, height = image.size

    print("\n" + "=" * 50)
    print(f"Image: {path}")
    print(f"Original size: {image.size}")

    label, confidence = predict(image)
    print(f"\nWHOLE IMAGE: {label} ({confidence:.2f}%)")

    print("\nNINE PATCHES:")

    patch_labels = []

    for row in range(3):
        for col in range(3):
            left = col * width // 3
            upper = row * height // 3
            right = (col + 1) * width // 3
            lower = (row + 1) * height // 3

            patch = image.crop((left, upper, right, lower))
            label, confidence = predict(patch)
            patch_labels.append(label)

            print(
                f"Patch ({row + 1},{col + 1}): "
                f"{label} ({confidence:.2f}%)"
            )

    forest_count = patch_labels.count("Forest")
    print(f"\nForest patches: {forest_count}/9")
    print("=" * 50)
