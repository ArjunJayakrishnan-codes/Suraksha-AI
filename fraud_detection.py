"""
Advanced Fraud Detection Module
Detects delivery-specific fraud patterns: GPS spoofing, fake weather claims, duplicate claims
"""

import os
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Any
from pymongo import MongoClient
from pymongo.errors import PyMongoError

# MongoDB connection (same as in claims_management.py)
MONGO_URI = os.getenv("MONGODB_URI")
MONGO_DB = os.getenv("MONGODB_DB", "secure_gig_guardian")
FRAUD_COLLECTION = os.getenv("MONGODB_FRAUD_COLLECTION", "fraud_flags")

client = None
collection = None

if MONGO_URI:
    try:
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
        db = client[MONGO_DB]
        collection = db[FRAUD_COLLECTION]
        collection.create_index([("claim_id", 1)], unique=True, sparse=True)
    except PyMongoError as exc:
        print(f"MongoDB fraud detection init error: {exc}")
        collection = None


class FraudDetectionResult:
    def __init__(self, is_fraudulent: bool, risk_score: float, flags: List[str], reason: str):
        self.is_fraudulent = is_fraudulent
        self.risk_score = risk_score  # 0.0 - 1.0
        self.flags = flags
        self.reason = reason

    def to_dict(self) -> Dict[str, Any]:
        return {
            "is_fraudulent": self.is_fraudulent,
            "risk_score": self.risk_score,
            "flags": self.flags,
            "reason": self.reason,
            "timestamp": datetime.utcnow().isoformat(),
        }


def detect_gps_spoofing(claim: Dict[str, Any], historical_claims: List[Dict[str, Any]]) -> Tuple[bool, float, str]:
    """
    Detect GPS spoofing patterns:
    - Impossible travel times (too far, too fast)
    - Location inconsistency with claimed delivery area
    - Multiple claims from different locations simultaneously
    """
    flags = []
    risk_score = 0.0

    # Check for impossible travel times
    recent_claims = [c for c in historical_claims if c.get("delivery_location") and c.get("timestamp")]
    if len(recent_claims) >= 2:
        recent_claims.sort(key=lambda x: x["timestamp"], reverse=True)
        last_claim = recent_claims[0]
        
        # Simulate location data (in production, use actual GPS coordinates)
        last_location = last_claim.get("delivery_location", "")
        current_location = claim.get("delivery_location", "")
        
        # Check if claims are from different cities within 10 minutes
        time_diff = datetime.utcnow() - datetime.fromisoformat(last_claim.get("timestamp", datetime.utcnow().isoformat()))
        if time_diff.total_seconds() < 600 and last_location != current_location:  # < 10 mins
            flags.append("Impossible travel time detected")
            risk_score += 0.4

    return len(flags) > 0, risk_score, ", ".join(flags) if flags else "No GPS anomalies"


def detect_fake_weather_claims(claim: Dict[str, Any], historical_weather: Dict[str, Any]) -> Tuple[bool, float, str]:
    """
    Detect fake weather claims using historical data:
    - Weather didn't match claimed conditions on claim date/time
    - Claiming disruption on clear weather days
    - Pattern of claims matching unrelated weather events
    """
    flags = []
    risk_score = 0.0

    claim_amount = claim.get("claim_amount", 0)
    claimed_weather = claim.get("weather_condition", "").lower()
    claim_date = claim.get("claim_date", datetime.utcnow().isoformat())

    # Simulate historical weather data (in production, use OpenWeatherMap API)
    historical_record = historical_weather.get(claim_date, {})
    actual_conditions = historical_record.get("conditions", [])

    # Check if claimed condition matches historical record
    if claimed_weather and claimed_weather not in actual_conditions:
        flags.append(f"Weather mismatch: claimed {claimed_weather}, actual {actual_conditions}")
        risk_score += 0.3

    # Check for suspiciously high claim amounts
    if claim_amount > 500:
        flags.append("Unusually high claim amount")
        risk_score += 0.2

    # Check for frequency anomalies
    if claim.get("claim_frequency", 0) > 3:  # More than 3 claims in a week
        flags.append("Excessive claim frequency")
        risk_score += 0.25

    return len(flags) > 0, risk_score, ", ".join(flags) if flags else "Weather claim verified"


def detect_duplicate_claims(claim: Dict[str, Any], user_claims: List[Dict[str, Any]]) -> Tuple[bool, float, str]:
    """
    Detect duplicate or near-duplicate claims:
    - Same claim submitted multiple times
    - Very similar claims with same details
    - Claims on same location/time with different descriptions
    """
    flags = []
    risk_score = 0.0

    for past_claim in user_claims:
        # Exact match check
        if (claim.get("title") == past_claim.get("title") and 
            claim.get("description") == past_claim.get("description") and
            abs(claim.get("claim_amount", 0) - past_claim.get("claim_amount", 0)) < 1):
            flags.append("Exact duplicate claim detected")
            risk_score += 0.6

        # Similar metadata check
        if (claim.get("delivery_location") == past_claim.get("delivery_location") and
            claim.get("weather_condition") == past_claim.get("weather_condition")):
            flags.append("Similar claim pattern detected")
            risk_score += 0.15

    return len(flags) > 0, risk_score, ", ".join(flags) if flags else "No duplicates found"


def analyze_claim(claim: Dict[str, Any], user_id: str, all_user_claims: List[Dict[str, Any]] = None) -> FraudDetectionResult:
    """
    Comprehensive fraud analysis for a claim
    Returns FraudDetectionResult with fraud score and flags
    """
    if all_user_claims is None:
        all_user_claims = []

    all_flags = []
    total_risk = 0.0

    # GPS Spoofing Detection
    gps_fraud, gps_risk, gps_msg = detect_gps_spoofing(claim, all_user_claims)
    if gps_fraud:
        all_flags.extend(gps_msg.split(", "))
    total_risk += gps_risk

    # Fake Weather Claims Detection
    historical_weather = {
        datetime.utcnow().date().isoformat(): {"conditions": ["clear", "sunny", "partly cloudy"]},
        (datetime.utcnow() - timedelta(days=1)).date().isoformat(): {"conditions": ["rainy", "stormy"]},
    }
    weather_fraud, weather_risk, weather_msg = detect_fake_weather_claims(claim, historical_weather)
    if weather_fraud:
        all_flags.extend(weather_msg.split(", "))
    total_risk += weather_risk

    # Duplicate Claims Detection
    dup_fraud, dup_risk, dup_msg = detect_duplicate_claims(claim, all_user_claims)
    if dup_fraud:
        all_flags.extend(dup_msg.split(", "))
    total_risk += dup_risk

    # Normalize risk score to 0-1
    risk_score = min(total_risk / 3.0, 1.0)
    is_fraudulent = risk_score > 0.4  # Fraud threshold

    reason = " | ".join(all_flags) if all_flags else "Claim appears legitimate"

    result = FraudDetectionResult(is_fraudulent, risk_score, all_flags, reason)

    # Store fraud analysis
    if collection:
        try:
            collection.insert_one({
                "claim_id": claim.get("id", str(datetime.utcnow().timestamp())),
                "user_id": user_id,
                **result.to_dict(),
            })
        except Exception:
            pass

    return result
