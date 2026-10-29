import pytest

from app.finance import effective_rate, emi, inr, max_principal
from app.loans import LOAN_KEYS, fields_for, validate_application
from app.ml.heuristic import HeuristicPredictor
from tests.conftest import GOOD_PERSONAL


# ---- finance maths ----------------------------------------------------------------------
def test_emi_matches_known_value():
    assert emi(100_000, 12, 12) == pytest.approx(8884.88, abs=0.01)


def test_max_principal_inverts_emi():
    assert max_principal(emi(500_000, 9, 60), 9, 60) == pytest.approx(500_000, rel=1e-6)


def test_weak_credit_pays_more():
    assert effective_rate(12.5, 600) > effective_rate(12.5, 780) == 12.5


def test_inr_grouping():
    assert inr(1234567) == "₹12,34,567" and inr(999) == "₹999" and inr(100000, plain=True) == "Rs. 1,00,000"


# ---- validation -------------------------------------------------------------------------
def test_every_loan_type_has_defaults_that_validate():
    for key in LOAN_KEYS:
        defaults = {f["name"]: f["default"] for f in fields_for(key)}
        clean, errors = validate_application(key, defaults)
        assert not errors, (key, errors)


def test_validation_rejects_bad_input():
    _, errors = validate_application("personal", {**GOOD_PERSONAL, "credit_score": 1200, "age": "abc", "employment_type": "pirate"})
    assert set(errors) == {"credit_score", "age", "employment_type"}


def test_home_loan_cannot_exceed_property_less_down_payment():
    base = {f["name"]: f["default"] for f in fields_for("home")}
    _, errors = validate_application("home", {**base, "loan_amount": 4_900_000, "down_payment": 1_000_000})
    assert "loan_amount" in errors


# ---- auth -------------------------------------------------------------------------------
def test_register_login_and_me(client):
    r = client.post("/api/auth/register", json={"name": "Asha K", "email": "Asha@Test.io", "password": "Secret123"})
    assert r.status_code == 201 and r.get_json()["user"]["role"] == "applicant"
    assert client.post("/api/auth/register", json={"name": "Asha K", "email": "asha@test.io", "password": "Secret123"}).status_code == 409
    token = client.post("/api/auth/login", json={"email": "asha@test.io", "password": "Secret123"}).get_json()["token"]
    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"}).get_json()["user"]["email"] == "asha@test.io"


def test_register_validates_and_login_rejects_wrong_password(client):
    assert client.post("/api/auth/register", json={"name": "A", "email": "nope", "password": "short"}).status_code == 422
    assert client.post("/api/auth/login", json={"email": "ghost@test.io", "password": "x"}).status_code == 401


def test_self_registration_cannot_create_admin(client):
    r = client.post("/api/auth/register", json={"name": "Sneaky", "email": "sneaky@test.io", "password": "Secret123", "role": "admin"})
    assert r.get_json()["user"]["role"] == "applicant"


def test_protected_routes_need_token(client):
    assert client.get("/api/predictions").status_code == 401
    assert client.get("/api/predictions", headers={"Authorization": "Bearer junk"}).status_code == 401


# ---- predictions ------------------------------------------------------------------------
def test_prediction_api_reports_unavailable_model_runtime(client, applicant, app, monkeypatch):
    monkeypatch.setitem(app.extensions, "predictor", None)
    response = _create(client, applicant)
    assert response.status_code == 503
    assert "model runtime" in response.get_json()["error"]


def _create(client, headers, **overrides):
    return client.post("/api/predictions", headers=headers, json={"loan_type": "personal", "input": {**GOOD_PERSONAL, **overrides}})


def test_heuristic_predictor_scores_the_vehicle_loan_demo():
    application = {field["name"]: field["default"] for field in fields_for("vehicle")}
    application.update({
        "age": 32, "dependents": 1, "employment_type": "salaried", "employment_years": 4,
        "monthly_income": 75_000, "credit_score": 730, "existing_emi": 8_000,
        "loan_amount": 700_000, "tenure_months": 60, "vehicle_price": 900_000,
        "down_payment": 200_000, "vehicle_condition": "new",
    })
    clean, errors = validate_application("vehicle", application)
    assert not errors

    result = HeuristicPredictor().analyze(clean)
    assert result["model"]["mode"] == "heuristic"
    assert result["model_probabilities"] is None
    assert result["emi"] == 14_718
    assert 0 <= result["recommendation"]["dti"] <= 100
    assert len(result["stress"]) == 6 and result["explanation"]["factors"]


