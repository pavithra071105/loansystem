"""PDF eligibility report (ReportLab). Uses 'Rs.' because the built-in PDF fonts lack the rupee glyph."""
import json
from io import BytesIO

from reportlab.graphics.shapes import Drawing, Rect
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from .finance import inr
from .loans import LOAN_TYPES, fields_for

INK, MUTED, LINE, BLUE = colors.HexColor("#101828"), colors.HexColor("#667085"), colors.HexColor("#E4E7EC"), colors.HexColor("#1F5FBF")
TONE = {"approved": colors.HexColor("#12805C"), "review": colors.HexColor("#B76E00"), "unlikely": colors.HexColor("#C2344D")}


def _fmt(field, value):
    if field["type"] == "select":
        return next((o["label"] for o in field["options"] if o["value"] == value), str(value))
    if field.get("unit") == "₹":
        return inr(value, plain=True)
    return f"{value:g} {field.get('unit', '')}".strip()


def _bar(pct, color, width=170 * mm):
    d = Drawing(width, 10)
    d.add(Rect(0, 1, width, 8, fillColor=LINE, strokeColor=None))
    d.add(Rect(0, 1, width * max(min(pct, 100), 0) / 100, 8, fillColor=color, strokeColor=None))
    return d


def _table(rows, widths, header=True):
    t = Table(rows, colWidths=widths)
    style = [("FONTSIZE", (0, 0), (-1, -1), 9), ("TEXTCOLOR", (0, 0), (-1, -1), INK), ("LINEBELOW", (0, 0), (-1, -1), 0.4, LINE),
             ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5), ("VALIGN", (0, 0), (-1, -1), "MIDDLE")]
    if header:
        style += [("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"), ("TEXTCOLOR", (0, 0), (-1, 0), MUTED)]
    t.setStyle(TableStyle(style))
    return t


