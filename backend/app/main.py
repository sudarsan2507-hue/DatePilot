import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from app.db import create_db_and_tables
from app.routers import sessions, taste, plan, memory_router

load_dotenv()

app = FastAPI(title="DatePilot — AI Date Optimizer for Chennai", version="0.1.0")

origins = os.getenv("CORS_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if "*" in origins else origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sessions.router)
app.include_router(taste.router)
app.include_router(plan.router)
app.include_router(memory_router.router)


@app.on_event("startup")
def on_startup():
    create_db_and_tables()


@app.get("/health")
def health():
    return {"status": "ok", "app": "DatePilot", "version": "0.1.0"}