def test_prediction_has_every_section(client, applicant):
    r = _create(client, applicant)
    assert r.status_code == 201
    p = r.get_json()["prediction"]
    res = p["result"]
    assert 0 <= res["probability"] <= 100 and res["verdict"]["code"] in {"approved", "review", "unlikely"}
    assert res["risk"]["level"] in {"low", "moderate", "high"}
    assert res["explanation"]["factors"] and {"label", "value", "impact"} <= set(res["explanation"]["factors"][0])
    assert res["recommendation"]["amount"] > 0 and res["recommendation"]["requested_tenure_options"]
    assert 0 <= res["recommendation"]["dti"] <= 100
    assert len(res["stress"]) == 6
    if res["model"]["mode"] == "heuristic":
        assert res["model_probabilities"] is None
        assert "not a trained model" in res["explanation"]["method"]
    else:
        assert set(res["model_probabilities"]) == {"logistic_regression", "random_forest"}


def test_strong_profile_beats_weak_profile(client, applicant):
    strong = _create(client, applicant).get_json()["prediction"]["probability"]
    weak = _create(client, applicant, credit_score=480, monthly_income=25_000, existing_emi=11_000, savings=0,
                   employment_years=0.5, loan_amount=900_000).get_json()["prediction"]["probability"]
    assert strong - weak > 40


@pytest.mark.parametrize("loan_type", LOAN_KEYS)
def test_each_loan_type_can_be_scored(client, applicant, loan_type):
    defaults = {f["name"]: f["default"] for f in fields_for(loan_type)}
    r = client.post("/api/predictions", headers=applicant, json={"loan_type": loan_type, "input": defaults})
    assert r.status_code == 201, r.get_json()


def test_invalid_prediction_returns_field_errors(client, applicant):
    r = _create(client, applicant, credit_score=50)
    assert r.status_code == 422 and "credit_score" in r.get_json()["fields"]


def test_history_is_private_and_deletable(client, applicant, other, admin):
    pid = _create(client, applicant).get_json()["prediction"]["id"]
    assert [p["id"] for p in client.get("/api/predictions", headers=applicant).get_json()["predictions"]].count(pid) == 1
    assert client.get("/api/predictions", headers=other).get_json()["predictions"] == []
    assert client.get(f"/api/predictions/{pid}", headers=other).status_code == 404
    assert client.get(f"/api/predictions/{pid}", headers=admin).status_code == 200
    assert client.delete(f"/api/predictions/{pid}", headers=other).status_code == 404
    assert client.delete(f"/api/predictions/{pid}", headers=applicant).status_code == 200


def test_what_if_moves_probability_in_the_right_direction(client, applicant):
    pid = _create(client, applicant, credit_score=640, loan_amount=600_000, monthly_income=70_000).get_json()["prediction"]["id"]
    up = client.post(f"/api/predictions/{pid}/what-if", headers=applicant, json={"changes": {"credit_score": 840, "loan_amount": 200_000}}).get_json()
    down = client.post(f"/api/predictions/{pid}/what-if", headers=applicant, json={"changes": {"credit_score": 450, "existing_emi": 40_000}}).get_json()
    assert up["change"] > 0 > down["change"]
    assert up["baseline"]["probability"] == down["baseline"]["probability"]


def test_pdf_report_downloads(client, applicant, other):
    pid = _create(client, applicant).get_json()["prediction"]["id"]
    r = client.get(f"/api/predictions/{pid}/report", headers=applicant)
    assert r.status_code == 200 and r.mimetype == "application/pdf" and r.data.startswith(b"%PDF") and len(r.data) > 3000
    assert client.get(f"/api/predictions/{pid}/report", headers=other).status_code == 404


# ---- calculators & admin ----------------------------------------------------------------
def test_calculators(client, applicant):
    r = client.post("/api/calculators/emi", headers=applicant, json={"principal": 100000, "rate": 12, "months": 12}).get_json()
    assert r["emi"] == pytest.approx(8884.88, abs=0.01) and r["schedule"][-1]["balance"] == pytest.approx(0, abs=1)
    a = client.post("/api/calculators/affordability", headers=applicant, json={"monthly_income": 100000, "existing_emi": 10000, "rate": 10, "months": 60}).get_json()
    assert a["comfortable"]["emi_budget"] == 25000 and a["stretch"]["max_loan"] > a["comfortable"]["max_loan"]
    assert client.post("/api/calculators/emi", headers=applicant, json={"principal": "x"}).status_code == 422


def test_admin_endpoints_are_role_protected(client, applicant, admin):
    _create(client, applicant)
    assert client.get("/api/admin/analytics", headers=applicant).status_code == 403
    data = client.get("/api/admin/analytics", headers=admin).get_json()
    assert data["totals"]["predictions"] >= 1 and len(data["daily"]) == 30
    if data["model"]["mode"] == "heuristic":
        assert "ensemble" not in data["model"]
    else:
        assert data["model"]["ensemble"]["roc_auc"] > 0.7
    assert client.get("/api/admin/predictions", headers=admin).get_json()["predictions"][0]["user"]["email"]
    assert client.get("/api/admin/predictions", headers=applicant).status_code == 403
