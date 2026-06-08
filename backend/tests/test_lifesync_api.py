"""LifeSync Backend API tests covering auth, AI removal, stats, dashboard,
supplements CRUD, and water tracking flows."""
import os
import time
import pytest

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://health-sync-pro-4.preview.emergentagent.com").rstrip("/")


# ----------------------------- AUTH -----------------------------
class TestAuth:
    def test_register_fresh_and_login(self, session):
        email = f"qa_test_{int(time.time())}@lifesync.app"
        password = "QaTest1234!"
        r = session.post(f"{BASE_URL}/api/auth/register",
                         json={"email": email, "password": password, "name": "Fresh QA"}, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "token" in data and isinstance(data["token"], str) and len(data["token"]) > 20
        assert data["user"]["email"] == email
        assert "user_id" in data["user"]
        # login
        r2 = session.post(f"{BASE_URL}/api/auth/login",
                          json={"email": email, "password": password}, timeout=20)
        assert r2.status_code == 200, r2.text
        assert r2.json()["user"]["email"] == email

    def test_login_qa_user(self, session, auth):
        # auth fixture already logs in - validate user is set
        assert auth["user"]["email"]
        assert auth["token"]

    def test_login_invalid(self, session):
        r = session.post(f"{BASE_URL}/api/auth/login",
                         json={"email": "qa.tester@lifesync.app", "password": "WRONG_PW"}, timeout=20)
        assert r.status_code == 401

    def test_auth_me(self, session, headers):
        r = session.get(f"{BASE_URL}/api/auth/me", headers=headers, timeout=20)
        assert r.status_code == 200
        assert "user_id" in r.json()

    def test_no_token_returns_401(self, session):
        r = session.get(f"{BASE_URL}/api/auth/me", timeout=20)
        assert r.status_code == 401


# ----------------------------- AI REMOVAL -----------------------------
class TestAIRemoved:
    def test_get_ai_reports_404(self, session, headers):
        r = session.get(f"{BASE_URL}/api/ai/reports", headers=headers, timeout=20)
        assert r.status_code == 404

    def test_post_ai_report_404(self, session, headers):
        r = session.post(f"{BASE_URL}/api/ai/report",
                         headers=headers, json={"period": "weekly"}, timeout=20)
        assert r.status_code == 404


# ----------------------------- STATS REPORT (rule-based) -----------------------------
class TestStatsReport:
    def test_weekly_report(self, session, headers):
        r = session.get(f"{BASE_URL}/api/stats/report?period=weekly", headers=headers, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["period"] == "weekly"
        assert data["days"] == 7
        for k in ("summary", "highlights", "suggestion", "metrics"):
            assert k in data, f"missing key {k}"
        assert isinstance(data["highlights"], list)
        assert isinstance(data["metrics"], dict)
        assert isinstance(data["summary"], str)

    def test_monthly_report(self, session, headers):
        r = session.get(f"{BASE_URL}/api/stats/report?period=monthly", headers=headers, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["period"] == "monthly"
        assert data["days"] == 30
        assert "summary" in data
        assert isinstance(data["highlights"], list)

    def test_stats_requires_auth(self, session):
        r = session.get(f"{BASE_URL}/api/stats/report?period=weekly", timeout=20)
        assert r.status_code == 401


# ----------------------------- DASHBOARD -----------------------------
class TestDashboard:
    def test_summary(self, session, headers):
        r = session.get(f"{BASE_URL}/api/dashboard/summary", headers=headers, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ("date", "completion_percent", "tasks", "health_score", "widgets"):
            assert k in data
        for w in ("supplements", "water", "meals", "weight", "steps", "sleep"):
            assert w in data["widgets"]

    def test_config(self, session, headers):
        r = session.get(f"{BASE_URL}/api/dashboard/config", headers=headers, timeout=20)
        assert r.status_code == 200
        cfg = r.json()
        assert "widgets" in cfg
        assert isinstance(cfg["widgets"], list)
        assert len(cfg["widgets"]) > 0


# ----------------------------- SUPPLEMENTS -----------------------------
class TestSupplements:
    @pytest.fixture(scope="class")
    def created_sup(self, session, headers):
        payload = {"name": "TEST_VitaminD", "dosage": "1000 IU", "daily_servings": 1,
                   "current_stock": 30, "package_size": 30, "purchase_price": 12.5,
                   "refill_threshold": 5}
        r = session.post(f"{BASE_URL}/api/supplements", json=payload, headers=headers, timeout=20)
        assert r.status_code == 200, r.text
        sup = r.json()
        assert sup["name"] == "TEST_VitaminD"
        assert "id" in sup
        assert "computed" in sup
        yield sup
        # cleanup
        session.delete(f"{BASE_URL}/api/supplements/{sup['id']}", headers=headers, timeout=20)

    def test_list_supplements(self, session, headers, created_sup):
        r = session.get(f"{BASE_URL}/api/supplements", headers=headers, timeout=20)
        assert r.status_code == 200
        items = r.json()
        ids = [s["id"] for s in items]
        assert created_sup["id"] in ids

    def test_update_supplement(self, session, headers, created_sup):
        r = session.put(f"{BASE_URL}/api/supplements/{created_sup['id']}",
                        json={"dosage": "2000 IU"}, headers=headers, timeout=20)
        assert r.status_code == 200
        assert r.json()["dosage"] == "2000 IU"

    def test_take_and_untake(self, session, headers, created_sup):
        r = session.post(f"{BASE_URL}/api/supplements/{created_sup['id']}/take",
                         headers=headers, timeout=20)
        assert r.status_code == 200
        # confirm taken_today via list
        r2 = session.get(f"{BASE_URL}/api/supplements", headers=headers, timeout=20)
        sup = next(s for s in r2.json() if s["id"] == created_sup["id"])
        assert sup["taken_today"] >= 1
        # untake
        r3 = session.post(f"{BASE_URL}/api/supplements/{created_sup['id']}/untake",
                          headers=headers, timeout=20)
        assert r3.status_code == 200

    def test_adherence(self, session, headers):
        r = session.get(f"{BASE_URL}/api/supplements/adherence?days=30",
                        headers=headers, timeout=20)
        assert r.status_code == 200
        data = r.json()
        for k in ("overall_percent", "streak", "history", "missed"):
            assert k in data
        assert isinstance(data["history"], list)
        assert len(data["history"]) == 30


# ----------------------------- WATER -----------------------------
class TestWater:
    def test_add_water_and_today(self, session, headers):
        r = session.post(f"{BASE_URL}/api/water", json={"amount": 250}, headers=headers, timeout=20)
        assert r.status_code == 200, r.text
        log = r.json()
        assert log["amount"] == 250
        assert "id" in log

        r2 = session.get(f"{BASE_URL}/api/water/today", headers=headers, timeout=20)
        assert r2.status_code == 200
        today = r2.json()
        for k in ("total", "goal", "logs", "percent"):
            assert k in today
        assert today["total"] >= 250

        # cleanup
        session.delete(f"{BASE_URL}/api/water/{log['id']}", headers=headers, timeout=20)

    def test_water_history(self, session, headers):
        r = session.get(f"{BASE_URL}/api/water/history?days=14", headers=headers, timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert "history" in data and "streak" in data
        assert len(data["history"]) == 14
        sample = data["history"][0]
        for k in ("date", "amount", "goal", "percent"):
            assert k in sample
