from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import time
import logging
import base64
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
import cloudinary
import cloudinary.uploader
import cloudinary.api
from cloudinary.utils import api_sign_request
from google import genai
from google.genai import types

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Cloudinary
cloudinary.config(
    cloud_name=os.environ['CLOUDINARY_CLOUD_NAME'],
    api_key=os.environ['CLOUDINARY_API_KEY'],
    api_secret=os.environ['CLOUDINARY_API_SECRET'],
    secure=True,
)

# Gemini
GEMINI_API_KEY = os.environ['GEMINI_API_KEY']
JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALG = "HS256"

app = FastAPI()
api = APIRouter(prefix="/api")

# ============ Models ============
class LoginIn(BaseModel):
    username: str
    password: str

class ChangePasswordIn(BaseModel):
    old_password: str
    new_password: str

class ProfileUpdateIn(BaseModel):
    name: Optional[str] = None
    nickname: Optional[str] = None
    mobile: Optional[str] = None
    avatar_url: Optional[str] = None

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

# ============ Helpers ============
def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def verify_pw(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False

def make_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=30),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)

async def current_user(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Not authenticated")
    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except Exception:
        raise HTTPException(401, "Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(401, "User not found")
    return user

async def seed_users():
    count = await db.users.count_documents({})
    if count == 0:
        defaults = [
            {"id": str(uuid.uuid4()), "username": "user1", "name": "User One",
             "nickname": "Sunny", "mobile": "", "avatar_url": "",
             "password_hash": hash_pw("changeme"), "must_change_password": True,
             "created_at": datetime.now(timezone.utc)},
            {"id": str(uuid.uuid4()), "username": "user2", "name": "User Two",
             "nickname": "Moon", "mobile": "", "avatar_url": "",
             "password_hash": hash_pw("changeme"), "must_change_password": True,
             "created_at": datetime.now(timezone.utc)},
        ]
        await db.users.insert_many(defaults)

# ============ Routes ============
@api.get("/")
async def root():
    return {"message": "DuoVault API"}

@api.post("/auth/login")
async def login(body: LoginIn):
    user = await db.users.find_one({"username": body.username})
    if not user or not verify_pw(body.password, user["password_hash"]):
        raise HTTPException(401, "Invalid credentials")
    token = make_token(user["id"])
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "username": user["username"],
            "name": user.get("name", ""),
            "nickname": user.get("nickname", ""),
            "mobile": user.get("mobile", ""),
            "avatar_url": user.get("avatar_url", ""),
            "must_change_password": user.get("must_change_password", False),
        }
    }

@api.get("/auth/me")
async def me(user=Depends(current_user)):
    return user

@api.post("/auth/change-password")
async def change_password(body: ChangePasswordIn, user=Depends(current_user)):
    doc = await db.users.find_one({"id": user["id"]})
    if not verify_pw(body.old_password, doc["password_hash"]):
        raise HTTPException(400, "Old password incorrect")
    if len(body.new_password) < 6:
        raise HTTPException(400, "Password too short (min 6)")
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"password_hash": hash_pw(body.new_password), "must_change_password": False}}
    )
    return {"ok": True}

@api.get("/users")
async def list_users(user=Depends(current_user)):
    docs = await db.users.find({}, {"_id": 0, "password_hash": 0, "must_change_password": 0}).to_list(10)
    return docs

@api.patch("/users/me")
async def update_profile(body: ProfileUpdateIn, user=Depends(current_user)):
    update = {k: v for k, v in body.model_dump().items() if v is not None}
    if update:
        await db.users.update_one({"id": user["id"]}, {"$set": update})
    doc = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0})
    return doc

# ---- Cloudinary signature ----
@api.post("/cloudinary/signature")
async def cloudinary_signature(user=Depends(current_user)):
    timestamp = int(time.time())
    folder = "duovault"
    params = {"timestamp": timestamp, "folder": folder}
    signature = api_sign_request(params, os.environ['CLOUDINARY_API_SECRET'])
    return {
        "cloud_name": os.environ['CLOUDINARY_CLOUD_NAME'],
        "api_key": os.environ['CLOUDINARY_API_KEY'],
        "timestamp": timestamp,
        "signature": signature,
        "folder": folder,
    }

# ---- Media ----
@api.post("/media")
async def save_media(items: List[MediaItemIn], user=Depends(current_user)):
    now = datetime.now(timezone.utc)
    docs = []
    for it in items:
        docs.append({
            "id": str(uuid.uuid4()),
            "owner_id": user["id"],
            "public_id": it.public_id,
            "secure_url": it.secure_url,
            "resource_type": it.resource_type,
            "format": it.format,
            "width": it.width,
            "height": it.height,
            "duration": it.duration,
            "caption": it.caption,
            "created_at": now,
        })
    if docs:
        await db.media.insert_many(docs)
    return {"inserted": len(docs), "ids": [d["id"] for d in docs]}

