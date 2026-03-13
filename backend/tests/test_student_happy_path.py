"""
Student Happy Path E2E Test

End-to-end test that walks through the full student journey:
1. Seeds an invite code and RA application posting directly in MongoDB
2. Student verifies invite code and registers via the API
3. Student receives an access token (lands on dashboard)
4. Student fetches RA applications
5. Student submits an RA application
6. Asserts success response from the API
7. Queries MongoDB directly to confirm the RAApplicationSubmission record exists
8. Cleans up all test data automatically via fixture finalizer
"""
import pytest
import requests
import os
import uuid
import asyncio
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'http://localhost:8000').rstrip('/')
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')

TEST_STUDENT_EMAIL = f"e2e_student_{uuid.uuid4().hex[:8]}@test.quadley.app"
TEST_STUDENT_FIRST = "E2ETest"
TEST_STUDENT_LAST = "Student"
TEST_STUDENT_PASSWORD = "TestP@ss1word!"
TEST_INVITE_CODE = f"E2E-{uuid.uuid4().hex[:4].upper()}"

TEST_RA_APP_ID = str(uuid.uuid4())
TEST_RA_APP_TITLE = f"E2E RA Application {uuid.uuid4().hex[:6]}"
TEST_RA_RESPONSE = "I am passionate about residential life and want to support fellow students."
TEST_RESUME_URL = "https://example.com/resume/e2e-test.pdf"


