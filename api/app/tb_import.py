from __future__ import annotations

import csv
import io
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import Dict, List, Optional, Tuple


# -------------------------
# Helpers for messy exports
# -------------------------
def _strip_bom(s: str) -> str:
    return s.lstrip("\ufeff") if isinstance(s, str) else s


def _normalize_header_if_needed(csv_text: str, delimiter: str, has_headers: bool, header_row: int) -> str:
    """
    Fix a common issue:
    header is TAB-delimited (sometimes quoted) but data is comma-delimited.
    We only patch header_row==1 to keep behavior predictable.
    """
    if not has_headers:
        return csv_text
    if header_row != 1:
        return _strip_bom(csv_text)

    lines = csv_text.splitlines()
    if not lines:
        return csv_text

    header = _strip_bom(lines[0])

    if delimiter == "," and ("\t" in header) and ("," not in header):
        header = header.replace("\t", ",")
        lines[0] = header
        return "\n".join(lines)

    lines[0] = header
    return "\n".join(lines)


def _normalize_csv_text(csv_text: str, delimiter: str, has_headers: bool, header_row: int) -> str:
    csv_text = _strip_bom(csv_text)
    csv_text = _normalize_header_if_needed(csv_text, delimiter, has_headers, header_row)
    return csv_text


# -------------------------
# Data model
# -------------------------
@dataclass
class ColumnMapping:
    account_col: str
    desc_col: Optional[str]

    # "signed" = total balance column (debit positive, credit negative)
    # "dc" = separate debit and credit columns
    mode: str  # "signed" or "dc"

    balance_col: Optional[str]
    debit_col: Optional[str]
    credit_col: Optional[str]

    # If using separate debit/credit columns:
    # - keep: credit column is positive and should be subtracted
    # - reverse: credit column stored positive but should be treated as negative (flip sign before calc)
    credit_sign_mode: str = "keep"  # "keep" or "reverse"

    # fund logic
    fund_mode: str  # "fund_from_account_prefix" or "fund_column" or "single_fund"
    fund_col: Optional[str]
    fund_delimiter: str  # e.g. "-"

    # filters
    ignore_blank_account: bool = True
    ignore_blank_amount: bool = True
    ignore_zero: bool = True


# -------------------------
# Parsing amounts
# -------------------------
def parse_decimal(value: str) -> Optional[Decimal]:
    if value is None:
        return None
    s = str(value).strip()
    if s == "":
        return None

    # handle parentheses negatives e.g. (1,234.56)
    if s.startswith("(") and s.endswith(")"):
        s = "-" + s[1:-1]

    # remove thousands separators
    s = s.replace(",", "")

    try:
        return Decimal(s)
    except InvalidOperation:
        return None


# -------------------------
# CSV preview + iteration
# -------------------------
def read_csv_preview(
    csv_text: str,
    has_headers: bool = True,
    header_row: int = 1,
    delimiter: str = ",",
    max_rows: int = 50,
):
    """
    Returns (headers, rows)
    - if has_headers: rows is List[Dict[str,str]]
    - else: rows is List[List[str]] (but we still return synthetic headers)
    """
    csv_text = _normalize_csv_text(csv_text, delimiter, has_headers, header_row)

    f = io.StringIO(csv_text)

    # Skip to header row
    for _ in range(header_row - 1):
        f.readline()

    reader = csv.reader(f, delimiter=delimiter)
    try:
        first = next(reader)
    except StopIteration:
        return [], []

    if has_headers:
        headers = [(_strip_bom(h).strip() if h else "") for h in first]
        rows: List[Dict[str, str]] = []

        for i, r in enumerate(reader):
            if i >= max_rows:
                break
            row = {headers[j]: (r[j] if j < len(r) else "") for j in range(len(headers))}
            rows.append(row)

        return headers, rows

    # no headers
    headers = [f"Column {i+1}" for i in range(len(first))]
    rows_list: List[List[str]] = [first]

    for i, r in enumerate(reader):
        if i >= max_rows - 1:
            break
        rows_list.append(r)

    # For template preview we prefer dict-style access; but caller can handle either.
    # We'll return list-of-lists for no-header mode (not used in XLSX-only MVP).
    return headers, rows_list


