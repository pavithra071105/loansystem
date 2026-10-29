"""Turns a validated application dict into the numeric feature row the models are trained on."""
import math

from ..finance import effective_rate, emi
from ..loans import LOAN_KEYS, LOAN_TYPES

EMP_KEYS = ["salaried", "self_employed", "business"]

FEATURES = (
    ["age", "log_income", "employment_years", "credit_score", "dependents", "dti", "lti", "ltv", "savings_ratio",
     "turnover_ratio", "business_years", "co_income_ratio", "abroad", "used_vehicle", "interest_rate", "tenure_years", "log_loan"]
    + [f"emp_{k}" for k in EMP_KEYS]
    + [f"lt_{k}" for k in LOAN_KEYS]
)

# Features that only make sense for some loan types; hidden from explanations elsewhere.
ONLY_FOR = {
    "savings_ratio": {"personal"}, "turnover_ratio": {"business"}, "business_years": {"business"},
    "co_income_ratio": {"education"}, "abroad": {"education"}, "used_vehicle": {"vehicle"},
    "ltv": {"home", "vehicle", "business"},
}


def derive(a):
    """Return (feature_row, extras). `a` may carry an optional `rate_delta` used by stress tests."""
    lt = a["loan_type"]
    cfg = LOAN_TYPES[lt]
    loan = float(a["loan_amount"])
    co = float(a.get("co_applicant_income", 0) or 0)
    eff_income = float(a["monthly_income"]) + 0.5 * co
    rate = effective_rate(cfg["rate"], a["credit_score"], a.get("rate_delta", 0.0))
    pay = emi(loan, rate, int(a["tenure_months"]))
    dti = (float(a["existing_emi"]) + pay) / eff_income
    asset = float(a.get(cfg["asset_field"], 0) or 0) if cfg["asset_field"] else 0.0

    row = {
        "age": a["age"],
        "log_income": math.log(eff_income),
        "employment_years": a["employment_years"],
        "credit_score": a["credit_score"],
        "dependents": a["dependents"],
        "dti": dti,
        "lti": loan / (eff_income * 12),
        "ltv": loan / asset if asset > 0 else 0.0,
        "savings_ratio": min(float(a.get("savings", 0) or 0) / loan, 3.0) if lt == "personal" else 0.0,
        "turnover_ratio": min(float(a.get("annual_turnover", 0) or 0) / loan, 10.0) if lt == "business" else 0.0,
        "business_years": float(a.get("years_in_business", 0) or 0) if lt == "business" else 0.0,
        "co_income_ratio": min(co / float(a["monthly_income"]), 3.0) if lt == "education" else 0.0,
        "abroad": 1 if a.get("course_type") == "abroad" else 0,
        "used_vehicle": 1 if a.get("vehicle_condition") == "used" else 0,
        "interest_rate": rate,
        "tenure_years": a["tenure_months"] / 12,
        "log_loan": math.log(loan),
    }
    for k in EMP_KEYS:
        row[f"emp_{k}"] = 1 if a["employment_type"] == k else 0
    for k in LOAN_KEYS:
        row[f"lt_{k}"] = 1 if lt == k else 0
    extras = {"emi": pay, "rate": rate, "dti": dti, "eff_income": eff_income, "asset": asset}
    return row, extras
