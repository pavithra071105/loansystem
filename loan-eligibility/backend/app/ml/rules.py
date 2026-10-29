"""Synthetic underwriting rules shared by training data and the demo-only fallback."""

LTI_LIMIT = {"personal": 1.0, "home": 6.0, "education": 4.0, "vehicle": 1.5, "business": 3.0}
TYPE_BIAS = {"personal": 0.0, "home": 0.4, "education": 0.2, "vehicle": 0.4, "business": 0.8}


def logit_components(row, loan_type):
    components = {
        "base": 1.1 + TYPE_BIAS[loan_type],
        "credit_score": 0.016 * (row["credit_score"] - 700),
        "dti": -5.5 * max(row["dti"] - 0.40, 0),
        "lti": -0.9 * max(row["lti"] / LTI_LIMIT[loan_type] - 1, 0),
        "ltv": -6.0 * max(row["ltv"] - 0.80, 0),
        "employment_years": 0.10 * min(row["employment_years"], 8) - 0.4,
        "dependents": -0.12 * row["dependents"],
        "age": -0.03 * max(row["age"] - 55, 0) - (0.5 if row["age"] < 23 else 0),
        "age_and_tenure": -0.25 * max(row["age"] + row["tenure_years"] - 65, 0),
        "employment_type": 0.3 * row["emp_salaried"] - 0.1 * row["emp_business"],
    }
    if loan_type == "personal":
        components["savings_ratio"] = min(row["savings_ratio"], 1.0) - 0.25
    elif loan_type == "education":
        components["co_income_ratio"] = min(row["co_income_ratio"], 1.5) - 0.5
        components["abroad"] = -0.3 * row["abroad"]
    elif loan_type == "vehicle":
        components["used_vehicle"] = -0.3 * row["used_vehicle"]
    elif loan_type == "business":
        components["turnover_ratio"] = 0.25 * min(row["turnover_ratio"], 4) - 1.0
        components["business_years"] = 0.1 * min(row["business_years"], 10)
    return components


def true_logit(row, loan_type):
    return sum(logit_components(row, loan_type).values())
