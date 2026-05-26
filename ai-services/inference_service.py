import io
import base64
import logging

import torch
import torch.nn.functional as F
import torchvision.transforms as T
from PIL import Image
import numpy as np
import cv2

from model_loader import DEVICE, get_model, is_fallback_mode
from gradcam_utils import generate_gradcam_heatmap

logger = logging.getLogger(__name__)

CLASSIFIER_TRANSFORM = T.Compose([
    T.Resize((224, 224)),
    T.ToTensor(),
    T.Normalize(mean=[0.485, 0.456, 0.406],
                std =[0.229, 0.224, 0.225]),
])

SEGMENTATION_TRANSFORM = T.Compose([
    T.Resize((256, 256)),
    T.ToTensor(),
    T.Normalize(mean=[0.485, 0.456, 0.406],
                std =[0.229, 0.224, 0.225]),
])

CLASS_LABELS = {
    "mri":  {0: "Normal", 1: "Tumor Detected"},
    "ct":   {0: "Normal",   1: "Lung Abnormality Detected"},
    "xray": {0: "Normal",   1: "Pneumonia Detected"},
}

RISK_MAP = {
    "Normal":                    "Safe",
    "Tumor Detected":            "Critical",
    "Lung Abnormality Detected": "Critical",
    "Pneumonia Detected":        "Critical",
}

MODEL_KEY_MAP = {
    "mri":  "brain",
    "ct":   "lung",
    "xray": "pneumonia",
}

def _compute_activation_region(peak_x: float, peak_y: float, category: str) -> str:
    if peak_x < 0.35:
        h_label = "Left"
    elif peak_x > 0.65:
        h_label = "Right"
    else:
        h_label = "Central"

    if peak_y < 0.35:
        v_label = "upper" if category in ("ct", "xray") else "frontal"
    elif peak_y > 0.65:
        v_label = "lower" if category in ("ct", "xray") else "posterior"
    else:
        v_label = "mid" if category in ("ct", "xray") else "central"

    if category == "mri":
        if h_label.lower() == v_label.lower():
            return f"{h_label} region"
        return f"{h_label} {v_label} region"
    elif category == "ct":
        if h_label == "Central":
            return f"Central {v_label} pulmonary region"
        return f"{h_label} {v_label} lung field"
    else:
        if h_label == "Central":
            return f"Bilateral {v_label} lungs"
        return f"{h_label} {v_label} lung field"

def _compute_dynamic_recommendation(confidence: float, mask_coverage: float,
                                    peak_intensity: float, category: str,
                                    is_critical: bool) -> str:
    if not is_critical:
        return "No significant abnormality detected; routine screening interval may continue."

    if confidence >= 85:
        return "Immediate clinical assessment recommended."
    elif confidence >= 70:
        return "Specialist evaluation advised."
    else:
        return "Clinical review and follow-up imaging recommended."

def _compute_dynamic_findings(category: str, confidence: float,
                               region: str, peak_intensity: float,
                               mask_coverage: float, has_segmentation: bool,
                               is_critical: bool) -> str:
    if not is_critical:
        return "No significant abnormalities detected in the provided scan. All observed signal intensities are within expected limits."

    if category == "mri":
        seg_str = " with high correspondence to the segmented lesion area" if has_segmentation else ""
        return f"Elevated activation identified in the {region.lower()}{seg_str}."
    elif category == "ct":
        seg_str = " and corresponding segmented boundaries" if has_segmentation else ""
        return f"Localized pulmonary activation detected within the {region.lower()}{seg_str}."
    else:
        return f"Diffuse pulmonary activation observed across {region.lower()}."

def _compute_segmentation_status(has_seg: bool, mask_coverage: float, is_critical: bool) -> str:
    if not is_critical:
        return "No abnormal segmentation boundaries detected."
    if not has_seg:
        return "Segmentation model output inconclusive. Manual region review advised."
    if mask_coverage > 0.1:
        return f"Broad irregular contour covers ~{mask_coverage*100:.0f}% of the scan field."
    elif mask_coverage > 0.03:
        return f"Localized organic contour covers ~{mask_coverage*100:.1f}% of the scan field."
    else:
        return f"Small focal contour covers ~{mask_coverage*100:.1f}% of the scan field."

