"""Loads (or trains) the models and turns an application into a full analysis:
probability, verdict, risk, SHAP explanation, recommendations, stress tests and what-if."""
import json
import logging
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import shap

from ..finance import inr, max_principal
from ..loans import LOAN_TYPES
from .features import FEATURES, ONLY_FOR, derive
from .train import train

log = logging.getLogger(__name__)

APPROVED_AT, REVIEW_AT = 70.0, 45.0

LABELS = {
    "age": "Age", "log_income": "Household income", "employment_years": "Work experience", "credit_score": "Credit score",
    "dependents": "Dependents", "dti": "Debt-to-income ratio", "lti": "Loan size vs. income", "ltv": "Loan-to-value ratio",
    "savings_ratio": "Savings vs. loan", "turnover_ratio": "Turnover vs. loan", "business_years": "Years in business",
    "co_income_ratio": "Co-applicant income", "abroad": "Study destination", "used_vehicle": "Vehicle condition",
    "interest_rate": "Interest rate", "tenure_years": "Repayment period", "log_loan": "Loan amount",
    "emp": "Employment type", "lt": "Loan type",
}

SCENARIOS = [
    ("income_10", "Income falls 10%", dict(income=0.90)),
    ("income_25", "Income falls 25%", dict(income=0.75)),
    ("rate_2", "Interest rates rise 2 points", dict(rate=2.0)),
    ("emi_25", "Other EMIs rise 25%", dict(emi=1.25)),
    ("credit_60", "Credit score drops 60 points", dict(credit=-60)),
    ("combined", "Income down 20% and rates up 2 points", dict(income=0.80, rate=2.0)),
]


def verdict_for(p):
    if p >= APPROVED_AT:
        return {"code": "approved", "label": "Likely approved"}
    if p >= REVIEW_AT:
        return {"code": "review", "label": "Needs review"}
    return {"code": "unlikely", "label": "Unlikely to be approved"}


def risk_for(p, dti):
    level = "low" if p >= APPROVED_AT else "moderate" if p >= REVIEW_AT else "high"
    if dti > 0.60 and level == "low":
        level = "moderate"
    return {"level": level, "label": {"low": "Low risk", "moderate": "Moderate risk", "high": "High risk"}[level],
            "score": round(100 - p)}


