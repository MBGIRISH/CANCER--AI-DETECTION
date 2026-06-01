"""
model_loader.py
---------------
Loads all pretrained .pth models ONCE at startup and caches them globally.

Architecture:
  - brain_tumor_model.pth    : DenseNet121 + custom 2-class head
  - pneumonia_model.pth      : DenseNet121 + custom 2-class head
  - unet_segmentation_model  : ResNet34 encoder + 5-block UNet decoder
"""

import os
from typing import Optional
import torch
import torch.nn as nn
import torchvision.models as tv_models

# ─────────────────────────────────────────────
# DEVICE
# ─────────────────────────────────────────────
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# ─────────────────────────────────────────────
# GLOBAL MODEL CACHE
# ─────────────────────────────────────────────
_models: dict = {
    "brain": None,
    "pneumonia": None,
    "segmentation": None,
}
_fallback_mode: bool = False


# ─────────────────────────────────────────────
# CLASSIFIER ARCHITECTURE: DenseNet121 + custom head
# keys: features.*, classifier.0 (Linear 1024→256), classifier.3 (Linear 256→2)
# ─────────────────────────────────────────────
class DenseNet121Classifier(nn.Module):
    def __init__(self, num_classes: int = 2):
        super().__init__()
        base = tv_models.densenet121(weights=None)
        self.features = base.features          # output: (B, 1024, H, W)
        self.classifier = nn.Sequential(
            nn.Linear(1024, 256),              # classifier.0
            nn.ReLU(inplace=True),             # classifier.1
            nn.Dropout(p=0.5),                 # classifier.2
            nn.Linear(256, num_classes),       # classifier.3
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        feats = self.features(x)
        feats = nn.functional.adaptive_avg_pool2d(feats, (1, 1))
        feats = torch.flatten(feats, 1)
        return self.classifier(feats)


# ─────────────────────────────────────────────
# UNET ARCHITECTURE: ResNet34 encoder + custom decoder
# Encoder: conv1, bn1, relu, maxpool, layer1-4  (ResNet34: 2,4,6,3 blocks)
# Decoder: 5 blocks (conv1+conv2 each as Sequential(Conv2d, BN))
# Seg head: Conv2d(16,1,3,3)
# Skip connections: layer3→block0, layer2→block1, layer1→block2,
#                   initial features (after relu/maxpool)→block3, nothing→block4
# ─────────────────────────────────────────────
class DecoderBlock(nn.Module):
    def __init__(self, in_channels: int, out_channels: int):
        super().__init__()
        self.conv1 = nn.Sequential(
            nn.Conv2d(in_channels, out_channels, kernel_size=3, padding=1, bias=False),
            nn.BatchNorm2d(out_channels),
        )
        self.conv2 = nn.Sequential(
            nn.Conv2d(out_channels, out_channels, kernel_size=3, padding=1, bias=False),
            nn.BatchNorm2d(out_channels),
        )
        self.relu = nn.ReLU(inplace=True)

    def forward(self, x: torch.Tensor, skip: Optional[torch.Tensor] = None) -> torch.Tensor:
        x = nn.functional.interpolate(x, scale_factor=2, mode="bilinear", align_corners=False)
        if skip is not None:
            x = torch.cat([x, skip], dim=1)
        x = self.relu(self.conv1(x))
        x = self.relu(self.conv2(x))
        return x


class ResNet34UNet(nn.Module):
    """
    ResNet34-based UNet.
    Decoder channel plan (matches saved weights):
      block0: in=512+256=768 → 256
      block1: in=256+128=384 → 128
      block2: in=128+64=192  → 64
      block3: in=64+64=128   → 32
      block4: in=32+0=32     → 16
    Seg head: Conv2d(16, 1, 3, 3)
    """

    def __init__(self):
        super().__init__()
        enc = tv_models.resnet34(weights=None)

        # Encoder stages (keep as sub-modules so state_dict keys match)
        self.encoder = _ResNet34Encoder(enc)

        # Decoder
        self.decoder = nn.ModuleDict({
            "blocks": nn.ModuleList([
                DecoderBlock(768, 256),   # block 0: 512+256=768 → 256
                DecoderBlock(384, 128),   # block 1: 256+128=384 → 128
                DecoderBlock(192, 64),    # block 2: 128+64 =192 → 64
                DecoderBlock(128, 32),    # block 3: 64+64  =128 → 32
                DecoderBlock(32, 16),     # block 4: 32+0   =32  → 16
            ])
        })

        self.segmentation_head = nn.Sequential(
            nn.Conv2d(16, 1, kernel_size=3, padding=1),
        )

    def forward(self, x: torch.Tensor):
        s0, s1, s2, s3, s4 = self.encoder(x)
        # s0: initial (B,64,H/4,W/4)
        # s1: layer1  (B,64,H/4,W/4)
        # s2: layer2  (B,128,H/8,W/8)
        # s3: layer3  (B,256,H/16,W/16)
        # s4: layer4  (B,512,H/32,W/32)

        blocks = self.decoder["blocks"]
        d = blocks[0](s4, s3)   # 512+256 → 256
        d = blocks[1](d,  s2)   # 256+128 → 128
        d = blocks[2](d,  s1)   # 128+64  → 64
        d = blocks[3](d,  s0)   # 64+64   → 32
        d = blocks[4](d,  None) # 32      → 16

        return self.segmentation_head(d)


class _ResNet34Encoder(nn.Module):
    """Wrap ResNet34 layers so state_dict keys become encoder.*"""
    def __init__(self, resnet):
        super().__init__()
        self.conv1   = resnet.conv1
        self.bn1     = resnet.bn1
        self.relu    = resnet.relu
        self.maxpool = resnet.maxpool
        self.layer1  = resnet.layer1
        self.layer2  = resnet.layer2
        self.layer3  = resnet.layer3
        self.layer4  = resnet.layer4

    def forward(self, x):
        x_prepool  = self.relu(self.bn1(self.conv1(x)))  # (B,64,H/2,W/2)
        x  = self.maxpool(x_prepool)                      # (B,64,H/4,W/4)
        s0 = x_prepool
        s1 = self.layer1(x)                       # (B,64,H/4,W/4)
        s2 = self.layer2(s1)                      # (B,128,H/8,W/8)
        s3 = self.layer3(s2)                      # (B,256,H/16,W/16)
        s4 = self.layer4(s3)                      # (B,512,H/32,W/32)
        return s0, s1, s2, s3, s4


# ─────────────────────────────────────────────
# LOADER
# ─────────────────────────────────────────────
def load_models():
    global _fallback_mode

    # Check newly trained models first, then fallback to original weights folder
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
    saved_models_dir = os.path.join(base_dir, "model", "saved_models")
    weights_dir = os.path.join(os.path.dirname(__file__), "weights")

    def get_path(filename):
        new_path = os.path.join(saved_models_dir, filename)
        return new_path if os.path.exists(new_path) else os.path.join(weights_dir, filename)

    _load_classifier("brain",     get_path("brain_tumor_model.pth"))
    _load_classifier("pneumonia", get_path("pneumonia_model.pth"))
    _load_segmentation(           get_path("unet_segmentation_model.pth"))

    loaded = [k for k, v in _models.items() if v is not None]
    print(f"[model_loader] Loaded models: {loaded}")
    if not loaded:
        _fallback_mode = True
        print("[model_loader] WARNING: No models loaded — running in fallback/simulation mode.")


def _load_classifier(key: str, path: str):
    if not os.path.exists(path):
        print(f"[model_loader] MISSING: {path}")
        return
    try:
        state = torch.load(path, map_location=DEVICE)
        model = DenseNet121Classifier(num_classes=2)
        model.load_state_dict(state, strict=True)
        model.to(DEVICE)
        model.eval()
        _models[key] = model
        print(f"[model_loader] OK: {key} classifier loaded from {os.path.basename(path)}")
    except Exception as exc:
        print(f"[model_loader] ERROR loading {key}: {exc}")


def _load_segmentation(path: str):
    if not os.path.exists(path):
        print(f"[model_loader] MISSING: {path}")
        return
    try:
        state = torch.load(path, map_location=DEVICE)
        model = ResNet34UNet()
        model.load_state_dict(state, strict=True)
        model.to(DEVICE)
        model.eval()
        _models["segmentation"] = model
        print(f"[model_loader] OK: segmentation UNet loaded from {os.path.basename(path)}")
    except Exception as exc:
        print(f"[model_loader] ERROR loading segmentation: {exc}")


# ─────────────────────────────────────────────
# ACCESSORS
# ─────────────────────────────────────────────
def get_model(key: str) -> Optional[nn.Module]:
    return _models.get(key)


def is_fallback_mode() -> bool:
    return _fallback_mode
