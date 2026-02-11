from __future__ import annotations
import os
from decimal import Decimal
from fastapi import FastAPI, Request, UploadFile, Form
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy import select
from sqlalchemy.orm import Session

from .db import engine, SessionLocal
from .models import Base, UploadedFile, Fund, Account, TBImport, TBLine
from .tb_import import read_csv_preview, ColumnMapping, validate_tb

app = FastAPI()
templates = Jinja2Templates(directory=os.path.join(os.path.dirname(__file__), "templates"))

# MVP: create tables on startup (later: Alembic migrations)
Base.metadata.create_all(bind=engine)

def db_session() -> Session:
    return SessionLocal()

@app.get("/", response_class=HTMLResponse)
def home(request: Request):
    return templates.TemplateResponse("upload.html", {"request": request, "message": None})

@app.get("/health")
def health():
    return {"status": "ok"}

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
        uf = UploadedFile(filename=file.filename, content_type=file.content_type or "text/csv", content_text=content)
        db.add(uf)
        db.commit()
        db.refresh(uf)

    headers, rows = read_csv_preview(content, has_headers=(has_headers == "on"), header_row=header_row, delimiter=delimiter, max_rows=50)

    return templates.TemplateResponse("map.html", {
        "request": request,
        "upload_id": uf.id,
        "filename": file.filename,
        "headers": headers,
        "rows": rows,
        "has_headers": (has_headers == "on"),
        "delimiter": delimiter,
        "header_row": header_row,
        "message": None,
    })

@app.post("/tb/validate", response_class=HTMLResponse)
def tb_validate(
    request: Request,
    upload_id: int = Form(...),
    has_headers: int = Form(...),
    delimiter: str = Form(...),
    header_row: int = Form(...),

    account_col: str = Form(...),
    desc_col: str = Form(""),
    amount_mode: str = Form(...),  # signed | dc
    balance_col: str = Form(""),
    debit_col: str = Form(""),
    credit_col: str = Form(""),

    fund_mode: str = Form(...),  # fund_from_account_prefix | fund_column | single_fund
    fund_col: str = Form(""),
    fund_delimiter: str = Form("-"),
):
    with db_session() as db:
        csv_text = db.get(UploadedFile, upload_id).content_text

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

    # Net-to-zero warning logic
    tolerance = Decimal("1.00")
    nets_to_zero = abs(report["total_net"]) <= tolerance

    # Pass mapping forward in hidden fields
    return templates.TemplateResponse("validate.html", {
        "request": request,
        "upload_id": upload_id,
        "mapping": mapping,
        "has_headers": bool(has_headers),
        "delimiter": delimiter,
        "header_row": int(header_row),
        "report": report,
        "tolerance": tolerance,
        "nets_to_zero": nets_to_zero,
    })

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
    # Re-run validation to get fund list (fast enough for MVP)
    with db_session() as db:
        csv_text = db.get(UploadedFile, upload_id).content_text

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

    report = validate_tb(csv_text, bool(has_headers), int(header_row), delimiter, mapping)
    tolerance = Decimal("1.00")
    nets_to_zero = abs(report["total_net"]) <= tolerance

    if (not nets_to_zero) and allow_unbalanced != "on":
        # bounce back to validation screen with warning
        return RedirectResponse(url="/", status_code=303)

    fund_codes = sorted(report["fund_counts"].keys())
    return templates.TemplateResponse("funds.html", {
        "request": request,
        "upload_id": upload_id,
        "has_headers": int(has_headers),
        "delimiter": delimiter,
        "header_row": int(header_row),
        "mapping": mapping,
        "fund_codes": fund_codes,
        "fund_counts": report["fund_counts"],
    })

@app.post("/tb/import", response_class=HTMLResponse)
def tb_import_commit(request: Request):
    form = dict(request.form())  # type: ignore

    upload_id = int(form["upload_id"])
    has_headers = bool(int(form["has_headers"]))
    delimiter = form["delimiter"]
    header_row = int(form["header_row"])

    # mapping
    account_col = form["account_col"]
    desc_col = form.get("desc_col") or ""
    amount_mode = form["amount_mode"]
    balance_col = form.get("balance_col") or ""
    debit_col = form.get("debit_col") or ""
    credit_col = form.get("credit_col") or ""
    fund_mode = form["fund_mode"]
    fund_col = form.get("fund_col") or ""
    fund_delimiter = form.get("fund_delimiter") or "-"

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

    # fund dictionary selections
    # fields like fund_type__10, fund_name__10
    with db_session() as db:
        uf = db.get(UploadedFile, upload_id)
        csv_text = uf.content_text

        # Create TBImport
        tbi = TBImport(import_name=f"TB Import - {uf.filename}", uploaded_file_id=upload_id)
        db.add(tbi)
        db.commit()
        db.refresh(tbi)

        # Build fund and account caches
        fund_cache = {}
        acct_cache = {}

        # Create funds from form selections
        for k, v in form.items():
            if k.startswith("fund_name__"):
                code = k.split("__", 1)[1]
                name = v
                ftype = form.get(f"fund_type__{code}", "")
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

        # Parse and import rows
        from .tb_import import iter_csv_rows, derive_fund_from_account, normalize_amount

        imported_lines = 0
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

            # Fund record must exist (should, from funds screen); create if missing
            fund = fund_cache.get(fund_code) or db.scalar(select(Fund).where(Fund.fund_code == fund_code))
            if not fund:
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

    return templates.TemplateResponse("complete.html", {
        "request": request,
        "import_name": f"TB Import - {uf.filename}",
        "imported_lines": imported_lines,
    })
