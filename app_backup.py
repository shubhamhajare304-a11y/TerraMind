
import streamlit as st
from PIL import Image, ImageChops
import numpy as np
import csv
import io

st.set_page_config(
    page_title="TerraMind AI",
    page_icon="🌍",
    layout="wide"
)

st.title("🌍 TerraMind AI")
st.subheader("Environmental Change Detection")

st.write(
    "Compare images from two dates, highlight visual "
    "differences, and download a comparison report."
)

st.info("Current method: Pixel-based image processing")

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
    help="Lower values detect smaller pixel differences."
)

if old_file is not None and new_file is not None:
    try:
        old_image = Image.open(old_file).convert("RGB")
        new_image = Image.open(new_file).convert("RGB")

        original_size = old_image.size

        # Resize the newer image for basic comparison
        new_image = new_image.resize(old_image.size)

        # Calculate pixel differences
        difference = ImageChops.difference(
            old_image, new_image
        )

        diff_array = np.array(difference)

        # Find pixels whose largest channel difference
        # exceeds the selected threshold
        changed = np.max(diff_array, axis=2) > threshold

        change_percent = float(changed.mean() * 100)

        # Create a red overlay for changed pixels
        old_array = np.array(old_image).copy()
        old_array[changed] = (
            255,
            0,
            0
        )

        overlay = Image.fromarray(old_array)

        left, right = st.columns(2)

        with left:
            st.subheader("Older Image")
            st.image(old_image, use_container_width=True)

        with right:
            st.subheader("Newer Image")
            st.image(new_image, use_container_width=True)

        st.divider()
        st.subheader("Analysis Results")

        metric1, metric2 = st.columns(2)

        with metric1:
            st.metric(
                "Visually changed pixels",
                f"{change_percent:.2f}%"
            )

        with metric2:
            st.metric(
                "Image dimensions",
                f"{old_image.width} × {old_image.height}"
            )

        st.subheader("Red Change Overlay")
        st.caption(
            "Red pixels indicate detected visual differences "
            "over the older image."
        )
        st.image(overlay, use_container_width=True)

        st.subheader("Pixel Difference Map")
        st.image(
            Image.fromarray(diff_array),
            use_container_width=True
        )

        # Create a downloadable CSV report
        report = io.StringIO()
        writer = csv.writer(report)

        writer.writerow(["TerraMind Comparison Report"])
        writer.writerow(["Metric", "Value"])
        writer.writerow(["Method", "Pixel-based comparison"])
        writer.writerow(["Older image", old_file.name])
        writer.writerow(["Newer image", new_file.name])
        writer.writerow(["Image width", old_image.width])
        writer.writerow(["Image height", old_image.height])
        writer.writerow(["Original newer image size", str(new_array_size := new_image.size)])
        writer.writerow(["Sensitivity threshold", threshold])
        writer.writerow([
            "Visually changed pixels (%)",
            round(change_percent, 2)
        ])

        st.download_button(
            "Download Comparison Report (CSV)",
            data=report.getvalue(),
            file_name="terramind_report.csv",
            mime="text/csv"
        )

        st.warning(
            "This is a pixel-level comparison, not confirmed "
            "environmental change. Clouds, shadows, seasonal "
            "effects, image alignment and different map exports "
            "can affect the result. The red overlay is not an "
            "AI classification."
        )

    except Exception as error:
        st.error(f"Could not process the images: {error}")

else:
    st.info("Upload both images to start the comparison.")
