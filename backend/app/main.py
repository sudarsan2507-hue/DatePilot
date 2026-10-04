import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from app.db import create_db_and_tables
from app.routers import sessions, taste, plan, memory_router, live_data

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    yield


app = FastAPI(
    title="DatePilot — AI Date Optimizer for Tamil Nadu",
    version="0.1.0",
    lifespan=lifespan,
)

origins = os.getenv("CORS_ORIGINS", "*").split(",")
allow_all_origins = "*" in origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if allow_all_origins else origins,
    allow_credentials=not allow_all_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sessions.router)
app.include_router(taste.router)
app.include_router(plan.router)
app.include_router(memory_router.router)
app.include_router(live_data.router)


@app.get("/health")
def health():
    return {"status": "ok", "app": "DatePilot", "version": "0.1.0"}
