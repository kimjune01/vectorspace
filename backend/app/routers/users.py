from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func
from typing import Optional, List
from app.database import get_db
from app.models import User, Conversation, Follow, Notification
from app.auth import get_current_user, get_current_user_optional
from app.schemas.social import (
    FollowCreate, FollowResponse, UserFollowStats, 
    FollowerResponse, PaginatedFollowersResponse, PaginatedFollowingResponse
)
from app.schemas.user import UserProfileResponse, UpdateProfileRequest
from app.services.user_service import UserService
import logging

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/profile/{username}")
async def get_user_profile(
    username: str,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    """
    Get public user profile by username.
    
    - Shows display name (not username)
    - Shows up to 10 recent conversations (respecting hidden flag)
    - Shows user statistics
    - Shows bio and profile image/stripe pattern
    - PII is filtered from conversation summaries
    """
    try:
        user_service = UserService(db)
        profile = await user_service.get_user_profile(username, current_user)
        
        if not profile:
            raise HTTPException(status_code=404, detail="User not found")
        
        return profile
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting user profile: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve user profile")


@router.get("/me")
async def get_current_user_info(
    current_user: User = Depends(get_current_user)
):
    """
    Get basic info about the current authenticated user.
    
    - Lightweight endpoint for auth verification
    - Returns only essential user data
    """
    return {
        "id": current_user.id,
        "username": current_user.username,
        "display_name": current_user.display_name,
        "email": current_user.email,
        "bio": current_user.bio,
        "created_at": current_user.created_at.isoformat()
    }


@router.get("/me/profile")
async def get_my_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get current user's own profile.
    
    - Includes all conversations (including hidden ones)
    - Shows actual username
    - Allows user to see their own hidden conversations
    """
    try:
        user_service = UserService(db)
        
        # Get user stats with correct conversation count
        stats = await user_service._get_user_stats(current_user.id)
        
        # Get all conversations for the user (including hidden)
        conversations_result = await db.execute(
            select(Conversation)
            .where(Conversation.user_id == current_user.id)
            .order_by(desc(Conversation.created_at))
            .limit(10)
        )
        conversations = conversations_result.scalars().all()
        
        # Format conversations with hidden status
        recent_conversations = []
        for conv in conversations:
            conv_data = {
                "id": conv.id,
                "title": conv.title,
                "created_at": conv.created_at.isoformat(),
                "view_count": conv.view_count,
                "is_archived": conv.is_archived(),
                "is_public": conv.is_public,
                "is_hidden_from_profile": conv.is_hidden_from_profile
            }
            
            # Include raw summary for own profile (not PII-filtered)
            if conv.summary_raw:
                conv_data["summary"] = conv.summary_raw
            elif conv.summary_public:
                conv_data["summary"] = conv.summary_public
            
            recent_conversations.append(conv_data)
        
        return {
            "username": current_user.username,
            "display_name": current_user.display_name,
            "email": current_user.email,  # Only shown to self
            "bio": current_user.bio,
            "profile_image_url": current_user.profile_image_url,
            "profile_image_data": current_user.profile_image_data,
            "stripe_pattern_seed": current_user.stripe_pattern_seed,
            "conversation_count": stats.conversation_count,
            "conversations_last_24h": stats.conversations_last_24h,
            "created_at": current_user.created_at.isoformat(),
            "recent_conversations": recent_conversations
        }
        
    except Exception as e:
        logger.error(f"Error getting own profile: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve profile")


@router.put("/me/profile")
async def update_my_profile(
    profile_update: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update current user's profile.
    
    - Can update bio (max 200 characters)
    - Can update display_name
    - Cannot update username or email here
    """
    try:
        # Update bio if provided
        if profile_update.bio is not None:
            if len(profile_update.bio) > 200:
                raise HTTPException(
                    status_code=400, 
                    detail="Bio must be 200 characters or less"
                )
            current_user.bio = profile_update.bio
        
        # Update display name if provided
        if profile_update.display_name is not None:
            if not profile_update.display_name.strip():
                raise HTTPException(
                    status_code=400,
                    detail="Display name cannot be empty"
                )
            if len(profile_update.display_name) > 100:
                raise HTTPException(
                    status_code=400,
                    detail="Display name must be 100 characters or less"
                )
            current_user.display_name = profile_update.display_name.strip()
        
        await db.commit()
        
        return {
            "message": "Profile updated successfully",
            "display_name": current_user.display_name,
            "bio": current_user.bio
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating profile: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update profile")


@router.get("/me/conversations")
async def get_my_conversations(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=50, description="Conversations per page"),
    include_hidden: bool = Query(False, description="Include hidden conversations"),
    include_private: bool = Query(False, description="Include private conversations"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get current user's conversations with pagination.
    
    - Supports filtering by hidden/private status
    - Includes full conversation details for user's own conversations
    """
    try:
        offset = (page - 1) * limit
        
        # Build query filters
        filters = [Conversation.user_id == current_user.id]
        
        if not include_hidden:
            filters.append(Conversation.is_hidden_from_profile == False)
        
        if not include_private:
            filters.append(Conversation.is_public == True)
        
        # Get conversations with count
        conversations_result = await db.execute(
            select(Conversation)
            .where(*filters)
            .order_by(desc(Conversation.created_at))
            .offset(offset)
            .limit(limit)
        )
        conversations = conversations_result.scalars().all()
        
        # Get total count
        total_result = await db.execute(
            select(func.count(Conversation.id))
            .where(*filters)
        )
        total_count = total_result.scalar()
        
        # Format conversations
        formatted_conversations = []
        for conv in conversations:
            conv_data = {
                "id": conv.id,
                "title": conv.title,
                "created_at": conv.created_at.isoformat(),
                "last_message_at": conv.last_message_at.isoformat() if conv.last_message_at else None,
                "token_count": conv.token_count,
                "view_count": conv.view_count,
                "is_archived": conv.is_archived(),
                "is_public": conv.is_public,
                "is_hidden_from_profile": conv.is_hidden_from_profile
            }
            
            # Include raw summary for own conversations
            if conv.summary_raw:
                conv_data["summary"] = conv.summary_raw
            
            formatted_conversations.append(conv_data)
        
        return {
            "conversations": formatted_conversations,
            "pagination": {
                "page": page,
                "limit": limit,
                "total_count": total_count,
                "total_pages": (total_count + limit - 1) // limit,
                "has_more": offset + len(conversations) < total_count
            }
        }
        
    except Exception as e:
        logger.error(f"Error getting user conversations: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve conversations")


@router.put("/me/conversations/{conversation_id}/visibility")
async def update_conversation_visibility(
    conversation_id: int,
    is_hidden: bool = Query(..., description="Hide from profile"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update conversation visibility on user's profile.
    
    - Can hide/show conversations from public profile
    - Only affects profile display, not search results
    """
    try:
        # Get conversation and verify ownership
        conversation_result = await db.execute(
            select(Conversation).where(
                Conversation.id == conversation_id,
                Conversation.user_id == current_user.id
            )
        )
        conversation = conversation_result.scalar_one_or_none()
        
        if not conversation:
            raise HTTPException(
                status_code=404,
                detail="Conversation not found or not owned by user"
            )
        
        # Update visibility
        conversation.is_hidden_from_profile = is_hidden
        await db.commit()
        
        return {
            "message": f"Conversation {'hidden from' if is_hidden else 'shown on'} profile",
            "conversation_id": conversation_id,
            "is_hidden_from_profile": is_hidden
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating conversation visibility: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update conversation visibility")


@router.get("/stats")
async def get_user_stats():
    """
    Get overall user statistics.
    
    - Total registered users
    - Active users (users with conversations in last 24h)
    - Public for discovery
    """
    try:
        from app.database import get_db
        
        async for db in get_db():
            # Total users
            total_users_result = await db.execute(
                select(func.count(User.id))
            )
            total_users = total_users_result.scalar()
            
            # Active users (with conversations in last 24h)
            active_users_result = await db.execute(
                select(func.count(User.id))
                .where(User.conversations_last_24h > 0)
            )
            active_users = active_users_result.scalar()
            
            # Users with public conversations
            users_with_public_convs_result = await db.execute(
                select(func.count(func.distinct(Conversation.user_id)))
                .where(Conversation.is_public == True)
            )
            users_with_public_convs = users_with_public_convs_result.scalar()
            
            break
        
        return {
            "total_users": total_users,
            "active_users_last_24h": active_users,
            "users_with_public_conversations": users_with_public_convs,
            "user_features": {
                "public_profiles": True,
                "conversation_hiding": True,
                "profile_images": True,
                "stripe_patterns": True
            }
        }
        
    except Exception as e:
        logger.error(f"Error getting user stats: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve user statistics")


@router.post("/me/profile-image")
async def upload_profile_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Upload and process profile image.
    
    - Accepts JPEG, PNG, WEBP, GIF formats
    - Automatically resizes to 128x128 thumbnail
    - Stores as base64 in database
    - Max file size: 5MB
    """
    try:
        from app.services.image_service import image_service
        
        # Read file data
        file_data = await file.read()
        
        # Validate file type
        if not file.content_type or not file.content_type.startswith("image/"):
            raise HTTPException(
                status_code=400,
                detail="File must be an image (JPEG, PNG, WEBP, or GIF)"
            )
        
        # Process image to base64 thumbnail
        base64_thumbnail = image_service.process_profile_image(file_data)
        
        if not base64_thumbnail:
            raise HTTPException(
                status_code=400,
                detail="Failed to process image. Please check format and size (max 5MB)."
            )
        
        # Update user profile
        current_user.profile_image_data = base64_thumbnail
        current_user.profile_image_url = None  # Clear URL if using base64
        
        await db.commit()
        
        # Get image info for response
        image_info = image_service.get_image_info(base64_thumbnail)
        
        return {
            "message": "Profile image uploaded successfully",
            "image_info": image_info,
            "thumbnail_size": "128x128"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading profile image: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to upload profile image")


@router.delete("/me/profile-image")
async def delete_profile_image(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete current user's profile image.
    
    - Removes both base64 data and URL
    - User will fall back to stripe pattern
    """
    try:
        current_user.profile_image_data = None
        current_user.profile_image_url = None
        
        await db.commit()
        
        return {
            "message": "Profile image deleted successfully",
            "fallback": "stripe_pattern"
        }
        
    except Exception as e:
        logger.error(f"Error deleting profile image: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to delete profile image")


@router.get("/me/stripe-pattern")
async def get_stripe_pattern(
    current_user: User = Depends(get_current_user)
):
    """
    Generate stripe pattern for user.
    
    - Returns base64 data URL of generated stripe pattern
    - Based on user's stripe_pattern_seed for consistency
    """
    try:
        from app.services.image_service import image_service
        
        stripe_data_url = image_service.generate_stripe_pattern_data_url(
            current_user.stripe_pattern_seed
        )
        
        return {
            "stripe_pattern": stripe_data_url,
            "seed": current_user.stripe_pattern_seed,
            "size": "128x128"
        }
        
    except Exception as e:
        logger.error(f"Error generating stripe pattern: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate stripe pattern")


# ========================================
# FOLLOW SYSTEM ENDPOINTS
# ========================================

@router.post("/{user_id}/follow")
async def follow_user(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Follow a user.
    
    - Cannot follow yourself
    - Creates follow relationship if not already following
    - Creates notification for the followed user
    """
    try:
        if user_id == current_user.id:
            raise HTTPException(
                status_code=400,
                detail="Cannot follow yourself"
            )
        
        # Check if target user exists
        target_user_result = await db.execute(
            select(User).where(User.id == user_id)
        )
        target_user = target_user_result.scalar_one_or_none()
        
        if not target_user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Check if already following
        existing_follow_result = await db.execute(
            select(Follow).where(
                Follow.follower_id == current_user.id,
                Follow.following_id == user_id
            )
        )
        existing_follow = existing_follow_result.scalar_one_or_none()
        
        if existing_follow:
            raise HTTPException(
                status_code=400,
                detail="Already following this user"
            )
        
        # Create follow relationship
        follow = Follow(
            follower_id=current_user.id,
            following_id=user_id
        )
        db.add(follow)
        
        # Create notification for followed user
        notification = Notification(
            user_id=user_id,
            type="follow",
            title="New Follower",
            content=f"{current_user.display_name} started following you",
            related_user_id=current_user.id
        )
        db.add(notification)
        
        await db.commit()
        await db.refresh(follow)
        
        return FollowResponse(
            id=follow.id,
            follower_id=follow.follower_id,
            following_id=follow.following_id,
            created_at=follow.created_at
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error following user: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to follow user")


@router.delete("/{user_id}/follow")
async def unfollow_user(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Unfollow a user.
    
    - Removes follow relationship if it exists
    - No error if not following
    """
    try:
        # Find and delete follow relationship
        follow_result = await db.execute(
            select(Follow).where(
                Follow.follower_id == current_user.id,
                Follow.following_id == user_id
            )
        )
        follow = follow_result.scalar_one_or_none()
        
        if follow:
            await db.delete(follow)
            await db.commit()
        
        return {"message": "Successfully unfollowed user"}
        
    except Exception as e:
        logger.error(f"Error unfollowing user: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to unfollow user")


@router.get("/{user_id}/followers")
async def get_user_followers(
    user_id: int,
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(20, ge=1, le=100, description="Items per page"),
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    """
    Get user's followers list.
    
    - Public endpoint (no auth required)
    - Returns follower user info with follow timestamp
    - Paginated results
    """
    try:
        # Check if user exists
        user_result = await db.execute(
            select(User).where(User.id == user_id)
        )
        user = user_result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        offset = (page - 1) * per_page
        
        # Get followers with user info
        followers_result = await db.execute(
            select(Follow, User)
            .join(User, Follow.follower_id == User.id)
            .where(Follow.following_id == user_id)
            .order_by(desc(Follow.created_at))
            .offset(offset)
            .limit(per_page)
        )
        followers_data = followers_result.all()
        
        # Get total count
        total_result = await db.execute(
            select(func.count(Follow.id))
            .where(Follow.following_id == user_id)
        )
        total_count = total_result.scalar()
        
        # Format response
        followers = []
        for follow, follower_user in followers_data:
            followers.append(FollowerResponse(
                id=follower_user.id,
                username=follower_user.username,
                display_name=follower_user.display_name,
                bio=follower_user.bio,
                profile_image_data=follower_user.profile_image_data,
                stripe_pattern_seed=follower_user.stripe_pattern_seed,
                followed_at=follow.created_at
            ))
        
        return PaginatedFollowersResponse(
            followers=followers,
            total=total_count,
            page=page,
            per_page=per_page,
            has_next=offset + len(followers) < total_count,
            has_prev=page > 1
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting followers: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve followers")


@router.get("/{user_id}/following")
async def get_user_following(
    user_id: int,
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(20, ge=1, le=100, description="Items per page"),
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    """
    Get list of users this user is following.
    
    - Public endpoint (no auth required)
    - Returns following user info with follow timestamp
    - Paginated results
    """
    try:
        # Check if user exists
        user_result = await db.execute(
            select(User).where(User.id == user_id)
        )
        user = user_result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        offset = (page - 1) * per_page
        
        # Get following with user info
        following_result = await db.execute(
            select(Follow, User)
            .join(User, Follow.following_id == User.id)
            .where(Follow.follower_id == user_id)
            .order_by(desc(Follow.created_at))
            .offset(offset)
            .limit(per_page)
        )
        following_data = following_result.all()
        
        # Get total count
        total_result = await db.execute(
            select(func.count(Follow.id))
            .where(Follow.follower_id == user_id)
        )
        total_count = total_result.scalar()
        
        # Format response
        following = []
        for follow, following_user in following_data:
            following.append(FollowerResponse(
                id=following_user.id,
                username=following_user.username,
                display_name=following_user.display_name,
                bio=following_user.bio,
                profile_image_data=following_user.profile_image_data,
                stripe_pattern_seed=following_user.stripe_pattern_seed,
                followed_at=follow.created_at
            ))
        
        return PaginatedFollowingResponse(
            following=following,
            total=total_count,
            page=page,
            per_page=per_page,
            has_next=offset + len(following) < total_count,
            has_prev=page > 1
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting following: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve following")


@router.get("/{user_id}/follow-stats")
async def get_user_follow_stats(
    user_id: int,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    """
    Get user's follow statistics.
    
    - Returns follower and following counts
    - Public endpoint (no auth required)
    """
    try:
        # Check if user exists
        user_result = await db.execute(
            select(User).where(User.id == user_id)
        )
        user = user_result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Get follower count
        followers_count_result = await db.execute(
            select(func.count(Follow.id))
            .where(Follow.following_id == user_id)
        )
        followers_count = followers_count_result.scalar()
        
        # Get following count
        following_count_result = await db.execute(
            select(func.count(Follow.id))
            .where(Follow.follower_id == user_id)
        )
        following_count = following_count_result.scalar()
        
        return UserFollowStats(
            followers_count=followers_count,
            following_count=following_count
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting follow stats: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve follow stats")


@router.get("/me/is-following/{user_id}")
async def check_if_following(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Check if current user is following a specific user.
    
    - Returns boolean indicating follow status
    - Requires authentication
    """
    try:
        follow_result = await db.execute(
            select(Follow).where(
                Follow.follower_id == current_user.id,
                Follow.following_id == user_id
            )
        )
        follow = follow_result.scalar_one_or_none()
        
        return {"is_following": follow is not None}
        
    except Exception as e:
        logger.error(f"Error checking follow status: {e}")
        raise HTTPException(status_code=500, detail="Failed to check follow status")