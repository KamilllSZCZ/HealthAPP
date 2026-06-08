"""LifeSync backend — personal life/health management platform.

Single-user-focused but fully multi-device-sync capable. All data is user-scoped.
Auth: email/password (JWT) + Emergent Google session tokens. Rule-based stats only.
"""
import os
import uuid
import logging
import secrets
from pathlib import Path
from datetime import datetime, timezone, timedelta, date

import jwt
import bcrypt
import httpx
from fastapi import FastAPI, APIRouter, Depends, HTTPException, Header, Request
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

JWT_SECRET = os.environ.get("JWT_SECRET", "dev_secret")
JWT_ALGO = "HS256"

app = FastAPI(title="LifeSync API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("lifesync")


# ----------------------------- helpers -----------------------------
def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def today_str() -> str:
    return date.today().isoformat()


def new_id(prefix: str = "") -> str:
    return f"{prefix}{uuid.uuid4().hex[:16]}"


def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_pw(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


def make_jwt(user_id: str) -> str:
    payload = {"user_id": user_id, "exp": now_utc() + timedelta(days=30)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


def clean(doc: dict) -> dict:
    if doc and "_id" in doc:
        doc = {k: v for k, v in doc.items() if k != "_id"}
    return doc


async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(" ", 1)[1].strip()
    user_id = None
    # Try our JWT first
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
        user_id = payload.get("user_id")
    except Exception:
        user_id = None
    # Fallback: Emergent/Google session token
    if not user_id:
        sess = await db.user_sessions.find_one({"session_token": token})
        if sess:
            exp = sess.get("expires_at")
            if exp and exp.tzinfo is None:
                exp = exp.replace(tzinfo=timezone.utc)
            if exp and exp < now_utc():
                raise HTTPException(status_code=401, detail="Session expired")
            user_id = sess.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


# ----------------------------- models -----------------------------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str
    name: Optional[str] = None


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class GoogleSessionIn(BaseModel):
    session_token: str


class ResetRequestIn(BaseModel):
    email: EmailStr


class ResetConfirmIn(BaseModel):
    email: EmailStr
    code: str
    new_password: str


class ProfileIn(BaseModel):
    name: Optional[str] = None
    height_cm: Optional[float] = None
    target_weight: Optional[float] = None
    daily_water_goal: Optional[int] = None
    sleep_goal_hours: Optional[float] = None
    avatar: Optional[str] = None
    timezone: Optional[str] = None


# ----------------------------- auth routes -----------------------------
DEFAULT_PROFILE = {
    "height_cm": None,
    "target_weight": None,
    "daily_water_goal": 2500,
    "sleep_goal_hours": 8.0,
    "avatar": None,
    "timezone": "UTC",
}


async def seed_defaults(user_id: str):
    """Seed default habits + dashboard config for a brand-new user."""
    existing = await db.habits.count_documents({"user_id": user_id})
    if existing == 0:
        defaults = [
            {"name": "Supplement Completion", "icon": "medical", "color": "#6B46FF", "system": True},
            {"name": "Water Goal", "icon": "water", "color": "#3B82F6", "system": True},
            {"name": "Sleep Goal", "icon": "moon", "color": "#8B5CF6", "system": True},
            {"name": "Weekly Weight Check", "icon": "barbell", "color": "#22C55E", "system": True, "frequency": "weekly"},
        ]
        for h in defaults:
            await db.habits.insert_one({
                "id": new_id("hab_"), "user_id": user_id, "name": h["name"],
                "icon": h["icon"], "color": h["color"], "frequency": h.get("frequency", "daily"),
                "system": h.get("system", False), "created_at": now_utc().isoformat(),
            })
    cfg = await db.dashboard_config.find_one({"user_id": user_id})
    if not cfg:
        default_widgets = [
            "completion", "supplements", "water", "meals", "weight", "steps",
            "sleep", "energy", "focus", "mood", "habits", "goals", "projects", "streaks", "review",
        ]
        widgets = [
            {"key": k, "visible": True, "favorite": k in ("completion", "supplements", "water"),
             "size": "full" if k in ("completion",) else "half", "order": i}
            for i, k in enumerate(default_widgets)
        ]
        await db.dashboard_config.insert_one({
            "user_id": user_id, "widgets": widgets, "updated_at": now_utc().isoformat(),
        })


@api.post("/auth/register")
async def register(body: RegisterIn):
    existing = await db.users.find_one({"email": body.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = new_id("user_")
    user = {
        "user_id": user_id, "email": body.email.lower(),
        "password": hash_pw(body.password),
        "name": body.name or body.email.split("@")[0],
        "auth_provider": "email", "picture": None,
        "profile": DEFAULT_PROFILE.copy(),
        "created_at": now_utc().isoformat(),
    }
    await db.users.insert_one(user)
    await seed_defaults(user_id)
    token = make_jwt(user_id)
    return {"token": token, "user": clean({k: v for k, v in user.items() if k != "password"})}


@api.post("/auth/login")
async def login(body: LoginIn):
    user = await db.users.find_one({"email": body.email.lower()})
    if not user or not user.get("password") or not verify_pw(body.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    await seed_defaults(user["user_id"])
    token = make_jwt(user["user_id"])
    return {"token": token, "user": clean({k: v for k, v in user.items() if k != "password"})}


@api.post("/auth/google/session")
async def google_session(body: GoogleSessionIn):
    """Verify Emergent session_token, upsert user, return our session token."""
    async with httpx.AsyncClient() as hc:
        r = await hc.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": body.session_token}, timeout=20,
        )
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid Google session")
    data = r.json()
    email = data["email"].lower()
    user = await db.users.find_one({"email": email})
    if not user:
        user_id = new_id("user_")
        user = {
            "user_id": user_id, "email": email, "password": None,
            "name": data.get("name") or email.split("@")[0],
            "auth_provider": "google", "picture": data.get("picture"),
            "profile": DEFAULT_PROFILE.copy(), "created_at": now_utc().isoformat(),
        }
        await db.users.insert_one(user)
    user_id = user["user_id"]
    await seed_defaults(user_id)
    session_token = data.get("session_token") or new_id("sess_")
    await db.user_sessions.insert_one({
        "session_token": session_token, "user_id": user_id,
        "expires_at": now_utc() + timedelta(days=7), "created_at": now_utc(),
    })
    return {"token": session_token, "user": clean({k: v for k, v in user.items() if k != "password"})}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user


@api.post("/auth/logout")
async def logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1].strip()
        await db.user_sessions.delete_one({"session_token": token})
    return {"ok": True}


@api.post("/auth/reset/request")
async def reset_request(body: ResetRequestIn):
    user = await db.users.find_one({"email": body.email.lower()})
    # Always succeed to avoid leaking which emails exist; but only store code if user exists
    code = f"{secrets.randbelow(1000000):06d}"
    if user:
        await db.password_resets.update_one(
            {"email": body.email.lower()},
            {"$set": {"email": body.email.lower(), "code": code,
                      "expires_at": now_utc() + timedelta(minutes=30)}},
            upsert=True,
        )
    # No email provider configured — return the code so the single user can reset.
    return {"ok": True, "code": code if user else None,
            "message": "Use this code to reset your password."}


@api.post("/auth/reset/confirm")
async def reset_confirm(body: ResetConfirmIn):
    rec = await db.password_resets.find_one({"email": body.email.lower()})
    if not rec or rec.get("code") != body.code:
        raise HTTPException(status_code=400, detail="Invalid reset code")
    exp = rec.get("expires_at")
    if exp and exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp and exp < now_utc():
        raise HTTPException(status_code=400, detail="Reset code expired")
    await db.users.update_one({"email": body.email.lower()},
                              {"$set": {"password": hash_pw(body.new_password)}})
    await db.password_resets.delete_one({"email": body.email.lower()})
    return {"ok": True}


@api.put("/profile")
async def update_profile(body: ProfileIn, user: dict = Depends(get_current_user)):
    updates = {}
    prof = user.get("profile", {}).copy()
    if body.name is not None:
        updates["name"] = body.name
    for f in ["height_cm", "target_weight", "daily_water_goal", "sleep_goal_hours", "avatar", "timezone"]:
        val = getattr(body, f)
        if val is not None:
            prof[f] = val
    updates["profile"] = prof
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": updates})
    fresh = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0, "password": 0})
    return fresh


# ----------------------------- generic CRUD factory -----------------------------
def crud_routes(name: str, collection: str, id_prefix: str):
    """Register list/create/update/delete for a simple user-scoped collection."""

    @api.get(f"/{name}", name=f"list_{name}")
    async def _list(user: dict = Depends(get_current_user)):
        items = await db[collection].find({"user_id": user["user_id"]}, {"_id": 0}).to_list(2000)
        return items

    @api.post(f"/{name}", name=f"create_{name}")
    async def _create(body: Dict[str, Any], user: dict = Depends(get_current_user)):
        doc = {**body, "id": new_id(id_prefix), "user_id": user["user_id"],
               "created_at": now_utc().isoformat()}
        doc.pop("_id", None)
        await db[collection].insert_one(doc)
        return clean(doc)

    @api.put(f"/{name}/{{item_id}}", name=f"update_{name}")
    async def _update(item_id: str, body: Dict[str, Any], user: dict = Depends(get_current_user)):
        body.pop("_id", None)
        body.pop("id", None)
        body.pop("user_id", None)
        body["updated_at"] = now_utc().isoformat()
        res = await db[collection].update_one(
            {"id": item_id, "user_id": user["user_id"]}, {"$set": body})
        if res.matched_count == 0:
            raise HTTPException(status_code=404, detail="Not found")
        doc = await db[collection].find_one({"id": item_id}, {"_id": 0})
        return doc

    @api.delete(f"/{name}/{{item_id}}", name=f"delete_{name}")
    async def _delete(item_id: str, user: dict = Depends(get_current_user)):
        await db[collection].delete_one({"id": item_id, "user_id": user["user_id"]})
        return {"ok": True}


# Simple collections
for n, c, p in [
    ("goals", "goals", "goal_"),
    ("projects", "projects", "proj_"),
    ("journal", "journal_entries", "jrn_"),
    ("recipes", "recipes", "rec_"),
    ("meal-templates", "meal_templates", "mt_"),
    ("notifications", "reminder_schedules", "rem_"),
]:
    crud_routes(n, c, p)


# ----------------------------- SUPPLEMENTS -----------------------------
def supplement_computed(s: dict) -> dict:
    daily_servings = s.get("daily_servings", 1) or 1
    current_stock = s.get("current_stock", 0) or 0
    price = s.get("purchase_price", 0) or 0
    package_size = s.get("package_size", 0) or 0
    days_left = round(current_stock / daily_servings, 1) if daily_servings else None
    cost_per_serving = round(price / package_size, 3) if package_size else None
    cost_per_month = round(cost_per_serving * daily_servings * 30, 2) if cost_per_serving else None
    inventory_value = round(cost_per_serving * current_stock, 2) if cost_per_serving else None
    refill_threshold = s.get("refill_threshold", 0) or 0
    low_stock = current_stock <= refill_threshold if refill_threshold else False
    refill_date = None
    if days_left is not None:
        refill_date = (date.today() + timedelta(days=int(days_left))).isoformat()
    s["computed"] = {
        "days_left": days_left, "cost_per_serving": cost_per_serving,
        "cost_per_month": cost_per_month, "inventory_value": inventory_value,
        "low_stock": low_stock, "refill_prediction": refill_date,
    }
    return s


@api.get("/supplements")
async def list_supplements(user: dict = Depends(get_current_user)):
    items = await db.supplements.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(1000)
    today = today_str()
    logs = await db.supplement_logs.find(
        {"user_id": user["user_id"], "date": today}, {"_id": 0}).to_list(1000)
    taken_map = {}
    for lg in logs:
        taken_map.setdefault(lg["supplement_id"], []).append(lg)
    for s in items:
        supplement_computed(s)
        s["taken_today"] = len(taken_map.get(s["id"], []))
        s["taken_count_needed"] = s.get("daily_servings", 1)
    return items


@api.post("/supplements")
async def create_supplement(body: Dict[str, Any], user: dict = Depends(get_current_user)):
    doc = {**body, "id": new_id("sup_"), "user_id": user["user_id"],
           "created_at": now_utc().isoformat()}
    doc.pop("_id", None)
    await db.supplements.insert_one(doc)
    return supplement_computed(clean(doc))


@api.put("/supplements/{sid}")
async def update_supplement(sid: str, body: Dict[str, Any], user: dict = Depends(get_current_user)):
    for k in ("_id", "id", "user_id", "computed", "taken_today"):
        body.pop(k, None)
    res = await db.supplements.update_one(
        {"id": sid, "user_id": user["user_id"]}, {"$set": body})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    doc = await db.supplements.find_one({"id": sid}, {"_id": 0})
    return supplement_computed(doc)


@api.delete("/supplements/{sid}")
async def delete_supplement(sid: str, user: dict = Depends(get_current_user)):
    await db.supplements.delete_one({"id": sid, "user_id": user["user_id"]})
    await db.supplement_logs.delete_many({"supplement_id": sid, "user_id": user["user_id"]})
    return {"ok": True}


@api.post("/supplements/{sid}/take")
async def take_supplement(sid: str, user: dict = Depends(get_current_user)):
    sup = await db.supplements.find_one({"id": sid, "user_id": user["user_id"]})
    if not sup:
        raise HTTPException(status_code=404, detail="Not found")
    log = {"id": new_id("slog_"), "user_id": user["user_id"], "supplement_id": sid,
           "date": today_str(), "taken_at": now_utc().isoformat()}
    await db.supplement_logs.insert_one(log)
    # decrement stock
    new_stock = max((sup.get("current_stock", 0) or 0) - 1, 0)
    await db.supplements.update_one({"id": sid}, {"$set": {"current_stock": new_stock}})
    return {"ok": True}


@api.post("/supplements/{sid}/untake")
async def untake_supplement(sid: str, user: dict = Depends(get_current_user)):
    sup = await db.supplements.find_one({"id": sid, "user_id": user["user_id"]})
    if not sup:
        raise HTTPException(status_code=404, detail="Not found")
    log = await db.supplement_logs.find_one_and_delete(
        {"user_id": user["user_id"], "supplement_id": sid, "date": today_str()})
    if log:
        await db.supplements.update_one(
            {"id": sid}, {"$set": {"current_stock": (sup.get("current_stock", 0) or 0) + 1}})
    return {"ok": True}


@api.get("/supplements/adherence")
async def supplement_adherence(days: int = 30, user: dict = Depends(get_current_user)):
    sups = await db.supplements.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(1000)
    total_needed_per_day = sum(s.get("daily_servings", 1) or 1 for s in sups)
    start = date.today() - timedelta(days=days - 1)
    logs = await db.supplement_logs.find(
        {"user_id": user["user_id"], "date": {"$gte": start.isoformat()}}, {"_id": 0}).to_list(50000)
    by_date: Dict[str, int] = {}
    for lg in logs:
        by_date[lg["date"]] = by_date.get(lg["date"], 0) + 1
    history = []
    streak = 0
    streak_active = True
    for i in range(days):
        d = (date.today() - timedelta(days=i)).isoformat()
        taken = by_date.get(d, 0)
        pct = round(taken / total_needed_per_day * 100) if total_needed_per_day else 0
        history.append({"date": d, "taken": taken, "needed": total_needed_per_day, "percent": min(pct, 100)})
        if streak_active and total_needed_per_day and taken >= total_needed_per_day:
            streak += 1
        elif i == 0 and total_needed_per_day and taken < total_needed_per_day:
            streak_active = False
        else:
            streak_active = False
    total_taken = sum(by_date.values())
    total_possible = total_needed_per_day * days
    overall = round(total_taken / total_possible * 100) if total_possible else 0
    history.reverse()
    return {"overall_percent": overall, "streak": streak, "history": history,
            "missed": max(total_possible - total_taken, 0)}


# ----------------------------- HYDRATION -----------------------------
class WaterIn(BaseModel):
    amount: int


@api.post("/water")
async def add_water(body: WaterIn, user: dict = Depends(get_current_user)):
    log = {"id": new_id("w_"), "user_id": user["user_id"], "date": today_str(),
           "amount": body.amount, "logged_at": now_utc().isoformat()}
    await db.water_logs.insert_one(log)
    return clean(log)


@api.get("/water/today")
async def water_today(user: dict = Depends(get_current_user)):
    logs = await db.water_logs.find(
        {"user_id": user["user_id"], "date": today_str()}, {"_id": 0}).to_list(1000)
    total = sum(x["amount"] for x in logs)
    goal = user.get("profile", {}).get("daily_water_goal", 2500)
    return {"total": total, "goal": goal, "logs": logs,
            "percent": min(round(total / goal * 100), 100) if goal else 0}


@api.delete("/water/{wid}")
async def delete_water(wid: str, user: dict = Depends(get_current_user)):
    await db.water_logs.delete_one({"id": wid, "user_id": user["user_id"]})
    return {"ok": True}


@api.get("/water/history")
async def water_history(days: int = 30, user: dict = Depends(get_current_user)):
    start = date.today() - timedelta(days=days - 1)
    logs = await db.water_logs.find(
        {"user_id": user["user_id"], "date": {"$gte": start.isoformat()}}, {"_id": 0}).to_list(50000)
    goal = user.get("profile", {}).get("daily_water_goal", 2500)
    by_date: Dict[str, int] = {}
    for lg in logs:
        by_date[lg["date"]] = by_date.get(lg["date"], 0) + lg["amount"]
    history = []
    streak = 0
    for i in range(days):
        d = (date.today() - timedelta(days=i)).isoformat()
        amt = by_date.get(d, 0)
        history.append({"date": d, "amount": amt, "goal": goal,
                        "percent": min(round(amt / goal * 100), 100) if goal else 0})
    for h in history:
        if h["amount"] >= goal:
            streak += 1
        else:
            break
    history.reverse()
    return {"history": history, "streak": streak}


# ----------------------------- WEIGHT -----------------------------
@api.post("/weight")
async def add_weight(body: Dict[str, Any], user: dict = Depends(get_current_user)):
    doc = {"id": new_id("wt_"), "user_id": user["user_id"],
           "date": body.get("date", today_str()),
           "weight": body.get("weight"), "waist": body.get("waist"),
           "created_at": now_utc().isoformat()}
    await db.weight_logs.insert_one(doc)
    return clean(doc)


@api.get("/weight")
async def list_weight(user: dict = Depends(get_current_user)):
    logs = await db.weight_logs.find({"user_id": user["user_id"]}, {"_id": 0}).sort("date", 1).to_list(5000)
    target = user.get("profile", {}).get("target_weight")
    trend = None
    weight_change = None
    if len(logs) >= 2:
        first = logs[0]["weight"]
        last = logs[-1]["weight"]
        weight_change = round(last - first, 1)
        trend = "down" if last < first else ("up" if last > first else "stable")
    current = logs[-1]["weight"] if logs else None
    return {"logs": logs, "target_weight": target, "current": current,
            "trend": trend, "change": weight_change}


@api.delete("/weight/{wid}")
async def delete_weight(wid: str, user: dict = Depends(get_current_user)):
    await db.weight_logs.delete_one({"id": wid, "user_id": user["user_id"]})
    return {"ok": True}


# ----------------------------- SLEEP -----------------------------
@api.post("/sleep")
async def add_sleep(body: Dict[str, Any], user: dict = Depends(get_current_user)):
    doc = {"id": new_id("sl_"), "user_id": user["user_id"],
           "date": body.get("date", today_str()),
           "duration": body.get("duration"), "bed_time": body.get("bed_time"),
           "wake_time": body.get("wake_time"), "quality": body.get("quality"),
           "created_at": now_utc().isoformat()}
    await db.sleep_logs.update_one(
        {"user_id": user["user_id"], "date": doc["date"]}, {"$set": doc}, upsert=True)
    return clean(doc)


@api.get("/sleep")
async def list_sleep(days: int = 30, user: dict = Depends(get_current_user)):
    start = date.today() - timedelta(days=days - 1)
    logs = await db.sleep_logs.find(
        {"user_id": user["user_id"], "date": {"$gte": start.isoformat()}},
        {"_id": 0}).sort("date", 1).to_list(5000)
    avg = round(sum(x.get("duration", 0) or 0 for x in logs) / len(logs), 1) if logs else 0
    goal = user.get("profile", {}).get("sleep_goal_hours", 8)
    return {"logs": logs, "avg_duration": avg, "goal": goal}


# ----------------------------- DAILY METRICS (energy/focus/mood/stress/...) -----------------------------
@api.post("/metrics")
async def set_metrics(body: Dict[str, Any], user: dict = Depends(get_current_user)):
    d = body.get("date", today_str())
    fields = {}
    for f in ["energy", "focus", "mood", "stress", "sleep_quality", "motivation"]:
        if f in body and body[f] is not None:
            fields[f] = body[f]
    doc = {"user_id": user["user_id"], "date": d, **fields, "updated_at": now_utc().isoformat()}
    await db.daily_metrics.update_one(
        {"user_id": user["user_id"], "date": d}, {"$set": doc}, upsert=True)
    saved = await db.daily_metrics.find_one({"user_id": user["user_id"], "date": d}, {"_id": 0})
    return saved


@api.get("/metrics/today")
async def metrics_today(user: dict = Depends(get_current_user)):
    doc = await db.daily_metrics.find_one(
        {"user_id": user["user_id"], "date": today_str()}, {"_id": 0})
    return doc or {"date": today_str()}


@api.get("/metrics")
async def list_metrics(days: int = 30, user: dict = Depends(get_current_user)):
    start = date.today() - timedelta(days=days - 1)
    logs = await db.daily_metrics.find(
        {"user_id": user["user_id"], "date": {"$gte": start.isoformat()}},
        {"_id": 0}).sort("date", 1).to_list(5000)
    return {"logs": logs}


# ----------------------------- NUTRITION / MEALS -----------------------------
@api.post("/meals")
async def add_meal(body: Dict[str, Any], user: dict = Depends(get_current_user)):
    doc = {"id": new_id("meal_"), "user_id": user["user_id"],
           "date": body.get("date", today_str()),
           "category": body.get("category", "Snack"),
           "name": body.get("name", "Meal"),
           "calories": body.get("calories", 0), "protein": body.get("protein", 0),
           "carbs": body.get("carbs", 0), "fat": body.get("fat", 0),
           "fiber": body.get("fiber", 0), "created_at": now_utc().isoformat()}
    await db.meals.insert_one(doc)
    return clean(doc)


@api.get("/meals/today")
async def meals_today(user: dict = Depends(get_current_user)):
    logs = await db.meals.find(
        {"user_id": user["user_id"], "date": today_str()}, {"_id": 0}).to_list(1000)
    totals = {k: round(sum(m.get(k, 0) or 0 for m in logs), 1)
              for k in ["calories", "protein", "carbs", "fat", "fiber"]}
    return {"meals": logs, "totals": totals}


@api.get("/meals")
async def meals_by_date(date: str = None, user: dict = Depends(get_current_user)):
    q = {"user_id": user["user_id"]}
    if date:
        q["date"] = date
    logs = await db.meals.find(q, {"_id": 0}).to_list(2000)
    return logs


@api.delete("/meals/{mid}")
async def delete_meal(mid: str, user: dict = Depends(get_current_user)):
    await db.meals.delete_one({"id": mid, "user_id": user["user_id"]})
    return {"ok": True}


@api.get("/meals/summary")
async def meals_summary(days: int = 7, user: dict = Depends(get_current_user)):
    start = date.today() - timedelta(days=days - 1)
    logs = await db.meals.find(
        {"user_id": user["user_id"], "date": {"$gte": start.isoformat()}}, {"_id": 0}).to_list(50000)
    by_date: Dict[str, dict] = {}
    for m in logs:
        d = by_date.setdefault(m["date"], {"calories": 0, "protein": 0, "carbs": 0, "fat": 0, "fiber": 0})
        for k in d:
            d[k] += m.get(k, 0) or 0
    history = []
    for i in range(days):
        dd = (date.today() - timedelta(days=i)).isoformat()
        vals = by_date.get(dd, {"calories": 0, "protein": 0, "carbs": 0, "fat": 0, "fiber": 0})
        history.append({"date": dd, **{k: round(v, 1) for k, v in vals.items()}})
    history.reverse()
    return {"history": history}


# ----------------------------- MEAL PREP BATCHES + SHOPPING -----------------------------
@api.get("/meal-prep")
async def list_batches(user: dict = Depends(get_current_user)):
    items = await db.meal_prep_batches.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(1000)
    return items


@api.post("/meal-prep")
async def create_batch(body: Dict[str, Any], user: dict = Depends(get_current_user)):
    total = body.get("total_servings", 1) or 1
    cost = body.get("total_cost", 0) or 0
    doc = {**body, "id": new_id("batch_"), "user_id": user["user_id"],
           "remaining_servings": body.get("remaining_servings", total),
           "cost_per_serving": round(cost / total, 2) if total else 0,
           "created_at": now_utc().isoformat()}
    doc.pop("_id", None)
    await db.meal_prep_batches.insert_one(doc)
    return clean(doc)


@api.put("/meal-prep/{bid}")
async def update_batch(bid: str, body: Dict[str, Any], user: dict = Depends(get_current_user)):
    for k in ("_id", "id", "user_id"):
        body.pop(k, None)
    await db.meal_prep_batches.update_one({"id": bid, "user_id": user["user_id"]}, {"$set": body})
    doc = await db.meal_prep_batches.find_one({"id": bid}, {"_id": 0})
    return doc


@api.post("/meal-prep/{bid}/consume")
async def consume_batch(bid: str, user: dict = Depends(get_current_user)):
    batch = await db.meal_prep_batches.find_one({"id": bid, "user_id": user["user_id"]})
    if not batch:
        raise HTTPException(status_code=404, detail="Not found")
    remaining = max((batch.get("remaining_servings", 0) or 0) - 1, 0)
    await db.meal_prep_batches.update_one({"id": bid}, {"$set": {"remaining_servings": remaining}})
    # also log as a meal
    await db.meals.insert_one({
        "id": new_id("meal_"), "user_id": user["user_id"], "date": today_str(),
        "category": "Lunch", "name": batch.get("name", "Meal Prep"),
        "calories": batch.get("calories_per_serving", 0), "protein": batch.get("protein_per_serving", 0),
        "carbs": batch.get("carbs_per_serving", 0), "fat": batch.get("fat_per_serving", 0),
        "fiber": 0, "created_at": now_utc().isoformat(),
    })
    return {"ok": True, "remaining_servings": remaining}


@api.delete("/meal-prep/{bid}")
async def delete_batch(bid: str, user: dict = Depends(get_current_user)):
    await db.meal_prep_batches.delete_one({"id": bid, "user_id": user["user_id"]})
    return {"ok": True}


@api.post("/shopping-list/generate")
async def generate_shopping_list(body: Dict[str, Any], user: dict = Depends(get_current_user)):
    """Aggregate ingredients from given recipe ids into a shopping list."""
    recipe_ids = body.get("recipe_ids", [])
    recipes = await db.recipes.find(
        {"user_id": user["user_id"], "id": {"$in": recipe_ids}}, {"_id": 0}).to_list(1000)
    items: Dict[str, dict] = {}
    for r in recipes:
        for ing in r.get("ingredients", []):
            nm = ing.get("name", "").strip().lower()
            if not nm:
                continue
            entry = items.setdefault(nm, {"name": ing.get("name"), "quantity": 0,
                                          "unit": ing.get("unit", ""), "checked": False})
            try:
                entry["quantity"] += float(ing.get("quantity", 0) or 0)
            except Exception:
                pass
    doc = {"id": new_id("shop_"), "user_id": user["user_id"],
           "name": body.get("name", "Shopping List"),
           "items": list(items.values()), "created_at": now_utc().isoformat()}
    await db.shopping_lists.insert_one(doc)
    return clean(doc)


@api.get("/shopping-list")
async def list_shopping(user: dict = Depends(get_current_user)):
    items = await db.shopping_lists.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return items


@api.put("/shopping-list/{lid}")
async def update_shopping(lid: str, body: Dict[str, Any], user: dict = Depends(get_current_user)):
    body.pop("_id", None)
    body.pop("id", None)
    body.pop("user_id", None)
    await db.shopping_lists.update_one({"id": lid, "user_id": user["user_id"]}, {"$set": body})
    doc = await db.shopping_lists.find_one({"id": lid}, {"_id": 0})
    return doc


@api.delete("/shopping-list/{lid}")
async def delete_shopping(lid: str, user: dict = Depends(get_current_user)):
    await db.shopping_lists.delete_one({"id": lid, "user_id": user["user_id"]})
    return {"ok": True}


# ----------------------------- HABITS -----------------------------
@api.get("/habits")
async def list_habits(user: dict = Depends(get_current_user)):
    habits = await db.habits.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(500)
    today = today_str()
    logs = await db.habit_logs.find(
        {"user_id": user["user_id"], "date": today}, {"_id": 0}).to_list(1000)
    done = {lg["habit_id"] for lg in logs}
    # streaks
    for h in habits:
        h["done_today"] = h["id"] in done
        hlogs = await db.habit_logs.find(
            {"user_id": user["user_id"], "habit_id": h["id"]}, {"_id": 0}).to_list(5000)
        dates = {lg["date"] for lg in hlogs}
        streak = 0
        i = 0
        while True:
            d = (date.today() - timedelta(days=i)).isoformat()
            if d in dates:
                streak += 1
                i += 1
            elif i == 0:
                i += 1  # allow today not yet done
            else:
                break
        h["streak"] = streak
    return habits


@api.post("/habits")
async def create_habit(body: Dict[str, Any], user: dict = Depends(get_current_user)):
    doc = {"id": new_id("hab_"), "user_id": user["user_id"],
           "name": body.get("name", "Habit"), "icon": body.get("icon", "checkmark-circle"),
           "color": body.get("color", "#6B46FF"), "frequency": body.get("frequency", "daily"),
           "system": False, "created_at": now_utc().isoformat()}
    await db.habits.insert_one(doc)
    return clean(doc)


@api.post("/habits/{hid}/toggle")
async def toggle_habit(hid: str, user: dict = Depends(get_current_user)):
    today = today_str()
    existing = await db.habit_logs.find_one(
        {"user_id": user["user_id"], "habit_id": hid, "date": today})
    if existing:
        await db.habit_logs.delete_one({"_id": existing["_id"]})
        return {"done": False}
    await db.habit_logs.insert_one({
        "id": new_id("hl_"), "user_id": user["user_id"], "habit_id": hid,
        "date": today, "created_at": now_utc().isoformat()})
    return {"done": True}


@api.delete("/habits/{hid}")
async def delete_habit(hid: str, user: dict = Depends(get_current_user)):
    await db.habits.delete_one({"id": hid, "user_id": user["user_id"]})
    await db.habit_logs.delete_many({"habit_id": hid, "user_id": user["user_id"]})
    return {"ok": True}


@api.get("/habits/history")
async def habits_history(days: int = 30, user: dict = Depends(get_current_user)):
    habits = await db.habits.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(500)
    start = date.today() - timedelta(days=days - 1)
    logs = await db.habit_logs.find(
        {"user_id": user["user_id"], "date": {"$gte": start.isoformat()}}, {"_id": 0}).to_list(50000)
    n = len(habits) or 1
    by_date: Dict[str, int] = {}
    for lg in logs:
        by_date[lg["date"]] = by_date.get(lg["date"], 0) + 1
    history = []
    for i in range(days):
        d = (date.today() - timedelta(days=i)).isoformat()
        cnt = by_date.get(d, 0)
        history.append({"date": d, "completed": cnt, "total": n,
                        "percent": round(cnt / n * 100)})
    history.reverse()
    return {"history": history}


# ----------------------------- WEEKLY REVIEW -----------------------------
@api.post("/weekly-review")
async def create_review(body: Dict[str, Any], user: dict = Depends(get_current_user)):
    doc = {**body, "id": new_id("wr_"), "user_id": user["user_id"],
           "week_start": body.get("week_start", today_str()),
           "created_at": now_utc().isoformat()}
    doc.pop("_id", None)
    await db.weekly_reviews.insert_one(doc)
    return clean(doc)


@api.get("/weekly-review")
async def list_reviews(user: dict = Depends(get_current_user)):
    items = await db.weekly_reviews.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return items


# ----------------------------- DASHBOARD CONFIG -----------------------------
@api.get("/dashboard/config")
async def get_dashboard_config(user: dict = Depends(get_current_user)):
    cfg = await db.dashboard_config.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not cfg:
        await seed_defaults(user["user_id"])
        cfg = await db.dashboard_config.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return cfg


@api.put("/dashboard/config")
async def update_dashboard_config(body: Dict[str, Any], user: dict = Depends(get_current_user)):
    await db.dashboard_config.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"widgets": body.get("widgets", []), "updated_at": now_utc().isoformat()}},
        upsert=True)
    cfg = await db.dashboard_config.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return cfg


