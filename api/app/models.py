# api/app/models.py
from __future__ import annotations

from datetime import datetime, date
from typing import Optional, List

from sqlalchemy import (
    String,
    Integer,
    Float,
    Date,
    DateTime,
    ForeignKey,
    Text,
    Index,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


# ============================================================
# Entity / Binder
# ============================================================
class Client(Base):
    __tablename__ = "clients"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # "Entity" name (you can rename label in UI; DB can stay Client)
    client_name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)

    # Optional details
    address: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    contact_name: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    contact_email: Mapped[str] = mapped_column(String(255), nullable=False, default="")

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    binders: Mapped[List["Binder"]] = relationship(
        back_populates="client",
        cascade="all, delete-orphan",
    )


class Binder(Base):
    __tablename__ = "binders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)

    # Period end date for the binder (ex: 12/31/2025)
    period_end: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    # Display label (ex: "Springfield (12/31/2025)")
    binder_name: Mapped[str] = mapped_column(String(255), nullable=False, default="")

    last_accessed: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    client: Mapped["Client"] = relationship(back_populates="binders")

    uploads: Mapped[List["UploadedFile"]] = relationship(
        back_populates="binder",
        cascade="all, delete-orphan",
    )

    tb_imports: Mapped[List["TBImport"]] = relationship(
        back_populates="binder",
        cascade="all, delete-orphan",
    )


# ============================================================
# Upload storage (wizard uses content_text)
# ============================================================
class UploadedFile(Base):
    __tablename__ = "uploaded_files"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    binder_id: Mapped[Optional[int]] = mapped_column(ForeignKey("binders.id", ondelete="CASCADE"), nullable=True)

    filename: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    content_type: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    content_text: Mapped[str] = mapped_column(Text, nullable=False, default="")

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    binder: Mapped[Optional["Binder"]] = relationship(back_populates="uploads")


# ============================================================
# Shared dimension tables (cross-binder)
# ============================================================
class Fund(Base):
    __tablename__ = "funds"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    fund_code: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    fund_name: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    fund_type: Mapped[str] = mapped_column(String(50), nullable=False, default="")

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    lines: Mapped[List["TBLine"]] = relationship(back_populates="fund")


class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    account_number: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    account_name: Mapped[str] = mapped_column(String(255), nullable=False, default="")

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    lines: Mapped[List["TBLine"]] = relationship(back_populates="account")


# ============================================================
# Trial balance imports (binder-scoped)
# ============================================================
class TBImport(Base):
    __tablename__ = "tb_imports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    binder_id: Mapped[int] = mapped_column(ForeignKey("binders.id", ondelete="CASCADE"), nullable=False)
    uploaded_file_id: Mapped[Optional[int]] = mapped_column(ForeignKey("uploaded_files.id", ondelete="SET NULL"), nullable=True)

    import_name: Mapped[str] = mapped_column(String(255), nullable=False, default="")

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    binder: Mapped["Binder"] = relationship(back_populates="tb_imports")
    lines: Mapped[List["TBLine"]] = relationship(
        back_populates="tb_import",
        cascade="all, delete-orphan",
    )


class TBLine(Base):
    __tablename__ = "tb_lines"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    tb_import_id: Mapped[int] = mapped_column(ForeignKey("tb_imports.id", ondelete="CASCADE"), nullable=False)
    binder_id: Mapped[int] = mapped_column(ForeignKey("binders.id", ondelete="CASCADE"), nullable=False)

    fund_id: Mapped[int] = mapped_column(ForeignKey("funds.id", ondelete="RESTRICT"), nullable=False)
    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id", ondelete="RESTRICT"), nullable=False)

    description: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    amount: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)

    source_row: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    tb_import: Mapped["TBImport"] = relationship(back_populates="lines")
    fund: Mapped["Fund"] = relationship(back_populates="lines")
    account: Mapped["Account"] = relationship(back_populates="lines")


# Helpful indexes for speed
Index("ix_binders_client_id", Binder.client_id)
Index("ix_tb_imports_binder_id", TBImport.binder_id)
Index("ix_tb_lines_binder_id", TBLine.binder_id)
Index("ix_tb_lines_import_id", TBLine.tb_import_id)
Index("ix_uploaded_files_binder_id", UploadedFile.binder_id)
