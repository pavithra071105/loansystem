"""Pure loan-maths helpers (no Flask, no ML)."""


def _r(annual_rate_pct: float) -> float:
    return annual_rate_pct / 1200.0


def emi(principal: float, annual_rate_pct: float, months: int) -> float:
    if months <= 0:
        raise ValueError("months must be positive")
    r = _r(annual_rate_pct)
    if r == 0:
        return principal / months
    f = (1 + r) ** months
    return principal * r * f / (f - 1)


def yearly_schedule(principal: float, annual_rate_pct: float, months: int):
    """Amortisation rolled up by year: principal paid, interest paid, closing balance."""
    r = _r(annual_rate_pct)
    pay = emi(principal, annual_rate_pct, months)
    balance, rows, year_p, year_i = principal, [], 0.0, 0.0
    for m in range(1, months + 1):
        interest = balance * r
        paid = pay - interest
        balance = max(balance - paid, 0.0)
        year_i += interest
        year_p += paid
        if m % 12 == 0 or m == months:
            rows.append({"year": (m + 11) // 12, "principal": round(year_p, 2),
                         "interest": round(year_i, 2), "balance": round(balance, 2)})
            year_p = year_i = 0.0
    return rows


def max_principal(emi_budget: float, annual_rate_pct: float, months: int) -> float:
    """Largest loan whose EMI fits inside `emi_budget`."""
    if emi_budget <= 0:
        return 0.0
    r = _r(annual_rate_pct)
    if r == 0:
        return emi_budget * months
    f = (1 + r) ** months
    return emi_budget * (f - 1) / (r * f)


def effective_rate(base_rate: float, credit_score: float, delta: float = 0.0) -> float:
    """Lenders price weaker credit higher: +1.5 points per 100 score points below 750."""
    return round(base_rate + max(0.0, 750 - credit_score) * 0.015 + delta, 2)


def inr(amount: float, plain: bool = False) -> str:
    """Indian digit grouping, e.g. 1234567 -> 12,34,567. `plain` uses 'Rs.' for PDFs."""
    n = int(round(amount))
    sign = "-" if n < 0 else ""
    s = str(abs(n))
    if len(s) > 3:
        head, tail = s[:-3], s[-3:]
        groups = []
        while len(head) > 2:
            groups.insert(0, head[-2:])
            head = head[:-2]
        if head:
            groups.insert(0, head)
        s = ",".join(groups) + "," + tail
    return f"{sign}{'Rs. ' if plain else '₹'}{s}"