# ----------------------------- HEALTH SCORE + DASHBOARD SUMMARY -----------------------------
async def compute_health_score(user: dict) -> dict:
    uid = user["user_id"]
    today = today_str()
    profile = user.get("profile", {})
    scores = {}
    # Sleep
    sl = await db.sleep_logs.find_one({"user_id": uid, "date": today}, {"_id": 0})
    goal_sleep = profile.get("sleep_goal_hours", 8) or 8
    if sl and sl.get("duration"):
        scores["sleep"] = min(round(sl["duration"] / goal_sleep * 100), 100)
    else:
        scores["sleep"] = 0
    # Water
    wlogs = await db.water_logs.find({"user_id": uid, "date": today}, {"_id": 0}).to_list(500)
    total_water = sum(x["amount"] for x in wlogs)
    goal_water = profile.get("daily_water_goal", 2500) or 2500
    scores["water"] = min(round(total_water / goal_water * 100), 100)
    # Activity (steps)
    sync = await db.health_sync_logs.find_one(
        {"user_id": uid, "date": today, "metric": "steps"}, {"_id": 0})
    steps = sync.get("value", 0) if sync else 0
    scores["activity"] = min(round(steps / 10000 * 100), 100)
    # Supplements
    sups = await db.supplements.find({"user_id": uid}, {"_id": 0}).to_list(500)
    needed = sum(s.get("daily_servings", 1) or 1 for s in sups)
    taken = await db.supplement_logs.count_documents({"user_id": uid, "date": today})
    scores["supplements"] = min(round(taken / needed * 100), 100) if needed else 100
    # Mood / Energy
    m = await db.daily_metrics.find_one({"user_id": uid, "date": today}, {"_id": 0})
    scores["mood"] = round((m.get("mood", 0) or 0) / 10 * 100) if m else 0
    scores["energy"] = round((m.get("energy", 0) or 0) / 10 * 100) if m else 0
    # Weight trend
    wts = await db.weight_logs.find({"user_id": uid}, {"_id": 0}).sort("date", 1).to_list(500)
    target = profile.get("target_weight")
    if wts and target:
        cur = wts[-1]["weight"]
        scores["weight"] = 100 if abs(cur - target) < 1 else max(0, 100 - round(abs(cur - target) * 3))
    else:
        scores["weight"] = 60
    overall = round(sum(scores.values()) / len(scores)) if scores else 0
    # suggestions
    suggestions = []
    if scores["sleep"] < 70:
        suggestions.append("Aim for more sleep tonight to boost recovery.")
    if scores["water"] < 70:
        suggestions.append("You're behind on hydration — drink some water.")
    if scores["supplements"] < 100 and needed:
        suggestions.append("You still have supplements to take today.")
    if scores["activity"] < 50:
        suggestions.append("Try to get more steps in today.")
    if not suggestions:
        suggestions.append("Great work — you're on track across the board!")
    return {"overall": overall, "categories": scores, "suggestions": suggestions}


