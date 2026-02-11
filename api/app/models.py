# api/app/models.py

from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import (
    String,
    Integer,
    DateTime,
    Text,
    ForeignKey,
    Numeric,
    func,
)


class Base(DeclarativeBase):
    pass


class UploadedFile(Base):
    __tablename__ = "uploaded_file"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[str] = mapped_column(String(100), default="text/csv")
    content_text: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now()
    )


class Fund(Base):
    __tablename__ = "fund"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    fund_code: Mapped[str] = mapped_column(String(50), index=True, nullable=False)
    fund_name: Mapped[str] = mapped_column(String(255), default="")
    fund_type: Mapped[str] = mapped_column(
        String(50), default=""
    )  # governmental / proprietary / fiduciary / component_unit
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now()
    )


class Account(Base):
    __tablename__ = "account"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    account_number: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    account_name: Mapped[str] = mapped_column(String(255), default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now()
    )


class TBImport(Base):
    __tablename__ = "tb_import"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    import_name: Mapped[str] = mapped_column(String(255), default="TB Import")
    uploaded_file_id: Mapped[int] = mapped_column(
        ForeignKey("uploaded_file.id"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now()
    )


class TBLine(Base):
    __tablename__ = "tb_line"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tb_import_id: Mapped[int] = mapped_column(
        ForeignKey("tb_import.id"), index=True, nullable=False
    )
    fund_id: Mapped[int] = mapped_column(
        ForeignKey("fund.id"), index=True, nullable=False
    )
    account_id: Mapped[int] = mapped_column(
        ForeignKey("account.id"), index=True, nullable=False
    )

    description: Mapped[str] = mapped_column(String(255), default="")
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    source_row: Mapped[int] = mapped_column(Integer, nullable=False)
