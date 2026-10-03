import os
from sqlmodel import SQLModel, create_engine

DB_PATH = os.getenv("DB_PATH", "datepilot.db")
DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})


def create_db_and_tables():
    SQLModel.metadata.create_all(engine)
