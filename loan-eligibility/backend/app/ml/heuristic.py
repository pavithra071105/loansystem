"""Dependency-free, explicitly illustrative scorer for environments without the ML runtime."""
import math

from ..finance import max_principal
from ..loans import LOAN_TYPES
from .features import derive
from .rules import logit_components

APPROVED_AT, REVIEW_AT = 70.0, 45.0
METHOD = "Transparent synthetic underwriting heuristic (not a trained model or SHAP)"

SCENARIOS = [
    ("income_10", "Income falls 10%", {"income": 0.90}),
    ("income_25", "Income falls 25%", {"income": 0.75}),
    ("rate_2", "Interest rates rise 2 points", {"rate": 2.0}),
    ("emi_25", "Other EMIs rise 25%", {"emi": 1.25}),
    ("credit_60", "Credit score drops 60 points", {"credit": -60}),
    ("combined", "Income down 20% and rates up 2 points", {"income": 0.80, "rate": 2.0}),
]

LABELS = {
    "credit_score": "Credit score",
    "dti": "Debt-to-income ratio",
    "lti": "Loan size vs. income",
    "ltv": "Loan-to-value ratio",
    "employment_years": "Work experience",
    "dependents": "Dependents",
    "age": "Age",
    "age_and_tenure": "Age and repayment period",
    "employment_type": "Employment type",
    "savings_ratio": "Savings vs. loan",
    "co_income_ratio": "Co-applicant income",
    "abroad": "Study destination",
    "used_vehicle": "Vehicle condition",
    "turnover_ratio": "Turnover vs. loan",
    "business_years": "Years in business",
}


def _sigmoid(value):
    if value >= 0:
        return 1 / (1 + math.exp(-value))
    exp_value = math.exp(value)
    return exp_value / (1 + exp_value)


def _verdict(probability):
    if probability >= APPROVED_AT:
        return {"code": "approved", "label": "Likely approved"}
    if probability >= REVIEW_AT:
        return {"code": "review", "label": "Needs review"}
    return {"code": "unlikely", "label": "Unlikely to be approved"}


def _risk(probability, dti):
    level = "low" if probability >= APPROVED_AT else "moderate" if probability >= REVIEW_AT else "high"
    if dti > 0.60 and level == "low":
        level = "moderate"
    labels = {"low": "Low risk", "moderate": "Moderate risk", "high": "High risk"}
    return {"level": level, "label": labels[level], "score": round(100 - probability)}


def _score(app):
    row, extras = derive(app)
    components = logit_components(row, app["loan_type"])
    probability = _sigmoid(sum(components.values())) * 100
    return row, extras, components, probability


def _summary(app):
    _, extras, _, probability = _score(app)
    probability = round(probability, 1)
    return {
        "probability": probability,
        "verdict": _verdict(probability),
        "risk": _risk(probability, extras["dti"]),
        "emi": round(extras["emi"]),
        "dti": round(extras["dti"] * 100, 1),
        "interest_rate": extras["rate"],
    }


def _factor_value(key, app, row, extras):
    values = {
        "credit_score": str(app["credit_score"]),
        "dti": f"{extras['dti'] * 100:.0f}% of income",
        "lti": f"{row['lti']:.1f}x annual income",
        "ltv": f"{row['ltv'] * 100:.0f}% of value" if extras["asset"] else "Unsecured",
        "employment_years": f"{app['employment_years']:g} yrs",
        "dependents": str(app["dependents"]),
        "age": f"{app['age']} yrs",
        "age_and_tenure": f"{app['age']} yrs, {app['tenure_months'] / 12:g}-year loan",
        "employment_type": app["employment_type"].replace("_", " ").title(),
        "savings_ratio": f"{row['savings_ratio'] * 100:.0f}% of loan",
        "co_income_ratio": f"{app.get('co_applicant_income', 0):,.0f}/month",
        "abroad": "Abroad" if app.get("course_type") == "abroad" else "In India",
        "used_vehicle": "Used" if app.get("vehicle_condition") == "used" else "New",
        "turnover_ratio": f"{row['turnover_ratio']:.1f}x loan",
        "business_years": f"{row['business_years']:g} yrs",
    }
    return values[key]


def _explanation(app):
    row, extras, components, _ = _score(app)
    baseline_logit = components["base"]
    baseline = _sigmoid(baseline_logit) * 100
    factors = []
    for key, contribution in components.items():
        if key == "base":
            continue
        impact = (_sigmoid(baseline_logit + contribution) - _sigmoid(baseline_logit)) * 100
        if abs(impact) < 0.2:
            continue
        factors.append({
            "feature": key,
            "label": LABELS[key],
            "value": _factor_value(key, app, row, extras),
            "impact": round(impact, 1),
            "direction": "up" if impact >= 0 else "down",
        })
    factors.sort(key=lambda factor: -abs(factor["impact"]))
    return {"base_probability": round(baseline, 1), "factors": factors[:8], "method": METHOD}