@api.get("/media")
async def list_media(user=Depends(current_user)):
    # Shared gallery - both users see all media
    cursor = db.media.find({}, {"_id": 0}).sort("created_at", -1)
    items = await cursor.to_list(500)
    for it in items:
        if isinstance(it.get("created_at"), datetime):
            it["created_at"] = it["created_at"].isoformat()
    return items

@api.delete("/media/{media_id}")
async def delete_media(media_id: str, user=Depends(current_user)):
    doc = await db.media.find_one({"id": media_id})
    if not doc:
        raise HTTPException(404, "Not found")
    try:
        rtype = doc.get("resource_type", "image")
        cloudinary.uploader.destroy(doc["public_id"], resource_type=rtype, invalidate=True)
    except Exception as e:
        logging.warning(f"Cloudinary destroy failed: {e}")
    await db.media.delete_one({"id": media_id})
    return {"ok": True}

@api.post("/media/delete-many")
async def delete_many(body: DeleteManyIn, user=Depends(current_user)):
    docs = await db.media.find({"id": {"$in": body.ids}}, {"_id": 0}).to_list(500)
    for d in docs:
        try:
            cloudinary.uploader.destroy(d["public_id"], resource_type=d.get("resource_type", "image"), invalidate=True)
        except Exception as e:
            logging.warning(f"Cloudinary destroy failed: {e}")
    await db.media.delete_many({"id": {"$in": body.ids}})
    return {"ok": True, "deleted": len(docs)}

# ---- Chat ----
@api.post("/chat/messages")
async def send_message(body: ChatMessageIn, user=Depends(current_user)):
    msg = {
        "id": str(uuid.uuid4()),
        "sender_id": user["id"],
        "sender_username": user["username"],
        "text": body.text,
        "created_at": datetime.now(timezone.utc),
    }
    await db.messages.insert_one(msg)
    msg["_id"] = None
    del msg["_id"]
    msg["created_at"] = msg["created_at"].isoformat()
    return msg

@api.get("/chat/messages")
async def list_messages(user=Depends(current_user)):
    docs = await db.messages.find({}, {"_id": 0}).sort("created_at", 1).to_list(500)
    for d in docs:
        if isinstance(d.get("created_at"), datetime):
            d["created_at"] = d["created_at"].isoformat()
    return docs

# ---- AI Image Generation ----
import httpx

@api.post("/ai/generate")
async def ai_generate(body: AIGenerateIn, user=Depends(current_user)):
    if not body.prompt.strip():
        raise HTTPException(400, "Prompt required")
    # Fetch selected media
    media_docs = await db.media.find({"id": {"$in": body.media_ids}}, {"_id": 0}).to_list(10)
    image_parts = []
    async with httpx.AsyncClient(timeout=30) as http:
        for m in media_docs:
            if m.get("resource_type") != "image":
                continue
            try:
                r = await http.get(m["secure_url"])
                r.raise_for_status()
                image_parts.append(types.Part.from_bytes(data=r.content, mime_type=f"image/{m.get('format','jpeg')}"))
            except Exception as e:
                logging.warning(f"Failed to fetch image: {e}")

    try:
        gclient = genai.Client(api_key=GEMINI_API_KEY)
        contents = [body.prompt] + image_parts
        response = gclient.models.generate_content(
            model="gemini-2.5-flash-image-preview",
            contents=contents,
        )
    except Exception as e:
        logging.error(f"Gemini error: {e}")
        raise HTTPException(500, f"AI generation failed: {str(e)[:200]}")

    # Extract generated image
    generated_b64 = None
    for part in response.candidates[0].content.parts:
        if getattr(part, 'inline_data', None) and part.inline_data.data:
            generated_b64 = base64.b64encode(part.inline_data.data).decode()
            break

    if not generated_b64:
        raise HTTPException(500, "No image was generated. Try a different prompt.")

    # Upload to Cloudinary
    try:
        upload_res = cloudinary.uploader.upload(
            f"data:image/png;base64,{generated_b64}",
            folder="duovault/ai",
            resource_type="image",
        )
    except Exception as e:
        logging.error(f"Cloudinary upload failed: {e}")
        raise HTTPException(500, "Failed to save generated image")

    # Save media record
    now = datetime.now(timezone.utc)
    doc = {
        "id": str(uuid.uuid4()),
        "owner_id": user["id"],
        "public_id": upload_res["public_id"],
        "secure_url": upload_res["secure_url"],
        "resource_type": "image",
        "format": upload_res.get("format"),
        "width": upload_res.get("width"),
        "height": upload_res.get("height"),
        "caption": f"AI: {body.prompt[:80]}",
        "is_ai": True,
        "created_at": now,
    }
    await db.media.insert_one(doc)
    return {
        "id": doc["id"],
        "secure_url": doc["secure_url"],
        "caption": doc["caption"],
    }

app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def on_start():
    await seed_users()
    logger.info("DuoVault API started")

@app.on_event("shutdown")
async def on_shutdown():
    client.close()
