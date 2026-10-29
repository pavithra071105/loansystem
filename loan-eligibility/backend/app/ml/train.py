"""Train Logistic Regression + Random Forest and persist them with their hold-out metrics.

Run manually with:  python -m app.ml.train
"""
import json
import time
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score, roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from .data import build_dataset
from .features import FEATURES


def _scores(y, p):
    pred = (p >= 0.5).astype(int)
    return {"accuracy": round(accuracy_score(y, pred), 4), "precision": round(precision_score(y, pred), 4),
            "recall": round(recall_score(y, pred), 4), "f1": round(f1_score(y, pred), 4), "roc_auc": round(roc_auc_score(y, p), 4)}


def train(model_dir, n_samples=9000, n_estimators=250, seed=42):
    started = time.time()
    X, y = build_dataset(n_samples, seed)
    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, random_state=seed, stratify=y)

    lr = make_pipeline(StandardScaler(), LogisticRegression(max_iter=2000, C=1.0))
    lr.fit(X_tr, y_tr)
    rf = RandomForestClassifier(n_estimators=n_estimators, min_samples_leaf=6, max_depth=14, n_jobs=-1, random_state=seed)
    rf.fit(X_tr, y_tr)

    p_lr, p_rf = lr.predict_proba(X_te)[:, 1], rf.predict_proba(X_te)[:, 1]
    importances = sorted(zip(FEATURES, rf.feature_importances_), key=lambda t: -t[1])[:10]
    metrics = {
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "samples": int(n_samples),
        "approval_rate": round(float(y.mean()), 4),
        "logistic_regression": _scores(y_te, p_lr),
        "random_forest": _scores(y_te, p_rf),
        "ensemble": _scores(y_te, (p_lr + p_rf) / 2),
        "top_features": [{"feature": f, "importance": round(float(i), 4)} for f, i in importances],
        "data_source": "synthetic",
    }
    path = Path(model_dir)
    path.mkdir(parents=True, exist_ok=True)
    joblib.dump({"lr": lr, "rf": rf}, path / "models.joblib")
    (path / "metrics.json").write_text(json.dumps(metrics, indent=2))
    metrics["seconds"] = round(time.time() - started, 1)
    return metrics


if __name__ == "__main__":
    from ..config import Config

    m = train(Config.MODEL_DIR, Config.TRAIN_SAMPLES, Config.RF_TREES)
    print(json.dumps(m, indent=2))
