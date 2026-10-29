from flask import current_app, jsonify
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


def predictor_unavailable():
    if current_app.extensions.get("predictor") is None:
        return jsonify(error="The loan prediction service is unavailable because its model runtime could not be loaded."), 503
    return None
