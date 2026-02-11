from __future__ import annotations

import os
import io
import csv
from datetime import datetime, date
from decimal import Decimal
from typing import Dict, Optional

from fastapi import FastAPI, Request, UploadFile, Form
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy import select
from sqlalchemy.orm import Session

from openpyxl import load_workbook

from .db import engine, SessionLocal
from .models import Base, Client, Binder, UploadedFile, Fund, Account, TBImport, TBLine
from .tb_import import (
    read_csv_preview,
    ColumnMapping,
    validate_tb,
    iter_csv_rows,
    derive_fund_from_account,
    normalize_amount,
)

# -----------------------
# App + Templates
# -----------------------
app = FastAPI()
templates = Jinja2Templates(directory=os.path.join(os.path.dirname(__file__), "templates"))

Base.metadata.create_all(bind=engine)


def db_session() -> Session:
    return SessionLocal()


def xlsx_bytes_to_csv_text(xlsx_bytes: bytes) -> str:
    """
    Converts FIRST sheet of an .xlsx into CSV text for reuse by our mapping pipeline.
    """
    wb = load_workbook(filename=io.BytesIO(xlsx_bytes), data_only=True, read_only=True)
    ws = wb.worksheets[0]

    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        return ""

    max_cols = max(len(r) for r in rows)

    def norm(v) -> str:
        if v is None:
            return ""
        return str(v)

    table = []
    for r in rows:
        row = [norm(r[i]) if i < len(r) else "" for i in range(max_cols)]
        table.append(row)

    # trim trailing fully-empty columns
    while max_cols > 1 and all((row[max_cols - 1] == "" for row in table)):
        max_cols -= 1
        table = [row[:max_cols] for row in table]

    out = io.StringIO()
    w = csv.writer(out)
    for row in table:
        w.writerow(row)
    return out.getvalue()


def parse_period_end(s: str) -> date:
    # expects YYYY-MM-DD from <input type="date">
    return datetime.strptime(s, "%Y-%m-%d").date()


def get_binder_or_404(db: Session, binder_id: int) -> Binder:
    b = db.get(Binder, binder_id)
    if not b:
        raise ValueError("Binder not found")
    return b


@app.get("/health")
def health():
    return {"status": "ok"}


# ============================================================
# HOME: Select/Create Client + Period (Binder)
# ============================================================
@app.get("/", response_class=HTMLResponse)
def home(request: Request):
    with db_session() as db:
        clients = db.scalars(select(Client).order_by(Client.client_name.asc())).all()

        # recent binders (optional convenience)
        recent_binders = db.scalars(
            select(Binder).order_by(Binder.created_at.desc()).limit(15)
        ).all()

        # preload clients for binder list display
        # (binder.client is lazy; easier: just rely on relationship, fine in template)
        return templates.TemplateResponse(
            "home.html",
            {
                "request": request,
                "clients": clients,
                "recent_binders": recent_binders,
                "message": None,
            },
        )


@app.post("/client/create")
def client_create(client_name: str = Form(...)):
    name = client_name.strip()
    if not name:
        return RedirectResponse("/", status_code=303)

    with db_session() as db:
        existing = db.scalar(select(Client).where(Client.client_name == name))
        if not existing:
            existing = Client(client_name=name)
            db.add(existing)
            db.commit()
            db.refresh(existing)

    return RedirectResponse("/", status_code=303)


@app.post("/binder/open")
def binder_open(
    client_id: int = Form(...),
    period_end: str = Form(...),
):
    pe = parse_period_end(period_end)

    with db_session() as db:
        client = db.get(Client, client_id)
        if not client:
            return RedirectResponse("/", status_code=303)

        binder = db.scalar(
            select(Binder).where(Binder.client_id == client_id, Binder.period_end == pe)
        )
        if not binder:
            binder = Binder(client_id=client_id, period_end=pe, fiscal_year=pe.year)
            db.add(binder)
            db.commit()
            db.refresh(binder)

        return RedirectResponse(f"/b/{binder.id}", status_code=303)


