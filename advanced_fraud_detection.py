"""
Advanced Fraud Detection System
- GPS Spoofing Detection
- Historical Weather Validation
- Delivery Pattern Analysis
- Duplicate Claim Detection
"""

import hashlib
from datetime import datetime, timedelta
from typing import Dict, List, Tuple
import random

# Historical weather patterns (simulated database)
HISTORICAL_WEATHER = {
    "2024-04-01": {"rainfall": 5, "temperature": 32, "aqi": 150, "disruption_likelihood": 0.1},
    "2024-04-02": {"rainfall": 45, "temperature": 35, "aqi": 280, "disruption_likelihood": 0.7},
    "2024-04-03": {"rainfall": 80, "temperature": 38, "aqi": 350, "disruption_likelihood": 0.95},
    "2024-04-04": {"rainfall": 10, "temperature": 30, "aqi": 120, "disruption_likelihood": 0.15},
    "2024-04-05": {"rainfall": 60, "temperature": 36, "aqi": 300, "disruption_likelihood": 0.8},
}

# Known safe zones for GPS validation
KNOWN_DELIVERY_ZONES = [
    {"name": "Downtown", "lat_range": (28.5, 28.7), "lon_range": (77.1, 77.3)},
    {"name": "West End", "lat_range": (28.4, 28.6), "lon_range": (77.0, 77.2)},
    {"name": "North Hub", "lat_range": (28.6, 28.8), "lon_range": (77.2, 77.4)},
    {"name": "South Market", "lat_range": (28.3, 28.5), "lon_range": (77.0, 77.2)},
]

