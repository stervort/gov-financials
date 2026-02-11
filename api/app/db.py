import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

def get_database_url() -> str:
    # Render provides DATABASE_URL for Postgres
    url = os.getenv("DATABASE_URL")
    if url:
        # Some providers use postgres:// which SQLAlchemy may warn about; psycopg handles it fine.
        return url
    # Fallback for local testing (not required if you're online-only)
    return "sqlite:///./dev.db"

DATABASE_URL = get_database_url()

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
