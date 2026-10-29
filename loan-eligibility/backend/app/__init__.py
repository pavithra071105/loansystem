import logging

from flask import Flask, jsonify
from werkzeug.exceptions import HTTPException

from .config import Config
from .extensions import db
from .models import User


def create_app(overrides=None):
    app = Flask(__name__)
    app.config.from_object(Config)
    if overrides:
        app.config.update(overrides)
    logging.basicConfig(level=logging.INFO)
    db.init_app(app)

    from .routes import admin, auth, calculators, meta, predictions
    for module in (meta, auth, predictions, calculators, admin):
        app.register_blueprint(module.bp)

    @app.errorhandler(HTTPException)
    def http_error(e):
        return jsonify(error=e.description), e.code

    @app.errorhandler(Exception)
    def server_error(e):
        app.logger.exception(e)
        return jsonify(error="Something went wrong on our side. Try again in a moment."), 500

    with app.app_context():
        db.create_all()
        if not User.query.filter_by(role="admin").first():
            from .routes.auth import hash_password
            db.session.add(User(name=app.config["ADMIN_NAME"], email=app.config["ADMIN_EMAIL"].lower(),
                                password_hash=hash_password(app.config["ADMIN_PASSWORD"]), role="admin"))
            db.session.commit()
        app.extensions["predictor"] = None
        try:
            from .ml.predictor import Predictor

            predictor = Predictor(app.config["MODEL_DIR"], app.config["TRAIN_SAMPLES"], app.config["RF_TREES"])
            predictor.ensure_models()
            app.extensions["predictor"] = predictor
        except (ImportError, OSError):
            app.logger.exception(
                "Could not load the trained ML predictor; enabling the clearly labeled demo heuristic instead."
            )
            from .ml.heuristic import HeuristicPredictor

            app.extensions["predictor"] = HeuristicPredictor()
    return app