class Predictor:
    mode = "trained"

    def __init__(self, model_dir, n_samples=9000, n_estimators=250):
        self.dir, self.n_samples, self.n_estimators = Path(model_dir), n_samples, n_estimators
        self.lr = self.rf = self.explainer = None
        self.metrics = {}

    def ensure_models(self, force=False):
        file = self.dir / "models.joblib"
        if force or not file.exists():
            log.warning("Training models on %s synthetic applicants (one-off, takes a few seconds)...", self.n_samples)
            self.metrics = train(self.dir, self.n_samples, self.n_estimators)
        bundle = joblib.load(file)
        self.lr, self.rf = bundle["lr"], bundle["rf"]
        self.explainer = shap.TreeExplainer(self.rf)
        if not self.metrics:
            self.metrics = json.loads((self.dir / "metrics.json").read_text())

    # ---- core scoring -------------------------------------------------------------------
    def _predict(self, apps):
        rows, extras = zip(*[derive(a) for a in apps])
        X = pd.DataFrame(list(rows))[FEATURES]
        p_lr, p_rf = self.lr.predict_proba(X)[:, 1], self.rf.predict_proba(X)[:, 1]
        return {"X": X, "lr": p_lr, "rf": p_rf, "prob": (p_lr + p_rf) / 2 * 100, "extras": list(extras)}

    def quick(self, app):
        out = self._predict([app])
        return self._summary(out, 0)

    @staticmethod
    def _summary(out, i):
        p, ex = float(out["prob"][i]), out["extras"][i]
        return {"probability": round(p, 1), "verdict": verdict_for(p), "risk": risk_for(p, ex["dti"]),
                "emi": round(ex["emi"]), "dti": round(ex["dti"] * 100, 1), "interest_rate": ex["rate"]}

    # ---- explainability -----------------------------------------------------------------
    def _display(self, key, app, ex):
        cfg = LOAN_TYPES[app["loan_type"]]
        yrs = lambda v: f"{v:g} yrs"
        return {
            "age": lambda: yrs(app["age"]), "log_income": lambda: inr(ex["eff_income"]) + "/month",
            "employment_years": lambda: yrs(app["employment_years"]), "credit_score": lambda: str(app["credit_score"]),
            "dependents": lambda: str(app["dependents"]), "dti": lambda: f"{ex['dti'] * 100:.0f}% of income",
            "lti": lambda: f"{app['loan_amount'] / (ex['eff_income'] * 12):.1f}x annual income",
            "ltv": lambda: f"{app['loan_amount'] / ex['asset'] * 100:.0f}% of value" if ex["asset"] else "Unsecured",
            "savings_ratio": lambda: f"{app.get('savings', 0) / app['loan_amount'] * 100:.0f}% of loan",
            "turnover_ratio": lambda: f"{app.get('annual_turnover', 0) / app['loan_amount']:.1f}x loan",
            "business_years": lambda: yrs(app.get("years_in_business", 0)),
            "co_income_ratio": lambda: inr(app.get("co_applicant_income", 0)) + "/month",
            "abroad": lambda: "Abroad" if app.get("course_type") == "abroad" else "In India",
            "used_vehicle": lambda: "Used" if app.get("vehicle_condition") == "used" else "New",
            "interest_rate": lambda: f"{ex['rate']}% a year", "tenure_years": lambda: yrs(app["tenure_months"] / 12),
            "log_loan": lambda: inr(app["loan_amount"]),
            "emp": lambda: dict(salaried="Salaried", self_employed="Self-employed", business="Business owner")[app["employment_type"]],
            "lt": lambda: cfg["label"],
        }[key]()

    def _explain(self, out, app):
        X, ex = out["X"].iloc[[0]], out["extras"][0]
        sv = self.explainer.shap_values(X)
        sv = np.asarray(sv[1] if isinstance(sv, list) else sv)
        sv = sv[0, :, 1] if sv.ndim == 3 else sv[0]
        base = float(np.ravel(self.explainer.expected_value)[-1])
        grouped = {}
        for name, v in zip(FEATURES, sv):
            key = "emp" if name.startswith("emp_") else "lt" if name.startswith("lt_") else name
            if key in ONLY_FOR and app["loan_type"] not in ONLY_FOR[key]:
                continue
            grouped[key] = grouped.get(key, 0.0) + float(v)
        top = sorted(grouped.items(), key=lambda kv: -abs(kv[1]))[:8]
        factors = [{"feature": k, "label": LABELS[k], "value": self._display(k, app, ex), "impact": round(v * 100, 1),
                    "direction": "up" if v >= 0 else "down"} for k, v in top if abs(v) * 100 >= 0.2]
        return {"base_probability": round(base * 100, 1), "factors": factors, "method": "SHAP on the Random Forest model"}

    # ---- recommendations ----------------------------------------------------------------
    def _recommend(self, app, base_p):
        cfg = LOAN_TYPES[app["loan_type"]]
        req = float(app["loan_amount"])
        cap = float(cfg["max_amount"])
        if "down_payment" in app:
            cap = min(cap, app[cfg["asset_field"]] - app["down_payment"])
        step = cfg["amount_step"]
        amounts = sorted({float(np.clip(round(req * f / step) * step, cfg["min_amount"], cap)) for f in np.linspace(0.3, 1.5, 17)} | {req})
        tenures = cfg["tenures"]
        cands = [(a, t) for a in amounts for t in tenures]
        out = self._predict([dict(app, loan_amount=a, tenure_months=t) for a, t in cands])
        grid = {}
        for i, (a, t) in enumerate(cands):
            grid.setdefault(a, []).append({"tenure_months": t, "probability": float(out["prob"][i]), "emi": out["extras"][i]["emi"],
                                           "dti": out["extras"][i]["dti"], "rate": out["extras"][i]["rate"]})

        def best_tenure(options):
            top = max(o["probability"] for o in options)
            return next(o for o in sorted(options, key=lambda o: o["tenure_months"]) if o["probability"] >= top - 3)

        best = {a: best_tenure(opts) for a, opts in grid.items()}
        ok = [a for a, o in best.items() if o["probability"] >= APPROVED_AT and o["dti"] <= 0.5]
        if ok:
            amount = max(ok)
        else:
            amount = max(best, key=lambda a: (best[a]["probability"], -a))
        pick = best[amount]
        if not ok:
            status = "not_viable" if pick["probability"] < REVIEW_AT else "reduce"
        else:
            status = "fits" if amount >= req * 0.98 else "reduce"
        req_opts = [{"tenure_months": o["tenure_months"], "emi": round(o["emi"]), "probability": round(o["probability"], 1),
                     "dti": round(o["dti"] * 100, 1)} for o in sorted(grid[req], key=lambda o: o["tenure_months"])]
        return {
            "status": status, "amount": amount, "tenure_months": pick["tenure_months"], "emi": round(pick["emi"]),
            "probability": round(pick["probability"], 1), "interest_rate": pick["rate"],
            "dti": round(pick["dti"] * 100, 1),
            "total_interest": round(pick["emi"] * pick["tenure_months"] - amount),
            "best_tenure_for_requested": best[req]["tenure_months"], "requested_tenure_options": req_opts,
            "levers": self._levers(app, base_p),
        }

    def _levers(self, app, base_p):
        cfg = LOAN_TYPES[app["loan_type"]]
        tests = [("Raise your credit score by 40 points", dict(credit_score=min(900, app["credit_score"] + 40))),
                 ("Borrow 20% less", dict(loan_amount=max(cfg["min_amount"], app["loan_amount"] * 0.8))),
                 ("Earn 15% more (or add a co-applicant)", dict(monthly_income=app["monthly_income"] * 1.15))]
        if app["existing_emi"] > 0:
            tests.append(("Pay off half of your current EMIs", dict(existing_emi=app["existing_emi"] * 0.5)))
        if app["tenure_months"] < max(cfg["tenures"]):
            tests.append((f"Stretch repayment to {max(cfg['tenures']) // 12} years", dict(tenure_months=max(cfg["tenures"]))))
        out = self._predict([dict(app, **chg) for _, chg in tests])
        levers = [{"label": lbl, "probability": round(float(out["prob"][i]), 1), "gain": round(float(out["prob"][i]) - base_p, 1)}
                  for i, (lbl, _) in enumerate(tests)]
        return sorted([l for l in levers if l["gain"] >= 0.5], key=lambda l: -l["gain"])[:4]

    # ---- stress test & what-if ----------------------------------------------------------
    def _stress(self, app, base_p):
        apps = []
        for _, _, m in SCENARIOS:
            apps.append(dict(app, monthly_income=app["monthly_income"] * m.get("income", 1),
                             co_applicant_income=app.get("co_applicant_income", 0) * m.get("income", 1),
                             existing_emi=app["existing_emi"] * m.get("emi", 1),
                             credit_score=max(300, app["credit_score"] + m.get("credit", 0)), rate_delta=m.get("rate", 0.0)))
        out = self._predict(apps)
        res = []
        for i, (sid, label, _) in enumerate(SCENARIOS):
            s = self._summary(out, i)
            res.append({"id": sid, "label": label, "probability": s["probability"], "change": round(s["probability"] - base_p, 1),
                        "dti": s["dti"], "emi": s["emi"], "verdict": s["verdict"]["code"]})
        return res

    def what_if(self, base_app, changed_app):
        out = self._predict([base_app, changed_app])
        base, scen = self._summary(out, 0), self._summary(out, 1)
        return {"baseline": base, "scenario": scen, "change": round(scen["probability"] - base["probability"], 1)}

    # ---- full report --------------------------------------------------------------------
    def analyze(self, app):
        cfg = LOAN_TYPES[app["loan_type"]]
        out = self._predict([app])
        s, ex = self._summary(out, 0), out["extras"][0]
        p = s["probability"]
        comfy = max_principal(max(ex["eff_income"] * 0.35 - app["existing_emi"], 0), ex["rate"], app["tenure_months"])
        stretch = max_principal(max(ex["eff_income"] * 0.50 - app["existing_emi"], 0), ex["rate"], app["tenure_months"])
        dti = ex["dti"]
        return {
            "loan_label": cfg["label"], "probability": p, "verdict": s["verdict"], "risk": s["risk"],
            "model_probabilities": {"logistic_regression": round(float(out["lr"][0]) * 100, 1), "random_forest": round(float(out["rf"][0]) * 100, 1)},
            "emi": s["emi"], "interest_rate": s["interest_rate"],
            "total_interest": round(ex["emi"] * app["tenure_months"] - app["loan_amount"]),
            "total_payment": round(ex["emi"] * app["tenure_months"]),
            "affordability": {"dti": s["dti"], "emi_to_income": round(ex["emi"] / ex["eff_income"] * 100, 1),
                              "status": "comfortable" if dti <= 0.35 else "manageable" if dti <= 0.50 else "stretched",
                              "comfortable_max_loan": round(comfy), "stretch_max_loan": round(stretch)},
            "explanation": self._explain(out, app),
            "recommendation": self._recommend(app, p),
            "stress": self._stress(app, p),
            "model": {"trained_at": self.metrics.get("trained_at"), "data_source": self.metrics.get("data_source", "synthetic"),
                      "mode": self.mode},
        }
