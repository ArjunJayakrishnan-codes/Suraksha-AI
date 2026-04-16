"""
User roles and permissions management.
Tracks admin/insurer vs worker users for the GigGuard system.
"""

import json
import os
from threading import Lock

# In-memory role storage (persisted in MongoDB in production)
_DEFAULT_USER_ROLES = {
    "dev-user-demo": "admin",  # Default admin for local development
    "admin@gig-guardian.local": "admin",
    # Real Supabase users would be added here or queried from a database
}

_USER_ROLES_FILE = os.getenv("USER_ROLES_FILE", "user_roles_store.json")
_ROLE_LOCK = Lock()


def _load_roles() -> dict:
    roles = dict(_DEFAULT_USER_ROLES)
    if not os.path.isfile(_USER_ROLES_FILE):
        return roles
    try:
        with open(_USER_ROLES_FILE, "r", encoding="utf-8") as f:
            payload = json.load(f)
            if isinstance(payload, dict):
                for k, v in payload.items():
                    if v in ["admin", "worker"]:
                        roles[str(k)] = v
    except Exception:
        # Keep service resilient even if local role file is malformed.
        pass
    return roles


def _save_roles() -> None:
    try:
        with open(_USER_ROLES_FILE, "w", encoding="utf-8") as f:
            json.dump(_USER_ROLES, f, indent=2)
    except Exception:
        # Non-fatal: role persistence may fail due to file permissions.
        pass


_USER_ROLES = _load_roles()

def get_user_role(user_id: str) -> str:
    """
    Get the role of a user: 'admin' or 'worker'
    
    Args:
        user_id: The user's unique ID from Supabase or mock auth
        
    Returns:
        'admin' for insurers/admins, 'worker' for gig workers
    """
    return _USER_ROLES.get(user_id, "worker")

def has_explicit_role(user_id: str) -> bool:
    """Return True if the user has an explicitly registered role."""
    return user_id in _USER_ROLES

def register_user_role(user_id: str, role: str) -> str:
    """
    Register a user's role once. If the user already has a different role,
    reject the change to enforce immutable identity role.
    """
    if role not in ["admin", "worker"]:
        raise ValueError("Invalid role")

    with _ROLE_LOCK:
        existing = _USER_ROLES.get(user_id)
        if existing and existing != role:
            raise ValueError(f"This account is registered as {existing}")

        _USER_ROLES[user_id] = role
        _save_roles()
        return role

def is_admin(user_id: str) -> bool:
    """
    Check if a user is an admin (insurer).
    
    Args:
        user_id: The user's unique ID
        
    Returns:
        True if user is admin, False otherwise
    """
    return get_user_role(user_id) == "admin"

def set_admin(user_id: str, is_admin_flag: bool) -> None:
    """
    Set admin status for a user.
    
    Args:
        user_id: The user's unique ID
        is_admin_flag: Whether to grant admin access
    """
    with _ROLE_LOCK:
        _USER_ROLES[user_id] = "admin" if is_admin_flag else "worker"
        _save_roles()

def register_admin(email: str, user_id: str) -> None:
    """
    Register a new admin/insurer user.
    
    Args:
        email: Admin email
        user_id: Admin's Supabase user ID
    """
    with _ROLE_LOCK:
        _USER_ROLES[user_id] = "admin"
        _save_roles()
    print(f"[ROLE] Registered admin: {email} ({user_id})")

def list_admins() -> list:
    """Get list of all admin user IDs"""
    return [user_id for user_id, role in _USER_ROLES.items() if role == "admin"]

def get_user_claims_query(user_id: str, is_admin_check: bool) -> dict:
    """
    Get MongoDB query filter for user claims.
    
    Args:
        user_id: The user's ID
        is_admin_check: Whether user is admin
        
    Returns:
        MongoDB query dict to filter claims appropriately
    """
    if is_admin_check:
        # Admins see all claims
        return {}
    else:
        # Workers see only their own claims
        return {"user_id": user_id}
