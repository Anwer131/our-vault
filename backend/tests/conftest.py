import os
import pytest
import requests
from dotenv import load_dotenv
from pathlib import Path

# Load frontend env to fetch public backend URL
load_dotenv(Path(__file__).resolve().parents[2] / 'frontend' / '.env')

BASE_URL = os.environ['EXPO_PUBLIC_BACKEND_URL'].rstrip('/')


@pytest.fixture(scope='session')
def base_url():
    return BASE_URL


@pytest.fixture
def api_client():
    s = requests.Session()
    s.headers.update({'Content-Type': 'application/json'})
    return s


def _login(client, username, password):
    r = client.post(f"{BASE_URL}/api/auth/login", json={"username": username, "password": password})
    return r


@pytest.fixture(scope='session')
def user1_token():
    """Login user1. If password already changed (401), try TEST_newpass1."""
    s = requests.Session()
    s.headers.update({'Content-Type': 'application/json'})
    # try default
    for pw in ("changeme", "TEST_newpass1"):
        r = s.post(f"{BASE_URL}/api/auth/login", json={"username": "user1", "password": pw})
        if r.status_code == 200:
            data = r.json()
            return {"token": data["token"], "user": data["user"], "password_used": pw}
    pytest.skip("Cannot login as user1 with either default or TEST password")


@pytest.fixture(scope='session')
def user2_token():
    s = requests.Session()
    s.headers.update({'Content-Type': 'application/json'})
    for pw in ("changeme", "TEST_newpass2"):
        r = s.post(f"{BASE_URL}/api/auth/login", json={"username": "user2", "password": pw})
        if r.status_code == 200:
            data = r.json()
            return {"token": data["token"], "user": data["user"], "password_used": pw}
    pytest.skip("Cannot login as user2 with either default or TEST password")


@pytest.fixture
def auth_headers1(user1_token):
    return {"Authorization": f"Bearer {user1_token['token']}", "Content-Type": "application/json"}


@pytest.fixture
def auth_headers2(user2_token):
    return {"Authorization": f"Bearer {user2_token['token']}", "Content-Type": "application/json"}
