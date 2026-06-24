import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from database import init_db
from routers.push import router as push_router
from routers.catalog import router as catalog_router

_STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(title="Prolifics AI Catalog", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(push_router)
app.include_router(catalog_router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}


# Serve the React SPA from api/static/ (populated by Docker build).
# Must be registered AFTER all API routes so /api/* routes take priority.
if os.path.isdir(_STATIC_DIR):
    app.mount("/", StaticFiles(directory=_STATIC_DIR, html=True), name="spa")
