
import torch
import torchvision.models as models
from torch import nn
from pathlib import Path

# Find the downloaded model file
model_path = Path("models/eurosat_resnet50.pt")

if not model_path.exists():
    raise FileNotFoundError(f"Model file not found: {model_path}")

print("Loading TerraMind AI model...")

# Create the ResNet50 model architecture
model = models.resnet50(weights=None)
model.fc = nn.Linear(model.fc.in_features, 10)

# Load the trained weights safely
state_dict = torch.load(
    model_path,
    map_location="cpu",
    weights_only=True
)

model.load_state_dict(state_dict)
model.eval()

print("SUCCESS: TerraMind AI model loaded!")
print("Device: CPU")
print("Number of land-cover classes:", model.fc.out_features)

# Test with a dummy input
sample = torch.rand(1, 3, 224, 224)

with torch.no_grad():
    output = model(sample)

print("Test output shape:", output.shape)
print("AI model test completed!")