# ============================================================
# BINDER HOME
# ============================================================
@app.get("/b/{binder_id}", response_class=HTMLResponse)
def binder_home(request: Request, binder_id: int):
    with db_session() as db:
        binder = get_binder_or_404(db, binder_id)
        client = binder.client

        latest_import = db.scalar(
            select(TBImport)
            .where(TBImport.binder_id == binder_id)
            .order_by(TBImport.created_at.desc())
            .limit(1)
        )

        imported_lines = 0
        if latest_import:
            imported_lines = db.scalar(
                select(TBLine)
                .where(TBLine.tb_import_id == latest_import.id)
                .count()
            ) or 0

        return templates.TemplateResponse(
            "binder_home.html",
            {
                "request": request,
                "client": client,
                "binder": binder,
                "latest_import": latest_import,
                "imported_lines": imported_lines,
            },
        )


# ============================================================
# TB UPLOAD (XLSX ONLY)
# ============================================================
@app.get("/b/{binder_id}/tb/upload", response_class=HTMLResponse)
def tb_upload_page(request: Request, binder_id: int):
    with db_session() as db:
        binder = get_binder_or_404(db, binder_id)
        client = binder.client

    return templates.TemplateResponse(
        "upload.html",
        {"request": request, "client": client, "binder": binder, "message": None},
    )


@app.post("/b/{binder_id}/tb/upload", response_class=HTMLResponse)
async def tb_upload(request: Request, binder_id: int, file: UploadFile):
    raw = await file.read()
    filename = file.filename or "upload.xlsx"
    lower = filename.lower()

    with db_session() as db:
        binder = get_binder_or_404(db, binder_id)
        client = binder.client

    if not lower.endswith(".xlsx"):
        return templates.TemplateResponse(
            "upload.html",
            {
                "request": request,
                "client": client,
                "binder": binder,
                "message": "Please upload an Excel .xlsx trial balance file.",
            },
        )

    content = xlsx_bytes_to_csv_text(raw)

    # locked assumptions for XLSX->CSV pipeline
    has_headers_bool = True
    delimiter_used = ","
    header_row_used = 1
    content_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

    with db_session() as db:
        binder = get_binder_or_404(db, binder_id)
        client = binder.client

        uf = UploadedFile(
            binder_id=binder_id,
            filename=filename,
            content_type=content_type,
            content_text=content,
        )
        db.add(uf)
        db.commit()
        db.refresh(uf)

    headers, rows = read_csv_preview(
        content,
        has_headers=has_headers_bool,
        header_row=header_row_used,
        delimiter=delimiter_used,
        max_rows=50,
    )

    return templates.TemplateResponse(
        "map.html",
        {
            "request": request,
            "client": client,
            "binder": binder,
            "upload_id": uf.id,
            "filename": filename,
            "headers": headers,
            "rows": rows,
            "has_headers": True,
            "delimiter": ",",
            "header_row": 1,
            "message": None,
        },
    )


# ============================================================
# TB VALIDATE
# ============================================================
@app.post("/b/{binder_id}/tb/validate", response_class=HTMLResponse)
def tb_validate(
    request: Request,
    binder_id: int,

    upload_id: int = Form(...),
    has_headers: int = Form(...),
    delimiter: str = Form(...),
    header_row: int = Form(...),

    account_col: str = Form(...),
    desc_col: str = Form(...),

    amount_mode: str = Form(...),  # "signed" | "dc"
    balance_col: str = Form(""),
    debit_col: str = Form(""),
    credit_col: str = Form(""),
    credit_sign_mode: str = Form("keep"),  # keep | reverse

    fund_mode: str = Form(...),
    fund_col: str = Form(""),
    fund_delimiter: str = Form("-"),
):
    with db_session() as db:
        binder = get_binder_or_404(db, binder_id)
        client = binder.client

        uf = db.get(UploadedFile, upload_id)
        csv_text = uf.content_text if uf else ""

    mapping = ColumnMapping(
        account_col=account_col,
        desc_col=desc_col.strip() if desc_col.strip() else None,
        mode=amount_mode,
        balance_col=balance_col if amount_mode == "signed" else None,
        debit_col=debit_col if amount_mode == "dc" else None,
        credit_col=credit_col if amount_mode == "dc" else None,
        credit_sign_mode=(credit_sign_mode or "keep").strip().lower(),
        fund_mode=fund_mode,
        fund_col=fund_col if fund_mode == "fund_column" else None,
        fund_delimiter=fund_delimiter or "-",
    )

    report = validate_tb(
        csv_text=csv_text,
        has_headers=bool(has_headers),
        header_row=int(header_row),
        delimiter=delimiter,
        mapping=mapping,
    )

    tolerance = Decimal("1.00")
    nets_to_zero = abs(Decimal(str(report["total_net"]))) <= tolerance

    return templates.TemplateResponse(
        "validate.html",
        {
            "request": request,
            "client": client,
            "binder": binder,
            "upload_id": upload_id,
            "mapping": mapping,
            "has_headers": bool(has_headers),
            "delimiter": delimiter,
            "header_row": int(header_row),
            "report": report,
            "tolerance": tolerance,
            "nets_to_zero": nets_to_zero,
            "force_unbalanced_warning": False,
        },
    )


