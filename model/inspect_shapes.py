import torch
import os

model_dir = os.path.dirname(os.path.abspath(__file__))

def inspect_shapes(path):
    print(f"\n--- {os.path.basename(path)} ---")
    data = torch.load(path, map_location='cpu')
    
    if 'classifier.0.weight' in data:
        print(f"classifier.0.weight: {data['classifier.0.weight'].shape}")
    if 'classifier.3.weight' in data:
        print(f"classifier.3.weight: {data['classifier.3.weight'].shape}")
    if 'classifier.weight' in data:
        print(f"classifier.weight: {data['classifier.weight'].shape}")
        
    if 'segmentation_head.0.weight' in data:
        print(f"segmentation_head.0.weight: {data['segmentation_head.0.weight'].shape}")
    if 'encoder.conv1.weight' in data:
        print(f"encoder.conv1.weight: {data['encoder.conv1.weight'].shape}")

for f in ['brain_tumor_model.pth', 'lung_opacity_model.pth', 'pneumonia_model.pth', 'unet_segmentation_model.pth']:
    inspect_shapes(os.path.join(model_dir, f))
