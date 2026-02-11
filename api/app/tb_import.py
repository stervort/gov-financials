@app.post("/tb/import", response_class=HTMLResponse)
async def tb_import_commit(request: Request):
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
    uf_filename = "upload.xlsx"  # fallback

    with db_session() as db:
        uf = db.get(UploadedFile, upload_id)
        if not uf:
            return templates.TemplateResponse(
                "complete.html",
                {"request": request, "import_name": "Import failed", "imported_lines": 0},
            )

        # IMPORTANT: capture filename while session is open
        uf_filename = uf.filename

        csv_text = uf.content_text

        tbi = TBImport(import_name=f"TB Import - {uf_filename}", uploaded_file_id=upload_id)
        db.add(tbi)
        db.commit()
        db.refresh(tbi)

        # Funds
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

        # Accounts + Lines
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

    # session is closed here, but we use uf_filename (string), not uf.filename
    return templates.TemplateResponse(
        "complete.html",
        {"request": request, "import_name": f"TB Import - {uf_filename}", "imported_lines": imported_lines},
    )
