"""
train_brain_tumor.py — ONCOSIGHT AI (FAST TRANSFER LEARNING)
DenseNet121 binary classifier for Brain Tumor MRI detection.
"""
import os, sys, time, copy
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, Subset
from torchvision import datasets, transforms, models
from sklearn.model_selection import StratifiedShuffleSplit
from sklearn.metrics import classification_report, f1_score
from torch.cuda.amp import autocast, GradScaler
from tqdm import tqdm

# ── Config ───────────────────────────────────────
DATA_DIR    = os.path.join(os.path.dirname(__file__), '..', 'brain_tumor_dataset')
SAVE_PATH   = os.path.join(os.path.dirname(__file__), '..', 'saved_models', 'brain_tumor_model.pth')
IMG_SIZE    = 160
BATCH_SIZE  = 16
EPOCHS      = 50
LR          = 1e-4
NUM_CLASSES = 2
DEVICE      = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

torch.backends.cudnn.benchmark = True

print(f"[train_brain] Device: {DEVICE}")

# ── Transforms ───────────────────────────────────
train_transform = transforms.Compose([
    transforms.Resize((IMG_SIZE, IMG_SIZE)),
    transforms.RandomHorizontalFlip(),
    transforms.RandomRotation(15),
    transforms.ColorJitter(contrast=0.2, brightness=0.2),
    transforms.RandomAffine(degrees=0, translate=(0.05, 0.05), scale=(0.95, 1.05)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
])

val_transform = transforms.Compose([
    transforms.Resize((IMG_SIZE, IMG_SIZE)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
])

# ── Dataset ──────────────────────────────────────
full_dataset = datasets.ImageFolder(DATA_DIR, transform=train_transform)
labels = [s[1] for s in full_dataset.samples]

sss1 = StratifiedShuffleSplit(n_splits=1, test_size=0.3, random_state=42)
train_idx, temp_idx = next(sss1.split(range(len(labels)), labels))

temp_labels = [labels[i] for i in temp_idx]
sss2 = StratifiedShuffleSplit(n_splits=1, test_size=0.5, random_state=42)
val_idx_rel, test_idx_rel = next(sss2.split(range(len(temp_idx)), temp_labels))
val_idx = temp_idx[val_idx_rel]
test_idx = temp_idx[test_idx_rel]

train_set = Subset(full_dataset, train_idx)
val_dataset_raw = datasets.ImageFolder(DATA_DIR, transform=val_transform)
val_set = Subset(val_dataset_raw, val_idx)
test_set = Subset(val_dataset_raw, test_idx)

from collections import Counter
train_labels = [labels[i] for i in train_idx]
counts = Counter(train_labels)
total = sum(counts.values())
weights = torch.tensor([total / counts[c] for c in range(NUM_CLASSES)], dtype=torch.float).to(DEVICE)

train_loader = DataLoader(train_set, batch_size=BATCH_SIZE, shuffle=True, num_workers=0)
val_loader   = DataLoader(val_set, batch_size=BATCH_SIZE, shuffle=False, num_workers=0)
test_loader  = DataLoader(test_set, batch_size=BATCH_SIZE, shuffle=False, num_workers=0)

# ── Model ────────────────────────────────────────
class DenseNet121Classifier(nn.Module):
    def __init__(self, num_classes=2):
        super().__init__()
        base = models.densenet121(weights='IMAGENET1K_V1')
        self.features = base.features
        
        # Layers are fully unfrozen for complete fine-tuning on the full dataset
                
        self.classifier = nn.Sequential(
            nn.Linear(1024, 256),
            nn.ReLU(inplace=True),
            nn.Dropout(p=0.5),
            nn.Linear(256, num_classes),
        )
    def forward(self, x):
        feats = self.features(x)
        feats = nn.functional.adaptive_avg_pool2d(feats, (1, 1))
        feats = torch.flatten(feats, 1)
        return self.classifier(feats)

model = DenseNet121Classifier(NUM_CLASSES).to(DEVICE)
criterion = nn.CrossEntropyLoss(weight=weights)
optimizer = optim.AdamW(filter(lambda p: p.requires_grad, model.parameters()), lr=LR)
scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode='max', factor=0.5, patience=2)
scaler = GradScaler()

# ── Training ─────────────────────────────────────
best_val_f1 = 0.0
best_model_wts = copy.deepcopy(model.state_dict())
patience_counter = 0
PATIENCE = 10

for epoch in range(EPOCHS):
    t0 = time.time()
    model.train()
    running_loss, correct, total = 0.0, 0, 0

    pbar = tqdm(train_loader, desc=f"Epoch {epoch+1}/{EPOCHS}", leave=False)
    for inputs, targets in pbar:
        inputs, targets = inputs.to(DEVICE), targets.to(DEVICE)
        optimizer.zero_grad()
        
        with autocast():
            outputs = model(inputs)
            loss = criterion(outputs, targets)
            
        scaler.scale(loss).backward()
        scaler.step(optimizer)
        scaler.update()
        
        running_loss += loss.item() * inputs.size(0)
        _, preds = outputs.max(1)
        correct += preds.eq(targets).sum().item()
        total += targets.size(0)

    train_loss = running_loss / total
    train_acc = 100. * correct / total

    model.eval()
    val_loss, val_correct, val_total = 0.0, 0, 0
    all_preds, all_targets = [], []
    with torch.no_grad():
        for inputs, targets in val_loader:
            inputs, targets = inputs.to(DEVICE), targets.to(DEVICE)
            with autocast():
                outputs = model(inputs)
                loss = criterion(outputs, targets)
            val_loss += loss.item() * inputs.size(0)
            _, preds = outputs.max(1)
            val_correct += preds.eq(targets).sum().item()
            val_total += targets.size(0)
            all_preds.extend(preds.cpu().numpy())
            all_targets.extend(targets.cpu().numpy())

    val_loss /= val_total
    val_acc = 100. * val_correct / val_total
    val_f1 = f1_score(all_targets, all_preds, average='weighted')

    elapsed = time.time() - t0
    print(f"Epoch {epoch+1:2d}/{EPOCHS} | Train Loss: {train_loss:.4f} Acc: {train_acc:.1f}% | Val Loss: {val_loss:.4f} Acc: {val_acc:.1f}% F1: {val_f1:.4f} | {elapsed:.1f}s")

    if val_f1 > best_val_f1:
        best_val_f1 = val_f1
        best_model_wts = copy.deepcopy(model.state_dict())
        patience_counter = 0
        print(f"  [*] New best F1: {val_f1:.4f}")
    else:
        patience_counter += 1
        if patience_counter >= PATIENCE:
            print(f"  [*] Early stopping at epoch {epoch+1}")
            break

    scheduler.step(val_f1)

os.makedirs(os.path.dirname(SAVE_PATH), exist_ok=True)
torch.save(best_model_wts, SAVE_PATH)
print(f"Saved: {SAVE_PATH}")