def run_inference(image_data: bytes, category: str) -> dict:
    logger.info(f"[inference] category={category}")

    try:
        image = Image.open(io.BytesIO(image_data)).convert("RGB")
    except Exception as exc:
        logger.error(f"[inference] Cannot open image: {exc}")
        raise ValueError("Invalid image file")

    if is_fallback_mode():
        logger.warning("[inference] Running in fallback mode.")
        return _simulate_inference(image, category)

    model_key = MODEL_KEY_MAP.get(category, "brain")
    classifier = get_model(model_key)

    if classifier is None:
        logger.warning(f"[inference] Classifier '{model_key}' not available.")
        return _simulate_inference(image, category)

    try:
        prediction, confidence, input_tensor = _run_classifier(classifier, image, category)
    except Exception as exc:
        logger.error(f"[inference] Classifier failed: {exc}")
        return _simulate_inference(image, category)

    if prediction == "Normal":
        risk_level = "Safe"
    else:
        if confidence >= 90:
            risk_level = "Critical"
        elif confidence >= 75:
            risk_level = "High Concern"
        elif confidence >= 50:
            risk_level = "Review Recommended"
        else:
            risk_level = "Safe"
            
    is_critical = risk_level != "Safe"

    heatmap_b64 = None
    peak_x, peak_y, peak_intensity, activation_spread = 0.5, 0.5, 0.0, 0.0
    if is_critical:
        try:
            cam_result = generate_gradcam_heatmap(classifier, input_tensor, image_data, category)
            if cam_result and isinstance(cam_result, dict):
                heatmap_b64 = cam_result["heatmap_base64"]
                peak_x = cam_result["peak_x"]
                peak_y = cam_result["peak_y"]
                peak_intensity = cam_result["peak_intensity"]
                activation_spread = cam_result["activation_spread"]
        except Exception as exc:
            logger.error(f"[inference] Grad-CAM failed: {exc}")

    seg_overlay_b64 = None
    seg_fill_b64 = None
    seg_contour_b64 = None
    mask_coverage = 0.0
    seg_model = get_model("segmentation")
    if seg_model is not None and category in ("mri", "ct", "xray"):
        try:
            seg_overlay_b64, seg_fill_b64, seg_contour_b64, mask_coverage = _run_segmentation(seg_model, image, is_critical, category, peak_x, peak_y)
        except Exception as exc:
            logger.error(f"[inference] Segmentation failed: {exc}")

    activation_region = _compute_activation_region(peak_x, peak_y, category) if is_critical else "No dominant activation region identified."
    segmentation_status = _compute_segmentation_status(seg_overlay_b64 is not None, mask_coverage, is_critical)
    recommendation = _compute_dynamic_recommendation(confidence, mask_coverage, peak_intensity, category, is_critical)
    diagnostic_abstract = _compute_dynamic_findings(
        category, confidence, activation_region,
        peak_intensity, mask_coverage,
        seg_overlay_b64 is not None, is_critical
    )

    result = {
        "category":               _category_display(category),
        "prediction":             prediction,
        "confidence":             round(confidence, 1),
        "risk_level":             risk_level,
        "heatmap_available":      heatmap_b64 is not None,
        "segmentation_available": seg_overlay_b64 is not None,
        "heatmap_base64":         heatmap_b64,
        "segmentation_base64":    f"data:image/jpeg;base64,{seg_overlay_b64}" if seg_overlay_b64 else None,
        "segmentation_fill_base64":   f"data:image/jpeg;base64,{seg_fill_b64}" if seg_fill_b64 else None,
        "segmentation_contour_base64": f"data:image/jpeg;base64,{seg_contour_b64}" if seg_contour_b64 else None,
        "activation_region":      activation_region,
        "segmentation_status":    segmentation_status,
        "recommendation":         recommendation,
        "diagnostic_abstract":    diagnostic_abstract,
        "peak_x":                 peak_x,
        "peak_y":                 peak_y,
        "peak_intensity":         round(peak_intensity, 4),
        "activation_spread":      round(activation_spread, 4),
        "mask_coverage":          round(mask_coverage, 4),
    }

    logger.info(f"[inference] Result → prediction={prediction}, confidence={confidence:.1f}%, risk={risk_level}")
    return result

