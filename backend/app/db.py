import os
from sqlalchemy import inspect, text
from sqlmodel import SQLModel, create_engine

DB_PATH = os.getenv("DB_PATH", "datepilot.db")
DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})


def create_db_and_tables():
    SQLModel.metadata.create_all(engine)
    # create_all does not add columns to an existing SQLite table. Keep older
    # hackathon sessions readable while adding Tamil Nadu city selection.
    if "sessions" in inspect(engine).get_table_names():
        columns = {column["name"] for column in inspect(engine).get_columns("sessions")}
        added = {
            "city": "VARCHAR NOT NULL DEFAULT 'Chennai'",
            # Sessions made before solo planning were all partner sessions.
            "mode": "VARCHAR NOT NULL DEFAULT 'together'",
        }
        with engine.begin() as connection:
            for name, definition in added.items():
                if name not in columns:
                    connection.execute(text(f"ALTER TABLE sessions ADD COLUMN {name} {definition}"))
