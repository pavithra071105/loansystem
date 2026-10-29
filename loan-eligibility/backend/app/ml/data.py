"""Synthetic applicant generator and the hidden 'ground truth' used to label it.

No real lending data ships with this project. The generator encodes common underwriting rules of
thumb (credit score, debt-to-income, loan-to-value, stability) so the trained models behave
sensibly. To use real data, replace `build_dataset` with a loader that returns (X, y) using the
columns in `features.FEATURES`.
"""
import numpy as np
import pandas as pd

from ..loans import LOAN_KEYS, LOAN_TYPES, PURPOSES, validate_application
from .features import FEATURES, derive
from .rules import true_logit


def _round(x, step):
    return round(x / step) * step


def sample_application(rng, loan_type=None):
    lt = loan_type or str(rng.choice(LOAN_KEYS, p=[0.28, 0.20, 0.14, 0.20, 0.18]))
    cfg = LOAN_TYPES[lt]
    emp_p = [0.1, 0.4, 0.5] if lt == "business" else [0.62, 0.22, 0.16]
    age = int(np.clip(rng.normal(34, 9), 21, 62))
    income = float(np.clip(rng.lognormal(np.log(60_000), 0.6), 12_000, 800_000))
    a = {
        "loan_type": lt,
        "age": age,
        "dependents": int(rng.choice([0, 1, 2, 3, 4], p=[0.25, 0.30, 0.28, 0.12, 0.05])),
        "employment_type": str(rng.choice(["salaried", "self_employed", "business"], p=emp_p)),
        "employment_years": _round(float(np.clip(rng.gamma(2.0, 2.5), 0, min(age - 18, 30))), 0.5),
        "monthly_income": _round(income, 1000),
        "credit_score": int(np.clip(rng.normal(715, 75), 400, 900)),
        "existing_emi": _round(income * rng.beta(1.5, 5) * (rng.random() < 0.65), 500),
        "tenure_months": int(rng.choice(cfg["tenures"])),
    }
    annual = income * 12
    mult = {"personal": (0.1, 1.2), "home": (1.5, 6), "education": (0.5, 4), "vehicle": (0.3, 1.8), "business": (0.3, 3)}[lt]
    amount = _round(annual * rng.uniform(*mult), cfg["amount_step"])
    amount = float(np.clip(amount, cfg["min_amount"], cfg["max_amount"]))
    a["loan_amount"] = amount

    if lt == "personal":
        a["savings"] = _round(annual * rng.uniform(0, 0.8), 5000)
        a["purpose"] = str(rng.choice([p[0] for p in PURPOSES]))
    elif lt in ("home", "vehicle"):
        ltv = rng.uniform(0.5, 0.95) if lt == "home" else rng.uniform(0.6, 0.95)
        asset = _round(amount / ltv, 10_000)
        key = cfg["asset_field"]
        a[key] = asset
        a["down_payment"] = max(asset - amount, 0)
        if lt == "vehicle":
            a["vehicle_condition"] = str(rng.choice(["new", "used"], p=[0.7, 0.3]))
    elif lt == "education":
        a["course_type"] = str(rng.choice(["domestic", "abroad"], p=[0.65, 0.35]))
        a["co_applicant_income"] = _round(income * rng.uniform(0.2, 1.5), 1000) if rng.random() < 0.85 else 0
    else:
        a["annual_turnover"] = _round(amount * rng.uniform(0.5, 8), 50_000)
        a["years_in_business"] = _round(float(rng.uniform(0.5, 15)), 0.5)
        a["collateral_value"] = _round(amount * rng.uniform(0, 1.5), 50_000) if rng.random() < 0.6 else 0

    clean, _ = validate_application(lt, a, strict=False)
    return clean


def build_dataset(n, seed=42):
    rng = np.random.default_rng(seed)
    rows, labels = [], []
    for _ in range(n):
        app = sample_application(rng)
        row, _ = derive(app)
        z = true_logit(row, app["loan_type"]) + rng.normal(0, 0.3)
        labels.append(int(rng.random() < 1 / (1 + np.exp(-z))))
        rows.append(row)
    return pd.DataFrame(rows)[FEATURES], pd.Series(labels, name="approved")
