# -*- coding: utf-8 -*-
"""
Đăng nhập demo: cookie phiên ký HMAC + bảng app_users.
RBAC tối thiểu khớp Ma_tran_phan_quyen_DYC.md (QL không ghi phân bổ LOT; KTV không duyệt đơn/PPF; KTV chỉ đọc HR).
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import time
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from starlette.middleware.base import BaseHTTPMiddleware

from database import DbAppUser, SessionLocal

COOKIE_NAME = "dyc_session"
TOKEN_TTL_SEC = int(os.getenv("DYC_SESSION_TTL_SEC", str(7 * 24 * 3600)))
PBKDF2_ITERS = 310_000

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _auth_secret() -> str:
    s = (os.getenv("DYC_AUTH_SECRET") or "").strip()
    if s:
        return s
    return "dyc-dev-only-change-DYC_AUTH_SECRET-in-production"


def hash_password(plain: str) -> str:
    salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac(
        "sha256", plain.encode("utf-8"), salt.encode("ascii"), PBKDF2_ITERS
    )
    return f"pbkdf2_sha256${PBKDF2_ITERS}${salt}${dk.hex()}"


def verify_password(plain: str, stored: str) -> bool:
    try:
        parts = stored.split("$")
        if len(parts) != 4 or parts[0] != "pbkdf2_sha256":
            return False
        iters = int(parts[1])
        salt = parts[2]
        want = parts[3]
        dk = hashlib.pbkdf2_hmac(
            "sha256", plain.encode("utf-8"), salt.encode("ascii"), iters
        )
        return hmac.compare_digest(dk.hex(), want)
    except Exception:
        return False


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def _b64url_decode(s: str) -> bytes:
    pad = "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s + pad)


def sign_session_token(payload: Dict[str, Any]) -> str:
    body = {"iat": int(time.time()), "exp": int(time.time()) + TOKEN_TTL_SEC, **payload}
    raw = json.dumps(body, separators=(",", ":"), sort_keys=True).encode("utf-8")
    body_b64 = _b64url(raw)
    sig = hmac.new(
        _auth_secret().encode("utf-8"), body_b64.encode("ascii"), hashlib.sha256
    ).hexdigest()
    return f"{body_b64}.{sig}"


def verify_session_token(token: str) -> Optional[Dict[str, Any]]:
    if not token or "." not in token:
        return None
    body_b64, sig = token.rsplit(".", 1)
    want = hmac.new(
        _auth_secret().encode("utf-8"), body_b64.encode("ascii"), hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(want, sig):
        return None
    try:
        data = json.loads(_b64url_decode(body_b64).decode("utf-8"))
    except Exception:
        return None
    exp = int(data.get("exp") or 0)
    if exp < int(time.time()):
        return None
    return data


def session_user_from_request(request: Request) -> Optional[Dict[str, Any]]:
    raw = (request.cookies.get(COOKIE_NAME) or "").strip()
    if not raw:
        return None
    data = verify_session_token(raw)
    if not data or data.get("typ") != "dyc_user":
        return None
    return {
        "user_id": data.get("sub"),
        "username": data.get("username"),
        "display_name": data.get("name"),
        "role": data.get("role"),
    }


def session_username(request: Request) -> str:
    """Tên đăng nhập từ phiên — dùng cho audit / approved_by (không tin body.client)."""
    u = getattr(request.state, "auth_user", None) or {}
    return (u.get("username") or "").strip() or "WEB"


def api_permissions_for_role(role: str) -> Dict[str, bool]:
    """
    Quyền UI + khớp middleware RBAC (Ma_tran_phan_quyen_DYC).
    Giá trị True = được phép.
    """
    r = (role or "").strip().upper()
    return {
        "can_write_allocation": r != "MANAGER",
        "can_post_approve_wf_materials": r != "MANAGER",
        "can_approve_request": r != "TECHNICIAN",
        "can_approve_ppf_pending_workstream": r != "TECHNICIAN",
        "can_approve_wf_preflight_commit": r != "MANAGER",
        "can_hr_write": r not in ("TECHNICIAN",),
        "can_admin_reset": r == "ADMIN",
    }


def _auth_exempt(method: str, path: str) -> bool:
    p = path.rstrip("/") or "/"
    if method == "OPTIONS":
        return True
    if p == "/api/auth/login" and method == "POST":
        return True
    if p == "/api/auth/me" and method == "GET":
        return True
    if p == "/api/auth/logout" and method == "POST":
        return True
    return False


def _path_rbac_forbidden(method: str, path: str, role: str) -> Optional[str]:
    """Trả mã lỗi ngắn nếu cấm; None nếu được phép."""
    p = path.split("?", 1)[0].rstrip("/") or "/"

    if role == "MANAGER":
        if method == "PUT" and re.match(
            r"^/api/workstreams/[^/]+/(ppf-allocation|allocation)$", p
        ):
            return "MANAGER_NO_ALLOCATION_WRITE"
        if method == "POST" and re.match(
            r"^/api/workstreams/[^/]+/approve-wf-materials$", p
        ):
            return "MANAGER_NO_ALLOCATION_WRITE"

    if role == "TECHNICIAN":
        if method == "POST" and re.match(r"^/api/requests/[^/]+/approve$", p):
            return "TECHNICIAN_NO_REQUEST_APPROVE"
        if p.startswith("/api/hr") and method not in ("GET", "HEAD", "OPTIONS"):
            return "TECHNICIAN_HR_READ_ONLY"

    if p == "/api/admin/reset-database-standard-seed" and method == "POST":
        if role != "ADMIN":
            return "RESET_ADMIN_ONLY"

    return None


class DycAuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        method = request.method.upper()

        if not path.startswith("/api/"):
            return await call_next(request)

        if _auth_exempt(method, path):
            u = session_user_from_request(request)
            if u:
                request.state.auth_user = u
            return await call_next(request)

        user = session_user_from_request(request)
        if not user or not user.get("role"):
            from fastapi.responses import JSONResponse

            return JSONResponse(
                status_code=401,
                content={
                    "detail": "AUTH_REQUIRED",
                    "message": "Vui lòng đăng nhập.",
                },
            )

        err = _path_rbac_forbidden(method, path, user["role"])
        if err:
            from fastapi.responses import JSONResponse

            return JSONResponse(
                status_code=403,
                content={"detail": err, "message": _rbac_message_vi(err)},
            )

        request.state.auth_user = user
        return await call_next(request)


def _rbac_message_vi(code: str) -> str:
    m = {
        "MANAGER_NO_ALLOCATION_WRITE": "Quản lý không được lưu phân bổ LOT / duyệt mã phim WF trên bảng phân bổ.",
        "TECHNICIAN_NO_REQUEST_APPROVE": "KTV không được phê duyệt đơn thi công.",
        "TECHNICIAN_HR_READ_ONLY": "KTV chỉ xem nhân sự — không được sửa.",
        "RESET_ADMIN_ONLY": "Chỉ Admin được reset CSDL.",
    }
    return m.get(code, "Không đủ quyền.")


def get_db_auth():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class LoginBody(BaseModel):
    username: str = Field(..., min_length=1, max_length=80)
    password: str = Field(..., min_length=1, max_length=200)


@router.post("/login")
def auth_login(body: LoginBody, response: Response, db: Session = Depends(get_db_auth)):
    u = (
        db.query(DbAppUser)
        .filter(DbAppUser.username == body.username.strip().lower())
        .first()
    )
    if not u or not (u.is_active if hasattr(u, "is_active") else True):
        raise HTTPException(401, detail="Sai tên đăng nhập hoặc mật khẩu.")
    if not verify_password(body.password, u.password_hash):
        raise HTTPException(401, detail="Sai tên đăng nhập hoặc mật khẩu.")

    token = sign_session_token(
        {
            "typ": "dyc_user",
            "sub": u.user_id,
            "username": u.username,
            "name": u.display_name or u.username,
            "role": u.role,
        }
    )
    secure = os.getenv("DYC_COOKIE_SECURE", "").lower() in ("1", "true", "yes")
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        max_age=TOKEN_TTL_SEC,
        samesite="lax",
        path="/",
        secure=secure,
    )
    return {
        "ok": True,
        "user": {
            "user_id": u.user_id,
            "username": u.username,
            "display_name": u.display_name,
            "role": u.role,
        },
        "permissions": api_permissions_for_role(u.role),
    }


@router.post("/logout")
def auth_logout(response: Response):
    response.delete_cookie(COOKIE_NAME, path="/")
    return {"ok": True}


@router.get("/me")
def auth_me(request: Request):
    u = session_user_from_request(request)
    if not u:
        return {"authenticated": False, "user": None, "permissions": None}
    return {
        "authenticated": True,
        "user": u,
        "permissions": api_permissions_for_role(u.get("role") or ""),
    }


def rbac_workstream_approve(
    request: Request, ws_status: str, ws_type: str
) -> None:
    """Gọi từ approve_workstream sau khi đã load WS."""
    user = getattr(request.state, "auth_user", None) or {}
    role = user.get("role") or ""
    if role == "MANAGER" and ws_type == "WINDOW_FILM_INSTALLATION":
        if ws_status == "PENDING_TECH_PREFLIGHT":
            raise HTTPException(
                403,
                detail={
                    "error": "MANAGER_NO_TECH_PREFLIGHT_APPROVE",
                    "message": "Bước chốt phân bổ sau chỉnh LOT dành cho KTV/Admin — Quản lý không thực hiện.",
                },
            )
    if role == "TECHNICIAN":
        if ws_type == "PPF_INSTALLATION" and ws_status == "PENDING_APPROVAL":
            raise HTTPException(
                403,
                detail={
                    "error": "TECHNICIAN_NO_PPF_APPROVE",
                    "message": "KTV không được phê duyệt luồng PPF ở bước chờ Quản lý.",
                },
            )
        if ws_type == "WINDOW_FILM_INSTALLATION" and ws_status == "PENDING_APPROVAL":
            raise HTTPException(
                403,
                detail={
                    "error": "TECHNICIAN_NO_WF_PENDING_APPROVAL",
                    "message": "KTV không được duyệt mã phim WF ở bước này — dùng API duyệt mã phim (nếu được) hoặc Quản lý.",
                },
            )


def rbac_request_approve(request: Request) -> None:
    user = getattr(request.state, "auth_user", None) or {}
    if user.get("role") == "TECHNICIAN":
        raise HTTPException(
            403,
            detail={
                "error": "TECHNICIAN_NO_REQUEST_APPROVE",
                "message": "KTV không được phê duyệt đơn thi công.",
            },
        )


def rbac_admin_reset(request: Request) -> None:
    user = getattr(request.state, "auth_user", None) or {}
    if user.get("role") != "ADMIN":
        raise HTTPException(
            403,
            detail={"error": "RESET_ADMIN_ONLY", "message": "Chỉ Admin được reset CSDL."},
        )