class AdvancedFraudDetector:
    def __init__(self):
        self.claim_history = {}  # Track claims for duplicate detection
        self.worker_patterns = {}  # Track worker behavior patterns
        
    def detect_gps_spoofing(self, latitude: float, longitude: float, claimed_zone: str) -> Tuple[bool, str, float]:
        """
        Detect GPS spoofing by validating coordinates against known delivery zones.
        Returns: (is_spoofed, reason, confidence_score)
        """
        # Check if coordinates match claimed zone
        for zone in KNOWN_DELIVERY_ZONES:
            if zone["name"].lower() == claimed_zone.lower():
                lat_match = zone["lat_range"][0] <= latitude <= zone["lat_range"][1]
                lon_match = zone["lon_range"][0] <= longitude <= zone["lon_range"][1]
                
                if lat_match and lon_match:
                    return False, "GPS coordinates valid for claimed zone", 0.0
                else:
                    # GPS doesn't match zone - potential spoofing
                    return True, f"GPS coordinates ({latitude}, {longitude}) don't match claimed zone {claimed_zone}", 0.9
        
        # Unknown zone
        return True, f"Claimed zone '{claimed_zone}' not in registered delivery zones", 0.7
    
    def validate_weather_claim(self, claim_date: str, claimed_weather_severity: float) -> Tuple[bool, str, float]:
        """
        Validate weather claims against historical data.
        Returns: (is_valid, reason, anomaly_score)
        """
        # Get historical weather for claimed date
        historical = HISTORICAL_WEATHER.get(claim_date)
        
        if not historical:
            # Date not in historical records - treat as suspicious
            return False, f"No historical data available for {claim_date}", 0.5
        
        # Check if claimed severity matches historical disruption likelihood
        historical_disruption = historical["disruption_likelihood"]
        
        if claimed_weather_severity > 0.8 and historical_disruption < 0.3:
            return False, f"Claimed severe weather ({claimed_weather_severity}) but historical data shows low disruption ({historical_disruption})", 0.85
        
        if claimed_weather_severity < 0.3 and historical_disruption > 0.8:
            return False, f"Claimed light weather ({claimed_weather_severity}) but historical data shows high disruption ({historical_disruption})", 0.75
        
        return True, f"Weather claim consistent with historical data (disruption: {historical_disruption})", 0.1
    
    def detect_duplicate_claims(self, claim_id: str, worker_id: str, claim_date: str, amount: float) -> Tuple[bool, str, float]:
        """
        Detect duplicate or near-duplicate claims from same worker.
        Returns: (is_duplicate, reason, suspicion_score)
        """
        # Create claim fingerprint
        fingerprint = hashlib.md5(f"{worker_id}{claim_date}{round(amount, 2)}".encode()).hexdigest()
        
        # Check if similar claim exists
        worker_claims = self.claim_history.get(worker_id, [])
        
        for past_claim in worker_claims:
            if past_claim["fingerprint"] == fingerprint:
                return True, f"Identical claim already submitted by worker {worker_id}", 0.95
            
            # Check for claims within 1 hour with 90% amount match
            if past_claim["date"] == claim_date:
                amount_diff = abs(past_claim["amount"] - amount) / amount
                if amount_diff < 0.1:
                    return True, f"Near-duplicate claim detected (same day, {amount_diff*100:.0f}% amount variance)", 0.8
        
        # Store claim for future checks
        if worker_id not in self.claim_history:
            self.claim_history[worker_id] = []
        
        self.claim_history[worker_id].append({
            "claim_id": claim_id,
            "date": claim_date,
            "amount": amount,
            "fingerprint": fingerprint
        })
        
        return False, "No duplicate claims detected", 0.0
    
    def analyze_worker_pattern(self, worker_id: str, claim_frequency: int, avg_claim_amount: float, approval_rate: float) -> Tuple[bool, str, float]:
        """
        Detect suspicious worker behavior patterns.
        Returns: (is_suspicious, reason, risk_score)
        """
        suspicious_indicators = []
        risk_score = 0.0
        
        # Check claim frequency - more than 3 claims per week is suspicious
        if claim_frequency > 3:
            suspicious_indicators.append(f"High claim frequency: {claim_frequency} claims/week (normal: 1-2)")
            risk_score += 0.2
        
        # Check for unusually high claims
        if avg_claim_amount > 5000:
            suspicious_indicators.append(f"High average claim amount: ₹{avg_claim_amount} (typical: ₹2000-3000)")
            risk_score += 0.15
        
        # Check approval rate - very high approval rate can indicate collusion
        if approval_rate > 0.95 and claim_frequency > 2:
            suspicious_indicators.append(f"Unusually high approval rate: {approval_rate*100:.0f}% with high frequency")
            risk_score += 0.25
        
        if suspicious_indicators:
            return True, " | ".join(suspicious_indicators), min(risk_score, 1.0)
        
        return False, "Worker behavior pattern is normal", 0.0
    
    def calculate_fraud_score(self, 
                            latitude: float, 
                            longitude: float, 
                            claimed_zone: str,
                            claim_date: str,
                            weather_severity: float,
                            worker_id: str,
                            claim_id: str,
                            amount: float,
                            claim_frequency: int = 1,
                            avg_claim_amount: float = 2000,
                            approval_rate: float = 0.7) -> Dict:
        """
        Comprehensive fraud analysis combining multiple detection methods.
        Returns detailed fraud analysis with individual scores.
        """
        results = {
            "claim_id": claim_id,
            "worker_id": worker_id,
            "timestamp": datetime.now().isoformat(),
            "fraud_indicators": [],
            "confidence_scores": {},
            "final_risk_score": 0.0,
            "recommendation": "APPROVE",
            "flags": []
        }
        
        # 1. GPS Spoofing Check (weight: 30%)
        gps_spoofed, gps_reason, gps_confidence = self.detect_gps_spoofing(latitude, longitude, claimed_zone)
        results["confidence_scores"]["gps_spoofing"] = gps_confidence
        if gps_spoofed:
            results["fraud_indicators"].append("GPS_SPOOFING_DETECTED")
            results["flags"].append(f"GPS Alert: {gps_reason}")
        results["final_risk_score"] += gps_confidence * 0.30
        
        # 2. Weather Claim Validation (weight: 25%)
        weather_valid, weather_reason, weather_anomaly = self.validate_weather_claim(claim_date, weather_severity)
        results["confidence_scores"]["weather_anomaly"] = weather_anomaly
        if not weather_valid:
            results["fraud_indicators"].append("WEATHER_MISMATCH")
            results["flags"].append(f"Weather Alert: {weather_reason}")
        results["final_risk_score"] += weather_anomaly * 0.25
        
        # 3. Duplicate Detection (weight: 25%)
        is_duplicate, dup_reason, dup_score = self.detect_duplicate_claims(claim_id, worker_id, claim_date, amount)
        results["confidence_scores"]["duplicate_claim"] = dup_score
        if is_duplicate:
            results["fraud_indicators"].append("DUPLICATE_CLAIM")
            results["flags"].append(f"Duplicate Alert: {dup_reason}")
        results["final_risk_score"] += dup_score * 0.25
        
        # 4. Worker Pattern Analysis (weight: 20%)
        suspicious_pattern, pattern_reason, pattern_risk = self.analyze_worker_pattern(
            worker_id, claim_frequency, avg_claim_amount, approval_rate
        )
        results["confidence_scores"]["worker_pattern"] = pattern_risk
        if suspicious_pattern:
            results["fraud_indicators"].append("SUSPICIOUS_WORKER_PATTERN")
            results["flags"].append(f"Pattern Alert: {pattern_reason}")
        results["final_risk_score"] += pattern_risk * 0.20
        
        # Normalize risk score to 0-1 range
        results["final_risk_score"] = min(results["final_risk_score"], 1.0)
        
        # Make recommendation
        if results["final_risk_score"] > 0.7:
            results["recommendation"] = "REJECT"
            results["reason"] = "High fraud risk detected across multiple indicators"
        elif results["final_risk_score"] > 0.4:
            results["recommendation"] = "REVIEW"
            results["reason"] = "Moderate fraud risk - requires manual review"
        else:
            results["recommendation"] = "APPROVE"
            results["reason"] = "Low fraud risk - safe to approve"
        
        return results

# Global detector instance
fraud_detector = AdvancedFraudDetector()

def analyze_claim_for_fraud(claim_data: Dict) -> Dict:
    """
    Analyze a claim for fraud using the advanced detection system.
    """
    return fraud_detector.calculate_fraud_score(
        latitude=claim_data.get("latitude", 28.6),
        longitude=claim_data.get("longitude", 77.2),
        claimed_zone=claim_data.get("delivery_zone", "Downtown"),
        claim_date=claim_data.get("claim_date", "2024-04-02"),
        weather_severity=claim_data.get("weather_severity", 0.5),
        worker_id=claim_data.get("worker_id", "unknown"),
        claim_id=claim_data.get("claim_id", "unknown"),
        amount=claim_data.get("amount", 2000),
        claim_frequency=claim_data.get("claim_frequency", 1),
        avg_claim_amount=claim_data.get("avg_claim_amount", 2000),
        approval_rate=claim_data.get("approval_rate", 0.7)
    )
