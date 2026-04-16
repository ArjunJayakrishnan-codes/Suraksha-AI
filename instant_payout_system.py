"""
Instant Payout System
Simulated payment gateways: UPI, Razorpay, Stripe
"""

import random
import string
from datetime import datetime, timedelta
from typing import Dict, Optional
from enum import Enum

class PaymentGateway(str, Enum):
    UPI = "upi"
    RAZORPAY = "razorpay"
    STRIPE = "stripe"

class PayoutStatus(str, Enum):
    INITIATED = "initiated"
    PROCESSING = "processing"
    SUCCESS = "success"
    FAILED = "failed"
    PENDING = "pending"

class InstantPayoutSystem:
    def __init__(self):
        self.transactions = {}
        self.gateway_success_rates = {
            PaymentGateway.UPI: 0.99,  # 99% success rate
            PaymentGateway.RAZORPAY: 0.95,
            PaymentGateway.STRIPE: 0.97,
        }
        self.gateway_processing_times = {
            PaymentGateway.UPI: timedelta(seconds=5),  # Instant
            PaymentGateway.RAZORPAY: timedelta(minutes=2),  # 2-5 minutes
            PaymentGateway.STRIPE: timedelta(hours=24),  # Next day
        }

    @staticmethod
    def _enum_value(value):
        if isinstance(value, Enum):
            return value.value
        return value

    @staticmethod
    def _normalize_status(value) -> str:
        raw = InstantPayoutSystem._enum_value(value)
        s = str(raw or "").strip().lower()
        if "." in s:
            s = s.split(".")[-1]
        return s

    @staticmethod
    def _normalize_gateway(value) -> str:
        raw = InstantPayoutSystem._enum_value(value)
        s = str(raw or "").strip().lower()
        if "." in s:
            s = s.split(".")[-1]
        return s

    def has_active_or_successful_payout(self, claim_id: str) -> bool:
        """Return True if claim already has a pending/processing/success payout."""
        for txn in self.transactions.values():
            if str(txn.get("claim_id")) != str(claim_id):
                continue
            status = self._normalize_status(txn.get("status"))
            if status in ["pending", "processing", "success"]:
                return True
        return False

    def refresh_transaction_statuses(self) -> None:
        """
        Advance in-flight simulated payouts to success once expected completion passes.
        """
        now = datetime.now()
        for txn in self.transactions.values():
            status = self._normalize_status(txn.get("status"))
            if status not in [PayoutStatus.PROCESSING.value, PayoutStatus.PENDING.value]:
                continue

            expected = txn.get("expected_completion")
            if not expected:
                continue

            try:
                expected_dt = datetime.fromisoformat(str(expected))
            except Exception:
                continue

            if now >= expected_dt:
                txn["status"] = PayoutStatus.SUCCESS.value
                txn["settled_at"] = now.isoformat()
    
    def generate_transaction_id(self) -> str:
        """Generate unique transaction ID"""
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        random_suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))
        return f"TXN{timestamp}{random_suffix}"
    
    def generate_rrn(self) -> str:
        """Generate Retrieval Reference Number"""
        return ''.join(random.choices(string.digits, k=12))
    
    def validate_upi(self, upi_id: str) -> bool:
        """Validate UPI address format"""
        return '@' in upi_id and len(upi_id) > 5
    
    def validate_bank_account(self, account_number: str) -> bool:
        """Validate bank account number"""
        return len(account_number) >= 9 and account_number.isdigit()
    
    def validate_stripe_token(self, token: str) -> bool:
        """Validate Stripe test token"""
        return token.startswith("tok_") or token.startswith("pm_")
    
    def process_upi_payout(self, amount: float, upi_id: str, claim_id: str) -> Dict:
        """
        Process UPI payout (instant simulation)
        """
        if not self.validate_upi(upi_id):
            return {
                "status": PayoutStatus.FAILED,
                "error": f"Invalid UPI ID format: {upi_id}",
                "transaction_id": None,
                "rrn": None
            }
        
        # Simulate success/failure
        success = random.random() < self.gateway_success_rates[PaymentGateway.UPI]
        transaction_id = self.generate_transaction_id()
        rrn = self.generate_rrn()
        
        result = {
            "gateway": PaymentGateway.UPI.value,
            "transaction_id": transaction_id,
            "rrn": rrn,
            "claim_id": claim_id,
            "amount": amount,
            "recipient": upi_id,
            "status": PayoutStatus.SUCCESS.value if success else PayoutStatus.FAILED.value,
            "processing_time": "Instant (< 5 seconds)",
            "fee": 0,  # No fees for UPI
            "net_amount": amount,
            "timestamp": datetime.now().isoformat(),
            "reference_number": f"UPI{rrn}",
        }
        
        if not success:
            result["error"] = "Simulated network failure"
            result["retry_available"] = True
        
        return result
    
    def process_razorpay_payout(self, amount: float, account_number: str, ifsc: str, claim_id: str) -> Dict:
        """
        Process Razorpay payout (2-5 minutes simulation)
        """
        if not self.validate_bank_account(account_number):
            return {
                "status": PayoutStatus.FAILED,
                "error": f"Invalid account number: {account_number}",
                "transaction_id": None,
            }
        
        # Simulate success/failure
        success = random.random() < self.gateway_success_rates[PaymentGateway.RAZORPAY]
        transaction_id = self.generate_transaction_id()
        rrn = self.generate_rrn()
        
        # Calculate fee (1% for Razorpay)
        processing_fee = amount * 0.01
        net_amount = amount - processing_fee
        
        result = {
            "gateway": PaymentGateway.RAZORPAY.value,
            "transaction_id": transaction_id,
            "rrn": rrn,
            "claim_id": claim_id,
            "amount": amount,
            "recipient_account": account_number[-4:],  # Masked
            "recipient_ifsc": ifsc,
            "status": PayoutStatus.PROCESSING.value if success else PayoutStatus.FAILED.value,
            "processing_time": "10-20 seconds (simulated)",
            "fee": processing_fee,
            "net_amount": net_amount,
            "timestamp": datetime.now().isoformat(),
            "expected_completion": (datetime.now() + timedelta(seconds=random.randint(10, 20))).isoformat(),
            "reference_number": f"RZP{rrn}",
        }
        
        if not success:
            result["error"] = "Insufficient balance or account validation failed"
            result["status"] = PayoutStatus.FAILED.value
        
        return result
    
    def process_stripe_payout(self, amount: float, token: str, claim_id: str) -> Dict:
        """
        Process Stripe payout (next-day simulation)
        """
        if not self.validate_stripe_token(token):
            return {
                "status": PayoutStatus.FAILED,
                "error": f"Invalid Stripe token format: {token}",
                "transaction_id": None,
            }
        
        # Simulate success/failure
        success = random.random() < self.gateway_success_rates[PaymentGateway.STRIPE]
        transaction_id = self.generate_transaction_id()
        rrn = self.generate_rrn()
        
        # Calculate fee ($0.25 flat fee)
        processing_fee = 0.25
        net_amount = amount - processing_fee
        
        result = {
            "gateway": PaymentGateway.STRIPE.value,
            "transaction_id": transaction_id,
            "rrn": rrn,
            "claim_id": claim_id,
            "amount": amount,
            "recipient_token": token[-4:],  # Masked
            "status": PayoutStatus.PENDING.value if success else PayoutStatus.FAILED.value,
            "processing_time": "20-40 seconds (simulated)",
            "fee": processing_fee,
            "net_amount": net_amount,
            "timestamp": datetime.now().isoformat(),
            "expected_completion": (datetime.now() + timedelta(seconds=random.randint(20, 40))).isoformat(),
            "reference_number": f"STR{rrn}",
        }
        
        if not success:
            result["error"] = "Card declined or invalid token"
            result["status"] = PayoutStatus.FAILED.value
        
        return result
    
    def process_payout(self,
                      claim_id: str,
                      amount: float,
                      gateway: str,
                      recipient_info: Dict) -> Dict:
        """
        Universal payout processor that routes to appropriate gateway.
        """
        
        if gateway == PaymentGateway.UPI:
            return self.process_upi_payout(
                amount=amount,
                upi_id=recipient_info.get("upi_id", ""),
                claim_id=claim_id
            )
        
        elif gateway == PaymentGateway.RAZORPAY:
            return self.process_razorpay_payout(
                amount=amount,
                account_number=recipient_info.get("account_number", ""),
                ifsc=recipient_info.get("ifsc", ""),
                claim_id=claim_id
            )
        
        elif gateway == PaymentGateway.STRIPE:
            return self.process_stripe_payout(
                amount=amount,
                token=recipient_info.get("token", ""),
                claim_id=claim_id
            )
        
        else:
            return {
                "status": PayoutStatus.FAILED,
                "error": f"Unknown payment gateway: {gateway}",
                "transaction_id": None,
            }
    
    def get_payout_analytics(self) -> Dict:
        """Get payout analytics"""
        self.refresh_transaction_statuses()
        total_payouts = len(self.transactions)
        successful = sum(1 for t in self.transactions.values() if self._normalize_status(t.get("status")) == PayoutStatus.SUCCESS.value)
        total_amount = sum(t.get("amount", 0) for t in self.transactions.values())
        
        return {
            "total_payouts": total_payouts,
            "successful_payouts": successful,
            "success_rate": (successful / total_payouts * 100) if total_payouts > 0 else 0,
            "total_amount_paid": total_amount,
            "average_payout": total_amount / total_payouts if total_payouts > 0 else 0,
            "by_gateway": {
                gateway.value: sum(1 for t in self.transactions.values() if self._normalize_gateway(t.get("gateway")) == gateway.value)
                for gateway in [PaymentGateway.UPI, PaymentGateway.RAZORPAY, PaymentGateway.STRIPE]
            }
        }

# Global payout system instance
payout_system = InstantPayoutSystem()

def process_claim_payout(claim_id: str,
                        amount: float,
                        gateway: str,
                        recipient_info: Dict) -> Dict:
    """
    Main function to process a claim payout.
    """
    result = payout_system.process_payout(claim_id, amount, gateway, recipient_info)
    payout_system.transactions[result.get("transaction_id", claim_id)] = result
    return result
