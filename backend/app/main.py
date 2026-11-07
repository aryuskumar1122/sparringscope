# Replace backend/app/main.py with this version.
from __future__ import annotations

import hashlib
import re
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Generator
from urllib.parse import parse_qs, urlparse

import geoip2.database
from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import DateTime, Integer, String, create_engine, func, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file="../.env", extra="ignore")
    app_name: str = "SparringScope"
    database_url: str = "sqlite:///./sparringscope.db"
    admin_token: str = "dev-change-me"
    story_published_at: str = ""
    maxmind_db_path: str = ""
    trust_proxy_headers: bool = False


settings = Settings()
connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


class ClickEvent(Base):
    __tablename__ = "click_events"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    visitor_hash: Mapped[str] = mapped_column(String(64), index=True)
    country: Mapped[str | None] = mapped_column(String(100), nullable=True)
    region: Mapped[str | None] = mapped_column(String(120), nullable=True)
    city: Mapped[str | None] = mapped_column(String(120), nullable=True)
    device: Mapped[str] = mapped_column(String(40), default="Unknown")
    browser: Mapped[str] = mapped_column(String(60), default="Unknown")
    os: Mapped[str] = mapped_column(String(60), default="Unknown")
    screen_bucket: Mapped[str] = mapped_column(String(30), default="Unknown")
    source: Mapped[str] = mapped_column(String(30), default="unknown")
    vpn_status: Mapped[str] = mapped_column(String(30), default="not_checked")
    clicked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Video(Base):
    __tablename__ = "videos"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str] = mapped_column(String(500), default="")
    category: Mapped[str] = mapped_column(String(20), index=True, nullable=False)
    youtube_id: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


Base.metadata.create_all(bind=engine)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class TrackPayload(BaseModel):
    visitor_id: str = Field(min_length=16, max_length=100)
    screen_width: int | None = Field(default=None, ge=1, le=10000)
    screen_height: int | None = Field(default=None, ge=1, le=10000)
    viewport_width: int | None = Field(default=None, ge=1, le=10000)


class VideoCreate(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    description: str = Field(default="", max_length=500)
    category: str
    youtube_url: str = Field(min_length=8, max_length=500)


class VideoUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=500)
    category: str | None = None
    youtube_url: str | None = Field(default=None, min_length=8, max_length=500)


app = FastAPI(title=settings.app_name, version="0.2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "Authorization"],
)


def require_admin(authorization: str | None = Header(default=None)) -> None:
    if not settings.admin_token or settings.admin_token == "dev-change-me":
        raise HTTPException(status_code=503, detail="Set a strong ADMIN_TOKEN in .env first.")
    if authorization != f"Bearer {settings.admin_token}":
        raise HTTPException(status_code=401, detail="Unauthorized")


def get_client_ip(request: Request) -> str | None:
    if settings.trust_proxy_headers:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


def coarse_location(ip: str | None) -> tuple[str | None, str | None, str | None]:
    path = settings.maxmind_db_path
    if not ip or not path or not Path(path).is_file():
        return None, None, None
    try:
        with geoip2.database.Reader(path) as reader:
            result = reader.city(ip)
            return (
                result.country.name,
                result.subdivisions.most_specific.name if result.subdivisions else None,
                result.city.name,
            )
    except Exception:
        return None, None, None


def parse_device(ua: str) -> tuple[str, str, str]:
    lower = ua.lower()
    device = "Mobile" if any(x in lower for x in ("mobile", "android", "iphone")) else "Desktop"
    if "ipad" in lower or "tablet" in lower:
        device = "Tablet"
    if "edg/" in lower:
        browser = "Edge"
    elif "chrome/" in lower and "chromium" not in lower:
        browser = "Chrome"
    elif "firefox/" in lower:
        browser = "Firefox"
    elif "safari/" in lower and "chrome/" not in lower:
        browser = "Safari"
    else:
        browser = "Unknown"
    if "android" in lower:
        os_name = "Android"
    elif "iphone" in lower or "ipad" in lower:
        os_name = "iOS/iPadOS"
    elif "windows" in lower:
        os_name = "Windows"
    elif "mac os" in lower or "macintosh" in lower:
        os_name = "macOS"
    elif "linux" in lower:
        os_name = "Linux"
    else:
        os_name = "Unknown"
    return device, browser, os_name


def screen_bucket(width: int | None) -> str:
    if width is None:
        return "Unknown"
    if width < 600:
        return "Small"
    if width < 1024:
        return "Medium"
    return "Large"


def current_phase() -> str:
    if not settings.story_published_at:
        return "unknown"
    try:
        published = datetime.fromisoformat(settings.story_published_at.replace("Z", "+00:00"))
        if published.tzinfo is None:
            published = published.replace(tzinfo=timezone.utc)
        return "story_period" if datetime.now(timezone.utc) < published + timedelta(hours=24) else "highlight_period"
    except ValueError:
        return "unknown"


def extract_youtube_id(url: str) -> str:
    parsed = urlparse(url.strip())
    host = (parsed.hostname or "").lower()
    if parsed.scheme not in {"http", "https"}:
        raise HTTPException(status_code=422, detail="Enter a valid YouTube URL.")
    video_id = None
    if host in {"youtu.be", "www.youtu.be"}:
        video_id = parsed.path.strip("/").split("/")[0]
    elif host in {"youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com"}:
        parts = [p for p in parsed.path.split("/") if p]
        if parsed.path == "/watch":
            video_id = parse_qs(parsed.query).get("v", [None])[0]
        elif len(parts) >= 2 and parts[0] in {"shorts", "embed", "live"}:
            video_id = parts[1]
    if not video_id or not re.fullmatch(r"[A-Za-z0-9_-]{11}", video_id):
        raise HTTPException(status_code=422, detail="That doesn't look like a valid YouTube video URL.")
    return video_id


