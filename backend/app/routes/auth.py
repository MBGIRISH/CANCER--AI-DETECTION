import hmac
from typing import Optional
import hashlib
import json
import base64
import time
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel

router = APIRouter(prefix="/api", tags=["Authentication"])

SECRET_KEY = "oncosight-secret-key-super-secure-12345"
TOKEN_EXPIRY_SECONDS = 3600 * 24  # 24 hours

# Preconfigured doctors database
DOCTORS_DB = {
    "carter@oncosight.ai": {
        "id": "1",
        "name": "Dr. Michael Carter",
        "role": "Lead Oncologist",
        "department": "Oncology Dept",
        "avatarLetter": "M",
        "password": "carterpassword123"
    },
    "chen@oncosight.ai": {
        "id": "2",
        "name": "Dr. Sarah Chen",
        "role": "Radiologist",
        "department": "Radiology Dept",
        "avatarLetter": "S",
        "password": "chenpassword123"
    },
    "reynolds@oncosight.ai": {
        "id": "3",
        "name": "Dr. David Reynolds",
        "role": "Pathologist",
        "department": "Pathology Dept",
        "avatarLetter": "D",
        "password": "reynoldspassword123"
    },
    "markovic@oncosight.ai": {
        "id": "4",
        "name": "Dr. Elena Markovic",
        "role": "Surgical Oncologist",
        "department": "Surgical Oncology",
        "avatarLetter": "E",
        "password": "markovicpassword123"
    }
}

class LoginRequest(BaseModel):
    email: str
    password: str

class VerifyRequest(BaseModel):
    token: str

# Helper functions for custom JWT encoding/decoding
def base64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode('utf-8')

def base64url_decode(data: str) -> bytes:
    padding = '=' * (4 - (len(data) % 4))
    return base64.urlsafe_b64decode(data + padding)

def create_jwt(payload: dict) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    header_json = json.dumps(header, separators=(',', ':')).encode('utf-8')
    payload_json = json.dumps(payload, separators=(',', ':')).encode('utf-8')
    
    header_b64 = base64url_encode(header_json)
    payload_b64 = base64url_encode(payload_json)
    
    signing_input = f"{header_b64}.{payload_b64}".encode('utf-8')
    signature = hmac.new(SECRET_KEY.encode('utf-8'), signing_input, hashlib.sha256).digest()
    signature_b64 = base64url_encode(signature)
    
    return f"{header_b64}.{payload_b64}.{signature_b64}"

def verify_jwt(token: str) -> Optional[dict]:
    try:
        parts = token.split('.')
        if len(parts) != 3:
            return None
        header_b64, payload_b64, signature_b64 = parts
        
        signing_input = f"{header_b64}.{payload_b64}".encode('utf-8')
        expected_signature = hmac.new(SECRET_KEY.encode('utf-8'), signing_input, hashlib.sha256).digest()
        expected_signature_b64 = base64url_encode(expected_signature)
        
        if not hmac.compare_digest(signature_b64, expected_signature_b64):
            return None
            
        payload_bytes = base64url_decode(payload_b64)
        payload = json.loads(payload_bytes.decode('utf-8'))
        
        # Check expiration
        if payload.get("exp", 0) < time.time():
            return None
            
        return payload
    except Exception:
        return None

@router.post("/login")
def login(req: LoginRequest):
    email = req.email.strip().lower()
    doc = DOCTORS_DB.get(email)
    if not doc or doc["password"] != req.password:
        raise HTTPException(status_code=401, detail="Invalid email or password.")
        
    # Generate token payload (excluding raw password)
    payload = {
        "id": doc["id"],
        "name": doc["name"],
        "role": doc["role"],
        "department": doc["department"],
        "avatarLetter": doc["avatarLetter"],
        "email": email,
        "exp": int(time.time()) + TOKEN_EXPIRY_SECONDS
    }
    
    token = create_jwt(payload)
    return {"token": token, "doctor": payload}

@router.post("/verify")
def verify(req: VerifyRequest):
    payload = verify_jwt(req.token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")
    return {"doctor": payload}
