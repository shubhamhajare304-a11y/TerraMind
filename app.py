
import streamlit as st
from PIL import Image, ImageChops
from ai_model import predict_land_cover
import numpy as np
import csv
import io

st.set_page_config(
    page_title="TerraMind AI",
    page_icon="🌍",
    layout="wide"
)

st.title("🌍 TerraMind AI")
st.subheader("Satellite-Based Environmental Change Detection")

st.write(
    "Compare satellite images from two dates, visualize "
    "pixel differences, and explore experimental AI "
    "land-cover predictions."
)

st.info(
    "Methods: Pixel-based comparison + experimental "
    "AI land-cover classification"
)

col1, col2 = st.columns(2)

with col1:
    old_file = st.file_uploader(
        "Upload older image",
        type=["png", "jpg", "jpeg"],
        key="old"
    )

with col2:
    new_file = st.file_uploader(
        "Upload newer image",
        type=["png", "jpg", "jpeg"],
        key="new"
    )

threshold = st.slider(
    "Change detection sensitivity",
    min_value=10,
    max_value=100,
    value=30,
    help=(
        "Lower values detect smaller pixel differences. "
        "Higher values ignore smaller differences."
    )
)

if old_file is not None and new_file is not None:
    try:
        old_image = Image.open(old_file).convert("RGB")
        new_image = Image.open(new_file).convert("RGB")

        original_old_size = old_image.size
        original_new_size = new_image.size

        # Resize the newer image for pixel comparison.
        # Resizing alone does not geographically align images.
        new_image = new_image.resize(old_image.size)

        # Calculate pixel differences.
        difference = ImageChops.difference(
            old_image, new_image
        )
        diff_array = np.array(difference)

        changed = np.max(diff_array, axis=2) > threshold

        change_percent = float(changed.mean() * 100)
        similar_percent = 100 - change_percent

        # Create red overlay.
        old_array = np.array(old_image).copy()
        old_array[changed] = (255, 0, 0)
        overlay = Image.fromarray(old_array)

        # Display input images.
        left, right = st.columns(2)

        with left:
            st.subheader("Older Image")
            st.image(
                old_image,
                use_container_width=True
            )

        with right:
            st.subheader("Newer Image")
            st.image(
                new_image,
                use_container_width=True
            )

        # Pixel comparison.
        st.divider()
        st.subheader("📊 Pixel-Based Comparison")

        metric1, metric2, metric3 = st.columns(3)

        with metric1:
            st.metric(
                "Visually Different Pixels",
                f"{change_percent:.2f}%"
            )

        with metric2:
            st.metric(
                "Pixels Below Threshold",
                f"{similar_percent:.2f}%"
            )

        with metric3:
            st.metric(
                "Image Dimensions",
                f"{old_image.width} × {old_image.height}"
            )

        st.caption(
            f"Original older image: {original_old_size[0]} × "
            f"{original_old_size[1]} pixels | "
            f"Original newer image: {original_new_size[0]} × "
            f"{original_new_size[1]} pixels"
        )

        st.caption(
            f"Current sensitivity threshold: {threshold}/255. "
            "A pixel is counted as different when its largest "
            "RGB channel difference exceeds this threshold."
        )

        # New comparison summary.
        st.divider()
        st.subheader("🌍 Environmental Comparison Summary")

        st.write(
            "This section summarizes the visual differences "
            "between the two uploaded images."
        )

        st.progress(change_percent / 100)

        st.markdown(
            f"**{change_percent:.2f}%** of pixels exceeded "
            f"the selected difference threshold, while "
            f"**{similar_percent:.2f}%** did not."
        )

        st.info(
            "These percentages describe pixel-level visual "
            "differences only. Pixels below the threshold may "
            "still contain small differences."
        )

        st.subheader("🧠 Interpretation of Results")

        if change_percent >= 50:
            st.write(
                "**Observation:** A large proportion of pixels "
                "exceeded the selected difference threshold."
            )
        elif change_percent >= 20:
            st.write(
                "**Observation:** A moderate proportion of "
                "pixels exceeded the selected difference threshold."
            )
        else:
            st.write(
                "**Observation:** A relatively small proportion "
                "of pixels exceeded the selected difference threshold."
            )

        st.write(
            "**Possible explanations:** Differences may result "
            "from lighting, shadows, seasonal vegetation, clouds, "
            "image alignment, image processing, or genuine "
            "land-cover changes."
        )

        st.caption(
            "The observation labels above are simple descriptive "
            "ranges for this prototype, not scientifically "
            "validated environmental-change categories."
        )

        # Red overlay.
        st.divider()
        st.subheader("🔴 Red Change Overlay")

        st.caption(
            "Red areas highlight pixels that exceeded the "
            "selected threshold. They are not confirmed "
            "environmental changes."
        )

        st.image(
            overlay,
            use_container_width=True
        )

        # Difference map.
        st.subheader("Pixel Difference Map")

        st.image(
            difference,
            use_container_width=True
        )

        # AI classification.
        st.divider()
        st.subheader("🤖 AI Land-Cover Classification")

        st.write(
            "The pretrained EuroSAT ResNet50 model predicts "
            "a land-cover category for each image."
        )

        with st.spinner(
            "Analyzing both images with the AI model..."
        ):
            old_predictions = predict_land_cover(old_image)
            new_predictions = predict_land_cover(new_image)

        old_class = old_predictions[0]["class"]
        new_class = new_predictions[0]["class"]

        ai_col1, ai_col2 = st.columns(2)

        with ai_col1:
            st.markdown("**Older Image Prediction**")

            st.metric(
                "Predicted Category",
                old_class
            )

            st.caption(
                f"Model score: "
                f"{old_predictions[0]['confidence']:.2f}%"
            )

            with st.expander("View top 3 predictions"):
                for item in old_predictions:
                    st.write(
                        f"{item['class']}: "
                        f"{item['confidence']:.2f}%"
                    )

        with ai_col2:
            st.markdown("**Newer Image Prediction**")

            st.metric(
                "Predicted Category",
                new_class
            )

            st.caption(
                f"Model score: "
                f"{new_predictions[0]['confidence']:.2f}%"
            )

            with st.expander("View top 3 predictions"):
                for item in new_predictions:
                    st.write(
                        f"{item['class']}: "
                        f"{item['confidence']:.2f}%"
                    )

        if old_class == new_class:
            ai_comparison = "Same predicted category"
            st.success(
                f"Both images are classified as **{old_class}**. "
                "The model predicts the same broad land-cover "
                "category for both images."
            )
        else:
            ai_comparison = "Different predicted categories"
            st.warning(
                f"The model predicts **{old_class}** for the "
                f"older image and **{new_class}** for the newer "
                "image. This difference needs verification."
            )

        st.warning(
            "AI predictions identify broad land-cover categories. "
            "The same category does not prove that the land stayed "
            "unchanged, and different categories do not prove "
            "environmental damage."
        )

        # Final combined interpretation.
        st.divider()
        st.subheader("📝 Overall Result")

        st.write(
            f"The pixel comparison found **{change_percent:.2f}%** "
            "of pixels above the selected difference threshold. "
            f"The AI classified the older image as **{old_class}** "
            f"and the newer image as **{new_class}**."
        )

        st.write(
            "Together, these results describe visual differences "
            "and predicted land-cover categories. They do not "
            "independently establish the cause, location, or "
            "environmental significance of any change."
        )

        st.warning(
            "Research limitation: Images should ideally be "
            "geographically aligned and captured under comparable "
            "conditions. Clouds, shadows, seasons, lighting, "
            "and image processing can affect the comparison. "
            "Neither method confirms environmental change."
        )

        # Downloadable CSV report.
        report = io.StringIO()
        writer = csv.writer(report)

        writer.writerow(["TerraMind AI Comparison Report"])
        writer.writerow(["Section", "Metric", "Value"])

        writer.writerow([
            "Images", "Older image", old_file.name
        ])
        writer.writerow([
            "Images", "Newer image", new_file.name
        ])
        writer.writerow([
            "Images",
            "Original older dimensions",
            f"{original_old_size[0]} x {original_old_size[1]}"
        ])
        writer.writerow([
            "Images",
            "Original newer dimensions",
            f"{original_new_size[0]} x {original_new_size[1]}"
        ])
        writer.writerow([
            "Comparison",
            "Comparison dimensions",
            f"{old_image.width} x {old_image.height}"
        ])
        writer.writerow([
            "Comparison",
            "Sensitivity threshold",
            threshold
        ])
        writer.writerow([
            "Comparison",
            "Visually different pixels (%)",
            round(change_percent, 2)
        ])
        writer.writerow([
            "Comparison",
            "Pixels below threshold (%)",
            round(similar_percent, 2)
        ])
        writer.writerow([
            "Interpretation",
            "Visual difference description",
            (
                "Large proportion"
                if change_percent >= 50
                else "Moderate proportion"
                if change_percent >= 20
                else "Relatively small proportion"
            )
        ])
        writer.writerow([
            "AI",
            "Model",
            "EuroSAT ResNet50"
        ])
        writer.writerow([
            "AI",
            "Older image predicted category",
            old_class
        ])
        writer.writerow([
            "AI",
            "Older image model score (%)",
            round(old_predictions[0]["confidence"], 2)
        ])
        writer.writerow([
            "AI",
            "Newer image predicted category",
            new_class
        ])
        writer.writerow([
            "AI",
            "Newer image model score (%)",
            round(new_predictions[0]["confidence"], 2)
        ])
        writer.writerow([
            "AI",
            "Category comparison",
            ai_comparison
        ])
        writer.writerow([
            "Limitations",
            "Important note",
            "Pixel differences and AI predictions do not "
            "confirm environmental change."
        ])

        st.download_button(
            "📥 Download Comparison Report (CSV)",
            data=report.getvalue(),
            file_name="terramind_report.csv",
            mime="text/csv"
        )

    except Exception as error:
        st.error(
            f"Could not process the images: {error}"
        )

else:
    st.info(
        "Upload both images to start the comparison."
    )
