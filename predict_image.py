
import torch
import torchvision.models as models
from torchvision import transforms
from PIL import Image
from torch import nn
from pathlib import Path

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

model_path = Path("models/eurosat_resnet50.pt")

preprocess = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225]
    ),
])

print("Loading AI model...")

model = models.resnet50(weights=None)
model.fc = nn.Linear(model.fc.in_features, 10)

weights = torch.load(
    model_path,
    map_location="cpu",
    weights_only=True
)

model.load_state_dict(weights)
model.eval()


def predict_image(image_path):
    image = Image.open(image_path).convert("RGB")
    image_tensor = preprocess(image).unsqueeze(0)

    with torch.no_grad():
        outputs = model(image_tensor)
        probabilities = torch.softmax(outputs, dim=1)[0]

    top_values, top_indices = torch.topk(probabilities, 3)

    print(f"\nImage: {image_path}")
    print("Top 3 predicted categories:")

    for rank, (value, index) in enumerate(
        zip(top_values, top_indices), start=1
    ):
        category = CLASSES[index.item()]
        confidence = value.item() * 100

        print(f"{rank}. {category}: {confidence:.2f}%")


predict_image("test_images/older.jpg")
predict_image("test_images/new.jpg")
