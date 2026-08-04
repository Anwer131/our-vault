"""WebSocket notification tests for the OurSpace backend.

Tests:
1. WS connection with valid token succeeds
2. WS connection with invalid token is rejected
3. WS connection without token is rejected
4. Chat notification: when member A sends a message, member B receives it via WS
5. Chat sender exclusion: member A does NOT receive their own message notification
6. Media notification: when member A uploads media, member B receives it via WS
7. Media sender exclusion: member A does NOT receive their own media notification
"""
import os
import json
import asyncio
import pytest
import requests
import websockets
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent.parent / "frontend" / ".env")
# Override to use local backend for testing
BASE_URL = "http://localhost:8000"
API = f"{BASE_URL}/api"
WS_URL = BASE_URL.replace("http://", "ws://").replace("https://", "wss://") + "/ws"

# Shared state across tests (module scope)
state = {}


def _auth(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _setup_space_and_members():
    """Create a space with 2 members and return their tokens."""
    # Login as admin
    r = requests.post(f"{API}/auth/login", json={"username": "admin", "password": "admin123"})
    if r.status_code != 200:
        r = requests.post(f"{API}/auth/login", json={"username": "admin", "password": "admin1234"})
    assert r.status_code == 200, f"Admin login failed: {r.text}"
    admin_token = r.json()["token"]

    # Create a space with 2 members
    r = requests.post(f"{API}/spaces", headers=_auth(admin_token),
                      json={"name": "TEST_WS_Space", "max_members": 2})
    assert r.status_code == 200, f"Failed to create space: {r.text}"
    space_data = r.json()
    space_id = space_data["id"]
    members = space_data["members"]

    # Login + change password for member 0
    r = requests.post(f"{API}/auth/login", json={"username": members[0]["username"], "password": "welcome123"})
    tok_pre_0 = r.json()["token"]
    requests.post(f"{API}/auth/change-password", headers=_auth(tok_pre_0),
                  json={"old_password": "welcome123", "new_password": "member123"})
    r = requests.post(f"{API}/auth/login", json={"username": members[0]["username"], "password": "member123"})
    m0_token = r.json()["token"]
    m0_id = r.json()["user"]["id"]

    # Login + change password for member 1
    r = requests.post(f"{API}/auth/login", json={"username": members[1]["username"], "password": "welcome123"})
    tok_pre_1 = r.json()["token"]
    requests.post(f"{API}/auth/change-password", headers=_auth(tok_pre_1),
                  json={"old_password": "welcome123", "new_password": "member123"})
    r = requests.post(f"{API}/auth/login", json={"username": members[1]["username"], "password": "member123"})
    m1_token = r.json()["token"]
    m1_id = r.json()["user"]["id"]

    return admin_token, space_id, m0_token, m0_id, m1_token, m1_id


def _cleanup_space(admin_token, space_id):
    """Delete a space and all its data."""
    if space_id:
        requests.delete(f"{API}/spaces/{space_id}", headers=_auth(admin_token))


@pytest.fixture(scope="module", autouse=True)
def setup_and_teardown():
    """Setup: create space + members. Teardown: delete space."""
    admin_token, space_id, m0_token, m0_id, m1_token, m1_id = _setup_space_and_members()
    state["admin_token"] = admin_token
    state["space_id"] = space_id
    state["m0_token"] = m0_token
    state["m0_id"] = m0_id
    state["m1_token"] = m1_token
    state["m1_id"] = m1_id
    yield
    _cleanup_space(state["admin_token"], state.get("space_id"))


async def _ws_connect(token, timeout=5):
    """Connect to the WebSocket endpoint with a token. Returns the ws or None."""
    try:
        ws = await asyncio.wait_for(
            websockets.connect(f"{WS_URL}?token={token}"),
            timeout=timeout
        )
        return ws
    except Exception:
        return None


async def _recv_with_timeout(ws, timeout=5):
    """Receive a message from ws with timeout. Returns parsed JSON or None."""
    try:
        raw = await asyncio.wait_for(ws.recv(), timeout=timeout)
        return json.loads(raw)
    except Exception:
        return None


async def _recv_notification(ws, timeout=5):
    """Receive messages, skipping pings, until we get a real notification or timeout."""
    while True:
        msg = await _recv_with_timeout(ws, timeout=timeout)
        if msg is None:
            return None
        if msg.get("type") == "ping":
            continue
        return msg


def test_ws_connect_valid_token():
    """WebSocket connection with a valid member token should succeed."""
    async def run():
        ws = await _ws_connect(state["m0_token"])
        assert ws is not None, "WS connection should succeed with valid token"
        await ws.close()
    asyncio.run(run())


def test_ws_connect_invalid_token():
    """WebSocket connection with an invalid token should be rejected."""
    async def run():
        ws = await _ws_connect("invalid.jwt.token")
        assert ws is None, "WS connection should fail with invalid token"
    asyncio.run(run())


def test_ws_connect_no_token():
    """WebSocket connection without a token should be rejected."""
    async def run():
        try:
            ws = await asyncio.wait_for(
                websockets.connect(WS_URL),
                timeout=5
            )
            # If it connects, it should close immediately
            await asyncio.wait_for(ws.recv(), timeout=3)
            await ws.close()
            assert False, "Should not be able to connect without token"
        except Exception:
            pass  # Expected: connection rejected
    asyncio.run(run())


def test_chat_notification_broadcast():
    """When member 0 sends a chat message, member 1 should receive it via WS."""
    async def run():
        # Member 1 connects via WS
        ws1 = await _ws_connect(state["m1_token"])
        assert ws1 is not None, "Member 1 WS should connect"
        # Give it a moment to register
        await asyncio.sleep(0.5)

        # Member 0 sends a chat message via REST API
        r = requests.post(f"{API}/chat/messages",
                         headers=_auth(state["m0_token"]),
                         json={"text": "Hello from WS test!"})
        assert r.status_code == 200, f"Send message failed: {r.text}"

        # Member 1 should receive the notification via WS
        msg = await _recv_notification(ws1, timeout=5)
        assert msg is not None, "Member 1 should receive a WS notification"
        assert msg["type"] == "chat", f"Expected type 'chat', got {msg.get('type')}"
        assert msg["data"]["text"] == "Hello from WS test!"
        assert msg["data"]["sender_id"] == state["m0_id"]

        await ws1.close()
    asyncio.run(run())


def test_chat_sender_excluded():
    """When member 0 sends a chat message, member 0 should NOT receive it via WS."""
    async def run():
        # Member 0 connects via WS
        ws0 = await _ws_connect(state["m0_token"])
        assert ws0 is not None, "Member 0 WS should connect"
        await asyncio.sleep(0.5)

        # Member 0 sends a chat message via REST API
        r = requests.post(f"{API}/chat/messages",
                         headers=_auth(state["m0_token"]),
                         json={"text": "Self message test"})
        assert r.status_code == 200

        # Member 0 should NOT receive a notification (sender excluded)
        msg = await _recv_notification(ws0, timeout=3)
        assert msg is None, f"Sender should NOT receive their own notification, got: {msg}"

        await ws0.close()
    asyncio.run(run())


def test_media_notification_broadcast():
    """When member 0 uploads media, member 1 should receive it via WS."""
    async def run():
        # Member 1 connects via WS
        ws1 = await _ws_connect(state["m1_token"])
        assert ws1 is not None, "Member 1 WS should connect"
        await asyncio.sleep(0.5)

        # Member 0 uploads media via REST API
        payload = [{
            "public_id": "TEST_ws_media_1",
            "secure_url": "https://res.cloudinary.com/demo/image/upload/sample.jpg",
            "resource_type": "image",
            "format": "jpg",
        }]
        r = requests.post(f"{API}/media", headers=_auth(state["m0_token"]), json=payload)
        assert r.status_code == 200, f"Upload media failed: {r.text}"

        # Member 1 should receive the notification via WS
        msg = await _recv_notification(ws1, timeout=5)
        assert msg is not None, "Member 1 should receive a WS notification"
        assert msg["type"] == "media", f"Expected type 'media', got {msg.get('type')}"
        assert msg["data"]["uploader_id"] == state["m0_id"]
        assert msg["data"]["count"] == 1

        await ws1.close()
    asyncio.run(run())


def test_media_sender_excluded():
    """When member 0 uploads media, member 0 should NOT receive it via WS."""
    async def run():
        # Member 0 connects via WS
        ws0 = await _ws_connect(state["m0_token"])
        assert ws0 is not None, "Member 0 WS should connect"
        await asyncio.sleep(0.5)

        # Member 0 uploads media via REST API
        payload = [{
            "public_id": "TEST_ws_media_self",
            "secure_url": "https://res.cloudinary.com/demo/image/upload/sample.jpg",
            "resource_type": "image",
            "format": "jpg",
        }]
        r = requests.post(f"{API}/media", headers=_auth(state["m0_token"]), json=payload)
        assert r.status_code == 200

        # Member 0 should NOT receive a notification (sender excluded)
        msg = await _recv_notification(ws0, timeout=3)
        assert msg is None, f"Sender should NOT receive their own media notification, got: {msg}"

        await ws0.close()
    asyncio.run(run())