@api.get("/health-score")
async def health_score(user: dict = Depends(get_current_user)):
    return await compute_health_score(user)


@api.get("/dashboard/summary")
async def dashboard_summary(user: dict = Depends(get_current_user)):
    uid = user["user_id"]
    today = today_str()
    profile = user.get("profile", {})
    # supplements
    sups = await db.supplements.find({"user_id": uid}, {"_id": 0}).to_list(500)
    needed = sum(s.get("daily_servings", 1) or 1 for s in sups)
    taken = await db.supplement_logs.count_documents({"user_id": uid, "date": today})
    # water
    wlogs = await db.water_logs.find({"user_id": uid, "date": today}, {"_id": 0}).to_list(500)
    total_water = sum(x["amount"] for x in wlogs)
    goal_water = profile.get("daily_water_goal", 2500) or 2500
    # meals
    meals = await db.meals.find({"user_id": uid, "date": today}, {"_id": 0}).to_list(500)
    cals = round(sum(m.get("calories", 0) or 0 for m in meals))
    protein = round(sum(m.get("protein", 0) or 0 for m in meals))
    # habits
    habits = await db.habits.find({"user_id": uid}, {"_id": 0}).to_list(500)
    hlogs = await db.habit_logs.count_documents({"user_id": uid, "date": today})
    # weight
    wts = await db.weight_logs.find({"user_id": uid}, {"_id": 0}).sort("date", -1).to_list(1)
    current_weight = wts[0]["weight"] if wts else None
    # sleep
    sl = await db.sleep_logs.find_one({"user_id": uid, "date": today}, {"_id": 0})
    # metrics
    m = await db.daily_metrics.find_one({"user_id": uid, "date": today}, {"_id": 0}) or {}
    # steps
    steps_sync = await db.health_sync_logs.find_one(
        {"user_id": uid, "date": today, "metric": "steps"}, {"_id": 0})
    steps = steps_sync.get("value", 0) if steps_sync else 0
    # goals / projects
    goals = await db.goals.find({"user_id": uid, "status": {"$ne": "completed"}}, {"_id": 0}).to_list(100)
    projects = await db.projects.find({"user_id": uid, "status": {"$ne": "completed"}}, {"_id": 0}).to_list(100)
    # completion tasks
    tasks = []
    if needed:
        tasks.append({"key": "supplements", "label": "Supplements",
                      "done": taken >= needed, "progress": min(taken / needed, 1) if needed else 1})
    tasks.append({"key": "water", "label": "Water goal",
                  "done": total_water >= goal_water, "progress": min(total_water / goal_water, 1)})
    tasks.append({"key": "meals", "label": "Log meals", "done": len(meals) > 0,
                  "progress": 1 if len(meals) > 0 else 0})
    if habits:
        tasks.append({"key": "habits", "label": "Habits",
                      "done": hlogs >= len(habits), "progress": hlogs / len(habits)})
    tasks.append({"key": "metrics", "label": "Daily check-in",
                  "done": bool(m.get("mood")), "progress": 1 if m.get("mood") else 0})
    completion = round(sum(min(t["progress"], 1) for t in tasks) / len(tasks) * 100) if tasks else 0
    hs = await compute_health_score(user)
    return {
        "date": today,
        "completion_percent": completion,
        "tasks": tasks,
        "health_score": hs["overall"],
        "widgets": {
            "supplements": {"taken": taken, "needed": needed},
            "water": {"total": total_water, "goal": goal_water,
                      "percent": min(round(total_water / goal_water * 100), 100) if goal_water else 0},
            "meals": {"count": len(meals), "calories": cals, "protein": protein},
            "weight": {"current": current_weight, "target": profile.get("target_weight")},
            "steps": {"value": steps, "goal": 10000},
            "sleep": {"duration": sl.get("duration") if sl else None,
                      "goal": profile.get("sleep_goal_hours", 8)},
            "energy": {"value": m.get("energy")},
            "focus": {"value": m.get("focus")},
            "mood": {"value": m.get("mood")},
            "habits": {"done": hlogs, "total": len(habits)},
            "goals": {"active": len(goals)},
            "projects": {"active": len(projects)},
        },
    }


