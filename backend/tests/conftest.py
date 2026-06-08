"""Shared pytest fixtures for LifeSync backend tests."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://health-sync-pro-4.preview.emergentagent.com").rstrip("/")


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def auth(session):
    """Login as fixed QA user, fall back to registering a fresh user."""
    email = "qa.tester@lifesync.app"
    password = "QaTest1234!"
    r = session.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=20)
    if r.status_code != 200:
        # Register new fresh user
        email = f"qa_{int(time.time())}@lifesync.app"
        r = session.post(f"{BASE_URL}/api/auth/register",
                         json={"email": email, "password": password, "name": "QA Tester"}, timeout=20)
        assert r.status_code == 200, f"Register failed: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data and "user" in data
    return {"token": data["token"], "user": data["user"], "email": email}


@pytest.fixture(scope="session")
def headers(auth):
    return {"Authorization": f"Bearer {auth['token']}", "Content-Type": "application/json"}
