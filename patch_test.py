
import torch
import torchvision.models as models
from torchvision import transforms
from PIL import Image
from torch import nn
from pathlib import Path

CLASSES = [
    "AnnualCrop", "Forest", "HerbaceousVegetation",
    "Highway", "Industrial", "Pasture",
    "PermanentCrop", "Residential", "River", "SeaLake"
]

# Use the same preprocessing as our previous test
preprocess = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225]
    )
])

# Load the trained model
model = models.resnet50(weights=None)
model.fc = nn.Linear(model.fc.in_features, 10)

weights = torch.load(
    "models/eurosat_resnet50.pt",
    map_location="cpu",
    weights_only=True
)

model.load_state_dict(weights)
model.eval()

def test_patches(path):
    image = Image.open(path).convert("RGB")
    width, height = image.size

    print(f"\nImage: {path}")

    # Divide the image into a 3 x 3 grid
    for row in range(3):
        for col in range(3):
            left = col * width // 3
            upper = row * height // 3
            right = (col + 1) * width // 3
            lower = (row + 1) * height // 3

            patch = image.crop((left, upper, right, lower))
            tensor = preprocess(patch).unsqueeze(0)

            with torch.no_grad():
                output = model(tensor)
                probabilities = torch.softmax(output, dim=1)[0]

            index = probabilities.argmax().item()

            print(
                f"Region ({row + 1},{col + 1}): "
                f"{CLASSES[index]} "
                f"({probabilities[index].item() * 100:.2f}%)"
            )

test_patches("test_images/older.jpg")
test_patches("test_images/new.jpg")
