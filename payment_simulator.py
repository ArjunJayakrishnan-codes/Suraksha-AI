"""
Payment Simulator Module
Mock payment gateway integrations for instant payouts
Simulates Razorpay, Stripe, and UPI payment processing
"""

import os
import random
import uuid
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, Literal
from enum import Enum
from pymongo import MongoClient
from pymongo.errors import PyMongoError

# Payment Gateway Types
class PaymentGateway(str, Enum):
    RAZORPAY = "razorpay"
    STRIPE = "stripe"
    UPI = "upi"


class PaymentStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    SUCCESS = "success"
    FAILED = "failed"
    REFUNDED = "refunded"


# MongoDB connection for payout tracking
MONGO_URI = os.getenv("MONGODB_URI")
MONGO_DB = os.getenv("MONGODB_DB", "secure_gig_guardian")
PAYOUTS_COLLECTION = os.getenv("MONGODB_PAYOUTS_COLLECTION", "payouts")

client = None
payouts_collection = None

if MONGO_URI:
    try:
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
        db = client[MONGO_DB]
        payouts_collection = db[PAYOUTS_COLLECTION]
        payouts_collection.create_index([("payout_id", 1)], unique=True, sparse=True)
        payouts_collection.create_index([("user_id", 1)])
        payouts_collection.create_index([("claim_id", 1)], sparse=True)
    except PyMongoError as exc:
        print(f"MongoDB payout init error: {exc}")
        payouts_collection = None


class PayoutSimulator:
    """Simulates instant payout across multiple payment gateways"""

    @staticmethod
    def simulate_razorpay_transfer(amount: float, worker_upi: str, claim_id: str) -> Dict[str, Any]:
        """
        Simulate Razorpay instant transfer
        Test mode: Always succeeds, generates mock transaction ID
        """
        # Simulate API latency (100-800ms)
        import time
        time.sleep(random.uniform(0.1, 0.8))

        transaction_id = f"RZIP{uuid.uuid4().hex[:12].upper()}"
        settlement_utr = f"RZIPL{datetime.utcnow().strftime('%Y%m%d%H%M%S')}{random.randint(1000, 9999)}"

        return {
            "gateway": PaymentGateway.RAZORPAY,
            "status": PaymentStatus.SUCCESS,
            "transaction_id": transaction_id,
            "settlement_utr": settlement_utr,
            "amount": amount,
            "recipient": worker_upi,
            "timestamp": datetime.utcnow().isoformat(),
            "settlement_time": (datetime.utcnow() + timedelta(minutes=2)).isoformat(),
            "fee": round(amount * 0.01, 2),  # 1% mock fee
            "net_amount": round(amount - amount * 0.01, 2),
        }

    @staticmethod
    def simulate_stripe_transfer(amount: float, stripe_account_id: str, claim_id: str) -> Dict[str, Any]:
        """
        Simulate Stripe Connect payout
        Test mode: Processes instantly, generates mock payout ID
        """
        import time
        time.sleep(random.uniform(0.15, 0.9))

        stripe_payout_id = f"po_{uuid.uuid4().hex[:16]}"
        arrival_date = (datetime.utcnow() + timedelta(days=2)).date().isoformat()

        return {
            "gateway": PaymentGateway.STRIPE,
            "status": PaymentStatus.SUCCESS,
            "payout_id": stripe_payout_id,
            "amount": amount,
            "recipient_account": stripe_account_id,
            "timestamp": datetime.utcnow().isoformat(),
            "arrival_date": arrival_date,
            "method": "instant",  # Instant transfer (test mode)
            "fee": 0.25,  # Stripe flat fee for instant transfers
            "net_amount": round(amount - 0.25, 2),
        }

    @staticmethod
    def simulate_upi_transfer(amount: float, upi_id: str, claim_id: str) -> Dict[str, Any]:
        """
        Simulate UPI instant payment
        Test mode: Near-instant settlement, generates mock reference
        """
        import time
        time.sleep(random.uniform(0.05, 0.3))  # UPI is fastest

        rrn = f"{''.join(random.choices('0123456789', k=12))}"  # Retrieval Reference Number
        rrn_timestamp = datetime.utcnow().isoformat()

        return {
            "gateway": PaymentGateway.UPI,
            "status": PaymentStatus.SUCCESS,
            "rrn": rrn,
            "ref_id": f"UPI{datetime.utcnow().strftime('%Y%m%d%H%M%S')}{random.randint(100, 999)}",
            "amount": amount,
            "recipient": upi_id,
            "timestamp": rrn_timestamp,
            "settlement_status": "settled",
            "fee": 0,  # UPI typically free for merchant
            "net_amount": amount,
            "message": f"₹{amount} sent to {upi_id}",
        }

    @staticmethod
    def process_instant_payout(
        amount: float,
        user_id: str,
        claim_id: str,
        recipient_identifier: str,
        gateway: PaymentGateway = PaymentGateway.UPI,
    ) -> Dict[str, Any]:
        """
        Process instant payout via specified gateway
        Stores transaction in MongoDB for tracking
        """
        payout_id = f"PO-{uuid.uuid4().hex[:12].upper()}"

        # Simulate payment based on gateway
        if gateway == PaymentGateway.RAZORPAY:
            payment_result = PayoutSimulator.simulate_razorpay_transfer(amount, recipient_identifier, claim_id)
        elif gateway == PaymentGateway.STRIPE:
            payment_result = PayoutSimulator.simulate_stripe_transfer(amount, recipient_identifier, claim_id)
        else:  # UPI default
            payment_result = PayoutSimulator.simulate_upi_transfer(amount, recipient_identifier, claim_id)

        payout_record = {
            "payout_id": payout_id,
            "user_id": user_id,
            "claim_id": claim_id,
            "amount": amount,
            "gateway": gateway.value,
            "recipient": recipient_identifier,
            "status": payment_result["status"].value,
            "transaction_details": payment_result,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
        }

        # Store in MongoDB
        if payouts_collection:
            try:
                payouts_collection.insert_one(payout_record)
            except Exception as e:
                print(f"Error storing payout: {e}")

        return payout_record

    @staticmethod
    def get_payout_status(payout_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve payout status from MongoDB"""
        if not payouts_collection:
            return None

        try:
            return payouts_collection.find_one({"payout_id": payout_id})
        except Exception:
            return None

    @staticmethod
    def get_user_payouts(user_id: str, limit: int = 10) -> list:
        """Get user's recent payouts"""
        if not payouts_collection:
            return []

        try:
            return list(
                payouts_collection.find({"user_id": user_id})
                .sort("created_at", -1)
                .limit(limit)
            )
        except Exception:
            return []

    @staticmethod
    def get_payout_analytics() -> Dict[str, Any]:
        """Get overall payout analytics"""
        if not payouts_collection:
            return {}

        try:
            pipeline = [
                {
                    "$group": {
                        "_id": "$gateway",
                        "count": {"$sum": 1},
                        "total_amount": {"$sum": "$amount"},
                        "success_count": {
                            "$sum": {
                                "$cond": [{"$eq": ["$status", PaymentStatus.SUCCESS.value]}, 1, 0]
                            }
                        },
                    }
                }
            ]
            results = list(payouts_collection.aggregate(pipeline))
            return {
                "by_gateway": results,
                "total_payouts": payouts_collection.count_documents({}),
                "timestamp": datetime.utcnow().isoformat(),
            }
        except Exception:
            return {}
