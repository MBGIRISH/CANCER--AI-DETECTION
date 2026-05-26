import requests
import json

base_url = "http://localhost:8000/api"

print("--- Testing Authentication Endpoints ---")

# 1. Test correct login
print("\n[1] Testing login with CORRECT credentials (Dr. Carter)...")
login_data = {
    "email": "carter@oncosight.ai",
    "password": "carterpassword123"
}
try:
    response = requests.post(f"{base_url}/login", json=login_data)
    print("Status Code:", response.status_code)
    if response.status_code == 200:
        res_json = response.json()
        token = res_json.get("token")
        doctor = res_json.get("doctor")
        print("Success! Token received:", token[:30] + "..." if token else None)
        print("Doctor profile received:", doctor)
    else:
        print("Failed. Response:", response.text)
        token = None
except Exception as e:
    print("Error connecting to backend:", e)
    token = None

# 2. Test incorrect login
print("\n[2] Testing login with INCORRECT password...")
bad_login_data = {
    "email": "carter@oncosight.ai",
    "password": "wrongpassword123"
}
try:
    response = requests.post(f"{base_url}/login", json=bad_login_data)
    print("Status Code:", response.status_code)
    print("Detail:", response.json().get("detail"))
except Exception as e:
    print("Error connecting to backend:", e)

# 3. Test verification with valid token
if token:
    print("\n[3] Testing verify with VALID token...")
    try:
        response = requests.post(f"{base_url}/verify", json={"token": token})
        print("Status Code:", response.status_code)
        print("Verified Doctor:", response.json().get("doctor"))
    except Exception as e:
        print("Error connecting to backend:", e)

# 4. Test verification with invalid token
print("\n[4] Testing verify with INVALID token...")
try:
    response = requests.post(f"{base_url}/verify", json={"token": "invalid.jwt.token"})
    print("Status Code:", response.status_code)
    print("Detail:", response.json().get("detail"))
except Exception as e:
    print("Error connecting to backend:", e)
