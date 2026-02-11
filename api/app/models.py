from __future__ import annotations

from datetime import datetime, date
from typing import Optional

from sqlalchemy import (
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    Float,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


# -----------------------
# NEW: Entity + Binder
# -----------------------
class Entity(Base):
    __tablename__ = "entities"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    entity_name: Mapped[str] = mapped_column(String(255), unique=True, index=True)

    # Optional fields (future-proof)
    address: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    contact_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    contact_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    binders: Mapped[list[Binder]] = relationship(
        back_populates="entity",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class Binder(Base):
    __tablename__ = "binders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    entity_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("entities.id", ondelete="CASCADE"),
        index=True,
    )

    period_end: Mapped[date] = mapped_column(Date, index=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_accessed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    entity: Mapped[Entity] = relationship(back_populates="binders")

    tb_imports: Mapped[list[TBImport]] = relationship(
        back_populates="binder",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    @property
    def label(self) -> str:
        # Stored in UI as: Entity (MM/DD/YYYY)
        try:
            pe = self.period_end.strftime("%m/%d/%Y")
        except Exception:
            pe = str(self.period_end)
        return f"{self.entity.entity_name} ({pe})"


# -----------------------
# Existing tables (kept)
# -----------------------
class UploadedFile(Base):
    __tablename__ = "uploaded_files"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    filename: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str] = mapped_column(String(255))
    content_text: Mapped[str] = mapped_column(Text)


class Fund(Base):
    __tablename__ = "funds"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    fund_code: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    fund_name: Mapped[str] = mapped_column(String(255), default="")
    fund_type: Mapped[str] = mapped_column(String(50), default="")


class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    account_number: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    account_name: Mapped[str] = mapped_column(String(255), default="")


class TBImport(Base):
    __tablename__ = "tb_imports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    import_name: Mapped[str] = mapped_column(String(255))

    uploaded_file_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("uploaded_files.id"), nullable=True
    )

    # NEW: bind TB imports to a binder
    binder_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("binders.id", ondelete="CASCADE"), nullable=True, index=True
    )

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    binder: Mapped[Optional[Binder]] = relationship(back_populates="tb_imports")


class TBLine(Base):
    __tablename__ = "tb_lines"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    tb_import_id: Mapped[int] = mapped_column(Integer, ForeignKey("tb_imports.id", ondelete="CASCADE"), index=True)
    fund_id: Mapped[int] = mapped_column(Integer, ForeignKey("funds.id"), index=True)
    account_id: Mapped[int] = mapped_column(Integer, ForeignKey("accounts.id"), index=True)

    description: Mapped[str] = mapped_column(String(255), default="")
    amount: Mapped[float] = mapped_column(Float)

    source_row: Mapped[int] = mapped_column(Integer)