class HeuristicPredictor:
    mode = "heuristic"

    def __init__(self):
        self.metrics = {}

    def quick(self, app):
        return _summary(app)

    def _levers(self, app, base_probability):
        cfg = LOAN_TYPES[app["loan_type"]]
        tests = [
            ("Raise your credit score by 40 points", {"credit_score": min(900, app["credit_score"] + 40)}),
            ("Borrow 20% less", {"loan_amount": max(cfg["min_amount"], app["loan_amount"] * 0.8)}),
            ("Earn 15% more (or add a co-applicant)", {"monthly_income": app["monthly_income"] * 1.15}),
        ]
        if app["existing_emi"] > 0:
            tests.append(("Pay off half of your current EMIs", {"existing_emi": app["existing_emi"] * 0.5}))
        if app["tenure_months"] < max(cfg["tenures"]):
            tests.append((f"Stretch repayment to {max(cfg['tenures']) // 12} years", {"tenure_months": max(cfg["tenures"])}))
        levers = []
        for label, changes in tests:
            probability = _summary({**app, **changes})["probability"]
            gain = round(probability - base_probability, 1)
            if gain >= 0.5:
                levers.append({"label": label, "probability": probability, "gain": gain})
        return sorted(levers, key=lambda lever: -lever["gain"])[:4]

    def _recommend(self, app, base_probability):
        cfg = LOAN_TYPES[app["loan_type"]]
        requested = float(app["loan_amount"])
        cap = float(cfg["max_amount"])
        if "down_payment" in app:
            cap = min(cap, app[cfg["asset_field"]] - app["down_payment"])
        step = cfg["amount_step"]
        amounts = {
            float(min(cap, max(cfg["min_amount"], round(requested * factor / step) * step)))
            for factor in (0.3 + i * (1.2 / 16) for i in range(17))
        }
        amounts.add(requested)

        candidates = {}
        for amount in amounts:
            options = []
            for months in cfg["tenures"]:
                trial = {**app, "loan_amount": amount, "tenure_months": months}
                summary = _summary(trial)
                _, extras = derive(trial)
                options.append({
                    "tenure_months": months,
                    "probability": summary["probability"],
                    "emi": extras["emi"],
                    "dti": extras["dti"],
                    "rate": extras["rate"],
                })
            best_probability = max(option["probability"] for option in options)
            candidates[amount] = next(
                option for option in sorted(options, key=lambda item: item["tenure_months"])
                if option["probability"] >= best_probability - 3
            )

        viable = [
            amount for amount, option in candidates.items()
            if option["probability"] >= APPROVED_AT and option["dti"] <= 0.5
        ]
        amount = max(viable) if viable else max(
            candidates, key=lambda candidate: (candidates[candidate]["probability"], -candidate)
        )
        pick = candidates[amount]
        status = (
            "fits" if amount >= requested * 0.98 else "reduce"
        ) if viable else ("not_viable" if pick["probability"] < REVIEW_AT else "reduce")
        requested_options = []
        for months in sorted(cfg["tenures"]):
            trial = {**app, "loan_amount": requested, "tenure_months": months}
            summary = _summary(trial)
            requested_options.append({
                "tenure_months": months,
                "emi": summary["emi"],
                "probability": summary["probability"],
                "dti": summary["dti"],
            })
        best_requested = candidates[requested]
        return {
            "status": status,
            "amount": amount,
            "tenure_months": pick["tenure_months"],
            "emi": round(pick["emi"]),
            "probability": round(pick["probability"], 1),
            "interest_rate": pick["rate"],
            "dti": round(pick["dti"] * 100, 1),
            "total_interest": round(pick["emi"] * pick["tenure_months"] - amount),
            "best_tenure_for_requested": best_requested["tenure_months"],
            "requested_tenure_options": requested_options,
            "levers": self._levers(app, base_probability),
        }

    def _stress(self, app, base_probability):
        results = []
        for scenario_id, label, changes in SCENARIOS:
            stressed = {
                **app,
                "monthly_income": app["monthly_income"] * changes.get("income", 1),
                "co_applicant_income": app.get("co_applicant_income", 0) * changes.get("income", 1),
                "existing_emi": app["existing_emi"] * changes.get("emi", 1),
                "credit_score": max(300, app["credit_score"] + changes.get("credit", 0)),
                "rate_delta": changes.get("rate", 0.0),
            }
            summary = _summary(stressed)
            results.append({
                "id": scenario_id,
                "label": label,
                "probability": summary["probability"],
                "change": round(summary["probability"] - base_probability, 1),
                "dti": summary["dti"],
                "emi": summary["emi"],
                "verdict": summary["verdict"]["code"],
            })
        return results

    def what_if(self, base_app, changed_app):
        baseline, scenario = _summary(base_app), _summary(changed_app)
        return {
            "baseline": baseline,
            "scenario": scenario,
            "change": round(scenario["probability"] - baseline["probability"], 1),
        }

    def analyze(self, app):
        cfg = LOAN_TYPES[app["loan_type"]]
        summary = _summary(app)
        _, extras = derive(app)
        probability = summary["probability"]
        comfortable = max_principal(
            max(extras["eff_income"] * 0.35 - app["existing_emi"], 0),
            extras["rate"], app["tenure_months"],
        )
        stretch = max_principal(
            max(extras["eff_income"] * 0.50 - app["existing_emi"], 0),
            extras["rate"], app["tenure_months"],
        )
        dti = extras["dti"]
        return {
            "loan_label": cfg["label"],
            "probability": probability,
            "verdict": summary["verdict"],
            "risk": summary["risk"],
            "model_probabilities": None,
            "emi": summary["emi"],
            "interest_rate": summary["interest_rate"],
            "total_interest": round(extras["emi"] * app["tenure_months"] - app["loan_amount"]),
            "total_payment": round(extras["emi"] * app["tenure_months"]),
            "affordability": {
                "dti": summary["dti"],
                "emi_to_income": round(extras["emi"] / extras["eff_income"] * 100, 1),
                "status": "comfortable" if dti <= 0.35 else "manageable" if dti <= 0.50 else "stretched",
                "comfortable_max_loan": round(comfortable),
                "stretch_max_loan": round(stretch),
            },
            "explanation": _explanation(app),
            "recommendation": self._recommend(app, probability),
            "stress": self._stress(app, probability),
            "model": {"trained_at": None, "data_source": "synthetic", "mode": self.mode},
        }