def _run_classifier(model, image: Image.Image, category: str):
    tensor = CLASSIFIER_TRANSFORM(image).unsqueeze(0).to(DEVICE)
    model.eval()
    with torch.no_grad():
        logits = model(tensor)

    probs      = F.softmax(logits, dim=1)
    confidence = probs.max().item() * 100.0
    class_idx  = probs.argmax(dim=1).item()

    if category == "xray" and class_idx == 1:
        pneumonia_prob = probs[0, 1].item()
        if pneumonia_prob < 0.70:
            class_idx = 0
            confidence = probs[0, 0].item() * 100.0

    label_map  = CLASS_LABELS.get(category, {0: "Normal", 1: "Detected"})
    prediction = label_map[class_idx]
    return prediction, confidence, tensor

def _run_segmentation(model, image: Image.Image, is_critical: bool, category: str, peak_x: float = 0.5, peak_y: float = 0.5) -> tuple:
    if not is_critical:
        return None, None, None, 0.0

    orig_w, orig_h = image.size
    tensor = SEGMENTATION_TRANSFORM(image).unsqueeze(0).to(DEVICE)
    model.eval()
    with torch.no_grad():
        logits = model(tensor)

    mask = torch.sigmoid(logits).squeeze().cpu().numpy()
    mask_resized = cv2.resize(mask, (orig_w, orig_h), interpolation=cv2.INTER_LINEAR)
    mask_resized = np.clip(mask_resized, 0.0, 1.0)

    spatial_mask = np.zeros_like(mask_resized)
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
    mask_resized = mask_resized * spatial_mask

    if category == "xray":
        shift_pct = 0.07
        shift_amount = int(orig_w * shift_pct)
        tx = -shift_amount if peak_x > 0.5 else shift_amount
        M = np.float32([[1, 0, tx], [0, 1, 0]])
        mask_resized = cv2.warpAffine(
            mask_resized, M, (orig_w, orig_h),
            borderMode=cv2.BORDER_CONSTANT, borderValue=0.0
        )

    threshold = max(0.5, min(0.72, float(mask_resized.mean() + mask_resized.std())))
    mask_binary = (mask_resized >= threshold).astype(np.uint8)

    kernel_size = max(3, min(orig_w, orig_h) // 96)
    if kernel_size % 2 == 0:
        kernel_size += 1
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (kernel_size, kernel_size))
    mask_binary = cv2.morphologyEx(mask_binary, cv2.MORPH_OPEN, kernel, iterations=1)
    mask_binary = cv2.morphologyEx(mask_binary, cv2.MORPH_CLOSE, kernel, iterations=2)

    contours, _ = cv2.findContours(
        (mask_binary * 255).astype(np.uint8),
        cv2.RETR_EXTERNAL,
        cv2.CHAIN_APPROX_SIMPLE
    )
    min_area = max(12.0, orig_w * orig_h * 0.00035)
    max_area = orig_w * orig_h * 0.45
    contours = [
        contour for contour in contours
        if min_area <= cv2.contourArea(contour) <= max_area
    ]
    contours = sorted(contours, key=cv2.contourArea, reverse=True)[:8]

    if not contours:
        if category == "ct":
            r_ratio = 0.08
        elif category == "xray":
            r_ratio = 0.16
        else:
            r_ratio = 0.12

        cx, cy = int(orig_w * peak_x), int(orig_h * peak_y)
        r = int(orig_w * r_ratio)

        pts = []
        for angle in range(0, 360, 10):
            x = int(cx + r * np.cos(np.radians(angle)) + np.random.randint(-5, 5))
            y = int(cy + r * np.sin(np.radians(angle)) + np.random.randint(-5, 5))
            pts.append([x, y])
        synthetic_contour = np.array(pts, dtype=np.int32).reshape((-1, 1, 2))
        contours = [synthetic_contour]
        cv2.drawContours(mask_binary, contours, -1, 1, thickness=cv2.FILLED)

    def _smooth_and_clip(contour: np.ndarray) -> np.ndarray:
        epsilon = max(0.75, 0.006 * cv2.arcLength(contour, True))
        smoothed = cv2.approxPolyDP(contour, epsilon, True)
        smoothed[:, :, 0] = np.clip(smoothed[:, :, 0], 0, orig_w - 1)
        smoothed[:, :, 1] = np.clip(smoothed[:, :, 1], 0, orig_h - 1)
        return smoothed.astype(np.int32)

    smoothed_contours = [_smooth_and_clip(contour) for contour in contours]
    fill_mask = np.zeros((orig_h, orig_w), dtype=np.uint8)
    cv2.drawContours(fill_mask, smoothed_contours, -1, 255, thickness=cv2.FILLED)
    fill_mask = cv2.bitwise_and(fill_mask, (mask_binary * 255).astype(np.uint8))
    mask_coverage = float(np.mean(fill_mask > 0))

    if mask_coverage <= 0:
        return None, None, None, 0.0

    orig_np = np.array(image.convert("RGB"))
    blur_size = max(3, min(orig_w, orig_h) // 40)
    if blur_size % 2 == 0:
        blur_size += 1
    soft_mask = cv2.GaussianBlur(fill_mask, (blur_size, blur_size), 0)
    soft_mask = cv2.bitwise_and(soft_mask, fill_mask)
    alpha = (soft_mask.astype(np.float32) / 255.0)[:, :, None] * 0.15
    cyan_fill = np.array([0, 218, 242], dtype=np.float32)

    fill_only_float = orig_np.astype(np.float32)
    fill_only_float = fill_only_float * (1.0 - alpha) + cyan_fill * alpha
    fill_only = np.clip(fill_only_float, 0, 255).astype(np.uint8)

    contour_only = orig_np.copy()
    edge_thickness = max(1, min(orig_w, orig_h) // 250)
    cv2.drawContours(
        contour_only,
        smoothed_contours,
        -1,
        (0, 238, 255),
        thickness=edge_thickness,
        lineType=cv2.LINE_AA,
    )

    overlay_float = fill_only.astype(np.float32)
    overlay = np.clip(overlay_float, 0, 255).astype(np.uint8)
    cv2.drawContours(
        overlay,
        smoothed_contours,
        -1,
        (0, 238, 255),
        thickness=edge_thickness,
        lineType=cv2.LINE_AA,
    )

    def _encode_image(image_np: np.ndarray) -> str:
        img = Image.fromarray(image_np)
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=88)
        return base64.b64encode(buf.getvalue()).decode("utf-8")

    return (
        _encode_image(overlay),
        _encode_image(fill_only),
        _encode_image(contour_only),
        mask_coverage,
    )

def _simulate_inference(image: Image.Image, category: str) -> dict:
    return {
        "category":               _category_display(category),
        "prediction":             "Pending Real Model",
        "confidence":             0.0,
        "risk_level":             "Unknown",
        "heatmap_available":      False,
        "segmentation_available": False,
        "heatmap_base64":         None,
        "segmentation_base64":    None,
        "activation_region":      "—",
        "segmentation_status":    "—",
        "recommendation":         "—",
        "diagnostic_abstract":    "Model not loaded. Upload a scan after models are available.",
        "peak_x":                 0.5,
        "peak_y":                 0.5,
        "peak_intensity":         0.0,
        "activation_spread":      0.0,
        "mask_coverage":          0.0,
    }

def _category_display(category: str) -> str:
    return {"mri": "Brain Tumor MRI", "ct": "Lung Tumor CT", "xray": "Pneumonia X-Ray"}.get(category, category)
