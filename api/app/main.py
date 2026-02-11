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
from sqlalchemy import select, desc
from sqlalchemy.orm import Session

from openpyxl import load_workbook

from .db import engine, SessionLocal
from .models import Base, UploadedFile, Fund, Account, TBImport, TBLine, Entity, Binder
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

Base.metadata.create_all(bind=engine)


def db_session() -> Session:
    return SessionLocal()


def fmt_date(d: Optional[date]) -> str:
    if not d:
        return ""
    try:
        return d.strftime("%m/%d/%Y")
    except Exception:
        return str(d)


def template_ctx(
    request: Request,
    *,
    binder_id: Optional[int] = None,
    entity_name: str = "",
    period_end: str = "",
    binder_label: str = "",
    **kwargs,
):
    # base.html reads these. Always provide safe primitives.
    return {
        "request": request,
        "binder_id": binder_id,
        "entity_name": entity_name,
        "period_end": period_end,
        "binder_label": binder_label,
        **kwargs,
    }


def load_binder_header(db: Session, binder_id: Optional[int]) -> dict:
    if not binder_id:
        return {"binder_id": None, "entity_name": "", "period_end": "", "binder_label": ""}

    b = db.get(Binder, int(binder_id))
    if not b:
        return {"binder_id": None, "entity_name": "", "period_end": "", "binder_label": ""}

    # touch last_accessed
    b.last_accessed_at = datetime.utcnow()
    db.commit()

    # build primitives while session is open
    entity_name = b.entity.entity_name
    period_end = fmt_date(b.period_end)
    binder_label = f"{entity_name} ({period_end})"

    return {
        "binder_id": b.id,
        "entity_name": entity_name,
        "period_end": period_end,
        "binder_label": binder_label,
    }


def xlsx_bytes_to_csv_text(xlsx_bytes: bytes) -> str:
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

    while max_cols > 1 and all((row[max_cols - 1] == "" for row in table)):
        max_cols -= 1
        table = [row[:max_cols] for row in table]

    out = io.StringIO()
    w = csv.writer(out)
    for row in table:
        w.writerow(row)
    return out.getvalue()


@app.get("/health")
def health():
    return {"status": "ok"}


# -----------------------
# HOME (Binder-first)
# -----------------------
@app.get("/", response_class=HTMLResponse)
def home(request: Request, q: str = ""):
    with db_session() as db:
        # Recent binders: most recent last_accessed, fallback created
        recent = db.scalars(
            select(Binder)
            .join(Binder.entity)
            .order_by(desc(Binder.last_accessed_at), desc(Binder.created_at))
            .limit(15)
        ).all()

        # Search binders (simple)
        binders_query = select(Binder).join(Binder.entity).order_by(desc(Binder.created_at))
        if q.strip():
            like = f"%{q.strip()}%"
            binders_query = binders_query.where(
                (Entity.entity_name.ilike(like))
            )
        binders = db.scalars(binders_query.limit(100)).all()

        # Entities for binder creation dropdown
        entities = db.scalars(select(Entity).order_by(Entity.entity_name)).all()

        # Convert to primitives for template safety
        def binder_row(b: Binder):
            return {
                "id": b.id,
                "entity": b.entity.entity_name,
                "period_end": fmt_date(b.period_end),
                "last_accessed": b.last_accessed_at.strftime("%m/%d/%Y %H:%M") if b.last_accessed_at else "",
                "label": f"{b.entity.entity_name} ({fmt_date(b.period_end)})",
            }

        recent_rows = [binder_row(b) for b in recent]
        binder_rows = [binder_row(b) for b in binders]

    return templates.TemplateResponse(
        "home.html",
        template_ctx(
            request,
            binder_id=None,
            entity_name="",
            period_end="",
            binder_label="",
            q=q,
            recent_binders=recent_rows,
            binder_rows=binder_rows,
            entities=[{"id": e.id, "name": e.entity_name} for e in entities],
            message=None,
        ),
    )