def iter_csv_rows(csv_text: str, has_headers: bool, header_row: int, delimiter: str):
    """
    Yields (row_number_in_source, row_dict)
    """
    csv_text = _normalize_csv_text(csv_text, delimiter, has_headers, header_row)

    f = io.StringIO(csv_text)
    for _ in range(header_row - 1):
        f.readline()

    if has_headers:
        reader = csv.DictReader(f, delimiter=delimiter)
        for idx, row in enumerate(reader, start=header_row + 1):
            if not row:
                yield idx, {}
                continue
            fixed: Dict[str, str] = {}
            for k, v in row.items():
                kk = _strip_bom(k).strip() if isinstance(k, str) else k
                fixed[kk] = v
            yield idx, fixed
    else:
        reader = csv.reader(f, delimiter=delimiter)
        for idx, row in enumerate(reader, start=header_row + 1):
            yield idx, {f"Column {i+1}": (row[i] if i < len(row) else "") for i in range(len(row))}


# -------------------------
# Fund derivation
# -------------------------
def derive_fund_from_account(account: str, delimiter: str) -> str:
    s = (account or "").strip()
    if s == "":
        return ""
    parts = s.split(delimiter, 1)
    return parts[0].strip() if parts else ""


# -------------------------
# Normalize row amount
# -------------------------
def normalize_amount(row: Dict[str, str], mapping: ColumnMapping) -> Tuple[Optional[Decimal], List[str]]:
    warnings: List[str] = []

    # Signed total balance mode
    if mapping.mode == "signed":
        raw = row.get(mapping.balance_col or "", "")
        amt = parse_decimal(raw)
        if amt is None:
            return None, ["Non-numeric balance"]
        return amt, warnings

    # Debit/Credit mode
    d_raw = row.get(mapping.debit_col or "", "")
    c_raw = row.get(mapping.credit_col or "", "")

    d = parse_decimal(d_raw) or Decimal("0")
    c = parse_decimal(c_raw) or Decimal("0")

    if (d_raw or "").strip() != "" and (c_raw or "").strip() != "":
        warnings.append("Both debit and credit populated")

    # Credit sign handling:
    # keep    => credit positive, subtract it (normal)
    # reverse => credit positive but should be treated negative (flip sign before calc)
    if (mapping.credit_sign_mode or "keep").lower() == "reverse":
        c = -c

    amt = d - c
    return amt, warnings


# -------------------------
# Validation summary
# -------------------------
def validate_tb(
    csv_text: str,
    has_headers: bool,
    header_row: int,
    delimiter: str,
    mapping: ColumnMapping,
) -> dict:
    total = Decimal("0")
    row_count = 0
    kept = 0
    non_numeric = 0
    missing_account = 0
    missing_fund = 0
    both_dc = 0

    fund_counts: Dict[str, int] = {}
    top_abs: List[Tuple[Decimal, str, str, int]] = []  # (abs, fund, acct, rowno)

    for rowno, row in iter_csv_rows(csv_text, has_headers, header_row, delimiter):
        row_count += 1

        acct = (row.get(mapping.account_col, "") or "").strip()
        if mapping.ignore_blank_account and acct == "":
            missing_account += 1
            continue

        # Determine fund code
        if mapping.fund_mode == "fund_from_account_prefix":
            fund = derive_fund_from_account(acct, mapping.fund_delimiter)
        elif mapping.fund_mode == "fund_column":
            fund = (row.get(mapping.fund_col or "", "") or "").strip()
        else:
            fund = "SINGLE"

        if fund == "":
            missing_fund += 1
            continue

        amt, warns = normalize_amount(row, mapping)
        if amt is None:
            non_numeric += 1
            continue

        if "Both debit and credit populated" in warns:
            both_dc += 1

        if mapping.ignore_zero and amt == 0:
            continue

        kept += 1
        total += amt
        fund_counts[fund] = fund_counts.get(fund, 0) + 1

        a = abs(amt)
        top_abs.append((a, fund, acct, rowno))

    top_abs.sort(reverse=True, key=lambda x: x[0])
    top_abs = top_abs[:10]

    return {
        "rows_read": row_count,
        "rows_kept": kept,
        "total_net": total,
        "missing_account": missing_account,
        "missing_fund": missing_fund,
        "non_numeric": non_numeric,
        "both_dc": both_dc,
        "fund_counts": fund_counts,
        "top_abs": top_abs,
    }

