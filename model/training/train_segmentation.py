"""
train_segmentation.py — ONCOSIGHT AI (FAST TRANSFER LEARNING)
UNet (ResNet34) for Brain MRI Tumor Segmentation.
"""
import os, sys, time, copy, glob
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
import numpy as np
import cv2
import albumentations as A
from albumentations.pytorch import ToTensorV2
from sklearn.model_selection import train_test_split
import segmentation_models_pytorch as smp
from torch.cuda.amp import autocast, GradScaler
from tqdm import tqdm

# ── Config ───────────────────────────────────────
DATA_DIR    = os.path.join(os.path.dirname(__file__), '..', 'kaggle_3m')
SAVE_PATH   = os.path.join(os.path.dirname(__file__), '..', 'saved_models', 'unet_segmentation_model.pth')
IMG_SIZE    = 160
BATCH_SIZE  = 8
EPOCHS      = 8
LR          = 1e-4
DEVICE      = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

torch.backends.cudnn.benchmark = True

print(f"[train_segmentation] Device: {DEVICE}")

# ── Dataset Definition ───────────────────────────
class BrainMRIDataset(Dataset):
    def __init__(self, image_paths, transform=None):
        self.image_paths = image_paths
        self.transform = transform

    def __len__(self):
        return len(self.image_paths)

    def __getitem__(self, idx):
        img_path = self.image_paths[idx]
        mask_path = img_path.replace('.tif', '_mask.tif')

        image = cv2.imread(img_path)
        image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        mask = cv2.imread(mask_path, cv2.IMREAD_GRAYSCALE)
        
        mask = (mask > 127).astype(np.float32)
        
        if self.transform:
            augmented = self.transform(image=image, mask=mask)
            image = augmented['image']
            mask = augmented['mask']
            
        mask = mask.unsqueeze(0)
        return image, mask

# ── Transforms (Albumentations) ──────────────────
train_transform = A.Compose([
    A.Resize(IMG_SIZE, IMG_SIZE),
    A.HorizontalFlip(p=0.5),
    A.RandomRotate90(p=0.5),
    A.Normalize(mean=(0.485, 0.456, 0.406), std=(0.229, 0.224, 0.225)),
    ToTensorV2(),
])

val_transform = A.Compose([
    A.Resize(IMG_SIZE, IMG_SIZE),
    A.Normalize(mean=(0.485, 0.456, 0.406), std=(0.229, 0.224, 0.225)),
    ToTensorV2(),
])

# ── Patient-Level Split ──────────────────────────
patient_dirs = [d for d in glob.glob(os.path.join(DATA_DIR, '*')) if os.path.isdir(d) and 'TCGA' in os.path.basename(d)]
train_dirs, temp_dirs = train_test_split(patient_dirs, test_size=0.2, random_state=42)
val_dirs, test_dirs = train_test_split(temp_dirs, test_size=0.5, random_state=42)

def get_images(dirs):
    images = []
    for d in dirs:
        imgs = glob.glob(os.path.join(d, '*.tif'))
        imgs = [i for i in imgs if '_mask' not in i]
        images.extend(imgs)
    return images

train_images = get_images(train_dirs)
val_images = get_images(val_dirs)
test_images = get_images(test_dirs)

train_dataset = BrainMRIDataset(train_images, transform=train_transform)
val_dataset = BrainMRIDataset(val_images, transform=val_transform)
test_dataset = BrainMRIDataset(test_images, transform=val_transform)

train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True, num_workers=0)
val_loader = DataLoader(val_dataset, batch_size=BATCH_SIZE, shuffle=False, num_workers=0)
test_loader = DataLoader(test_dataset, batch_size=BATCH_SIZE, shuffle=False, num_workers=0)

# ── Model ────────────────────────────────────────
model = smp.Unet(
    encoder_name="resnet34",
    encoder_weights="imagenet",
    in_channels=3,
    classes=1,
    activation=None
).to(DEVICE)

# Freeze entire encoder for fast transfer learning
for param in model.encoder.parameters():
    param.requires_grad = False

criterion_dice = smp.losses.DiceLoss(smp.losses.BINARY_MODE, from_logits=True)
bce_loss = nn.BCEWithLogitsLoss()

def calc_loss(pred, target):
    return bce_loss(pred, target) + 2.5 * criterion_dice(pred, target)

optimizer = optim.AdamW(filter(lambda p: p.requires_grad, model.parameters()), lr=LR)
scaler = GradScaler()

def calc_dice_score(pred, target, threshold=0.5):
    pred = torch.sigmoid(pred) > threshold
    pred = pred.float()
    intersection = (pred * target).sum(dim=(2, 3))
    union = pred.sum(dim=(2, 3)) + target.sum(dim=(2, 3))
    dice = (2. * intersection + 1e-7) / (union + 1e-7)
    return dice.mean().item()

# ── Training ─────────────────────────────────────
best_val_dice = 0.0
best_model_wts = copy.deepcopy(model.state_dict())
patience_counter = 0
PATIENCE = 2

for epoch in range(EPOCHS):
    t0 = time.time()
    
    model.train()
    train_loss, train_dice = 0.0, 0.0
    
    pbar = tqdm(train_loader, desc=f"Epoch {epoch+1}/{EPOCHS} [Train]", leave=False)
    for images, masks in pbar:
        images, masks = images.to(DEVICE), masks.to(DEVICE)
        optimizer.zero_grad()
        
        with autocast():
            outputs = model(images)
            loss = calc_loss(outputs, masks)
            
        scaler.scale(loss).backward()
        scaler.step(optimizer)
        scaler.update()
        
        train_loss += loss.item() * images.size(0)
        train_dice += calc_dice_score(outputs, masks) * images.size(0)
        
    train_loss /= len(train_dataset)
    train_dice /= len(train_dataset)
    
    model.eval()
    val_loss, val_dice = 0.0, 0.0
    with torch.no_grad():
        for images, masks in val_loader:
            images, masks = images.to(DEVICE), masks.to(DEVICE)
            with autocast():
                outputs = model(images)
                loss = calc_loss(outputs, masks)
            val_loss += loss.item() * images.size(0)
            val_dice += calc_dice_score(outputs, masks) * images.size(0)
            
    val_loss /= len(val_dataset)
    val_dice /= len(val_dataset)
    
    elapsed = time.time() - t0
    print(f"Epoch {epoch+1:2d}/{EPOCHS} | Train Loss: {train_loss:.4f} Dice: {train_dice:.4f} | Val Loss: {val_loss:.4f} Dice: {val_dice:.4f} | {elapsed:.1f}s")
          
    if val_dice > best_val_dice:
        best_val_dice = val_dice
        best_model_wts = copy.deepcopy(model.state_dict())
        patience_counter = 0
        print(f"  [*] New best Dice Score: {val_dice:.4f}")
    else:
        patience_counter += 1
        if patience_counter >= PATIENCE:
            print(f"  [*] Early stopping at epoch {epoch+1}")
            break

os.makedirs(os.path.dirname(SAVE_PATH), exist_ok=True)
torch.save(best_model_wts, SAVE_PATH)
print(f"Saved: {SAVE_PATH}")