# ============================================================
# FUNDS SCREEN
# ============================================================
@app.post("/b/{binder_id}/tb/funds", response_class=HTMLResponse)
def tb_funds(
    request: Request,
    binder_id: int,

    upload_id: int = Form(...),
    has_headers: int = Form(...),
    delimiter: str = Form(...),
    header_row: int = Form(...),

    account_col: str = Form(...),
    desc_col: str = Form(""),

    amount_mode: str = Form(...),
    balance_col: str = Form(""),
    debit_col: str = Form(""),
    credit_col: str = Form(""),
    credit_sign_mode: str = Form("keep"),

    fund_mode: str = Form(...),
    fund_col: str = Form(""),
    fund_delimiter: str = Form("-"),

    allow_unbalanced: str = Form("off"),
):
    with db_session() as db:
        binder = get_binder_or_404(db, binder_id)
        client = binder.client

        uf = db.get(UploadedFile, upload_id)
        csv_text = uf.content_text if uf else ""

    mapping = ColumnMapping(
        account_col=account_col,
        desc_col=desc_col.strip() if desc_col.strip() else None,
        mode=amount_mode,
        balance_col=balance_col if amount_mode == "signed" else None,
        debit_col=debit_col if amount_mode == "dc" else None,
        credit_col=credit_col if amount_mode == "dc" else None,
        credit_sign_mode=(credit_sign_mode or "keep").strip().lower(),
        fund_mode=fund_mode,
        fund_col=fund_col if fund_mode == "fund_column" else None,
        fund_delimiter=fund_delimiter or "-",
    )

    report = validate_tb(
        csv_text=csv_text,
        has_headers=bool(has_headers),
        header_row=int(header_row),
        delimiter=delimiter,
        mapping=mapping,
    )

    tolerance = Decimal("1.00")
    nets_to_zero = abs(Decimal(str(report["total_net"]))) <= tolerance

    if (not nets_to_zero) and allow_unbalanced != "on":
        return templates.TemplateResponse(
            "validate.html",
            {
                "request": request,
                "client": client,
                "binder": binder,
                "upload_id": upload_id,
                "mapping": mapping,
                "has_headers": bool(has_headers),
                "delimiter": delimiter,
                "header_row": int(header_row),
                "report": report,
                "tolerance": tolerance,
                "nets_to_zero": nets_to_zero,
                "force_unbalanced_warning": True,
            },
        )

    fund_codes = sorted(report["fund_counts"].keys())

    return templates.TemplateResponse(
        "funds.html",
        {
            "request": request,
            "client": client,
            "binder": binder,
            "upload_id": upload_id,
            "has_headers": int(has_headers),
            "delimiter": delimiter,
            "header_row": int(header_row),
            "mapping": mapping,
            "fund_codes": fund_codes,
            "fund_counts": report["fund_counts"],
        },
    )


