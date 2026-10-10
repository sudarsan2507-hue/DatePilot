import asyncio
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from app.db import create_db_and_tables
from app.llm import text_model, warm_up
from app.routers import sessions, taste, plan, memory_router, live_data, quick

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    warm = asyncio.create_task(warm_up())
    yield
    warm.cancel()


app = FastAPI(
    title="DatePilot — AI Date Optimizer for India",
    version="0.1.0",
    lifespan=lifespan,
)

origins = os.getenv("CORS_ORIGINS", "*").split(",")
allow_all_origins = "*" in origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if allow_all_origins else origins,
    # Phones on the same home/office network (http://<laptop-ip>:5173) during local testing.
    allow_origin_regex=None if allow_all_origins else r"^http://(10(\.\d+){3}|192\.168(\.\d+){2}|172\.(1[6-9]|2\d|3[01])(\.\d+){2}):\d+$",
    allow_credentials=not allow_all_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sessions.router)
app.include_router(taste.router)
app.include_router(plan.router)
app.include_router(memory_router.router)
app.include_router(live_data.router)
app.include_router(quick.router)


@app.get("/config")
def config():
    """What the frontend may offer. No secrets here."""
    from app.routers.taste import uploads_enabled
    return {"text_model": text_model(), "uploads": uploads_enabled()}


@app.get("/health")
def health():
    return {"status": "ok", "app": "DatePilot", "version": "0.1.0"}