def _run_async(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@pytest.fixture(scope="module")
def tenant_code():
    async def find_active_tenant():
        client = AsyncIOMotorClient(MONGO_URL)
        try:
            master = client["quadley_master"]
            tenant = await master.tenants.find_one(
                {"status": "active"},
                {"_id": 0, "code": 1, "name": 1},
            )
            assert tenant, "No active tenant found in quadley_master"
            return tenant["code"]
        finally:
            client.close()

    code = _run_async(find_active_tenant())
    yield code

    async def cleanup():
        client = AsyncIOMotorClient(MONGO_URL)
        try:
            master = client["quadley_master"]
            tenant_db = client[f"quadley_tenant_{code.lower()}"]
            await master.invitations.delete_many({"email": TEST_STUDENT_EMAIL})
            await tenant_db.users.delete_many({"email": TEST_STUDENT_EMAIL})
            await tenant_db.ra_application_submissions.delete_many(
                {"ra_application_id": TEST_RA_APP_ID}
            )
            await tenant_db.ra_applications.delete_many({"id": TEST_RA_APP_ID})
        finally:
            client.close()

    _run_async(cleanup())


@pytest.fixture(scope="module")
def seeded_invite(tenant_code):
    now = datetime.now(timezone.utc)
    invitation_doc = {
        "id": str(uuid.uuid4()),
        "tenant_code": tenant_code,
        "email": TEST_STUDENT_EMAIL,
        "role": "student",
        "first_name": TEST_STUDENT_FIRST,
        "last_name": TEST_STUDENT_LAST,
        "token": str(uuid.uuid4()),
        "invite_code": TEST_INVITE_CODE,
        "status": "pending",
        "invited_by": "e2e-test-seeder",
        "created_at": now.isoformat(),
        "expires_at": (now + timedelta(days=7)).isoformat(),
        "accepted_at": None,
    }

    async def seed():
        client = AsyncIOMotorClient(MONGO_URL)
        try:
            master = client["quadley_master"]
            await master.invitations.insert_one(invitation_doc.copy())
        finally:
            client.close()

    _run_async(seed())
    return TEST_INVITE_CODE


@pytest.fixture(scope="module")
def seeded_ra_app(tenant_code):
    now = datetime.now(timezone.utc)
    ra_app_doc = {
        "id": TEST_RA_APP_ID,
        "title": TEST_RA_APP_TITLE,
        "description": "Apply to be an RA for the upcoming semester.",
        "requirements": "Must be a current student in good standing.",
        "due_date": "2027-12-31",
        "status": "open",
        "created_by": "e2e-test-seeder",
        "created_at": now.isoformat(),
    }

    async def seed():
        client = AsyncIOMotorClient(MONGO_URL)
        try:
            tenant_db = client[f"quadley_tenant_{tenant_code.lower()}"]
            await tenant_db.ra_applications.insert_one(ra_app_doc.copy())
        finally:
            client.close()

    _run_async(seed())
    return TEST_RA_APP_ID


@pytest.fixture(scope="module")
def student_registration(seeded_invite, tenant_code):
    verify_resp = requests.post(
        f"{BASE_URL}/api/auth/invite-code/verify",
        json={"invite_code": seeded_invite},
    )
    assert verify_resp.status_code == 200, f"Invite verify failed: {verify_resp.text}"
    verify_data = verify_resp.json()
    assert verify_data.get("valid") is True
    assert verify_data.get("email") == TEST_STUDENT_EMAIL

    register_resp = requests.post(
        f"{BASE_URL}/api/auth/invite-code/register",
        json={
            "invite_code": seeded_invite,
            "first_name": TEST_STUDENT_FIRST,
            "last_name": TEST_STUDENT_LAST,
            "password": TEST_STUDENT_PASSWORD,
        },
    )
    assert register_resp.status_code == 200, f"Registration failed: {register_resp.text}"
    reg_data = register_resp.json()
    assert "access_token" in reg_data, f"No access_token in registration response: {reg_data}"
    assert reg_data["user"]["email"] == TEST_STUDENT_EMAIL
    assert reg_data["user"]["role"] == "student"
    return reg_data


@pytest.fixture(scope="module")
def student_token(student_registration):
    return student_registration["access_token"]


@pytest.fixture(scope="module")
def student_user(student_registration):
    return student_registration["user"]


class TestStudentHappyPath:

    def test_01_invite_code_seeded(self, seeded_invite):
        assert seeded_invite == TEST_INVITE_CODE

    def test_02_ra_application_seeded(self, seeded_ra_app):
        assert seeded_ra_app == TEST_RA_APP_ID

    def test_03_student_registers_via_invite_code(self, student_registration):
        assert student_registration["access_token"]
        assert student_registration["user"]["email"] == TEST_STUDENT_EMAIL
        assert student_registration["user"]["role"] == "student"

    def test_04_student_can_fetch_ra_applications(self, student_token):
        response = requests.get(
            f"{BASE_URL}/api/ra-applications",
            headers={"Authorization": f"Bearer {student_token}"},
        )
        assert response.status_code == 200, f"Failed to fetch RA apps: {response.text}"
        apps = response.json()
        assert isinstance(apps, list)

    def test_05_student_sees_seeded_ra_application(self, student_token, seeded_ra_app):
        response = requests.get(
            f"{BASE_URL}/api/ra-applications",
            headers={"Authorization": f"Bearer {student_token}"},
        )
        assert response.status_code == 200
        apps = response.json()
        app_ids = [a["id"] for a in apps]
        assert seeded_ra_app in app_ids, f"Seeded RA app {seeded_ra_app} not found in {app_ids}"

    def test_06_student_submits_ra_application(self, student_token, seeded_ra_app):
        response = requests.post(
            f"{BASE_URL}/api/ra-applications/{seeded_ra_app}/submit",
            json={
                "ra_application_id": seeded_ra_app,
                "responses": TEST_RA_RESPONSE,
                "resume_url": TEST_RESUME_URL,
            },
            headers={"Authorization": f"Bearer {student_token}"},
        )
        assert response.status_code == 200, f"RA submission failed: {response.text}"
        data = response.json()
        assert data.get("status") == "pending"
        assert data.get("responses") == TEST_RA_RESPONSE
        assert data.get("resume_url") == TEST_RESUME_URL

    def test_07_database_has_submission(self, student_user, seeded_ra_app, tenant_code):
        async def check_db():
            client = AsyncIOMotorClient(MONGO_URL)
            try:
                db = client[f"quadley_tenant_{tenant_code.lower()}"]
                submission = await db.ra_application_submissions.find_one(
                    {
                        "ra_application_id": seeded_ra_app,
                        "applicant_id": student_user["id"],
                    },
                    {"_id": 0},
                )
                return submission
            finally:
                client.close()

        submission = _run_async(check_db())
        assert submission is not None, "RAApplicationSubmission not found in database"
        assert submission["applicant_id"] == student_user["id"]
        assert submission["responses"] == TEST_RA_RESPONSE
        assert submission["resume_url"] == TEST_RESUME_URL
        assert submission["ra_application_id"] == seeded_ra_app
        assert submission["status"] == "pending"