# ----------------------------- ANALYTICS -----------------------------
def correlation(xs, ys):
    n = len(xs)
    if n < 3:
        return None
    mx = sum(xs) / n
    my = sum(ys) / n
    num = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    dx = sum((x - mx) ** 2 for x in xs) ** 0.5
    dy = sum((y - my) ** 2 for y in ys) ** 0.5
    if dx == 0 or dy == 0:
        return None
    return round(num / (dx * dy), 2)


@api.get("/analytics")
async def analytics(days: int = 30, user: dict = Depends(get_current_user)):
    uid = user["user_id"]
    start = date.today() - timedelta(days=days - 1)
    s = start.isoformat()
    metrics = await db.daily_metrics.find({"user_id": uid, "date": {"$gte": s}}, {"_id": 0}).to_list(5000)
    sleep = await db.sleep_logs.find({"user_id": uid, "date": {"$gte": s}}, {"_id": 0}).to_list(5000)
    water = await db.water_logs.find({"user_id": uid, "date": {"$gte": s}}, {"_id": 0}).to_list(50000)
    suplogs = await db.supplement_logs.find({"user_id": uid, "date": {"$gte": s}}, {"_id": 0}).to_list(50000)
    steps_logs = await db.health_sync_logs.find(
        {"user_id": uid, "metric": "steps", "date": {"$gte": s}}, {"_id": 0}).to_list(5000)

    metric_by_date = {m["date"]: m for m in metrics}
    sleep_by_date = {x["date"]: x.get("duration", 0) for x in sleep}
    water_by_date: Dict[str, int] = {}
    for w in water:
        water_by_date[w["date"]] = water_by_date.get(w["date"], 0) + w["amount"]
    sup_by_date: Dict[str, int] = {}
    for lg in suplogs:
        sup_by_date[lg["date"]] = sup_by_date.get(lg["date"], 0) + 1
    steps_by_date = {x["date"]: x.get("value", 0) for x in steps_logs}

    insights = []

    def build(pairs):
        xs = [p[0] for p in pairs]
        ys = [p[1] for p in pairs]
        return correlation(xs, ys)

    # Sleep vs Energy
    pe = [(sleep_by_date[d], metric_by_date[d]["energy"]) for d in sleep_by_date
          if d in metric_by_date and metric_by_date[d].get("energy")]
    c = build(pe)
    if c is not None:
        insights.append({"title": "Sleep vs Energy", "value": c,
                         "text": "More sleep tends to raise your energy." if c > 0.3
                         else "Little link between your sleep and energy so far."})
    # Water vs Focus
    pf = [(water_by_date[d], metric_by_date[d]["focus"]) for d in water_by_date
          if d in metric_by_date and metric_by_date[d].get("focus")]
    c = build(pf)
    if c is not None:
        insights.append({"title": "Water vs Focus", "value": c,
                         "text": "Higher hydration aligns with better focus." if c > 0.3
                         else "Hydration shows a weak link with focus."})
    # Supplements vs Mood
    pm = [(sup_by_date.get(d, 0), metric_by_date[d]["mood"]) for d in metric_by_date
          if metric_by_date[d].get("mood")]
    c = build(pm)
    if c is not None:
        insights.append({"title": "Supplement Consistency vs Mood", "value": c,
                         "text": "Consistent supplements align with better mood." if c > 0.3
                         else "Supplements show a weak link with mood."})
    # Steps vs Energy
    ps = [(steps_by_date[d], metric_by_date[d]["energy"]) for d in steps_by_date
          if d in metric_by_date and metric_by_date[d].get("energy")]
    c = build(ps)
    if c is not None:
        insights.append({"title": "Steps vs Energy", "value": c,
                         "text": "More steps relate to higher energy." if c > 0.3
                         else "Steps show a weak link with energy."})

    # trend series
    def series(getter, key):
        out = []
        for i in range(days):
            d = (date.today() - timedelta(days=days - 1 - i)).isoformat()
            out.append({"date": d, "value": getter(d)})
        return out

    trends = {
        "energy": series(lambda d: metric_by_date.get(d, {}).get("energy"), "energy"),
        "focus": series(lambda d: metric_by_date.get(d, {}).get("focus"), "focus"),
        "mood": series(lambda d: metric_by_date.get(d, {}).get("mood"), "mood"),
        "sleep": series(lambda d: sleep_by_date.get(d), "sleep"),
        "water": series(lambda d: water_by_date.get(d, 0), "water"),
    }
    return {"insights": insights, "trends": trends}


