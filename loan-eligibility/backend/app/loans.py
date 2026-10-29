"""Loan catalogue: the single source of truth for form fields and validation.

The same structure is served to the frontend (GET /api/meta/loan-types), which renders the
dynamic application form from it, and used here to validate every submission.
"""
import math


def _opts(pairs):
    return [{"value": v, "label": l} for v, l in pairs]


EMPLOYMENT = [("salaried", "Salaried"), ("self_employed", "Self-employed"), ("business", "Business owner")]
LOAN_KEYS = ["personal", "home", "education", "vehicle", "business"]

COMMON_FIELDS = [
    dict(name="age", label="Age", type="number", section="person", min=18, max=70, step=1, default=32, unit="yrs", integer=True),
    dict(name="dependents", label="Dependents", type="number", section="person", min=0, max=8, step=1, default=1, integer=True),
    dict(name="employment_type", label="Employment type", type="select", section="person", options=_opts(EMPLOYMENT), default="salaried"),
    dict(name="employment_years", label="Years in current job or business", type="number", section="person", min=0, max=45, step=0.5, default=4, unit="yrs"),
    dict(name="monthly_income", label="Monthly income", type="number", section="finance", min=10_000, max=1_000_000, step=1_000, default=75_000, unit="₹", help="Take-home pay, before any EMIs"),
    dict(name="credit_score", label="Credit score (CIBIL)", type="number", section="finance", min=300, max=900, step=1, default=730, integer=True, help="Between 300 and 900"),
    dict(name="existing_emi", label="Existing EMIs per month", type="number", section="finance", min=0, max=500_000, step=500, default=8_000, unit="₹", help="Add up every loan and card EMI you pay today"),
]

PURPOSES = [("medical", "Medical"), ("wedding", "Wedding"), ("travel", "Travel"), ("debt", "Debt consolidation"),
            ("home_improvement", "Home improvement"), ("other", "Other")]

LOAN_TYPES = {
    "personal": dict(
        label="Personal Loan", tagline="Unsecured funds for weddings, medical bills or consolidating debt", icon="Wallet",
        rate=12.5, min_amount=50_000, max_amount=2_500_000, amount_step=10_000, default_amount=300_000,
        tenures=[12, 24, 36, 48, 60, 84], default_tenure=36, asset_field=None,
        fields=[
            dict(name="savings", label="Savings you can set aside", type="number", min=0, max=20_000_000, step=5_000, default=100_000, unit="₹"),
            dict(name="purpose", label="Purpose", type="select", options=_opts(PURPOSES), default="other"),
        ]),
    "home": dict(
        label="Home Loan", tagline="Buy, build or extend a home with the longest repayment terms", icon="Home",
        rate=8.75, min_amount=500_000, max_amount=50_000_000, amount_step=50_000, default_amount=3_500_000,
        tenures=[60, 120, 180, 240, 300, 360], default_tenure=240, asset_field="property_value",
        fields=[
            dict(name="property_value", label="Property value", type="number", min=500_000, max=100_000_000, step=50_000, default=5_000_000, unit="₹"),
            dict(name="down_payment", label="Down payment", type="number", min=0, max=100_000_000, step=25_000, default=1_000_000, unit="₹"),
        ]),
    "education": dict(
        label="Education Loan", tagline="Cover tuition and living costs, in India or abroad", icon="GraduationCap",
        rate=9.5, min_amount=100_000, max_amount=7_500_000, amount_step=25_000, default_amount=1_500_000,
        tenures=[36, 60, 84, 120, 180], default_tenure=84, asset_field=None,
        fields=[
            dict(name="course_type", label="Where will you study?", type="select",
                 options=_opts([("domestic", "In India"), ("abroad", "Abroad")]), default="domestic"),
            dict(name="co_applicant_income", label="Co-applicant monthly income", type="number", min=0, max=1_000_000, step=1_000, default=60_000, unit="₹",
                 help="Usually a parent or guardian. Use 0 if none"),
        ]),
    "vehicle": dict(
        label="Vehicle Loan", tagline="Finance a new or used car or two-wheeler", icon="Car",
        rate=9.25, min_amount=100_000, max_amount=5_000_000, amount_step=10_000, default_amount=700_000,
        tenures=[12, 24, 36, 48, 60, 84], default_tenure=60, asset_field="vehicle_price",
        fields=[
            dict(name="vehicle_price", label="Vehicle price", type="number", min=100_000, max=10_000_000, step=10_000, default=900_000, unit="₹"),
            dict(name="down_payment", label="Down payment", type="number", min=0, max=10_000_000, step=10_000, default=200_000, unit="₹"),
            dict(name="vehicle_condition", label="Vehicle condition", type="select", options=_opts([("new", "New"), ("used", "Used")]), default="new"),
        ]),
    "business": dict(
        label="Business Loan", tagline="Working capital or expansion funding for your business", icon="Briefcase",
        rate=14.0, min_amount=100_000, max_amount=20_000_000, amount_step=50_000, default_amount=1_500_000,
        tenures=[12, 24, 36, 60, 84, 120], default_tenure=60, asset_field="collateral_value",
        fields=[
            dict(name="annual_turnover", label="Annual turnover", type="number", min=100_000, max=500_000_000, step=50_000, default=6_000_000, unit="₹"),
            dict(name="years_in_business", label="Years in business", type="number", min=0, max=60, step=0.5, default=4, unit="yrs"),
            dict(name="collateral_value", label="Collateral value", type="number", min=0, max=500_000_000, step=50_000, default=1_000_000, unit="₹", help="Use 0 for an unsecured loan"),
        ]),
}


