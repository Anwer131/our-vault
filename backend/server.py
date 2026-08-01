from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import time
import random
import string
import logging
import base64
from pathlib import Path
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone, timedelta

import bcrypt
import jwt
import cloudinary
import cloudinary.uploader
from cloudinary.utils import api_sign_request
from google import genai
from google.genai import types
import httpx

from sqlalchemy import select, delete, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from db import init_db, SessionLocal, Space, User, Nickname, Media, Message, uid

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

cloudinary.config(
    cloud_name=os.environ['CLOUDINARY_CLOUD_NAME'],
    api_key=os.environ['CLOUDINARY_API_KEY'],
    api_secret=os.environ['CLOUDINARY_API_SECRET'],
    secure=True,
)

GEMINI_API_KEY = os.environ['GEMINI_API_KEY']
JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALG = "HS256"

app = FastAPI()
api = APIRouter(prefix="/api")

# ============ Slug generation ============
SLUG_WORDS = [
    "sun", "moon", "star", "sky", "leaf", "rain", "wave", "fern", "rose", "sage",
    "pine", "oak", "dawn", "dusk", "mist", "lake", "reed", "wren", "lark", "opal",
    "jade", "coral", "amber", "ivy", "cove", "isle", "pearl", "cloud", "brook", "vale",
]

async def unique_slug(db: AsyncSession) -> str:
    for _ in range(50):
        s = f"{random.choice(SLUG_WORDS)}-{random.randint(10, 99)}"
        exists = await db.scalar(select(User).where(User.username == s))
        if not exists:
            return s
    return f"user-{uid()[:8]}"

def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def verify_pw(pw: str, hashed: str) -> bool:
    try: return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception: return False

def make_token(user_id: str) -> str:
    return jwt.encode({"sub": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=30)}, JWT_SECRET, algorithm=JWT_ALG)

async def get_db():
    async with SessionLocal() as s:
        yield s

async def current_user(authorization: Optional[str] = Header(None), db: AsyncSession = Depends(get_db)) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Not authenticated")
    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except Exception:
        raise HTTPException(401, "Invalid token")
    user = await db.get(User, payload["sub"])
    if not user:
        raise HTTPException(401, "User not found")
    return user

async def require_admin(user: User = Depends(current_user)) -> User:
    if user.role != "superadmin":
        raise HTTPException(403, "Superadmin only")
    return user

async def require_member(user: User = Depends(current_user)) -> User:
    if user.role != "member" or not user.space_id:
        raise HTTPException(403, "Members only")
    return user

def user_dict(u: User, nickname: Optional[str] = None, space_name: Optional[str] = None) -> dict:
    return {
        "id": u.id, "username": u.username, "role": u.role, "space_id": u.space_id,
        "name": u.name or "", "mobile": u.mobile or "", "avatar_url": u.avatar_url or "",
        "must_change_password": u.must_change_password,
        "nickname": nickname or "",
        "space_name": space_name or "",
    }

# ============ Models ============
class LoginIn(BaseModel):
    username: str
    password: str

class ChangePasswordIn(BaseModel):
    old_password: str
    new_password: str

class ProfileUpdateIn(BaseModel):
    name: Optional[str] = None
    mobile: Optional[str] = None
    avatar_url: Optional[str] = None

class NicknameIn(BaseModel):
    target_id: str
    nickname: str

class SpaceCreateIn(BaseModel):
    name: str
    max_members: int

class MediaItemIn(BaseModel):
    public_id: str
    secure_url: str
    resource_type: str
    format: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None
    duration: Optional[float] = None
    caption: Optional[str] = None

class ChatMessageIn(BaseModel):
    text: str

class AIGenerateIn(BaseModel):
    prompt: str
    media_ids: List[str]

class DeleteManyIn(BaseModel):
    ids: List[str]

# ============ Seed superadmin ============
async def seed_superadmin():
    async with SessionLocal() as db:
        existing = await db.scalar(select(User).where(User.username == "admin"))
        if not existing:
            admin = User(
                id=uid(), username="admin", password_hash=hash_pw("admin123"),
                role="superadmin", space_id=None, must_change_password=True,
            )
            db.add(admin)
            await db.commit()

