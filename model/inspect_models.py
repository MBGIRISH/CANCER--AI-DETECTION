import torch
import glob
import os

model_dir = os.path.dirname(os.path.abspath(__file__))
pth_files = glob.glob(os.path.join(model_dir, "*.pth"))

print(f"Found {len(pth_files)} .pth files.")

for f in pth_files:
    print("-" * 50)
    print(f"Inspecting {os.path.basename(f)}:")
    try:
        data = torch.load(f, map_location=torch.device('cpu'))
        if isinstance(data, dict):
            print("  It's a state_dict or dict.")
            # Check for common state dict patterns to guess architecture
            keys = list(data.keys())
            print(f"  Number of keys: {len(keys)}")
            if len(keys) > 0:
                print(f"  First few keys: {keys[:5]}")
                print(f"  Last few keys: {keys[-5:]}")
                
                if any('features' in k or 'classifier' in k for k in keys):
                    print("  Hint: Might be a torchvision model like DenseNet or VGG")
                if any('layer1' in k or 'fc.' in k for k in keys):
                    print("  Hint: Might be a ResNet")
                if any('down' in k and 'up' in k for k in keys):
                    print("  Hint: Might be a UNet")
        else:
            print(f"  It's a full model of type: {type(data)}")
            print(f"  Model structure:\n{data}")
    except Exception as e:
        print(f"  Error loading: {e}")
