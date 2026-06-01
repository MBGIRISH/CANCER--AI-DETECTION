Write-Host "Starting ONCOSIGHT AI Master Training Pipeline..."
Write-Host "================================================"

Write-Host "
[1/4] Training Brain Tumor Model..."
python model/training/train_brain_tumor.py

Write-Host "
[2/4] Training Pneumonia Model..."
python model/training/train_pneumonia.py

Write-Host "
[3/4] Training Lung Abnormality Model..."
python model/training/train_lung.py

Write-Host "
[4/4] Training UNet Segmentation Model..."
python model/training/train_segmentation.py

Write-Host "
================================================"
Write-Host "Master Training Pipeline Completed!"
