"""Authentication and User Security for QuantEX.

Provides PBKDF2 password hashing, cryptographically secure token generation,
and strict FastAPI dependencies for user authentication and authorization.
Never bypasses authentication or hardcodes demo credentials.
"""

from datetime import datetime, timezone, timedelta
import hashlib
import hmac
import secrets
from typing import Optional, Dict
from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User, AuthToken
from app.core.logger import logger

# In-memory fast token lookup cache: token -> {"user_id": str, "expires_at": datetime}
_TOKEN_STORE: Dict[str, Dict] = {}
security_scheme = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    """Hashes a password with PBKDF2-HMAC-SHA256 and a cryptographically random salt."""
    salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        100_000,
    )
    return f"{salt}${key.hex()}"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plain password against the stored salt$key hash."""
    try:
        parts = hashed_password.split("$")
        if len(parts) != 2:
            return False
        salt, expected_hash = parts
        computed_key = hashlib.pbkdf2_hmac(
            "sha256",
            plain_password.encode("utf-8"),
            salt.encode("utf-8"),
            100_000,
        )
        return hmac.compare_digest(computed_key.hex(), expected_hash)
    except Exception as e:
        logger.error(f"Password verification error: {e}")
        return False


def create_access_token(user_id: str, db: Optional[Session] = None, expires_in_hours: int = 24) -> str:
    """Generates a secure access token for a user session and persists it."""
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=expires_in_hours)
    _TOKEN_STORE[token] = {
        "user_id": user_id,
        "expires_at": expires_at,
    }
    if db is not None:
        try:
            db_token = AuthToken(token=token, user_id=user_id, expires_at=expires_at)
            db.add(db_token)
            db.commit()
        except Exception as e:
            logger.error(f"Failed to persist token to database: {e}")
    return token


def revoke_token(token: str, db: Optional[Session] = None) -> bool:
    """Revokes a session token on logout."""
    _TOKEN_STORE.pop(token, None)
    if db is not None:
        try:
            db.query(AuthToken).filter(AuthToken.token == token).delete()
            db.commit()
        except Exception as e:
            logger.error(f"Failed to remove token from database: {e}")
    return True


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Strict FastAPI dependency to retrieve the authenticated user.
    Requires a valid non-expired Bearer token.
    """
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    now = datetime.now(timezone.utc)

    # 1. Check in-memory fast cache
    session_info = _TOKEN_STORE.get(token)
    if session_info:
        exp = session_info["expires_at"]
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if exp > now:
            user = db.query(User).filter(User.user_id == session_info["user_id"]).first()
            if user and user.is_active:
                return user
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User account is inactive or not found",
                headers={"WWW-Authenticate": "Bearer"},
            )

    # 2. Check SQLite persistent token storage
    db_token = db.query(AuthToken).filter(AuthToken.token == token).first()
    if db_token:
        expires = db_token.expires_at
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        if expires > now:
            user = db.query(User).filter(User.user_id == db_token.user_id).first()
            if user and user.is_active:
                # Re-populate in-memory cache
                _TOKEN_STORE[token] = {
                    "user_id": user.user_id,
                    "expires_at": expires,
                }
                return user
        else:
            db.delete(db_token)
            db.commit()

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired authentication token",
        headers={"WWW-Authenticate": "Bearer"},
    )