# ----------------------------- HEALTH SYNC (mock / future-ready) -----------------------------
@api.get("/health-sync/status")
async def sync_status(user: dict = Depends(get_current_user)):
    cfg = await db.health_sync_config.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not cfg:
        cfg = {"user_id": user["user_id"], "connected": False, "auto_sync": False,
               "provider": None, "metrics": ["steps", "distance", "active_calories", "sleep", "weight", "workouts"],
               "last_sync": None}
        await db.health_sync_config.insert_one(dict(cfg))
        cfg.pop("_id", None)
    history = await db.health_sync_logs.find(
        {"user_id": user["user_id"]}, {"_id": 0}).sort("date", -1).to_list(60)
    return {"config": clean(cfg), "history": history}


@api.put("/health-sync/config")
async def update_sync_config(body: Dict[str, Any], user: dict = Depends(get_current_user)):
    body.pop("_id", None)
    body.pop("user_id", None)
    await db.health_sync_config.update_one(
        {"user_id": user["user_id"]}, {"$set": body}, upsert=True)
    cfg = await db.health_sync_config.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return cfg


@api.post("/health-sync/sync")
async def run_sync(user: dict = Depends(get_current_user)):
    """Mock sync: generates plausible values for the connected metrics for today.

    Future-ready: replace this body with a real Health Connect / Samsung Health
    bridge once running in a native build.
    """
    import random
    uid = user["user_id"]
    today = today_str()
    cfg = await db.health_sync_config.find_one({"user_id": uid}, {"_id": 0}) or {}
    metrics = cfg.get("metrics", ["steps", "distance", "active_calories", "sleep", "weight", "workouts"])
    generated = {
        "steps": random.randint(4000, 12000),
        "distance": round(random.uniform(3, 9), 1),
        "active_calories": random.randint(300, 800),
        "sleep": round(random.uniform(6, 8.5), 1),
        "weight": None,
        "workouts": random.randint(0, 2),
    }
    results = {}
    for mt in metrics:
        val = generated.get(mt)
        if val is None:
            continue
        await db.health_sync_logs.update_one(
            {"user_id": uid, "date": today, "metric": mt},
            {"$set": {"id": new_id("hs_"), "user_id": uid, "date": today, "metric": mt,
                      "value": val, "source": "mock", "synced_at": now_utc().isoformat()}},
            upsert=True)
        results[mt] = val
    await db.health_sync_config.update_one(
        {"user_id": uid}, {"$set": {"last_sync": now_utc().isoformat(), "connected": True}}, upsert=True)
    return {"ok": True, "synced": results}


