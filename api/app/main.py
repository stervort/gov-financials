# api/app/main.py

from __future__ import annotations

import os
from decimal import Decimal
from typing import Optional

from fastapi import FastAPI, Request, UploadFile, Form
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy import select
from sqlalchemy.orm import Session

from .db import engine, SessionLocal
from .models import Base, UploadedFile, Fund, Account, TBImport, TBLine
from .tb_import import (
    read_csv_preview,
    ColumnMapping,
    validate_tb,
    iter_csv_rows,
    derive_fund_from_account,
    normalize_amount,
)

app = FastAPI()
templates = Jinja2Templates(directory=os.path.join(os.path.dirname(__file__), "templates"))

# MVP: create tables on startup (later: Alembic migrations)
Base.metadata.create_all(bind=engine)


def db_session() -> Session:
    return SessionLocal()


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/", response_class=HTMLResponse)
def upload_page(request: Request):
    return templates.TemplateResponse(
        "upload.html",
        {"request": request, "message": None},
    )


# -----------------------
# Step 1: Upload & Preview
# -----------------------
@app.post("/tb/upload", response_class=HTMLResponse)
async def tb_upload(
    request: Request,
    file: UploadFile,
    has_headers: str = Form("on"),
    delimiter: str = Form(","),
    header_row: int = Form(1),
):
    content = (await file.read()).decode("utf-8", errors="replace")

    with db_session() as db:
        uf = UploadedFile(
            filename=file.filename,
            content_type=file.content_type or "text/csv",
            content_text=content,
        )
        db.add(uf)
        db.commit()
        db.refresh(uf)

    headers, rows = read_csv_preview(
        content,
        has_headers=(has_headers == "on"),
        header_row=header_row,
        delimiter=delimiter,
        max_rows=50,
    )

    return templates.TemplateResponse(
        "map.html",
        {
            "request": request,
            "upload_id": uf.id,
            "filename": file.filename,
            "headers": headers,
            "rows": rows,
            "has_headers": (has_headers == "on"),
            "delimiter": delimiter,
            "header_row": header_row,
            "message": None,
        },
    )


# -----------------------
# Step 2: Validate Mapping
# -----------------------
@app.post("/tb/validate", response_class=HTMLResponse)
def tb_validate(
    request: Request,
    upload_id: int = Form(...),
    has_headers: int = Form(...),
    delimiter: str = Form(...),
    header_row: int = Form(...),
    account_col: str = Form(...),
    desc_col: str = Form(""),
    amount_mode: str = Form(...),  # "signed" | "dc"
    balance_col: str = Form(""),
    debit_col: str = Form(""),
    credit_col: str = Form(""),
    fund_mode: str = Form(...),  # "fund_from_account_prefix" | "fund_column" | "single_fund"
    fund_col: str = Form(""),
    fund_delimiter: str = Form("-"),
):
    with db_session() as db:
        uf = db.get(UploadedFile, upload_id)
        csv_text = uf.content_text if uf else ""

    mapping = ColumnMapping(
        account_col=account_col,
        desc_col=desc_col if desc_col.strip() else None,
        mode=amount_mode,
        balance_col=balance_col if amount_mode == "signed" else None,
        debit_col=debit_col if amount_mode == "dc" else None,
        credit_col=credit_col if amount_mode == "dc" else None,
        fund_mode=fund_mode,
        fund_col=fund_col if fund_mode == "fund_column" else None,
        fund_delimiter=fund_delimiter,
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
            "upload_id": upload_id,
            "mapping": mapping,
            "has_headers": bool(has_headers),
            "delimiter": delimiter,
            "header_row": int(header_row),
            "report": report,
            "tolerance": tolerance,
            "nets_to_zero": nets_to_zero,
        },
    )


