@app.post("/tb/upload", response_class=HTMLResponse)
async def tb_upload(
    request: Request,
    file: UploadFile,
):
    raw = await file.read()
    filename = file.filename or "upload.xlsx"
    lower = filename.lower()

    # XLSX-only
    if not lower.endswith(".xlsx"):
        return templates.TemplateResponse(
            "upload.html",
            {
                "request": request,
                "message": "Please upload an Excel .xlsx trial balance file.",
            },
        )

    # Convert FIRST sheet to CSV-text and reuse existing pipeline
    content = xlsx_bytes_to_csv_text(raw)

    # For MVP: Excel assumptions (we can add sheet/header-row selection later)
    has_headers_bool = True
    delimiter_used = ","
    header_row_used = 1
    content_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

    with db_session() as db:
        uf = UploadedFile(
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
            "upload_id": uf.id,
            "filename": filename,
            "headers": headers,
            "rows": rows,
            # Carry-forward values are now fixed (no UI controls)
            "has_headers": has_headers_bool,
            "delimiter": delimiter_used,
            "header_row": header_row_used,
            "message": None,
        },
    )
