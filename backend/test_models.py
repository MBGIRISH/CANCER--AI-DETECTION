import sys
sys.path.insert(0, '.')
from app.models.model_loader import load_models, get_model, is_fallback_mode

load_models()
print('Fallback mode:', is_fallback_mode())
for k in ['brain', 'pneumonia', 'segmentation']:
    m = get_model(k)
    name = type(m).__name__ if m is not None else 'NOT LOADED'
    print('  ' + k + ': ' + name)