# ----------------------------- RULE-BASED STATS REPORT -----------------------------
async def gather_stats_context(uid: str, days: int = 30) -> dict:
    start = date.today() - timedelta(days=days - 1)
    s = start.isoformat()
    metrics = await db.daily_metrics.find({"user_id": uid, "date": {"$gte": s}}, {"_id": 0}).to_list(5000)
    sleep = await db.sleep_logs.find({"user_id": uid, "date": {"$gte": s}}, {"_id": 0}).to_list(5000)
    water = await db.water_logs.find({"user_id": uid, "date": {"$gte": s}}, {"_id": 0}).to_list(50000)
    suplogs = await db.supplement_logs.find({"user_id": uid, "date": {"$gte": s}}, {"_id": 0}).to_list(50000)
    weights = await db.weight_logs.find({"user_id": uid}, {"_id": 0}).sort("date", 1).to_list(500)
    meals = await db.meals.find({"user_id": uid, "date": {"$gte": s}}, {"_id": 0}).to_list(50000)

    water_by_date: Dict[str, int] = {}
    for w in water:
        water_by_date[w["date"]] = water_by_date.get(w["date"], 0) + w["amount"]
    # weekend miss detection
    weekend_logs = sum(1 for lg in suplogs if datetime.fromisoformat(lg["date"]).weekday() >= 5)
    weekday_logs = len(suplogs) - weekend_logs
    return {
        "days": days,
        "avg_sleep": round(sum(x.get("duration", 0) or 0 for x in sleep) / len(sleep), 1) if sleep else None,
        "avg_water": round(sum(water_by_date.values()) / len(water_by_date)) if water_by_date else None,
        "avg_energy": round(sum(m.get("energy", 0) or 0 for m in metrics if m.get("energy")) / max(len([m for m in metrics if m.get("energy")]), 1), 1) if metrics else None,
        "avg_mood": round(sum(m.get("mood", 0) or 0 for m in metrics if m.get("mood")) / max(len([m for m in metrics if m.get("mood")]), 1), 1) if metrics else None,
        "avg_focus": round(sum(m.get("focus", 0) or 0 for m in metrics if m.get("focus")) / max(len([m for m in metrics if m.get("focus")]), 1), 1) if metrics else None,
        "supplement_logs_total": len(suplogs),
        "weekend_supplement_logs": weekend_logs,
        "weekday_supplement_logs": weekday_logs,
        "weight_start": weights[0]["weight"] if weights else None,
        "weight_current": weights[-1]["weight"] if weights else None,
        "meals_logged": len(meals),
        "avg_calories": round(sum(m.get("calories", 0) or 0 for m in meals) / max(len(set(m["date"] for m in meals)), 1)) if meals else None,
    }


