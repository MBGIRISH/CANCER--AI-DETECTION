import os
import uuid
import logging
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from pymongo import MongoClient

# Persistent file-based storage (used when MongoDB is unavailable)
from app.services import storage as file_store

logger = logging.getLogger("report_service")
router = APIRouter(prefix="/api/reports", tags=["Reports"])

# MongoDB connection configuration
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb+srv://ankush:ankush66@cluster0.wvivwbg.mongodb.net/?appName=Cluster0")
DB_NAME = os.getenv("MONGODB_DATABASE", "oncosight")

# Global MongoClient & Collection reference
mongo_client = None
db = None
reports_collection = None

try:
    logger.info(f"Connecting to MongoDB at {MONGODB_URI}...")
    mongo_client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=2000)
    mongo_client.server_info()
    db = mongo_client[DB_NAME]
    reports_collection = db["scan_records"]
    logger.info("Successfully connected to MongoDB.")
except Exception as exc:
    logger.warning(
        f"Could not connect to MongoDB: {exc}. "
        f"Using persistent JSON file storage at: {file_store.REPORTS_FILE}"
    )
    mongo_client = None
    reports_collection = None


# ──────────────────────────────────────────────────────────────────────────────
# Pydantic Schemas (matching frontend ScanRecord properties)
# ──────────────────────────────────────────────────────────────────────────────

class ReportSchema(BaseModel):
    id: Optional[str] = None
    patient: str
    age: str
    dob: Optional[str] = "N/A"
    type: str
    status: str
    confidence: str
    time: str
    date: str
    findings: str
    recommendations: str
    reportId: Optional[str] = None
    findingsBullets: Optional[List[str]] = []
    diseaseProbability: Optional[float] = 0.0
    modelConfidence: Optional[float] = 0.0
    reviewingDoctor: Optional[str] = "N/A"
    generatedAt: Optional[str] = None
    prediction: Optional[str] = None
    activationStrength: Optional[str] = "Low"
    peakIntensity: Optional[float] = 0.0
    originalScan: Optional[str] = None
    heatmapOverlay: Optional[str] = None
    segmentationMask: Optional[str] = None


# ──────────────────────────────────────────────────────────────────────────────
# Routes
# ──────────────────────────────────────────────────────────────────────────────

@router.post("")
def save_report(report: ReportSchema):
    report_dict = report.dict()

    # Assign defaults for missing generated fields
    if not report_dict.get("id"):
        report_dict["id"] = str(uuid.uuid4())
    if not report_dict.get("reportId"):
        report_dict["reportId"] = (
            f"REP-{datetime.now().strftime('%Y%m%d')}-{report_dict['id'][:6].upper()}"
        )
    if not report_dict.get("generatedAt"):
        report_dict["generatedAt"] = datetime.now().isoformat()

    if reports_collection is not None:
        # ── MongoDB path ──────────────────────────────────────────────────────
        try:
            existing = reports_collection.find_one({"id": report_dict["id"]})
            if existing:
                reports_collection.update_one(
                    {"id": report_dict["id"]}, {"$set": report_dict}
                )
                logger.info(f"Updated report ID {report_dict['id']} in MongoDB.")
            else:
                reports_collection.insert_one(report_dict)
                logger.info(f"Saved new report ID {report_dict['id']} in MongoDB.")
        except Exception as exc:
            logger.error(f"Error saving to MongoDB: {exc}")
            raise HTTPException(status_code=500, detail="Database write error")
    else:
        # ── Persistent JSON file path ─────────────────────────────────────────
        try:
            file_store.upsert(report_dict)
        except Exception as exc:
            logger.error(f"Error saving to file store: {exc}")
            raise HTTPException(status_code=500, detail="File storage write error")

    # Strip internal Mongo _id before returning
    report_dict.pop("_id", None)
    return report_dict


@router.get("", response_model=List[ReportSchema])
def get_reports(doctor: Optional[str] = None):
    if reports_collection is not None:
        # ── MongoDB path ──────────────────────────────────────────────────────
        try:
            query = {}
            if doctor:
                query["reviewingDoctor"] = doctor
            cursor = reports_collection.find(query).sort("generatedAt", -1)
            reports = []
            for doc in cursor:
                doc.pop("_id", None)
                reports.append(doc)
            logger.info(
                f"Fetched {len(reports)} records from MongoDB for doctor={doctor!r}."
            )
            return reports
        except Exception as exc:
            logger.error(f"Error fetching from MongoDB: {exc}")
            raise HTTPException(status_code=500, detail="Database read error")
    else:
        # ── Persistent JSON file path ─────────────────────────────────────────
        try:
            return file_store.get_all(doctor=doctor)
        except Exception as exc:
            logger.error(f"Error reading from file store: {exc}")
            raise HTTPException(status_code=500, detail="File storage read error")


@router.delete("/{report_id}")
def delete_report(report_id: str):
    if reports_collection is not None:
        # ── MongoDB path ──────────────────────────────────────────────────────
        try:
            result = reports_collection.delete_one({"id": report_id})
            if result.deleted_count == 0:
                raise HTTPException(status_code=404, detail="Report not found")
            logger.info(f"Deleted report {report_id} from MongoDB.")
        except HTTPException:
            raise
        except Exception as exc:
            logger.error(f"Error deleting from MongoDB: {exc}")
            raise HTTPException(status_code=500, detail="Database write error")
    else:
        # ── Persistent JSON file path ─────────────────────────────────────────
        try:
            deleted = file_store.delete(report_id)
        except Exception as exc:
            logger.error(f"Error deleting from file store: {exc}")
            raise HTTPException(status_code=500, detail="File storage write error")
        if not deleted:
            raise HTTPException(status_code=404, detail="Report not found")

    return {"message": "Report deleted successfully."}
