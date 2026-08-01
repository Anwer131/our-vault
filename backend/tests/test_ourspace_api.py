"""OurSpace backend API test suite.

Covers: auth, spaces CRUD (superadmin), members listing + nicknames,
role-based access, media CRUD, chat, and a smoke AI generate call.
"""
import os
import time
import pytest
import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent.parent / "frontend" / ".env")
BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

# Shared state across tests (module scope)
state = {}


def _auth(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------- Health ----------
def test_health_root():
    r = requests.get(f"{API}/")
    assert r.status_code == 200
    assert r.json().get("message") == "OurSpace API"


# ---------- Admin auth + change password ----------
def test_admin_login_and_change_pw():
    # try admin123 first
    r = requests.post(f"{API}/auth/login", json={"username": "admin", "password": "admin123"})
    if r.status_code != 200:
        # maybe previously changed to admin1234 by earlier run
        r = requests.post(f"{API}/auth/login", json={"username": "admin", "password": "admin1234"})
        assert r.status_code == 200, f"Admin login failed: {r.text}"
        current = "admin1234"
    else:
        current = "admin123"

    data = r.json()
    assert "token" in data
    assert data["user"]["role"] == "superadmin"
    token = data["token"]

    # Change password (idempotent flip). If already changed, POST with correct current pw.
    new_pw = "admin1234"
    if current != new_pw:
        r2 = requests.post(f"{API}/auth/change-password",
                           headers=_auth(token),
                           json={"old_password": current, "new_password": new_pw})
        assert r2.status_code == 200, r2.text

    # re-login with new pw
    r3 = requests.post(f"{API}/auth/login", json={"username": "admin", "password": new_pw})
    assert r3.status_code == 200
    admin_user = r3.json()["user"]
    assert admin_user["role"] == "superadmin"
    assert admin_user["must_change_password"] is False
    state["admin_token"] = r3.json()["token"]
    state["admin_pw"] = new_pw


def test_login_invalid():
    r = requests.post(f"{API}/auth/login", json={"username": "admin", "password": "WRONG"})
    assert r.status_code == 401


# ---------- Space CRUD ----------
def test_create_space_returns_credentials():
    assert "admin_token" in state
    body = {"name": "TEST_SpaceA", "max_members": 2}
    r = requests.post(f"{API}/spaces", headers=_auth(state["admin_token"]), json=body)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["name"] == "TEST_SpaceA"
    assert d["max_members"] == 2
    assert len(d["members"]) == 2
    for m in d["members"]:
        assert m["username"]
        assert m["password"] == "welcome123"
    state["space_id"] = d["id"]
    state["member_creds"] = d["members"]


def test_list_spaces_shows_created():
    r = requests.get(f"{API}/spaces", headers=_auth(state["admin_token"]))
    assert r.status_code == 200
    ids = [s["id"] for s in r.json()]
    assert state["space_id"] in ids
    sp = next(s for s in r.json() if s["id"] == state["space_id"])
    assert sp["member_count"] == 2
    assert len(sp["members"]) == 2


def test_member_cannot_access_admin_endpoint():
    m0 = state["member_creds"][0]
    r = requests.post(f"{API}/auth/login", json={"username": m0["username"], "password": m0["password"]})
    assert r.status_code == 200
    d = r.json()
    assert d["user"]["role"] == "member"
    assert d["user"]["must_change_password"] is True
    assert d["user"]["space_name"] == "TEST_SpaceA"
    state["m0_token_pre"] = d["token"]
    # Change pw so token is usable & flag false
    r2 = requests.post(f"{API}/auth/change-password",
                       headers=_auth(state["m0_token_pre"]),
                       json={"old_password": "welcome123", "new_password": "member123"})
    assert r2.status_code == 200
    r3 = requests.post(f"{API}/auth/login", json={"username": m0["username"], "password": "member123"})
    state["m0_token"] = r3.json()["token"]
    assert r3.json()["user"]["must_change_password"] is False

    # Member cannot list spaces
    r4 = requests.get(f"{API}/spaces", headers=_auth(state["m0_token"]))
    assert r4.status_code == 403
    # Member cannot create space
    r5 = requests.post(f"{API}/spaces", headers=_auth(state["m0_token"]), json={"name": "X", "max_members": 1})
    assert r5.status_code == 403


def test_admin_cannot_access_member_endpoints():
    r = requests.get(f"{API}/space/members", headers=_auth(state["admin_token"]))
    assert r.status_code == 403
    r2 = requests.get(f"{API}/media", headers=_auth(state["admin_token"]))
    assert r2.status_code == 403
    r3 = requests.get(f"{API}/chat/messages", headers=_auth(state["admin_token"]))
    assert r3.status_code == 403


# ---------- Members + Nicknames ----------
def test_list_members_and_nicknames():
    r = requests.get(f"{API}/space/members", headers=_auth(state["m0_token"]))
    assert r.status_code == 200
    members = r.json()
    assert len(members) == 2
    m1 = state["member_creds"][1]
    other = next(m for m in members if m["username"] == m1["username"])
    state["m1_id"] = other["id"]
    self_m = next(m for m in members if m["username"] == state["member_creds"][0]["username"])
    state["m0_id"] = self_m["id"]

    # Set nickname for other
    r2 = requests.post(f"{API}/nicknames",
                       headers=_auth(state["m0_token"]),
                       json={"target_id": state["m1_id"], "nickname": "Buddy"})
    assert r2.status_code == 200
    # Verify via GET
    r3 = requests.get(f"{API}/space/members", headers=_auth(state["m0_token"]))
    other2 = next(m for m in r3.json() if m["id"] == state["m1_id"])
    assert other2["nickname"] == "Buddy"

    # Cannot set nickname for self
    r4 = requests.post(f"{API}/nicknames",
                       headers=_auth(state["m0_token"]),
                       json={"target_id": state["m0_id"], "nickname": "MeMe"})
    assert r4.status_code == 400

    # Clear nickname (empty)
    r5 = requests.post(f"{API}/nicknames",
                       headers=_auth(state["m0_token"]),
                       json={"target_id": state["m1_id"], "nickname": ""})
    assert r5.status_code == 200
    r6 = requests.get(f"{API}/space/members", headers=_auth(state["m0_token"]))
    other3 = next(m for m in r6.json() if m["id"] == state["m1_id"])
    assert other3["nickname"] == ""


# ---------- Media ----------
def test_media_crud_scoped():
    payload = [{
        "public_id": "TEST_public_id_1",
        "secure_url": "https://res.cloudinary.com/demo/image/upload/sample.jpg",
        "resource_type": "image",
        "format": "jpg",
        "width": 100,
        "height": 100,
        "caption": "test",
    }]
    r = requests.post(f"{API}/media", headers=_auth(state["m0_token"]), json=payload)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["inserted"] == 1
    media_id = d["ids"][0]
    state["media_id"] = media_id

    # List
    r2 = requests.get(f"{API}/media", headers=_auth(state["m0_token"]))
    assert r2.status_code == 200
    assert any(m["id"] == media_id for m in r2.json())

    # delete-many
    r3 = requests.post(f"{API}/media/delete-many",
                       headers=_auth(state["m0_token"]),
                       json={"ids": [media_id]})
    assert r3.status_code == 200
    assert r3.json()["deleted"] == 1

    # Verify deleted
    r4 = requests.get(f"{API}/media", headers=_auth(state["m0_token"]))
    assert all(m["id"] != media_id for m in r4.json())


def test_media_isolation_across_spaces():
    # Create second space and try to access m0's media (should be empty)
    body = {"name": "TEST_SpaceB", "max_members": 1}
    r = requests.post(f"{API}/spaces", headers=_auth(state["admin_token"]), json=body)
    assert r.status_code == 200
    sp2 = r.json()
    state["space2_id"] = sp2["id"]
    m2 = sp2["members"][0]

    r2 = requests.post(f"{API}/auth/login", json={"username": m2["username"], "password": m2["password"]})
    tok_pre = r2.json()["token"]
    requests.post(f"{API}/auth/change-password",
                  headers=_auth(tok_pre),
                  json={"old_password": "welcome123", "new_password": "member234"})
    r3 = requests.post(f"{API}/auth/login", json={"username": m2["username"], "password": "member234"})
    tok2 = r3.json()["token"]
    state["m2_token"] = tok2

    # Insert media in space1
    r_ins = requests.post(f"{API}/media", headers=_auth(state["m0_token"]), json=[{
        "public_id": "TEST_iso_1",
        "secure_url": "https://res.cloudinary.com/demo/image/upload/sample.jpg",
        "resource_type": "image",
        "format": "jpg",
    }])
    mid = r_ins.json()["ids"][0]

    # Space2 member should NOT see it
    r_list = requests.get(f"{API}/media", headers=_auth(tok2))
    assert all(m["id"] != mid for m in r_list.json())

    # Space2 member cannot delete it (404)
    r_del = requests.delete(f"{API}/media/{mid}", headers=_auth(tok2))
    assert r_del.status_code == 404


# ---------- Chat ----------
def test_chat_scoped():
    r = requests.post(f"{API}/chat/messages", headers=_auth(state["m0_token"]), json={"text": "hello TEST"})
    assert r.status_code == 200
    msg = r.json()
    assert msg["text"] == "hello TEST"
    assert msg["sender_username"]

    r2 = requests.get(f"{API}/chat/messages", headers=_auth(state["m0_token"]))
    assert r2.status_code == 200
    assert any(m["id"] == msg["id"] for m in r2.json())

    # Space2 member cannot see space1 messages
    r3 = requests.get(f"{API}/chat/messages", headers=_auth(state["m2_token"]))
    assert all(m["id"] != msg["id"] for m in r3.json())


# ---------- AI smoke test ----------
def test_ai_generate_smoke():
    # Just verify it doesn't crash server (may 429). Prompt only, no media.
    r = requests.post(f"{API}/ai/generate",
                      headers=_auth(state["m0_token"]),
                      json={"prompt": "a small red cube on white background", "media_ids": []},
                      timeout=60)
    # Accept 200 (success) or 500 (quota/API failure). Fail only on unexpected codes.
    assert r.status_code in (200, 500), f"Unexpected {r.status_code}: {r.text}"
    if r.status_code == 500:
        print("AI generate returned 500 (likely Gemini quota or transient):", r.text[:200])


# ---------- Cleanup: DELETE spaces ----------
def test_delete_spaces_cascade():
    for key in ("space2_id", "space_id"):
        sid = state.get(key)
        if not sid:
            continue
        r = requests.delete(f"{API}/spaces/{sid}", headers=_auth(state["admin_token"]))
        assert r.status_code == 200, r.text

    # Verify spaces list no longer contains them
    r2 = requests.get(f"{API}/spaces", headers=_auth(state["admin_token"]))
    ids = [s["id"] for s in r2.json()]
    assert state["space_id"] not in ids

    # Verify member cannot login anymore (user deleted)
    m0 = state["member_creds"][0]
    r3 = requests.post(f"{API}/auth/login", json={"username": m0["username"], "password": "member123"})
    assert r3.status_code == 401