def build_report(pred, user):
    inp, res = json.loads(pred.input_json), json.loads(pred.result_json)
    rec, cfg = res["recommendation"], LOAN_TYPES[pred.loan_type]
    ss = getSampleStyleSheet()
    h1 = ParagraphStyle("h1", parent=ss["Title"], fontName="Helvetica-Bold", fontSize=20, textColor=INK, alignment=0, spaceAfter=2)
    h2 = ParagraphStyle("h2", parent=ss["Heading2"], fontName="Helvetica-Bold", fontSize=12, textColor=INK, spaceBefore=14, spaceAfter=6)
    body = ParagraphStyle("body", parent=ss["BodyText"], fontSize=9.5, leading=14, textColor=INK)
    small = ParagraphStyle("small", parent=body, fontSize=8, leading=11, textColor=MUTED)
    tone = TONE[res["verdict"]["code"]]
    heuristic = res.get("model", {}).get("mode") == "heuristic"
    method_text = (
        f"{res['risk']['label']}. This is a demo-only estimate from a transparent synthetic underwriting heuristic, "
        "not a trained model or lender decision."
        if heuristic else
        f"{res['risk']['label']}. Approval probability from the combined Logistic Regression "
        f"({res['model_probabilities']['logistic_regression']:.0f}%) and Random Forest "
        f"({res['model_probabilities']['random_forest']:.0f}%) models."
    )

    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=20 * mm, rightMargin=20 * mm, topMargin=18 * mm, bottomMargin=18 * mm,
                            title=f"Loan eligibility report #{pred.id}", author="LoanLens")
    s = [Paragraph("Loan eligibility report", h1),
         Paragraph(f"{cfg['label']} | Report #{pred.id} | {pred.created_at:%d %b %Y} | Prepared for {user.name} ({user.email})", small),
         Spacer(1, 10)]

    big = ParagraphStyle("big", parent=body, fontName="Helvetica-Bold", fontSize=30, leading=34, textColor=tone)
    head = Table([[Paragraph(f"{res['probability']:.0f}%", big),
                   [Paragraph(f"<b>{res['verdict']['label']}</b>", ParagraphStyle("v", parent=body, fontSize=13, textColor=tone)),
                    Paragraph(method_text, body)]]],
                 colWidths=[40 * mm, 130 * mm])
    head.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("BOX", (0, 0), (-1, -1), 0.8, tone), ("LEFTPADDING", (0, 0), (-1, -1), 10),
                              ("TOPPADDING", (0, 0), (-1, -1), 10), ("BOTTOMPADDING", (0, 0), (-1, -1), 10)]))
    s += [head, Spacer(1, 6), _bar(res["probability"], tone)]

    a = res["affordability"]
    s += [Paragraph("Your loan request", h2), _table([
        ["Amount", inr(pred.loan_amount, plain=True), "Interest rate", f"{res['interest_rate']}% a year"],
        ["Tenure", f"{pred.tenure_months} months", "Monthly EMI", inr(res["emi"], plain=True)],
        ["Total interest", inr(res["total_interest"], plain=True), "Total repayment", inr(res["total_payment"], plain=True)],
        ["Debt-to-income", f"{a['dti']}% ({a['status']})", "Comfortable limit", inr(a["comfortable_max_loan"], plain=True)],
    ], [32 * mm, 53 * mm, 32 * mm, 53 * mm], header=False)]

    prof = [[f["label"], _fmt(f, inp[f["name"]])] for f in fields_for(pred.loan_type) if f["name"] in inp and f["name"] not in ("loan_amount", "tenure_months")]
    half = (len(prof) + 1) // 2
    left, right = prof[:half], prof[half:] + [["", ""]] * (half - len(prof[half:]))
    s += [Paragraph("Applicant profile", h2), _table([l + r for l, r in zip(left, right)], [40 * mm, 45 * mm, 40 * mm, 45 * mm], header=False)]

    rows = [["What influenced the result", "Your value", "Effect"]]
    for f in res["explanation"]["factors"]:
        rows.append([f["label"], f["value"], f"{f['impact']:+.1f} points"])
    t = _table(rows, [65 * mm, 65 * mm, 40 * mm])
    for i, f in enumerate(res["explanation"]["factors"], start=1):
        t.setStyle(TableStyle([("TEXTCOLOR", (2, i), (2, i), TONE["approved"] if f["direction"] == "up" else TONE["unlikely"])]))
    s += [Paragraph("Why this result", h2), t,
          Paragraph(f"{res['explanation']['method']}, measured from a {res['explanation']['base_probability']:.0f}% baseline.", small)]

    msg = {"fits": "Your requested amount fits your profile. The tenure below balances approval chances against total interest.",
           "reduce": "A smaller loan improves your approval chances. This is the largest amount that clears our approval threshold.",
           "not_viable": "No amount tested clears the approval threshold yet. Work on the improvements below, then apply again."}[rec["status"]]
    s += [Paragraph("Recommended amount and tenure", h2), Paragraph(msg, body), Spacer(1, 4),
          _table([["Amount", "Tenure", "EMI", "Approval chance"],
                  [inr(rec["amount"], plain=True), f"{rec['tenure_months']} months", inr(rec["emi"], plain=True), f"{rec['probability']:.0f}%"]],
                 [45 * mm, 40 * mm, 40 * mm, 45 * mm])]
    if rec["levers"]:
        s += [Spacer(1, 6), _table([["Ways to improve", "Approval chance after"]] + [[l["label"], f"{l['probability']:.0f}% ({l['gain']:+.0f})"] for l in rec["levers"]], [110 * mm, 60 * mm])]

    s += [Paragraph("Financial stress test", h2), _table(
        [["Scenario", "Approval chance", "Change", "EMI"]] + [[x["label"], f"{x['probability']:.0f}%", f"{x['change']:+.1f}", inr(x["emi"], plain=True)] for x in res["stress"]],
        [80 * mm, 30 * mm, 25 * mm, 35 * mm])]
    disclaimer = ("This report is a demo-only heuristic estimate based on synthetic underwriting rules, not a trained model. "
                  if heuristic else "This report is an indicative estimate from statistical models trained on synthetic data. ")
    s += [Spacer(1, 16), Paragraph(disclaimer + "It is not a credit decision, "
                                   "and a lender's own checks may reach a different outcome.", small)]
    doc.build(s)
    buf.seek(0)
    return buf
