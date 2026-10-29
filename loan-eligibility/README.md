# LoanLens: AI loan eligibility prediction

Applicants pick a loan type, fill an adaptive form and get an approval probability, a risk class, a plain-language
explanation (SHAP), a recommended amount and tenure, a stress test, a what-if simulator and a downloadable PDF.
Admins get analytics across all applications and model quality.

**Stack:** React 19 + TypeScript, Vite, Tailwind CSS 4, shadcn/ui-style components, Recharts, Framer Motion ·
Flask, SQLAlchemy + SQLite, scikit-learn (Logistic Regression + Random Forest), SHAP, ReportLab, pytest.

> The models are trained on **synthetic data** generated from common underwriting rules (credit score, debt-to-income,
> loan-to-value, stability). Results are illustrative, not a credit decision. See "Using real data" below.

## Run it in the VS Code terminal

You need Python 3.10 to 3.13 and Node 20+. Open the project folder in VS Code, then open two terminals (Terminal > New Terminal).

**Terminal 1: backend**

```bash
cd backend
python -m venv .venv
# macOS / Linux:            source .venv/bin/activate
# Windows PowerShell:       .venv\Scripts\Activate.ps1
# Windows cmd:              .venv\Scripts\activate.bat
pip install -r requirements.txt
python seed_demo.py        # optional: demo users + 76 sample predictions
python run.py              # http://127.0.0.1:5000
```

The first start trains both models (about 5 seconds) and saves them to `backend/models/`.

**Terminal 2: frontend**

```bash
cd frontend
npm install
npm run dev                # http://localhost:5173
```

Open http://localhost:5173. Vite proxies `/api` to Flask, so there is no CORS setup.

Shortcut: **Terminal > Run Task** has "Backend: install", "Frontend: install", "Backend: seed demo data" and **"Run full stack"**,
which starts both servers (defined in `.vscode/tasks.json`).

### Accounts

| Role | Email | Password |
|---|---|---|
| Admin (created on first start) | `admin@loanlens.ai` | `Admin@12345` |
| Demo applicant (after `seed_demo.py`) | `demo@loanlens.ai` | `Demo@12345` |

Anyone can register as an applicant. Admins can't be created from the sign-up form. Change the admin credentials with
the `ADMIN_EMAIL` / `ADMIN_PASSWORD` environment variables before first start.

## Tests

```bash
cd backend && python -m pytest -q      # 24 tests: finance maths, validation, auth, roles, predictions, PDF, admin
cd frontend && npm run build           # type-checks, then builds
```

## How it works

```
frontend/src
  pages/        Auth, Dashboard, Apply, Result, History, Calculators, Admin
  components/   ui/ (button, card, input, tabs, slider, badge), result/ (SHAP, stress, what-if, recommendation), gauge
  lib/          typed API client, hooks, formatters (Indian grouping)
backend/app
  loans.py      loan catalogue: ONE schema drives the dynamic form AND server-side validation
  ml/           data.py (synthetic applicants) · features.py · train.py · predictor.py (score, SHAP, recommend, stress, what-if)
  routes/       auth, predictions, calculators, admin, meta
  reports.py    PDF report (ReportLab)
```

- **Dynamic forms:** the frontend calls `GET /api/meta/loan-types` and renders whatever fields that loan type defines. Add a
  field in `loans.py` and it appears in the form and is validated, with no frontend change (add it to `ml/features.py` if the model should use it).
- **Prediction:** the headline probability averages Logistic Regression and Random Forest. Verdict: 70%+ likely approved,
  45 to 70% needs review, below 45% unlikely. Risk level follows the same bands, raised one step when debt-to-income exceeds 60%.
- **Restricted ML runtime:** if Windows blocks the scientific Python libraries, LoanLens falls back to a dependency-free,
  demo-only estimate using the same synthetic underwriting rules as the sample-data generator. The result and PDF identify
  this heuristic clearly; it is not a trained model or a lender decision. Trained model metrics are hidden in this mode.
- **Explainability:** SHAP `TreeExplainer` on the Random Forest. Each factor shows how many percentage points it added or removed.
- **Recommendation:** re-scores a grid of amounts and tenures in one batch and picks the largest amount that stays above 70% with
  debt-to-income at or below 50%, then the shortest tenure within 3 points of the best approval chance. "Ways to improve" re-scores
  single changes (credit +40, pay off half the EMIs, and so on).
- **Scenario comparison:** the recommendation view compares the submitted request with its suggested amount and tenure, including
  monthly EMI, total interest, demo score, and debt-to-income. These guideposts are illustrative and are not lender approval criteria.
- **Stress test:** income -10% / -25%, rates +2 points, other EMIs +25%, credit -60, and a combined shock.
- **Pricing:** interest rate = base rate for the loan type + 1.5 points per 100 credit-score points below 750.

### API (all JSON, bearer token)

`POST /api/auth/register|login` · `GET /api/auth/me` · `GET /api/meta/loan-types` ·
`POST /api/predictions` · `GET /api/predictions[?loan_type=]` · `GET|DELETE /api/predictions/:id` ·
`POST /api/predictions/:id/what-if` · `GET /api/predictions/:id/report` (PDF) ·
`POST /api/calculators/emi|affordability` · `GET /api/admin/analytics|predictions` (admin only)

## Configuration (environment variables)

`SECRET_KEY`, `DATABASE_URL` (default SQLite file in `backend/`), `MODEL_DIR`, `TRAIN_SAMPLES` (9000), `RF_TREES` (250),
`ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`. Delete `backend/models/` to retrain.

## Using real data

Replace `build_dataset` in `backend/app/ml/data.py` with a loader that returns a DataFrame with the columns in
`ml/features.py: FEATURES` plus an `approved` label, delete `backend/models/`, and restart. Check the hold-out metrics on the
admin page, and test for bias across protected groups before using any model on real applicants.

## Before deploying

This is a development setup. At minimum: set a strong `SECRET_KEY`, change the admin password, serve Flask with gunicorn/waitress
behind HTTPS, add login rate limiting, and consider moving the JWT from `localStorage` to an httpOnly cookie.

## Troubleshooting

- **"Can't reach the server"** in the UI: the backend isn't running on port 5000.
- **`pip install` fails on `shap`/`numba`:** use Python 3.10 to 3.13.
- **Windows blocks an ML native DLL at startup:** the app uses the clearly labeled, synthetic-rule demo estimate; trained-model metrics remain unavailable until the Python scientific dependencies are permitted by your administrator.
- **PowerShell blocks activation:** run `Set-ExecutionPolicy -Scope Process Bypass`, then activate again.
- **Port in use:** change the port in `backend/run.py` and the proxy target in `frontend/vite.config.ts`.