# ============================================================
# IMPORT COMMIT
# - replaces existing TB import for this binder
# ============================================================
@app.post("/b/{binder_id}/tb/import", response_class=HTMLResponse)
async def tb_import_commit(request: Request, binder_id: int):
    form = dict(await request.form())

    upload_id = int(form["upload_id"])
    has_headers = bool(int(form["has_headers"]))
    delimiter = form["delimiter"]
    header_row = int(form["header_row"])

    account_col = form["account_col"]
    desc_col = (form.get("desc_col") or "").strip()

    amount_mode = form["amount_mode"]
    balance_col = (form.get("balance_col") or "").strip()
    debit_col = (form.get("debit_col") or "").strip()
    credit_col = (form.get("credit_col") or "").strip()
    credit_sign_mode = (form.get("credit_sign_mode") or "keep").strip().lower()

    fund_mode = form["fund_mode"]
    fund_col = (form.get("fund_col") or "").strip()
    fund_delimiter = (form.get("fund_delimiter") or "-").strip()

    mapping = ColumnMapping(
        account_col=account_col,
        desc_col=desc_col if desc_col else None,
        mode=amount_mode,
        balance_col=balance_col if amount_mode == "signed" else None,
        debit_col=debit_col if amount_mode == "dc" else None,
        credit_col=credit_col if amount_mode == "dc" else None,
        credit_sign_mode=credit_sign_mode,
        fund_mode=fund_mode,
        fund_col=fund_col if fund_mode == "fund_column" else None,
        fund_delimiter=fund_delimiter or "-",
    )

    imported_lines = 0

    with db_session() as db:
        binder = get_binder_or_404(db, binder_id)
        client = binder.client

        uf = db.get(UploadedFile, upload_id)
        if not uf:
            return templates.TemplateResponse(
                "complete.html",
                {"request": request, "client": client, "binder": binder, "import_name": "Import failed", "imported_lines": 0},
            )

        uf_filename = uf.filename
        csv_text = uf.content_text

        # Replace existing TB for this binder (delete old import + lines)
        existing_imports = db.scalars(select(TBImport).where(TBImport.binder_id == binder_id)).all()
        for old in existing_imports:
            db.delete(old)
        db.flush()

        tbi = TBImport(
            binder_id=binder_id,
            import_name=f"TB Import - {uf_filename}",
            uploaded_file_id=upload_id,
        )
        db.add(tbi)
        db.flush()

        # Funds cache
        fund_cache: Dict[str, Fund] = {}
        for k, v in form.items():
            if k.startswith("fund_name__"):
                code = k.split("__", 1)[1]
                name = str(v).strip()
                ftype = str(form.get(f"fund_type__{code}", "")).strip()

                existing = db.scalar(select(Fund).where(Fund.fund_code == code))
                if not existing:
                    existing = Fund(fund_code=code, fund_name=name, fund_type=ftype)
                    db.add(existing)
                    db.flush()
                else:
                    existing.fund_name = name
                    existing.fund_type = ftype

                fund_cache[code] = existing

        db.flush()

        acct_cache: Dict[str, Account] = {}

        for rowno, row in iter_csv_rows(csv_text, has_headers, header_row, delimiter):
            acct = (row.get(mapping.account_col, "") or "").strip()
            if mapping.ignore_blank_account and acct == "":
                continue

            if mapping.fund_mode == "fund_from_account_prefix":
                fund_code = derive_fund_from_account(acct, mapping.fund_delimiter)
            elif mapping.fund_mode == "fund_column":
                fund_code = (row.get(mapping.fund_col or "", "") or "").strip()
            else:
                fund_code = "SINGLE"

            if fund_code == "":
                continue

            amt, _warns = normalize_amount(row, mapping)
            if amt is None:
                continue
            if mapping.ignore_zero and amt == 0:
                continue

            desc = ""
            if mapping.desc_col:
                desc = (row.get(mapping.desc_col, "") or "").strip()

            fund = fund_cache.get(fund_code) or db.scalar(select(Fund).where(Fund.fund_code == fund_code))
            if not fund:
                fund = Fund(fund_code=fund_code, fund_name="", fund_type="")
                db.add(fund)
                db.flush()
                fund_cache[fund_code] = fund

            acct_obj = acct_cache.get(acct) or db.scalar(select(Account).where(Account.account_number == acct))
            if not acct_obj:
                acct_obj = Account(account_number=acct, account_name=desc[:255] if desc else "")
                db.add(acct_obj)
                db.flush()
                acct_cache[acct] = acct_obj

            line = TBLine(
                tb_import_id=tbi.id,
                fund_id=fund.id,
                account_id=acct_obj.id,
                description=desc[:255],
                amount=float(amt),
                source_row=rowno,
            )
            db.add(line)
            imported_lines += 1

        db.commit()

    # After import: go to binder home
    return RedirectResponse(f"/b/{binder_id}", status_code=303)
