from flask import Blueprint, jsonify, request

from ..finance import emi, max_principal, yearly_schedule
from ..security import auth_required

bp = Blueprint("calculators", __name__, url_prefix="/api/calculators")


def _num(data, key, lo, hi):
    try:
        v = float(data.get(key))
    except (TypeError, ValueError):
        raise ValueError(f"{key} must be a number")
    if not lo <= v <= hi:
        raise ValueError(f"{key} must be between {lo:g} and {hi:g}")
    return v


@bp.post("/emi")
@auth_required()
def emi_calc():
    d = request.get_json(silent=True) or {}
    try:
        principal, rate, months = _num(d, "principal", 1_000, 1_000_000_000), _num(d, "rate", 0, 40), int(_num(d, "months", 1, 480))
    except ValueError as e:
        return jsonify(error=str(e)), 422
    pay = emi(principal, rate, months)
    return jsonify(emi=round(pay, 2), total_payment=round(pay * months, 2), total_interest=round(pay * months - principal, 2),
                   schedule=yearly_schedule(principal, rate, months))


@bp.post("/affordability")
@auth_required()
def affordability():
    d = request.get_json(silent=True) or {}
    try:
        income, existing = _num(d, "monthly_income", 1_000, 100_000_000), _num(d, "existing_emi", 0, 100_000_000)
        rate, months = _num(d, "rate", 0, 40), int(_num(d, "months", 1, 480))
    except ValueError as e:
        return jsonify(error=str(e)), 422
    tiers = {}
    for name, share in (("comfortable", 0.35), ("stretch", 0.50)):
        budget = max(income * share - existing, 0)
        tiers[name] = {"max_total_obligations": round(income * share), "emi_budget": round(budget, 2),
                       "max_loan": round(max_principal(budget, rate, months), 2)}
    return jsonify(current_obligation_pct=round(existing / income * 100, 1), **tiers)
