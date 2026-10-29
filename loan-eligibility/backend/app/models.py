import json
from datetime import datetime, timezone

from .extensions import db


def _now():
    return datetime.now(timezone.utc)


class User(db.Model):
    __tablename__ = "users"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), nullable=False)
    email = db.Column(db.String(160), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(256), nullable=False)
    role = db.Column(db.String(20), nullable=False, default="applicant")
    created_at = db.Column(db.DateTime, default=_now)

    predictions = db.relationship("Prediction", backref="user", cascade="all, delete-orphan")

    def to_dict(self):
        return {"id": self.id, "name": self.name, "email": self.email, "role": self.role}


class Prediction(db.Model):
    __tablename__ = "predictions"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    loan_type = db.Column(db.String(20), nullable=False, index=True)
    loan_amount = db.Column(db.Float, nullable=False)
    tenure_months = db.Column(db.Integer, nullable=False)
    probability = db.Column(db.Float, nullable=False)  # percent, 0-100
    verdict = db.Column(db.String(20), nullable=False)
    risk_level = db.Column(db.String(20), nullable=False)
    input_json = db.Column(db.Text, nullable=False)
    result_json = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=_now, index=True)

    def summary(self, with_user=False):
        data = {
            "id": self.id,
            "loan_type": self.loan_type,
            "loan_amount": self.loan_amount,
            "tenure_months": self.tenure_months,
            "probability": self.probability,
            "verdict": self.verdict,
            "risk_level": self.risk_level,
            "created_at": self.created_at.replace(tzinfo=timezone.utc).isoformat(),
        }
        if with_user:
            data["user"] = {"id": self.user.id, "name": self.user.name, "email": self.user.email}
        return data

    def full(self):
        return {**self.summary(), "input": json.loads(self.input_json), "result": json.loads(self.result_json)}
