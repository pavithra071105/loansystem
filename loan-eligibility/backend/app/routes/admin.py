from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone

from flask import Blueprint, current_app, jsonify, request

from ..extensions import predictor_unavailable
from ..loans import LOAN_TYPES
from ..models import Prediction, User
from ..security import auth_required

bp = Blueprint("admin", __name__, url_prefix="/api/admin")


@bp.get("/analytics")
@auth_required("admin")
def analytics():
    unavailable = predictor_unavailable()
    if unavailable:
        return unavailable
    preds = Prediction.query.order_by(Prediction.created_at.desc()).all()
    n = len(preds)
    approved = sum(p.verdict == "approved" for p in preds)

    by_type = defaultdict(list)
    for p in preds:
        by_type[p.loan_type].append(p)
    per_type = [{"loan_type": k, "label": LOAN_TYPES[k]["label"], "count": len(v),
                 "approval_rate": round(sum(x.verdict == "approved" for x in v) / len(v) * 100, 1),
                 "avg_probability": round(sum(x.probability for x in v) / len(v), 1),
                 "avg_amount": round(sum(x.loan_amount for x in v) / len(v))} for k, v in by_type.items()]

    today = datetime.now(timezone.utc).date()
    days = {(today - timedelta(days=i)): [] for i in range(29, -1, -1)}
    for p in preds:
        d = p.created_at.date()
        if d in days:
            days[d].append(p.probability)
    daily = [{"date": d.isoformat(), "count": len(v), "avg_probability": round(sum(v) / len(v), 1) if v else None} for d, v in days.items()]

    buckets = Counter(min(int(p.probability // 10), 9) for p in preds)
    risk = Counter(p.risk_level for p in preds)
    return jsonify(
        totals={"users": User.query.filter_by(role="applicant").count(), "predictions": n,
                "approval_rate": round(approved / n * 100, 1) if n else 0,
                "avg_probability": round(sum(p.probability for p in preds) / n, 1) if n else 0,
                "avg_amount": round(sum(p.loan_amount for p in preds) / n) if n else 0},
        by_loan_type=sorted(per_type, key=lambda r: -r["count"]),
        risk_distribution=[{"risk": r, "count": risk.get(r, 0)} for r in ("low", "moderate", "high")],
        verdicts=[{"verdict": v, "count": sum(p.verdict == v for p in preds)} for v in ("approved", "review", "unlikely")],
        probability_histogram=[{"range": f"{i * 10}-{i * 10 + 10}", "count": buckets.get(i, 0)} for i in range(10)],
        daily=daily,
        model={**current_app.extensions["predictor"].metrics, "mode": current_app.extensions["predictor"].mode},
    )


@bp.get("/predictions")
@auth_required("admin")
def all_predictions():
    q = Prediction.query
    if request.args.get("loan_type") in LOAN_TYPES:
        q = q.filter_by(loan_type=request.args["loan_type"])
    rows = q.order_by(Prediction.created_at.desc(), Prediction.id.desc()).limit(150).all()
    return jsonify(predictions=[r.summary(with_user=True) for r in rows])
