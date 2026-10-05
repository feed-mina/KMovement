"""Hostinger entrypoint: only F11 and the authenticated F12 service endpoint."""
import os

# This public-read service never stores caller-supplied route-history identities.
os.environ['KRIDE_ROUTE_HISTORY_STORE'] = 'disabled'

from fastapi import FastAPI
from src.api.fastapi_server import app as source
from src.api.public_itinerary import router

ALLOWED={'/api/health','/api/ready','/api/route','/api/course','/api/facilities','/api/pois','/api/weather','/api/public/itinerary'}
app=FastAPI(title='KMovement CPU route and public itinerary',docs_url=None,redoc_url=None,openapi_url=None)
app.router.routes.extend(route for route in source.routes if getattr(route,'path',None) in ALLOWED)
if not any(getattr(route,'path',None)=='/api/public/itinerary' for route in app.routes):
    app.include_router(router)