def _build_stat_lines(ctx: dict) -> List[dict]:
    """Pure rule-based highlights derived from aggregated metrics."""
    out: List[dict] = []
    if ctx.get("avg_sleep") is not None:
        good = ctx["avg_sleep"] >= 7
        out.append({"icon": "moon", "tone": "good" if good else "warn",
                    "text": f"Averaged {ctx['avg_sleep']}h of sleep" + ("" if good else " — aim for 7-9h")})
    if ctx.get("avg_water") is not None:
        out.append({"icon": "water", "tone": "info",
                    "text": f"Average hydration was {ctx['avg_water']}ml/day"})
    if ctx.get("weekday_supplement_logs") and ctx.get("weekend_supplement_logs") is not None:
        if ctx["weekend_supplement_logs"] < ctx["weekday_supplement_logs"] / 2.5:
            out.append({"icon": "alert-circle", "tone": "warn",
                        "text": "You tend to miss supplements more on weekends"})
        else:
            out.append({"icon": "checkmark-circle", "tone": "good",
                        "text": "Supplement intake is consistent across the week"})
    if ctx.get("avg_energy") is not None and ctx.get("avg_mood") is not None:
        out.append({"icon": "flash", "tone": "info",
                    "text": f"Energy averaged {ctx['avg_energy']}/10 and mood {ctx['avg_mood']}/10"})
    if ctx.get("weight_start") is not None and ctx.get("weight_current") is not None:
        delta = round(ctx["weight_current"] - ctx["weight_start"], 1)
        if abs(delta) >= 0.1:
            arrow = "trending-down" if delta < 0 else "trending-up"
            out.append({"icon": arrow, "tone": "info",
                        "text": f"Weight changed by {delta:+}kg over the tracked period"})
    if ctx.get("avg_calories") is not None:
        out.append({"icon": "restaurant", "tone": "info",
                    "text": f"Logged ~{ctx['avg_calories']} kcal/day across {ctx['meals_logged']} meals"})
    return out


