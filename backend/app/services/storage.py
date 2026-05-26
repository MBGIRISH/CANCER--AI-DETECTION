"""
storage.py – Persistent JSON file-based storage for scan reports.

Used as the fallback when MongoDB is not available.
Data is saved to  backend/data/reports.json  so it survives
server restarts and persists per-doctor.
"""

import json
import logging
import os
import threading
from typing import List, Optional

logger = logging.getLogger("storage")

# Resolve the data directory relative to this file so it always lands inside
# the backend folder regardless of where uvicorn is launched from.
_BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(_BASE_DIR, "data")
REPORTS_FILE = os.path.join(DATA_DIR, "reports.json")

# One lock to serialise all reads/writes (safe for multi-thread uvicorn workers).
_lock = threading.Lock()


def _ensure_data_dir() -> None:
    os.makedirs(DATA_DIR, exist_ok=True)


def _load_all() -> List[dict]:
    """Read all reports from disk. Returns an empty list if the file doesn't exist yet."""
    _ensure_data_dir()
    if not os.path.exists(REPORTS_FILE):
        return []
    try:
        with open(REPORTS_FILE, "r", encoding="utf-8") as fh:
            data = json.load(fh)
            if isinstance(data, list):
                return data
            return []
    except (json.JSONDecodeError, OSError) as exc:
        logger.error(f"Failed to read {REPORTS_FILE}: {exc}. Returning empty list.")
        return []


def _save_all(reports: List[dict]) -> None:
    """Write the full report list back to disk atomically (write-then-rename)."""
    _ensure_data_dir()
    tmp_path = REPORTS_FILE + ".tmp"
    try:
        with open(tmp_path, "w", encoding="utf-8") as fh:
            json.dump(reports, fh, indent=2, ensure_ascii=False)
        os.replace(tmp_path, REPORTS_FILE)
    except OSError as exc:
        logger.error(f"Failed to write {REPORTS_FILE}: {exc}")
        raise


# ──────────────────────────────────────────────────────────────────────────────
# Public API
# ──────────────────────────────────────────────────────────────────────────────

def get_all(doctor: Optional[str] = None) -> List[dict]:
    """Return all reports, optionally filtered by reviewingDoctor (case-sensitive)."""
    with _lock:
        reports = _load_all()
    if doctor:
        reports = [r for r in reports if r.get("reviewingDoctor") == doctor]
    # Sort newest-first by generatedAt
    reports = sorted(reports, key=lambda x: x.get("generatedAt", ""), reverse=True)
    logger.info(f"[FileStore] Fetched {len(reports)} records (doctor={doctor!r}).")
    return reports


def upsert(report: dict) -> dict:
    """Insert or update a report by its 'id' field. Returns the stored record."""
    with _lock:
        reports = _load_all()
        idx = next((i for i, r in enumerate(reports) if r.get("id") == report.get("id")), None)
        if idx is not None:
            reports[idx] = report
            logger.info(f"[FileStore] Updated report id={report.get('id')}.")
        else:
            reports.append(report)
            logger.info(f"[FileStore] Inserted report id={report.get('id')}.")
        _save_all(reports)
    return report


def delete(report_id: str) -> bool:
    """Remove a report by id. Returns True if deleted, False if not found."""
    with _lock:
        reports = _load_all()
        original_len = len(reports)
        reports = [r for r in reports if r.get("id") != report_id]
        if len(reports) == original_len:
            return False
        _save_all(reports)
    logger.info(f"[FileStore] Deleted report id={report_id}.")
    return True
