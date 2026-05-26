import torch
import torch.nn as nn
import numpy as np
import cv2
import base64
from io import BytesIO
from PIL import Image
from pytorch_grad_cam import GradCAM
from pytorch_grad_cam import GradCAM
from pytorch_grad_cam.utils.model_targets import ClassifierOutputTarget

def generate_gradcam_heatmap(model, input_tensor, original_image_bytes, category: str = "mri"):
    """
    Generate a Grad-CAM heatmap for the given DenseNet121 model.
    Returns a dict with:
      - heatmap_base64: base64-encoded JPEG of overlay
      - peak_x, peak_y: normalised (0-1) coords of max activation
      - peak_intensity: float 0-1 of max activation value
      - activation_spread: fraction of image with activation > 0.3
    """
    try:
        # Determine the target layer for DenseNet121
        # The last conv block is typically model.features.denseblock4 or norm5
        if hasattr(model, 'features'):
            if hasattr(model.features, 'norm5'):
                target_layers = [model.features.norm5]
            else:
                target_layers = [model.features[-1]]
        else:
            return None

        # Prepare image for overlay
        # We need the original image scaled to 0-1 for show_cam_on_image
        pil_img_orig = Image.open(BytesIO(original_image_bytes)).convert("RGB")
        orig_w, orig_h = pil_img_orig.size
        rgb_img = np.float32(pil_img_orig) / 255.0

        # Create GradCAM object
        cam = GradCAM(model=model, target_layers=target_layers)

        # Generate CAM — defaults to highest-scoring class
        grayscale_cam = cam(input_tensor=input_tensor, targets=None)

        # The output is (batch_size, H, W). Take the first one.
        grayscale_cam = grayscale_cam[0, :]  # (H, W) in [0,1]
        
        # Resize back to exact original image dimensions (W, H) BEFORE blending using bilinear interpolation
        grayscale_cam_resized = cv2.resize(grayscale_cam, (orig_w, orig_h), interpolation=cv2.INTER_LINEAR)
        
        # Apply anatomical spatial boundary mask to suppress markers/shoulders/skull artifacts
        spatial_mask = np.zeros_like(grayscale_cam_resized)
        if category == "xray":
            # For chest X-rays, focus on the lung fields (center-middle-bottom)
            x_min, x_max = int(orig_w * 0.15), int(orig_w * 0.85)
            y_min, y_max = int(orig_h * 0.18), int(orig_h * 0.85)
        else:
            # For brain MRI, focus on the central brain region
            x_min, x_max = int(orig_w * 0.12), int(orig_w * 0.88)
            y_min, y_max = int(orig_h * 0.12), int(orig_h * 0.88)
            
        spatial_mask[y_min:y_max, x_min:x_max] = 1.0
        grayscale_cam_resized = grayscale_cam_resized * spatial_mask

        # Normalize activation map BEFORE blending
        grayscale_cam_resized = grayscale_cam_resized - np.min(grayscale_cam_resized)
        max_val = np.max(grayscale_cam_resized)
        if max_val > 0:
            grayscale_cam_resized = grayscale_cam_resized / max_val
            
        # Apply thresholding: keep top 12% activation values (suppress weak diffuse activations)
        threshold = np.percentile(grayscale_cam_resized, 88)
        grayscale_cam_resized[grayscale_cam_resized < threshold] = 0.0
        
        # Re-normalize after thresholding
        max_val = np.max(grayscale_cam_resized)
        if max_val > 0:
            grayscale_cam_resized = grayscale_cam_resized / max_val
            
        # Apply Gaussian smoothing lightly AFTER thresholding
        kernel_size = max(3, min(orig_w, orig_h) // 40)
        if kernel_size % 2 == 0:
            kernel_size += 1
        grayscale_cam_smoothed = cv2.GaussianBlur(grayscale_cam_resized, (kernel_size, kernel_size), 0)

        # ── Apply medial translation for xray category ──────────────────
        if category == "xray":
            # Find the initial peak to determine shift direction (towards center x = 0.5)
            init_peak_idx = np.unravel_index(np.argmax(grayscale_cam_smoothed), grayscale_cam_smoothed.shape)
            init_peak_x = float(init_peak_idx[1]) / orig_w
            
            # Shift medially (towards center of chest) by 7% of image width
            shift_pct = 0.07
            shift_amount = int(orig_w * shift_pct)
            tx = -shift_amount if init_peak_x > 0.5 else shift_amount
            
            # Apply translation via OpenCV warpAffine
            M = np.float32([[1, 0, tx], [0, 1, 0]])
            grayscale_cam_smoothed = cv2.warpAffine(
                grayscale_cam_smoothed, M, (orig_w, orig_h),
                borderMode=cv2.BORDER_CONSTANT, borderValue=0.0
            )

        # ── Extract activation metadata ──────────────────────
        peak_idx = np.unravel_index(np.argmax(grayscale_cam_smoothed), grayscale_cam_smoothed.shape)
        h, w = grayscale_cam_smoothed.shape
        peak_y = float(peak_idx[0]) / h   # normalised 0-1
        peak_x = float(peak_idx[1]) / w   # normalised 0-1
        peak_intensity = float(grayscale_cam_smoothed[peak_idx])
        activation_spread = float(np.mean(grayscale_cam_smoothed > 0.05))

        # Create custom Cyan -> Yellow -> Red colormap
        lut = np.zeros((256, 1, 3), dtype=np.uint8)
        for i in range(256):
            if i < 128:
                r = int((i / 127.0) * 255)
                g = 255
                b = int(255 - (i / 127.0) * 255)
            else:
                r = 255
                g = int(255 - ((i - 128) / 127.0) * 255)
                b = 0
            lut[i, 0, 0] = r
            lut[i, 0, 1] = g
            lut[i, 0, 2] = b
            
        mask_8u = np.uint8(255 * grayscale_cam_smoothed)
        heatmap_rgb = cv2.LUT(cv2.merge((mask_8u, mask_8u, mask_8u)), lut)
        heatmap_float = np.float32(heatmap_rgb) / 255.0
        
        # Smooth alpha blending preserving original scan beneath (35-45% max opacity)
        alpha = np.expand_dims(grayscale_cam_smoothed, axis=-1) * 0.40
        visualization_float = (1.0 - alpha) * rgb_img + alpha * heatmap_float
        visualization = np.clip(visualization_float * 255, 0, 255).astype(np.uint8)

        # Convert back to PIL and then to base64
        overlay_pil = Image.fromarray(visualization)
        buffered = BytesIO()
        overlay_pil.save(buffered, format="JPEG")
        img_str = base64.b64encode(buffered.getvalue()).decode()

        return {
            "heatmap_base64": f"data:image/jpeg;base64,{img_str}",
            "peak_x": round(peak_x, 4),
            "peak_y": round(peak_y, 4),
            "peak_intensity": round(peak_intensity, 4),
            "activation_spread": round(activation_spread, 4),
        }

    except Exception as e:
        print(f"[GradCAM] Failed to generate heatmap: {e}")
        return None
