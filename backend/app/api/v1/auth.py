"""Authentication and User Account endpoints for QuantEX."""

from fastapi import APIRouter, Depends, HTTPException, status, Security
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.auth import UserRegisterRequest, UserLoginRequest, UserResponse, TokenResponse
from app.core.auth import (
    hash_password,
    verify_password,
    create_access_token,
    revoke_token,
    get_current_user,
    security_scheme,
)

router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register_user(payload: UserRegisterRequest, db: Session = Depends(get_db)):
    """Registers a new trader account with PBKDF2 password hashing."""
    username_clean = payload.username.strip().lower()
    email_clean = payload.email.strip().lower()

    if len(username_clean) < 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username must be at least 3 characters",
        )
    if "@" not in email_clean or "." not in email_clean:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide a valid email address",
        )
    if len(payload.password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters",
        )

    existing_user = db.query(User).filter(
        (User.username == username_clean) | (User.email == email_clean)
    ).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username or email is already registered",
        )

    new_user = User(
        username=username_clean,
        email=email_clean,
        password_hash=hash_password(payload.password),
        is_active=True,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    token = create_access_token(new_user.user_id, db=db)
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse(
            id=new_user.id,
            user_id=new_user.user_id,
            username=new_user.username,
            email=new_user.email,
            is_active=new_user.is_active,
            is_admin=new_user.is_admin,
            created_at=new_user.created_at.isoformat() if new_user.created_at else None,
        ),
    )


@router.post("/login", response_model=TokenResponse)
def login_user(payload: UserLoginRequest, db: Session = Depends(get_db)):
    """Authenticates user credentials and issues a cryptographic session token."""
    login_id = payload.username.strip().lower()
    user = db.query(User).filter(
        (User.username.ilike(login_id)) | (User.email.ilike(login_id))
    ).first()

    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated",
        )

    token = create_access_token(user.user_id, db=db)
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse(
            id=user.id,
            user_id=user.user_id,
            username=user.username,
            email=user.email,
            is_active=user.is_active,
            is_admin=user.is_admin,
            created_at=user.created_at.isoformat() if user.created_at else None,
        ),
    )


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """Returns profile for currently authenticated user."""
    return UserResponse(
        id=current_user.id,
        user_id=current_user.user_id,
        username=current_user.username,
        email=current_user.email,
        is_active=current_user.is_active,
        is_admin=current_user.is_admin,
        created_at=current_user.created_at.isoformat() if current_user.created_at else None,
    )


@router.post("/logout")
def logout_user(
    credentials: HTTPAuthorizationCredentials = Security(security_scheme),
    db: Session = Depends(get_db),
):
    """Terminates user session and revokes access token."""
    if credentials and credentials.credentials:
        revoke_token(credentials.credentials, db=db)
    return {"success": True, "message": "Successfully logged out"}
