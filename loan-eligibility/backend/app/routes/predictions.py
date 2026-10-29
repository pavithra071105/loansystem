import json

from flask import Blueprint, current_app, g, jsonify, request, send_file

from ..extensions import db, predictor_unavailable
from ..loans import LOAN_TYPES, validate_application
from ..models import Prediction
from ..reports import build_report
from ..security import auth_required

bp = Blueprint("predictions", __name__, url_prefix="/api/predictions")


def _predictor():
    return current_app.extensions["predictor"]


def _owned_or_404(pid):
    pred = db.session.get(Prediction, pid)
    if pred is None or (pred.user_id != g.user.id and g.user.role != "admin"):
        return None
    return pred


@bp.post("")
@auth_required()
def create():
    unavailable = predictor_unavailable()
    if unavailable:
        return unavailable
    data = request.get_json(silent=True) or {}
    loan_type = data.get("loan_type")
    clean, errors = validate_application(loan_type, data.get("input") or {})
    if errors:
        return jsonify(error="Check the highlighted fields.", fields=errors), 422
    result = _predictor().analyze(clean)
    pred = Prediction(user_id=g.user.id, loan_type=loan_type, loan_amount=clean["loan_amount"], tenure_months=clean["tenure_months"],
                      probability=result["probability"], verdict=result["verdict"]["code"], risk_level=result["risk"]["level"],
                      input_json=json.dumps(clean), result_json=json.dumps(result))
    db.session.add(pred)
    db.session.commit()
    return jsonify(prediction=pred.full()), 201


@bp.get("")
@auth_required()
def history():
    q = Prediction.query.filter_by(user_id=g.user.id)
    if request.args.get("loan_type") in LOAN_TYPES:
        q = q.filter_by(loan_type=request.args["loan_type"])
    rows = q.order_by(Prediction.created_at.desc(), Prediction.id.desc()).limit(200).all()
    return jsonify(predictions=[r.summary() for r in rows])


@bp.get("/<int:pid>")
@auth_required()
def detail(pid):
    pred = _owned_or_404(pid)
    return (jsonify(prediction=pred.full()) if pred else (jsonify(error="We couldn't find that prediction."), 404))


@bp.delete("/<int:pid>")
@auth_required()
def remove(pid):
    pred = _owned_or_404(pid)
    if not pred:
        return jsonify(error="We couldn't find that prediction."), 404
    db.session.delete(pred)
    db.session.commit()
    return jsonify(deleted=pid)


@bp.post("/<int:pid>/what-if")
@auth_required()
def what_if(pid):
    pred = _owned_or_404(pid)
    if not pred:
        return jsonify(error="We couldn't find that prediction."), 404
    unavailable = predictor_unavailable()
    if unavailable:
        return unavailable
    base = json.loads(pred.input_json)
    changes = {k: v for k, v in (request.get_json(silent=True) or {}).get("changes", {}).items() if k in base and k != "loan_type"}
    base_clean, _ = validate_application(pred.loan_type, base, strict=False)
    scen_clean, errors = validate_application(pred.loan_type, {**base, **changes}, strict=False)
    if errors:
        return jsonify(error="Those values aren't valid.", fields=errors), 422
    return jsonify(_predictor().what_if(base_clean, scen_clean) | {"applied": {k: scen_clean[k] for k in changes}})


@bp.get("/<int:pid>/report")
@auth_required()
def report(pid):
    pred = _owned_or_404(pid)
    if not pred:
        return jsonify(error="We couldn't find that prediction."), 404
    pdf = build_report(pred, pred.user)
    return send_file(pdf, mimetype="application/pdf", as_attachment=True, download_name=f"loan-eligibility-report-{pred.id}.pdf")