@app.post("/entity/create", response_class=HTMLResponse)
def create_entity(
    request: Request,
    entity_name: str = Form(...),
    address: str = Form(""),
    contact_name: str = Form(""),
    contact_email: str = Form(""),
):
    with db_session() as db:
        name = entity_name.strip()
        if not name:
            return RedirectResponse("/", status_code=303)

        exists = db.scalar(select(Entity).where(Entity.entity_name == name))
        if exists:
            return RedirectResponse("/?q=" + name, status_code=303)

        e = Entity(
            entity_name=name,
            address=address.strip() or None,
            contact_name=contact_name.strip() or None,
            contact_email=contact_email.strip() or None,
        )
        db.add(e)
        db.commit()

    return RedirectResponse("/", status_code=303)


@app.post("/binder/create")
def create_binder(
    request: Request,
    entity_id: int = Form(...),
    period_end: str = Form(...),  # yyyy-mm-dd from <input type="date">
):
    try:
        pe = date.fromisoformat(period_end)
    except Exception:
        return RedirectResponse("/", status_code=303)

    with db_session() as db:
        e = db.get(Entity, int(entity_id))
        if not e:
            return RedirectResponse("/", status_code=303)

        # Prevent duplicates: same entity + same period_end
        existing = db.scalar(select(Binder).where(Binder.entity_id == e.id, Binder.period_end == pe))
        if existing:
            return RedirectResponse(f"/binder/open/{existing.id}", status_code=303)

        b = Binder(entity_id=e.id, period_end=pe, created_at=datetime.utcnow(), last_accessed_at=datetime.utcnow())
        db.add(b)
        db.commit()
        db.refresh(b)

        return RedirectResponse(f"/binder/open/{b.id}", status_code=303)


@app.get("/binder/open/{binder_id}")
def open_binder(binder_id: int):
    # Redirect into TB upload wizard within binder context
    return RedirectResponse(f"/tb/upload?binder_id={binder_id}", status_code=303)


@app.get("/binder/{binder_id}/delete", response_class=HTMLResponse)
def binder_delete_confirm(request: Request, binder_id: int):
    with db_session() as db:
        header = load_binder_header(db, binder_id)
        if not header["binder_id"]:
            return RedirectResponse("/", status_code=303)

    phrase = f"Yes I want to delete this binder"
    return templates.TemplateResponse(
        "binder_delete.html",
        template_ctx(
            request,
            **header,
            confirm_phrase=phrase,
            error=None,
        ),
    )


@app.post("/binder/{binder_id}/delete")
def binder_delete_do(
    request: Request,
    binder_id: int,
    confirm_text: str = Form(""),
):
    required = "Yes I want to delete this binder"
    if confirm_text.strip() != required:
        with db_session() as db:
            header = load_binder_header(db, binder_id)
        return templates.TemplateResponse(
            "binder_delete.html",
            template_ctx(
                request,
                **header,
                confirm_phrase=required,
                error="Confirmation text did not match. Binder was NOT deleted.",
            ),
        )

    with db_session() as db:
        b = db.get(Binder, int(binder_id))
        if b:
            db.delete(b)
            db.commit()

    return RedirectResponse("/", status_code=303)


# -----------------------
# TB WIZARD (Binder-aware)
# -----------------------

@app.get("/tb/upload", response_class=HTMLResponse)
def tb_upload_page(request: Request, binder_id: int):
    with db_session() as db:
        header = load_binder_header(db, binder_id)
        if not header["binder_id"]:
            return RedirectResponse("/", status_code=303)

    return templates.TemplateResponse(
        "upload.html",
        template_ctx(
            request,
            **header,
            message=None,
        ),
    )


