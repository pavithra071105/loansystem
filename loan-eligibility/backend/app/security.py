from datetime import datetime, timedelta, timezone
from functools import wraps

import jwt
from flask import current_app, g, jsonify, request

from .extensions import db
from .models import User


def issue_token(user):
    exp = datetime.now(timezone.utc) + timedelta(hours=current_app.config["JWT_HOURS"])
    return jwt.encode({"sub": str(user.id), "role": user.role, "exp": exp}, current_app.config["SECRET_KEY"], algorithm="HS256")


def auth_required(*roles):
    """Require a valid bearer token; optionally restrict to the given roles."""
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            header = request.headers.get("Authorization", "")
            if not header.startswith("Bearer "):
                return jsonify(error="Sign in to continue."), 401
            try:
                data = jwt.decode(header[7:], current_app.config["SECRET_KEY"], algorithms=["HS256"])
            except jwt.PyJWTError:
                return jsonify(error="Your session has expired. Sign in again."), 401
            user = db.session.get(User, int(data["sub"]))
            if user is None:
                return jsonify(error="Your session has expired. Sign in again."), 401
            if roles and user.role not in roles:
                return jsonify(error="You don't have access to this page."), 403
            g.user = user
            return fn(*args, **kwargs)
        return wrapper
    return decorator
