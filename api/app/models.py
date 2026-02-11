from __future__ import annotations

from datetime import date, datetime
from typing import List, Optional

from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Client(Base):
    __tablename__ = "clients"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    client_name: Mapped[str] = mapped_column(String(255), unique=True, index=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    binders: Mapped[List["Binder"]] = relationship(
        back_populates="client",
        cascade="all, delete-orphan",
    )


class Binder(Base):
    __tablename__ = "binders"
    __table_args__ = (
        UniqueConstraint("client_id", "period_end", name="uq_binder_client_period"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id"), index=True)
    period_end: Mapped[date] = mapped_column(Date, index=True)  # year-end / period end date
    fiscal_year: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    client: Mapped["Client"] = relationship(back_populates="binders")

    uploaded_files: Mapped[List["UploadedFile"]] = relationship(
        back_populates="binder",
        cascade="all, delete-orphan",
    )

    tb_imports: Mapped[List["TBImport"]] = relationship(
        back_populates="binder",
        cascade="all, delete-orphan",
    )


class UploadedFile(Base):
    __tablename__ = "uploaded_files"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    binder_id: Mapped[int] = mapped_column(ForeignKey("binders.id"), index=True)

    filename: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str] = mapped_column(String(255))
    content_text: Mapped[str] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    binder: Mapped["Binder"] = relationship(back_populates="uploaded_files")
    tb_imports: Mapped[List["TBImport"]] = relationship(back_populates="uploaded_file")


class Fund(Base):
    __tablename__ = "funds"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    fund_code: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    fund_name: Mapped[str] = mapped_column(String(255), default="")
    fund_type: Mapped[str] = mapped_column(String(50), default="")

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    account_number: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    account_name: Mapped[str] = mapped_column(String(255), default="")

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class TBImport(Base):
    __tablename__ = "tb_imports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    binder_id: Mapped[int] = mapped_column(ForeignKey("binders.id"), index=True)
    uploaded_file_id: Mapped[int] = mapped_column(ForeignKey("uploaded_files.id"), index=True)

    import_name: Mapped[str] = mapped_column(String(255))

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    binder: Mapped["Binder"] = relationship(back_populates="tb_imports")
    uploaded_file: Mapped["UploadedFile"] = relationship(back_populates="tb_imports")

    lines: Mapped[List["TBLine"]] = relationship(
        back_populates="tb_import",
        cascade="all, delete-orphan",
    )


class TBLine(Base):
    __tablename__ = "tb_lines"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    tb_import_id: Mapped[int] = mapped_column(ForeignKey("tb_imports.id"), index=True)
    fund_id: Mapped[int] = mapped_column(ForeignKey("funds.id"), index=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"), index=True)

    description: Mapped[str] = mapped_column(String(255), default="")
    amount: Mapped[float] = mapped_column(Float)

    source_row: Mapped[int] = mapped_column(Integer)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    tb_import: Mapped["TBImport"] = relationship(back_populates="lines")
