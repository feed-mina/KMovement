"""Hostinger entrypoint: F11 and authenticated F12/F13 service endpoints."""
import os
import asyncio
from contextlib import asynccontextmanager

# This public-read service never stores caller-supplied route-history identities.
os.environ['KRIDE_ROUTE_HISTORY_STORE'] = 'disabled'

from fastapi import FastAPI
from src.api.fastapi_server import app as source
from src.api.public_itinerary import router
from src.api.public_chat import router as chat_router

ALLOWED={'/api/health','/api/ready','/api/route','/api/course','/api/facilities','/api/pois','/api/weather','/api/public/itinerary'}
@asynccontextmanager
async def lifespan(app):
    if os.environ.get('KRIDE_PRELOAD_EMBEDDER')=='true':
        from src.api.torchserve_client import embed_texts_sync
        # Readiness follows the real CPU model load; requests do not race two loads.
        await asyncio.to_thread(embed_texts_sync,['query: 서울 문화'])
    yield

app=FastAPI(title='KMovement CPU route, itinerary and chat',lifespan=lifespan,docs_url=None,redoc_url=None,openapi_url=None)
app.router.routes.extend(route for route in source.routes if getattr(route,'path',None) in ALLOWED)
if not any(getattr(route,'path',None)=='/api/public/itinerary' for route in app.routes):
    app.include_router(router)
app.include_router(chat_router)