def _tenure_label(m):
    return f"{m} months" if m < 24 else (f"{m // 12} years" if m % 12 == 0 else f"{m} months")


def amount_field(cfg):
    return dict(name="loan_amount", label="Loan amount", type="number", section="loan", min=cfg["min_amount"], max=cfg["max_amount"],
                step=cfg["amount_step"], default=cfg["default_amount"], unit="₹")


def tenure_field(cfg):
    return dict(name="tenure_months", label="Repayment period", type="select", section="loan", default=cfg["default_tenure"],
                options=[{"value": t, "label": _tenure_label(t)} for t in cfg["tenures"]])


def fields_for(loan_type):
    cfg = LOAN_TYPES[loan_type]
    extras = [dict(f, section="details") for f in cfg["fields"]]
    return COMMON_FIELDS + [amount_field(cfg), tenure_field(cfg)] + extras


def catalog():
    out = {}
    for key in LOAN_KEYS:
        cfg = LOAN_TYPES[key]
        out[key] = {"key": key, "label": cfg["label"], "tagline": cfg["tagline"], "icon": cfg["icon"], "rate": cfg["rate"],
                    "min_amount": cfg["min_amount"], "max_amount": cfg["max_amount"], "tenures": cfg["tenures"],
                    "asset_field": cfg["asset_field"], "fields": fields_for(key)}
    return out


def _to_number(raw):
    if isinstance(raw, bool):
        raise ValueError
    if isinstance(raw, str):
        raw = raw.strip().replace(",", "")
    v = float(raw)
    if not math.isfinite(v):
        raise ValueError
    return v


def validate_application(loan_type, payload, strict=True):
    """Return (clean_dict, errors). With strict=False values are clamped instead of rejected
    (used by the what-if simulator where sliders may push a value slightly out of range)."""
    if loan_type not in LOAN_TYPES:
        return {}, {"loan_type": "Choose a valid loan type."}
    cfg = LOAN_TYPES[loan_type]
    clean, errors = {"loan_type": loan_type}, {}

    for f in fields_for(loan_type):
        name, raw = f["name"], payload.get(f["name"])
        if raw is None or raw == "":
            if strict:
                errors[name] = "This field is required."
                continue
            raw = f["default"]
        if f["type"] == "select":
            values = [o["value"] for o in f["options"]]
            try:
                val = int(_to_number(raw)) if isinstance(values[0], int) else str(raw)
            except (ValueError, TypeError):
                val = None
            if val not in values:
                errors[name] = "Choose one of the listed options."
                continue
            clean[name] = val
            continue
        try:
            val = _to_number(raw)
        except (ValueError, TypeError):
            errors[name] = "Enter a number."
            continue
        if val < f["min"] or val > f["max"]:
            if strict:
                errors[name] = f"Enter a value between {f['min']:,} and {f['max']:,}."
                continue
            val = min(max(val, f["min"]), f["max"])
        clean[name] = int(round(val)) if f.get("integer") else val

    if not errors and "down_payment" in clean:
        asset = clean[cfg["asset_field"]]
        label = "property value" if loan_type == "home" else "vehicle price"
        if clean["down_payment"] > asset:
            if strict:
                errors["down_payment"] = f"Down payment can't be more than the {label}."
            else:
                clean["down_payment"] = asset
        cap = asset - clean["down_payment"]
        if clean["loan_amount"] > cap:
            if strict:
                errors["loan_amount"] = f"Loan plus down payment can't exceed the {label}."
            else:
                clean["loan_amount"] = max(min(cap, cfg["max_amount"]), cfg["min_amount"])
    return clean, errors
