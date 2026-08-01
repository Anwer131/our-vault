import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / '.env')

from sqlalchemy import Column, String, Text, Integer, Boolean, DateTime, ForeignKey, UniqueConstraint, Float
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

Base = declarative_base()

def now_utc():
    return datetime.now(timezone.utc)

def uid():
    return str(uuid.uuid4())


class Space(Base):
    __tablename__ = "spaces"
    id = Column(String, primary_key=True, default=uid)
    name = Column(String, nullable=False)
    max_members = Column(Integer, nullable=False)
    created_by = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), default=now_utc)


class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, default=uid)
    username = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False)  # 'superadmin' or 'member'
    space_id = Column(String, ForeignKey("spaces.id", ondelete="CASCADE"), nullable=True)
    name = Column(String, default="")
    mobile = Column(String, default="")
    avatar_url = Column(String, default="")
    must_change_password = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=now_utc)


class Nickname(Base):
    __tablename__ = "nicknames"
    id = Column(String, primary_key=True, default=uid)
    owner_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    target_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    nickname = Column(String, nullable=False)
    __table_args__ = (UniqueConstraint("owner_id", "target_id", name="uq_nickname_pair"),)


class Media(Base):
    __tablename__ = "media"
    id = Column(String, primary_key=True, default=uid)
    space_id = Column(String, ForeignKey("spaces.id", ondelete="CASCADE"), nullable=False, index=True)
    uploader_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    public_id = Column(String, nullable=False)
    secure_url = Column(String, nullable=False)
    resource_type = Column(String, default="image")
    format = Column(String, nullable=True)
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    duration = Column(Float, nullable=True)
    caption = Column(String, nullable=True)
    is_ai = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=now_utc)


class Message(Base):
    __tablename__ = "messages"
    id = Column(String, primary_key=True, default=uid)
    space_id = Column(String, ForeignKey("spaces.id", ondelete="CASCADE"), nullable=False, index=True)
    sender_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    text = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=now_utc)


engine = create_async_engine(os.environ["DATABASE_URL"], pool_pre_ping=True, pool_size=5, max_overflow=5)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