@app.post("/tb/upload", response_class=HTMLResponse)
async def tb_upload(
    request: Request,
    binder_id: int = Form(...),
    file: UploadFile = Form(...),
):
    raw = await file.read()
    filename = file.filename or "upload.xlsx"
    lower = filename.lower()

    with db_session() as db:
        header = load_binder_header(db, binder_id)
        if not header["binder_id"]:
            return RedirectResponse("/", status_code=303)

    if not lower.endswith(".xlsx"):
        return templates.TemplateResponse(
            "upload.html",
            template_ctx(
                request,
                **header,
                message="Please upload an Excel .xlsx trial balance file.",
            ),
        )

    content = xlsx_bytes_to_csv_text(raw)

    has_headers_bool = True
    delimiter_used = ","
    header_row_used = 1
    content_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

    with db_session() as db:
        uf = UploadedFile(filename=filename, content_type=content_type, content_text=content)
        db.add(uf)
        db.commit()
        db.refresh(uf)
        upload_id = uf.id

    headers, rows = read_csv_preview(
        content,
        has_headers=has_headers_bool,
        header_row=header_row_used,
        delimiter=delimiter_used,
        max_rows=50,
    )

    return templates.TemplateResponse(
        "map.html",
        template_ctx(
            request,
            **header,
            upload_id=upload_id,
            filename=filename,
            headers=headers,
            rows=rows,
            has_headers=True,
            delimiter=",",
            header_row=1,
            message=None,
        ),
    )


@app.post("/tb/validate", response_class=HTMLResponse)
def tb_validate(
    request: Request,
    binder_id: int = Form(...),
    upload_id: int = Form(...),

    has_headers: int = Form(...),
    delimiter: str = Form(...),
    header_row: int = Form(...),

    account_col: str = Form(...),
    desc_col: str = Form(...),

    amount_mode: str = Form(...),
    balance_col: str = Form(""),
    debit_col: str = Form(""),
    credit_col: str = Form(""),
    credit_sign_mode: str = Form("keep"),

    fund_mode: str = Form(...),
    fund_col: str = Form(""),
    fund_delimiter: str = Form("-"),
):
    with db_session() as db:
        header = load_binder_header(db, binder_id)
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
        template_ctx(
            request,
            **header,
            upload_id=upload_id,
            mapping=mapping,
            has_headers=bool(has_headers),
            delimiter=delimiter,
            header_row=int(header_row),
            report=report,
            tolerance=tolerance,
            nets_to_zero=nets_to_zero,
            force_unbalanced_warning=False,
        ),
    )


@app.post("/tb/funds", response_class=HTMLResponse)
def tb_funds(
    request: Request,
    binder_id: int = Form(...),
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
        header = load_binder_header(db, binder_id)
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
            template_ctx(
                request,
                **header,
                upload_id=upload_id,
                mapping=mapping,
                has_headers=bool(has_headers),
                delimiter=delimiter,
                header_row=int(header_row),
                report=report,
                tolerance=tolerance,
                nets_to_zero=nets_to_zero,
                force_unbalanced_warning=True,
            ),
        )

    fund_codes = sorted(report["fund_counts"].keys())

    return templates.TemplateResponse(
        "funds.html",
        template_ctx(
            request,
            **header,
            upload_id=upload_id,
            has_headers=int(has_headers),
            delimiter=delimiter,
            header_row=int(header_row),
            mapping=mapping,
            fund_codes=fund_codes,
            fund_counts=report["fund_counts"],
        ),
    )


@app.post("/tb/import", response_class=HTMLResponse)
async def tb_import_commit(request: Request):
    form = dict(await request.form())

    binder_id = int(form["binder_id"])
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
    uf_filename = "upload.xlsx"

    with db_session() as db:
        header = load_binder_header(db, binder_id)

        uf = db.get(UploadedFile, upload_id)
        if not uf:
            return templates.TemplateResponse(
                "complete.html",
                template_ctx(request, **header, import_name="Import failed", imported_lines=0),
            )

        uf_filename = uf.filename
        csv_text = uf.content_text

        tbi = TBImport(
            import_name=f"TB Import - {uf_filename}",
            uploaded_file_id=upload_id,
            binder_id=binder_id,
        )
        db.add(tbi)
        db.commit()
        db.refresh(tbi)

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

    return templates.TemplateResponse(
        "complete.html",
        template_ctx(
            request,
            **header,
            import_name=f"TB Import - {uf_filename}",
            imported_lines=imported_lines,
        ),
    )
