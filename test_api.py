import requests

url = "http://localhost:8000/predict"
file_path = "frontend/src/assets/mri_scan.png"

with open(file_path, "rb") as f:
    files = {"file": ("mri_scan.png", f, "image/png")}
    data = {"category": "mri"}
    response = requests.post(url, files=files, data=data)
    
print("Status Code:", response.status_code)
if response.status_code != 200:
    print("Response text:", response.text)
else:
    res_json = response.json()
    print("Keys in response:", res_json.keys())
print("Prediction:", res_json.get("prediction"))
print("Risk Level:", res_json.get("risk_level"))
print("Has Segmentation:", bool(res_json.get("segmentation_base64")))
