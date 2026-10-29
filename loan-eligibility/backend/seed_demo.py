"""Fill the database with demo applicants and predictions so the dashboards have something to show.

    python seed_demo.py

Demo applicant: demo@loanlens.ai / Demo@12345
"""
import json
import random
from datetime import datetime, timedelta, timezone

import numpy as np

from app import create_app
from app.extensions import db
from app.ml.data import sample_application
from app.models import Prediction, User
from app.routes.auth import hash_password

NAMES = ["Aarav Nair", "Diya Raman", "Karthik Subramanian", "Meera Iyer", "Rohan Gupta", "Sneha Pillai", "Vikram Rao", "Ananya Das", "Imran Sheikh", "Lakshmi Venkat"]


def add_prediction(app, predictor, user, when, loan_type=None, rng=None):
    clean = sample_application(rng, loan_type)
    result = predictor.analyze(clean)
    db.session.add(Prediction(user_id=user.id, loan_type=clean["loan_type"], loan_amount=clean["loan_amount"], tenure_months=clean["tenure_months"],
                              probability=result["probability"], verdict=result["verdict"]["code"], risk_level=result["risk"]["level"],
                              input_json=json.dumps(clean), result_json=json.dumps(result), created_at=when))


def main():
    app = create_app()
    predictor = app.extensions["predictor"]
    with app.app_context():
        if User.query.filter_by(email="demo@loanlens.ai").first():
            print("Demo data already present.")
            return
        now = datetime.now(timezone.utc)
        demo = User(name="Demo Applicant", email="demo@loanlens.ai", password_hash=hash_password("Demo@12345"), role="applicant")
        if predictor is None:
            db.session.add(demo)
            db.session.commit()
            print("Seeded the demo applicant. Sample predictions were skipped because the model runtime is unavailable.")
            return
        rng = np.random.default_rng(7)
        random.seed(7)
        db.session.add(demo)
        users = [User(name=n, email=f"{n.split()[0].lower()}@example.com", password_hash=hash_password("Demo@12345")) for n in NAMES]
        db.session.add_all(users)
        db.session.flush()
        for i, lt in enumerate(["personal", "home", "vehicle", "education", "business", "personal"]):
            add_prediction(app, predictor, demo, now - timedelta(days=(5 - i) * 4, hours=i), lt, rng)
        for _ in range(70):
            add_prediction(app, predictor, random.choice(users), now - timedelta(days=random.randint(0, 29), hours=random.randint(0, 23)), None, rng)
        db.session.commit()
        print("Seeded 1 demo applicant, 10 users and 76 predictions.")


if __name__ == "__main__":
    main()
