
from PIL import Image
from ai_model import predict_land_cover

image_paths = [
    "test_images/older.jpg",
    "test_images/new.jpg",
]

for path in image_paths:
    image = Image.open(path)
    predictions = predict_land_cover(image)

    print(f"\nImage: {path}")
    for item in predictions:
        print(
            f"{item['class']}: "
            f"{item['confidence']:.2f}%"
        )
