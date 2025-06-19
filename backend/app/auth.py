from datetime import datetime, timedelta
from typing import Optional, Set
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.security.utils import get_authorization_scheme_param
from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models import User
import os
import uuid

# JWT Configuration
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key")
ALGORITHM = "HS256"

# Token blacklist for logout functionality
# In production, this should be Redis or database-backed
blacklisted_tokens: Set[str] = set()

security = HTTPBearer()

class OptionalHTTPBearer(HTTPBearer):
    """HTTP Bearer that doesn't raise an exception if no token is provided."""
    
    async def __call__(self, request: Request) -> Optional[HTTPAuthorizationCredentials]:
        authorization: str = request.headers.get("Authorization")
        scheme, credentials = get_authorization_scheme_param(authorization)
        if not (authorization and scheme and credentials):
            return None
        if scheme.lower() != "bearer":
            return None
        return HTTPAuthorizationCredentials(scheme=scheme, credentials=credentials)

security_optional = OptionalHTTPBearer()


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create a non-expiring JWT access token with unique identifier."""
    to_encode = data.copy()
    
    # Add unique token ID for blacklist functionality
    token_id = str(uuid.uuid4())
    to_encode.update({"jti": token_id, "iat": int(datetime.utcnow().timestamp())})
    
    # Note: No expiration time set - tokens are non-expiring as per requirements
    # Only way to invalidate is through logout (blacklist)
    
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def blacklist_token(token: str):
    """Add token to blacklist for logout functionality."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        token_id = payload.get("jti")
        if token_id:
            blacklisted_tokens.add(token_id)
    except JWTError:
        pass  # Invalid token, ignore


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> User:
    """Get the current authenticated user."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        token_id: str = payload.get("jti")
        
        # Check if token is blacklisted
        if token_id in blacklisted_tokens:
            raise credentials_exception
        
        if username is None:
            raise credentials_exception
            
    except JWTError:
        raise credentials_exception
    
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_exception
    
    return user


async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_optional),
    db: AsyncSession = Depends(get_db)
) -> Optional[User]:
    """Get current user if token is provided, otherwise return None."""
    if not credentials:
        return None
    
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        token_id: str = payload.get("jti")
        
        if username is None:
            return None
            
        # Check if token is blacklisted
        if token_id in blacklisted_tokens:
            return None
    except JWTError:
        return None
    
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    return user