# ----------------------------------------
# Step 3: Funds Dictionary (Confirm Funds)
# ----------------------------------------
@app.post("/tb/funds", response_class=HTMLResponse)
def tb_funds(
    request: Request,
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
    fund_mode: str = Form(...),
    fund_col: str = Form(""),
    fund_delimiter: str = Form("-"),
    allow_unbalanced: str = Form("off"),
):
    with db_session() as db:
        uf = db.get(UploadedFile, upload_id)
        csv_text = uf.content_text if uf else ""

    mapping = ColumnMapping(
        account_col=account_col,
        desc_col=desc_col if desc_col.strip() else None,
        mode=amount_mode,
        balance_col=balance_col if amount_mode == "signed" else None,
        debit_col=debit_col if amount_mode == "dc" else None,
        credit_col=credit_col if amount_mode == "dc" else None,
        fund_mode=fund_mode,
        fund_col=fund_col if fund_mode == "fund_column" else None,
        fund_delimiter=fund_delimiter,
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

    # If unbalanced, require explicit override
    if (not nets_to_zero) and allow_unbalanced != "on":
        # Re-render validate screen with a stronger message
        return templates.TemplateResponse(
            "validate.html",
            {
                "request": request,
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
            "upload_id": upload_id,
            "has_headers": int(has_headers),
            "delimiter": delimiter,
            "header_row": int(header_row),
            "mapping": mapping,
            "fund_codes": fund_codes,
            "fund_counts": report["fund_counts"],
        },
    )


# -----------------------
# Step 4: Commit TB Import
# -----------------------
@app.post("/tb/import", response_class=HTMLResponse)
async def tb_import_commit(request: Request):
    form = await request.form()
    form = dict(form)

    upload_id = int(form["upload_id"])
    has_headers = bool(int(form["has_headers"]))
    delimiter = form["delimiter"]
    header_row = int(form["header_row"])

    # Mapping selections
    account_col = form["account_col"]
    desc_col = (form.get("desc_col") or "").strip()
    amount_mode = form["amount_mode"]
    balance_col = (form.get("balance_col") or "").strip()
    debit_col = (form.get("debit_col") or "").strip()
    credit_col = (form.get("credit_col") or "").strip()
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
        fund_mode=fund_mode,
        fund_col=fund_col if fund_mode == "fund_column" else None,
        fund_delimiter=fund_delimiter,
    )

    with db_session() as db:
        uf = db.get(UploadedFile, upload_id)
        if not uf:
            return templates.TemplateResponse(
                "complete.html",
                {"request": request, "import_name": "Import failed", "imported_lines": 0},
            )

        csv_text = uf.content_text

        # Create TBImport record
        tbi = TBImport(import_name=f"TB Import - {uf.filename}", uploaded_file_id=upload_id)
        db.add(tbi)
        db.commit()
        db.refresh(tbi)

        # Create/update funds from fund dictionary form inputs
        fund_cache: dict[str, Fund] = {}
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

        # Account cache
        acct_cache: dict[str, Account] = {}

        imported_lines = 0
        for rowno, row in iter_csv_rows(csv_text, has_headers, header_row, delimiter):
            acct = (row.get(mapping.account_col, "") or "").strip()
            if mapping.ignore_blank_account and acct == "":
                continue

            # Determine fund code
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

            # Description
            desc = ""
            if mapping.desc_col:
                desc = (row.get(mapping.desc_col, "") or "").strip()

            # Fund record
            fund = fund_cache.get(fund_code) or db.scalar(select(Fund).where(Fund.fund_code == fund_code))
            if not fund:
                # fallback (should be rare if funds screen was completed)
                fund = Fund(fund_code=fund_code, fund_name="", fund_type="")
                db.add(fund)
                db.flush()
                fund_cache[fund_code] = fund

            # Account record
            acct_obj = acct_cache.get(acct) or db.scalar(select(Account).where(Account.account_number == acct))
            if not acct_obj:
                acct_obj = Account(account_number=acct, account_name=desc[:255] if desc else "")
                db.add(acct_obj)
                db.flush()
                acct_cache[acct] = acct_obj

            # Create TB line
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

    return templates.TemplateResponse(
        "complete.html",
        {
            "request": request,
            "import_name": f"TB Import - {uf.filename}",
            "imported_lines": imported_lines,
        },
    )
