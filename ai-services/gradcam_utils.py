import torch
import torch.nn as nn
import numpy as np
import cv2
import base64
from io import BytesIO
from PIL import Image
from pytorch_grad_cam import GradCAM
from pytorch_grad_cam.utils.model_targets import ClassifierOutputTarget

def generate_gradcam_heatmap(model, input_tensor, original_image_bytes, category: str = "mri"):
    """
    Generate a Grad-CAM heatmap for the given DenseNet121 model.
    """
    try:
        if hasattr(model, 'features'):
            if hasattr(model.features, 'norm5'):
                target_layers = [model.features.norm5]
            else:
                target_layers = [model.features[-1]]
        else:
            return None

        pil_img_orig = Image.open(BytesIO(original_image_bytes)).convert("RGB")
        orig_w, orig_h = pil_img_orig.size
        rgb_img = np.float32(pil_img_orig) / 255.0

        cam = GradCAM(model=model, target_layers=target_layers)
        grayscale_cam = cam(input_tensor=input_tensor, targets=None)
        grayscale_cam = grayscale_cam[0, :]  # (H, W) in [0,1]
        
        grayscale_cam_resized = cv2.resize(grayscale_cam, (orig_w, orig_h), interpolation=cv2.INTER_LINEAR)
        
        spatial_mask = np.zeros_like(grayscale_cam_resized)
        if category == "xray":
            x_min, x_max = int(orig_w * 0.15), int(orig_w * 0.85)
            y_min, y_max = int(orig_h * 0.18), int(orig_h * 0.85)
        elif category == "ct":
            x_min, x_max = int(orig_w * 0.15), int(orig_w * 0.85)
            y_min, y_max = int(orig_h * 0.15), int(orig_h * 0.85)
        else:
            x_min, x_max = int(orig_w * 0.12), int(orig_w * 0.88)
            y_min, y_max = int(orig_h * 0.12), int(orig_h * 0.88)
            
        spatial_mask[y_min:y_max, x_min:x_max] = 1.0
        grayscale_cam_resized = grayscale_cam_resized * spatial_mask

        grayscale_cam_resized = grayscale_cam_resized - np.min(grayscale_cam_resized)
        max_val = np.max(grayscale_cam_resized)
        if max_val > 0:
            grayscale_cam_resized = grayscale_cam_resized / max_val
            
        threshold = np.percentile(grayscale_cam_resized, 88)
        grayscale_cam_resized[grayscale_cam_resized < threshold] = 0.0
        
        max_val = np.max(grayscale_cam_resized)
        if max_val > 0:
            grayscale_cam_resized = grayscale_cam_resized / max_val
            
        kernel_size = max(3, min(orig_w, orig_h) // 40)
        if kernel_size % 2 == 0:
            kernel_size += 1
        grayscale_cam_smoothed = cv2.GaussianBlur(grayscale_cam_resized, (kernel_size, kernel_size), 0)

        if category == "xray":
            init_peak_idx = np.unravel_index(np.argmax(grayscale_cam_smoothed), grayscale_cam_smoothed.shape)
            init_peak_x = float(init_peak_idx[1]) / orig_w
            
            shift_pct = 0.07
            shift_amount = int(orig_w * shift_pct)
            tx = -shift_amount if init_peak_x > 0.5 else shift_amount
            
            M = np.float32([[1, 0, tx], [0, 1, 0]])
            grayscale_cam_smoothed = cv2.warpAffine(
                grayscale_cam_smoothed, M, (orig_w, orig_h),
                borderMode=cv2.BORDER_CONSTANT, borderValue=0.0
            )

        peak_idx = np.unravel_index(np.argmax(grayscale_cam_smoothed), grayscale_cam_smoothed.shape)
        h, w = grayscale_cam_smoothed.shape
        peak_y = float(peak_idx[0]) / h
        peak_x = float(peak_idx[1]) / w
        peak_intensity = float(grayscale_cam_smoothed[peak_idx])
        activation_spread = float(np.mean(grayscale_cam_smoothed > 0.05))

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
        
        alpha = np.expand_dims(grayscale_cam_smoothed, axis=-1) * 0.40
        visualization_float = (1.0 - alpha) * rgb_img + alpha * heatmap_float
        visualization = np.clip(visualization_float * 255, 0, 255).astype(np.uint8)

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