# ============ Auth ============
@api.get("/")
async def root():
    return {"message": "OurSpace API"}

@api.post("/auth/login")
async def login(body: LoginIn, db: AsyncSession = Depends(get_db)):
    user = await db.scalar(select(User).where(User.username == body.username))
    if not user or not verify_pw(body.password, user.password_hash):
        raise HTTPException(401, "Invalid credentials")
    space_name = None
    if user.space_id:
        sp = await db.get(Space, user.space_id)
        if sp: space_name = sp.name
    token = make_token(user.id)
    return {"token": token, "user": user_dict(user, space_name=space_name)}

@api.get("/auth/me")
async def me(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    space_name = None
    if user.space_id:
        sp = await db.get(Space, user.space_id)
        if sp: space_name = sp.name
    return user_dict(user, space_name=space_name)

@api.post("/auth/change-password")
async def change_password(body: ChangePasswordIn, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    if not verify_pw(body.old_password, user.password_hash):
        raise HTTPException(400, "Old password incorrect")
    if len(body.new_password) < 6:
        raise HTTPException(400, "Password too short (min 6)")
    user.password_hash = hash_pw(body.new_password)
    user.must_change_password = False
    await db.commit()
    return {"ok": True}

# ============ Profile ============
@api.patch("/users/me")
async def update_profile(body: ProfileUpdateIn, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    data = {k: v for k, v in body.model_dump().items() if v is not None}
    for k, v in data.items():
        setattr(user, k, v)
    await db.commit()
    return user_dict(user)

@api.get("/space/members")
async def list_space_members(user: User = Depends(require_member), db: AsyncSession = Depends(get_db)):
    members = (await db.scalars(select(User).where(User.space_id == user.space_id))).all()
    nickmap = {n.target_id: n.nickname for n in (await db.scalars(select(Nickname).where(Nickname.owner_id == user.id))).all()}
    return [user_dict(m, nickname=nickmap.get(m.id)) for m in members]

@api.post("/nicknames")
async def set_nickname(body: NicknameIn, user: User = Depends(require_member), db: AsyncSession = Depends(get_db)):
    if body.target_id == user.id:
        raise HTTPException(400, "Cannot set nickname for yourself")
    target = await db.get(User, body.target_id)
    if not target or target.space_id != user.space_id:
        raise HTTPException(404, "Target not found in your space")
    existing = await db.scalar(select(Nickname).where(and_(Nickname.owner_id == user.id, Nickname.target_id == body.target_id)))
    if existing:
        if body.nickname.strip():
            existing.nickname = body.nickname.strip()
        else:
            await db.delete(existing)
    else:
        if body.nickname.strip():
            db.add(Nickname(id=uid(), owner_id=user.id, target_id=body.target_id, nickname=body.nickname.strip()))
    await db.commit()
    return {"ok": True}

# ============ Superadmin: spaces ============
@api.get("/spaces")
async def list_spaces(admin: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    spaces = (await db.scalars(select(Space).order_by(Space.created_at.desc()))).all()
    result = []
    for s in spaces:
        member_count = await db.scalar(select(User.id).where(User.space_id == s.id).with_only_columns(User.id))
        members = (await db.scalars(select(User).where(User.space_id == s.id))).all()
        result.append({
            "id": s.id, "name": s.name, "max_members": s.max_members,
            "created_at": s.created_at.isoformat() if s.created_at else None,
            "member_count": len(members),
            "members": [{"id": m.id, "username": m.username, "name": m.name, "must_change_password": m.must_change_password} for m in members],
        })
    return result

@api.post("/spaces")
async def create_space(body: SpaceCreateIn, admin: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    if not body.name.strip():
        raise HTTPException(400, "Space name required")
    if body.max_members < 1 or body.max_members > 50:
        raise HTTPException(400, "max_members must be between 1 and 50")
    sp = Space(id=uid(), name=body.name.strip(), max_members=body.max_members, created_by=admin.id)
    db.add(sp)
    creds = []
    for _ in range(body.max_members):
        u_name = await unique_slug(db)
        pw = "welcome123"
        u = User(
            id=uid(), username=u_name, password_hash=hash_pw(pw),
            role="member", space_id=sp.id, must_change_password=True,
        )
        db.add(u)
        creds.append({"username": u_name, "password": pw})
    await db.commit()
    return {
        "id": sp.id, "name": sp.name, "max_members": sp.max_members,
        "created_at": sp.created_at.isoformat() if sp.created_at else None,
        "members": creds,
    }

@api.delete("/spaces/{space_id}")
async def delete_space(space_id: str, admin: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    sp = await db.get(Space, space_id)
    if not sp:
        raise HTTPException(404, "Space not found")
    media_items = (await db.scalars(select(Media).where(Media.space_id == space_id))).all()
    for m in media_items:
        try:
            cloudinary.uploader.destroy(m.public_id, resource_type=m.resource_type, invalidate=True)
        except Exception as e:
            logging.warning(f"Cloudinary destroy failed: {e}")
    await db.execute(delete(Message).where(Message.space_id == space_id))
    await db.execute(delete(Media).where(Media.space_id == space_id))
    member_ids = [u.id for u in (await db.scalars(select(User).where(User.space_id == space_id))).all()]
    if member_ids:
        await db.execute(delete(Nickname).where(or_(Nickname.owner_id.in_(member_ids), Nickname.target_id.in_(member_ids))))
    await db.execute(delete(User).where(User.space_id == space_id))
    await db.delete(sp)
    await db.commit()
    return {"ok": True}

# ============ Cloudinary signature ============
@api.post("/cloudinary/signature")
async def cloudinary_signature(user: User = Depends(current_user)):
    timestamp = int(time.time())
    folder = f"ourspace/{user.space_id or 'admin'}"
    params = {"timestamp": timestamp, "folder": folder}
    signature = api_sign_request(params, os.environ['CLOUDINARY_API_SECRET'])
    return {
        "cloud_name": os.environ['CLOUDINARY_CLOUD_NAME'],
        "api_key": os.environ['CLOUDINARY_API_KEY'],
        "timestamp": timestamp,
        "signature": signature,
        "folder": folder,
    }

# ============ Media (space-scoped) ============
def media_dict(m: Media) -> dict:
    return {
        "id": m.id, "space_id": m.space_id, "uploader_id": m.uploader_id,
        "public_id": m.public_id, "secure_url": m.secure_url,
        "resource_type": m.resource_type, "format": m.format,
        "width": m.width, "height": m.height, "duration": m.duration,
        "caption": m.caption, "is_ai": m.is_ai,
        "created_at": m.created_at.isoformat() if m.created_at else None,
    }

@api.post("/media")
async def save_media(items: List[MediaItemIn], user: User = Depends(require_member), db: AsyncSession = Depends(get_db)):
    ids = []
    for it in items:
        m = Media(
            id=uid(), space_id=user.space_id, uploader_id=user.id,
            public_id=it.public_id, secure_url=it.secure_url,
            resource_type=it.resource_type, format=it.format,
            width=it.width, height=it.height, duration=it.duration, caption=it.caption,
        )
        db.add(m)
        ids.append(m.id)
    await db.commit()
    return {"inserted": len(ids), "ids": ids}

@api.get("/media")
async def list_media(user: User = Depends(require_member), db: AsyncSession = Depends(get_db)):
    items = (await db.scalars(select(Media).where(Media.space_id == user.space_id).order_by(Media.created_at.desc()))).all()
    return [media_dict(m) for m in items]

@api.delete("/media/{media_id}")
async def delete_media(media_id: str, user: User = Depends(require_member), db: AsyncSession = Depends(get_db)):
    m = await db.get(Media, media_id)
    if not m or m.space_id != user.space_id:
        raise HTTPException(404, "Not found")
    try:
        cloudinary.uploader.destroy(m.public_id, resource_type=m.resource_type, invalidate=True)
    except Exception as e:
        logging.warning(f"Cloudinary destroy failed: {e}")
    await db.delete(m)
    await db.commit()
    return {"ok": True}

@api.post("/media/delete-many")
async def delete_many(body: DeleteManyIn, user: User = Depends(require_member), db: AsyncSession = Depends(get_db)):
    items = (await db.scalars(select(Media).where(and_(Media.space_id == user.space_id, Media.id.in_(body.ids))))).all()
    for m in items:
        try:
            cloudinary.uploader.destroy(m.public_id, resource_type=m.resource_type, invalidate=True)
        except Exception as e:
            logging.warning(f"Cloudinary destroy failed: {e}")
        await db.delete(m)
    await db.commit()
    return {"ok": True, "deleted": len(items)}

# ============ Chat (space-scoped) ============
def message_dict(m: Message, sender_username: str = "") -> dict:
    return {
        "id": m.id, "space_id": m.space_id, "sender_id": m.sender_id,
        "sender_username": sender_username,
        "text": m.text,
        "created_at": m.created_at.isoformat() if m.created_at else None,
    }

@api.post("/chat/messages")
async def send_message(body: ChatMessageIn, user: User = Depends(require_member), db: AsyncSession = Depends(get_db)):
    m = Message(id=uid(), space_id=user.space_id, sender_id=user.id, text=body.text)
    db.add(m)
    await db.commit()
    await db.refresh(m)
    return message_dict(m, sender_username=user.username)

@api.get("/chat/messages")
async def list_messages(user: User = Depends(require_member), db: AsyncSession = Depends(get_db)):
    rows = (await db.scalars(select(Message).where(Message.space_id == user.space_id).order_by(Message.created_at.asc()))).all()
    # Get sender usernames
    sender_ids = list({r.sender_id for r in rows if r.sender_id})
    sender_map = {}
    if sender_ids:
        senders = (await db.scalars(select(User).where(User.id.in_(sender_ids)))).all()
        sender_map = {s.id: s.username for s in senders}
    return [message_dict(m, sender_username=sender_map.get(m.sender_id, "")) for m in rows]

# ============ AI ============
@api.post("/ai/generate")
async def ai_generate(body: AIGenerateIn, user: User = Depends(require_member), db: AsyncSession = Depends(get_db)):
    if not body.prompt.strip():
        raise HTTPException(400, "Prompt required")
    media_items = (await db.scalars(select(Media).where(and_(Media.space_id == user.space_id, Media.id.in_(body.media_ids))))).all()
    image_parts = []
    async with httpx.AsyncClient(timeout=30) as http:
        for m in media_items:
            if m.resource_type != "image":
                continue
            try:
                r = await http.get(m.secure_url)
                r.raise_for_status()
                image_parts.append(types.Part.from_bytes(data=r.content, mime_type=f"image/{m.format or 'jpeg'}"))
            except Exception as e:
                logging.warning(f"Failed to fetch image: {e}")

    try:
        gclient = genai.Client(api_key=GEMINI_API_KEY)
        contents = [body.prompt] + image_parts
        response = gclient.models.generate_content(model="gemini-2.5-flash-image", contents=contents)
    except Exception as e:
        logging.error(f"Gemini error: {e}")
        raise HTTPException(500, f"AI generation failed: {str(e)[:200]}")

    generated_b64 = None
    for part in response.candidates[0].content.parts:
        if getattr(part, 'inline_data', None) and part.inline_data.data:
            generated_b64 = base64.b64encode(part.inline_data.data).decode()
            break

    if not generated_b64:
        raise HTTPException(500, "No image was generated. Try a different prompt.")

    try:
        upload_res = cloudinary.uploader.upload(
            f"data:image/png;base64,{generated_b64}",
            folder=f"ourspace/{user.space_id}/ai",
            resource_type="image",
        )
    except Exception as e:
        logging.error(f"Cloudinary upload failed: {e}")
        raise HTTPException(500, "Failed to save generated image")

    m = Media(
        id=uid(), space_id=user.space_id, uploader_id=user.id,
        public_id=upload_res["public_id"], secure_url=upload_res["secure_url"],
        resource_type="image", format=upload_res.get("format"),
        width=upload_res.get("width"), height=upload_res.get("height"),
        caption=f"AI: {body.prompt[:80]}", is_ai=True,
    )
    db.add(m)
    await db.commit()
    return {"id": m.id, "secure_url": m.secure_url, "caption": m.caption}


app.include_router(api)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def on_start():
    await init_db()
    await seed_superadmin()
    logger.info("OurSpace API started")
