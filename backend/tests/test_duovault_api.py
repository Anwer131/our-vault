"""DuoVault backend API tests - covers auth, profile, cloudinary, media, chat, ai."""
import os
import pytest
import requests

BASE_URL = os.environ['EXPO_PUBLIC_BACKEND_URL'].rstrip('/') if os.environ.get('EXPO_PUBLIC_BACKEND_URL') else None


# ==================== Health ====================
class TestHealth:
    def test_root(self):
        r = requests.get(f"{BASE_URL}/api/")
        assert r.status_code == 200
        assert r.json().get("message") == "DuoVault API"


# ==================== Auth ====================
class TestAuth:
    def test_login_user1_success(self, api_client):
        # DB reseeded; try changeme, else fallback (session may already have run change-pw)
        r = api_client.post(f"{BASE_URL}/api/auth/login", json={"username": "user1", "password": "changeme"})
        if r.status_code == 401:
            pytest.skip("user1 password already changed - covered by user1_token fixture")
        assert r.status_code == 200
        data = r.json()
        assert "token" in data and isinstance(data["token"], str) and len(data["token"]) > 20
        assert data["user"]["username"] == "user1"
        assert data["user"]["must_change_password"] is True
        assert "password_hash" not in data["user"]

    def test_login_bad_password(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/auth/login", json={"username": "user1", "password": "wrongpw"})
        assert r.status_code == 401

    def test_login_unknown_user(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/auth/login", json={"username": "nouser", "password": "x"})
        assert r.status_code == 401

    def test_me_requires_auth(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 401

    def test_me_returns_user_without_password(self, auth_headers1):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_headers1)
        assert r.status_code == 200
        data = r.json()
        assert data["username"] == "user1"
        assert "password_hash" not in data
        assert "_id" not in data


# ==================== Change Password ====================
class TestChangePassword:
    def test_wrong_old_password_rejected(self, auth_headers1):
        r = requests.post(f"{BASE_URL}/api/auth/change-password",
                          json={"old_password": "wrongwrong", "new_password": "abcdef"},
                          headers=auth_headers1)
        assert r.status_code == 400

    def test_short_password_rejected(self, auth_headers1, user1_token):
        r = requests.post(f"{BASE_URL}/api/auth/change-password",
                          json={"old_password": user1_token["password_used"], "new_password": "abc"},
                          headers=auth_headers1)
        assert r.status_code == 400

    def test_change_password_flow(self, user1_token):
        """Change to TEST_newpass1 then flip must_change_password=false. Restore back to previous."""
        headers = {"Authorization": f"Bearer {user1_token['token']}", "Content-Type": "application/json"}
        old_pw = user1_token["password_used"]
        new_pw = "TEST_newpass1"
        if old_pw == new_pw:
            new_pw = "TEST_newpass1b"
        r = requests.post(f"{BASE_URL}/api/auth/change-password",
                          json={"old_password": old_pw, "new_password": new_pw},
                          headers=headers)
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True

        # Login again -> must_change_password False
        r2 = requests.post(f"{BASE_URL}/api/auth/login", json={"username": "user1", "password": new_pw})
        assert r2.status_code == 200
        assert r2.json()["user"]["must_change_password"] is False

        # Restore
        new_token = r2.json()["token"]
        h2 = {"Authorization": f"Bearer {new_token}", "Content-Type": "application/json"}
        r3 = requests.post(f"{BASE_URL}/api/auth/change-password",
                           json={"old_password": new_pw, "new_password": old_pw},
                           headers=h2)
        assert r3.status_code == 200


# ==================== Profile ====================
class TestProfile:
    def test_update_and_verify(self, auth_headers1):
        payload = {"name": "TEST_User One", "nickname": "TEST_Sunny", "mobile": "1234567890"}
        r = requests.patch(f"{BASE_URL}/api/users/me", json=payload, headers=auth_headers1)
        assert r.status_code == 200
        doc = r.json()
        assert doc["name"] == payload["name"]
        assert doc["nickname"] == payload["nickname"]
        assert doc["mobile"] == payload["mobile"]
        assert "password_hash" not in doc

        # GET to verify persisted
        r2 = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_headers1)
        assert r2.status_code == 200
        assert r2.json()["nickname"] == "TEST_Sunny"

        # Restore
        requests.patch(f"{BASE_URL}/api/users/me",
                       json={"name": "User One", "nickname": "Sunny", "mobile": ""},
                       headers=auth_headers1)

    def test_list_users(self, auth_headers1):
        r = requests.get(f"{BASE_URL}/api/users", headers=auth_headers1)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 2
        for u in data:
            assert "password_hash" not in u
            assert "_id" not in u


# ==================== Cloudinary Signature ====================
class TestCloudinary:
    def test_signature_requires_auth(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/cloudinary/signature", json={})
        assert r.status_code == 401

    def test_signature_returns_fields(self, auth_headers1):
        r = requests.post(f"{BASE_URL}/api/cloudinary/signature", json={}, headers=auth_headers1)
        assert r.status_code == 200
        data = r.json()
        for k in ("cloud_name", "api_key", "timestamp", "signature", "folder"):
            assert k in data, f"missing {k}"
        assert data["folder"] == "duovault"
        assert isinstance(data["timestamp"], int)
        assert len(data["signature"]) > 20


# ==================== Media ====================
class TestMedia:
    def test_media_requires_auth(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/media")
        assert r.status_code == 401

    def test_create_list_delete_media(self, auth_headers1):
        items = [{
            "public_id": "duovault/TEST_media_1",
            "secure_url": "https://res.cloudinary.com/mnv82wm7/image/upload/v1/duovault/TEST_media_1.jpg",
            "resource_type": "image",
            "format": "jpg",
            "width": 100,
            "height": 100,
            "caption": "TEST_caption"
        }]
        r = requests.post(f"{BASE_URL}/api/media", json=items, headers=auth_headers1)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["inserted"] == 1
        media_id = data["ids"][0]

        # list
        r2 = requests.get(f"{BASE_URL}/api/media", headers=auth_headers1)
        assert r2.status_code == 200
        listed = r2.json()
        assert any(m["id"] == media_id for m in listed)
        # ObjectID excluded
        for m in listed:
            assert "_id" not in m

        # delete single
        r3 = requests.delete(f"{BASE_URL}/api/media/{media_id}", headers=auth_headers1)
        assert r3.status_code == 200

        # verify removed
        r4 = requests.get(f"{BASE_URL}/api/media", headers=auth_headers1)
        assert not any(m["id"] == media_id for m in r4.json())

    def test_delete_nonexistent(self, auth_headers1):
        r = requests.delete(f"{BASE_URL}/api/media/no-such-id", headers=auth_headers1)
        assert r.status_code == 404

    def test_delete_many(self, auth_headers1):
        items = [
            {"public_id": f"duovault/TEST_dm_{i}", "secure_url": f"https://res.cloudinary.com/mnv82wm7/image/upload/v1/duovault/TEST_dm_{i}.jpg", "resource_type": "image", "format": "jpg"}
            for i in range(3)
        ]
        r = requests.post(f"{BASE_URL}/api/media", json=items, headers=auth_headers1)
        assert r.status_code == 200
        ids = r.json()["ids"]

        r2 = requests.post(f"{BASE_URL}/api/media/delete-many", json={"ids": ids}, headers=auth_headers1)
        assert r2.status_code == 200
        assert r2.json()["deleted"] == 3

        # verify gone
        r3 = requests.get(f"{BASE_URL}/api/media", headers=auth_headers1)
        listed_ids = {m["id"] for m in r3.json()}
        for i in ids:
            assert i not in listed_ids

    def test_shared_gallery_between_users(self, auth_headers1, auth_headers2):
        items = [{"public_id": "duovault/TEST_shared", "secure_url": "https://res.cloudinary.com/mnv82wm7/image/upload/v1/duovault/TEST_shared.jpg", "resource_type": "image", "format": "jpg"}]
        r = requests.post(f"{BASE_URL}/api/media", json=items, headers=auth_headers1)
        assert r.status_code == 200
        mid = r.json()["ids"][0]

        # user2 should see it
        r2 = requests.get(f"{BASE_URL}/api/media", headers=auth_headers2)
        assert r2.status_code == 200
        assert any(m["id"] == mid for m in r2.json())

        # cleanup
        requests.delete(f"{BASE_URL}/api/media/{mid}", headers=auth_headers1)


# ==================== Chat ====================
class TestChat:
    def test_chat_requires_auth(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/chat/messages")
        assert r.status_code == 401

    def test_send_and_list_asc(self, auth_headers1, auth_headers2):
        import time as _t
        m1 = requests.post(f"{BASE_URL}/api/chat/messages", json={"text": "TEST_hello from u1"}, headers=auth_headers1)
        assert m1.status_code == 200, m1.text
        d1 = m1.json()
        assert d1["text"] == "TEST_hello from u1"
        assert d1["sender_username"] == "user1"
        assert "_id" not in d1
        _t.sleep(0.05)
        m2 = requests.post(f"{BASE_URL}/api/chat/messages", json={"text": "TEST_reply from u2"}, headers=auth_headers2)
        assert m2.status_code == 200
        d2 = m2.json()
        assert d2["sender_username"] == "user2"

        # list ascending
        r = requests.get(f"{BASE_URL}/api/chat/messages", headers=auth_headers1)
        assert r.status_code == 200
        msgs = r.json()
        # extract our two test messages
        ours = [m for m in msgs if m["id"] in (d1["id"], d2["id"])]
        assert len(ours) == 2
        assert ours[0]["id"] == d1["id"]  # oldest first (asc)
        assert ours[1]["id"] == d2["id"]
        # ISO string dates
        assert isinstance(ours[0]["created_at"], str)


# ==================== AI Generate ====================
class TestAI:
    def test_ai_requires_auth(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/ai/generate", json={"prompt": "hi", "media_ids": []})
        assert r.status_code == 401

    def test_ai_empty_prompt_rejected(self, auth_headers1):
        r = requests.post(f"{BASE_URL}/api/ai/generate", json={"prompt": "  ", "media_ids": []}, headers=auth_headers1)
        assert r.status_code == 400

    def test_ai_generate_smoke(self, auth_headers1):
        """Attempt a generation - may fail on quota. Report but do not fail suite."""
        r = requests.post(f"{BASE_URL}/api/ai/generate",
                          json={"prompt": "TEST a small red circle on white background", "media_ids": []},
                          headers=auth_headers1, timeout=90)
        if r.status_code >= 500:
            pytest.skip(f"Gemini AI unavailable/quota (expected in some envs): {r.status_code} {r.text[:200]}")
        assert r.status_code == 200, r.text
        data = r.json()
        assert "secure_url" in data
        assert data["secure_url"].startswith("https://")
        # cleanup
        requests.delete(f"{BASE_URL}/api/media/{data['id']}", headers=auth_headers1)