def video_dict(v: Video) -> dict:
    return {
        "id": v.id, "title": v.title, "description": v.description,
        "category": v.category, "youtube_id": v.youtube_id,
        "embed_url": f"https://www.youtube-nocookie.com/embed/{v.youtube_id}",
        "thumbnail_url": f"https://i.ytimg.com/vi/{v.youtube_id}/hqdefault.jpg",
        "created_at": v.created_at.isoformat() if v.created_at else None,
    }


@app.on_event("startup")
def seed_demo_videos():
    # Preserve the two videos previously hardcoded in GET /api/videos.
    with SessionLocal() as db:
        if (db.scalar(select(func.count()).select_from(Video)) or 0) == 0:
            db.add_all([
                Video(title="Wrestling Session 01", description="Wrestling and takedown training",
                      category="grappling", youtube_id="lUzAesVpKC0"),
                Video(title="Boxing Sparring 01", description="Boxing sparring session",
                      category="striking", youtube_id="MNfhLwXPRwE"),
            ])
            db.commit()


@app.get("/health")
def health():
    return {"status": "ok", "service": "sparringscope-api"}


@app.get("/api/videos")
def get_videos(db: Session = Depends(get_db)):
    items = db.scalars(select(Video).order_by(Video.id.desc())).all()
    return {
        "grappling": [video_dict(v) for v in items if v.category == "grappling"],
        "striking": [video_dict(v) for v in items if v.category == "striking"],
    }


@app.post("/api/admin/videos", status_code=201, dependencies=[Depends(require_admin)])
def add_video(payload: VideoCreate, db: Session = Depends(get_db)):
    category = payload.category.strip().lower()
    if category not in {"grappling", "striking"}:
        raise HTTPException(status_code=422, detail="Category must be grappling or striking.")
    youtube_id = extract_youtube_id(payload.youtube_url)
    if db.scalar(select(Video).where(Video.youtube_id == youtube_id)):
        raise HTTPException(status_code=409, detail="This YouTube video is already in your archive.")
    item = Video(title=payload.title.strip(), description=payload.description.strip(),
                 category=category, youtube_id=youtube_id)
    db.add(item)
    db.commit()
    db.refresh(item)
    return video_dict(item)


@app.patch("/api/admin/videos/{video_id}", dependencies=[Depends(require_admin)])
def update_video(video_id: int, payload: VideoUpdate, db: Session = Depends(get_db)):
    item = db.get(Video, video_id)
    if not item:
        raise HTTPException(status_code=404, detail="Video not found.")
    values = payload.model_dump(exclude_unset=True)
    if "category" in values:
        category = (values["category"] or "").strip().lower()
        if category not in {"grappling", "striking"}:
            raise HTTPException(status_code=422, detail="Category must be grappling or striking.")
        item.category = category
    if "youtube_url" in values:
        youtube_id = extract_youtube_id(values["youtube_url"])
        duplicate = db.scalar(select(Video).where(Video.youtube_id == youtube_id, Video.id != video_id))
        if duplicate:
            raise HTTPException(status_code=409, detail="That video is already in your archive.")
        item.youtube_id = youtube_id
    if values.get("title") is not None:
        item.title = values["title"].strip()
    if values.get("description") is not None:
        item.description = values["description"].strip()
    db.commit()
    db.refresh(item)
    return video_dict(item)


@app.delete("/api/admin/videos/{video_id}", status_code=204, dependencies=[Depends(require_admin)])
def delete_video(video_id: int, db: Session = Depends(get_db)):
    item = db.get(Video, video_id)
    if not item:
        raise HTTPException(status_code=404, detail="Video not found.")
    db.delete(item)
    db.commit()


@app.post("/api/track", status_code=202)
def track(payload: TrackPayload, request: Request, db: Session = Depends(get_db)):
    device, browser, os_name = parse_device(request.headers.get("user-agent", ""))
    country, region, city = coarse_location(get_client_ip(request))
    visitor_hash = hashlib.sha256(payload.visitor_id.encode("utf-8")).hexdigest()
    db.add(ClickEvent(
        visitor_hash=visitor_hash, country=country, region=region, city=city,
        device=device, browser=browser, os=os_name,
        screen_bucket=screen_bucket(payload.screen_width),
        source={"story_period": "story", "highlight_period": "highlight"}.get(current_phase(), "unknown"),
        vpn_status="not_checked",
    ))
    db.commit()
    return {"recorded": True}


@app.get("/api/admin/analytics", dependencies=[Depends(require_admin)])
def analytics(db: Session = Depends(get_db)):
    events = db.scalars(select(ClickEvent).order_by(ClickEvent.clicked_at.desc()).limit(200)).all()
    total = db.scalar(select(func.count()).select_from(ClickEvent)) or 0
    unique_visitors = db.scalar(select(func.count(func.distinct(ClickEvent.visitor_hash)))) or 0
    return {
        "total_clicks": total, "unique_browsers_estimate": unique_visitors,
        "phase": current_phase(),
        "recent": [{
            "id": e.id, "area": ", ".join(x for x in (e.city, e.region, e.country) if x) or "Unknown",
            "device": e.device, "browser": e.browser, "os": e.os,
            "screen": e.screen_bucket, "source": e.source, "vpn_status": e.vpn_status,
            "clicked_at": e.clicked_at.isoformat() if e.clicked_at else None,
        } for e in events],
    }


@app.get("/")
def root():
    return {"message": "Welcome to SparringScope API", "status": "running",
            "docs": "/docs", "health": "/health"}