def _build_suggestion(ctx: dict) -> str:
    if ctx.get("avg_sleep") is not None and ctx["avg_sleep"] < 7:
        return "Try winding down 30 minutes earlier to push sleep toward 7-9 hours."
    if ctx.get("avg_water") is not None and ctx["avg_water"] < 2000:
        return "Add one more glass of water mid-afternoon to lift your daily hydration."
    if ctx.get("weekday_supplement_logs") and ctx.get("weekend_supplement_logs", 0) < ctx["weekday_supplement_logs"] / 2.5:
        return "Set a weekend reminder so your supplement streak stays unbroken."
    return "You're trending well — keep logging daily to sharpen these stats."


@api.get("/stats/report")
async def stats_report(period: str = "weekly", user: dict = Depends(get_current_user)):
    days = 7 if period == "weekly" else 30
    ctx = await gather_stats_context(user["user_id"], days)
    lines = _build_stat_lines(ctx)
    has_data = bool(lines) or ctx.get("supplement_logs_total", 0) > 0 or ctx.get("meals_logged", 0) > 0
    summary = (
        f"Here's your {period} snapshot based on the last {days} days of tracking."
        if has_data else
        "Not enough data yet — log a few days of sleep, water, supplements and metrics to see your stats."
    )
    return {
        "period": period,
        "days": days,
        "summary": summary,
        "highlights": lines,
        "suggestion": _build_suggestion(ctx) if has_data else None,
        "metrics": ctx,
        "generated_at": now_utc().isoformat(),
    }


# ----------------------------- EXPORT -----------------------------
@api.get("/export")
async def export_data(user: dict = Depends(get_current_user)):
    uid = user["user_id"]
    collections = ["supplements", "supplement_logs", "meals", "meal_templates", "recipes",
                   "meal_prep_batches", "shopping_lists", "water_logs", "weight_logs",
                   "sleep_logs", "daily_metrics", "goals", "habits", "habit_logs",
                   "projects", "journal_entries", "weekly_reviews", "health_sync_logs",
                   "reminder_schedules"]
    data = {}
    for c in collections:
        data[c] = await db[c].find({"user_id": uid}, {"_id": 0}).to_list(100000)
    data["profile"] = user.get("profile", {})
    data["exported_at"] = now_utc().isoformat()
    return data


# ----------------------------- startup -----------------------------
@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.user_sessions.create_index("session_token", unique=True)
    await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
    logger.info("LifeSync API started")


@api.get("/")
async def root():
    return {"app": "LifeSync", "status": "ok"}


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
