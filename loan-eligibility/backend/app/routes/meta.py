from flask import Blueprint, jsonify

from ..loans import catalog

bp = Blueprint("meta", __name__, url_prefix="/api")


@bp.get("/health")
def health():
    return jsonify(status="ok")


@bp.get("/meta/loan-types")
def loan_types():
    return jsonify(loan_types=list(catalog().values()))
