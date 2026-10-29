import pytest

from app import create_app


@pytest.fixture(scope="session")
def app(tmp_path_factory):
    tmp = tmp_path_factory.mktemp("loanlens")
    return create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": f"sqlite:///{tmp / 'test.db'}", "MODEL_DIR": str(tmp / "models"),
                       "TRAIN_SAMPLES": 3000, "RF_TREES": 60, "ADMIN_EMAIL": "admin@test.io", "ADMIN_PASSWORD": "Admin@12345"})


@pytest.fixture()
def client(app):
    return app.test_client()


def _auth(client, email, password, name="Test User"):
    client.post("/api/auth/register", json={"name": name, "email": email, "password": password})
    r = client.post("/api/auth/login", json={"email": email, "password": password})
    return {"Authorization": f"Bearer {r.get_json()['token']}"}


@pytest.fixture()
def applicant(client):
    return _auth(client, "applicant@test.io", "Passw0rdOK")


@pytest.fixture()
def other(client):
    return _auth(client, "other@test.io", "Passw0rdOK", "Other User")


@pytest.fixture()
def admin(client):
    r = client.post("/api/auth/login", json={"email": "admin@test.io", "password": "Admin@12345"})
    return {"Authorization": f"Bearer {r.get_json()['token']}"}


GOOD_PERSONAL = dict(age=34, dependents=1, employment_type="salaried", employment_years=7, monthly_income=120_000, credit_score=790,
                     existing_emi=5_000, loan_amount=200_000, tenure_months=36, savings=400_000, purpose="medical")
