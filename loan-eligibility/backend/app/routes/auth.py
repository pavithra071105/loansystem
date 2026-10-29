import re

from flask import Blueprint, g, jsonify, request
from werkzeug.security import check_password_hash, generate_password_hash

from ..extensions import db
from ..models import User
from ..security import auth_required, issue_token

bp = Blueprint("auth", __name__, url_prefix="/api/auth")
EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def hash_password(pw):
    return generate_password_hash(pw, method="pbkdf2:sha256")


@bp.post("/register")
def register():
    data = request.get_json(silent=True) or {}
    name, email, pw = str(data.get("name", "")).strip(), str(data.get("email", "")).strip().lower(), str(data.get("password", ""))
    errors = {}
    if not 2 <= len(name) <= 80:
        errors["name"] = "Enter your full name."
    if not EMAIL.match(email) or len(email) > 160:
        errors["email"] = "Enter a valid email address."
    if len(pw) < 8 or not re.search(r"[A-Za-z]", pw) or not re.search(r"\d", pw):
        errors["password"] = "Use at least 8 characters with a letter and a number."
    if errors:
        return jsonify(error="Check the highlighted fields.", fields=errors), 422
    if User.query.filter_by(email=email).first():
        return jsonify(error="An account with this email already exists.", fields={"email": "Already registered."}), 409
    user = User(name=name, email=email, password_hash=hash_password(pw), role="applicant")
    db.session.add(user)
    db.session.commit()
    return jsonify(token=issue_token(user), user=user.to_dict()), 201


@bp.post("/login")
def login():
    data = request.get_json(silent=True) or {}
    user = User.query.filter_by(email=str(data.get("email", "")).strip().lower()).first()
    if not user or not check_password_hash(user.password_hash, str(data.get("password", ""))):
        return jsonify(error="Incorrect email or password."), 401
    return jsonify(token=issue_token(user), user=user.to_dict())


@bp.get("/me")
@auth_required()
def me():
    return jsonify(user=g.user.to_dict())
