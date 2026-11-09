
from PIL import Image, ImageChops, ImageStat
from pathlib import Path

older_path = Path("test_images/older.jpg")
new_path = Path("test_images/new.jpg")

older = Image.open(older_path).convert("RGB")
new = Image.open(new_path).convert("RGB")

print("Older image size:", older.size)
print("Newer image size:", new.size)

if older.size != new.size:
    print("WARNING: Image dimensions differ.")
    new = new.resize(older.size)
    print("Resized newer image for comparison.")

difference = ImageChops.difference(older, new)
mean_difference = sum(ImageStat.Stat(difference).mean) / 3

print(f"Mean pixel difference: {mean_difference:.2f} / 255")

print("\nImage check completed.")
