"""F11 HTTP contracts with actual local graph; no production or paid API calls."""
import os
os.environ['KRIDE_ROUTE_HISTORY_STORE']='disabled'
from unittest.mock import patch
import networkx as nx
from fastapi.testclient import TestClient
from src.api import fastapi_server as server

client=TestClient(server.app,raise_server_exceptions=False)

def fixture_graph():
    g=nx.Graph()
    g.add_edge((37.5,127.0),(37.51,127.0),length_km=1,safety_score=.8,tourism_score=.5)
    g.add_edge((37.51,127.0),(37.52,127.0),length_km=1,safety_score=.8,tourism_score=.5)
    return g

def test_ready_rejects_missing_graph():
    with patch.object(server,'G_main',None):
        assert client.get('/api/health').status_code==200
        assert client.get('/api/ready').status_code==503

def test_route_and_closed_course_http():
    with patch.object(server,'G_main',fixture_graph()):
        r=client.post('/api/route',json={'start_lat':37.5,'start_lon':127,'end_lat':37.52,'end_lon':127})
        assert r.status_code==200,r.text
        assert r.json()['path']==[{'lat':37.5,'lon':127},{'lat':37.51,'lon':127},{'lat':37.52,'lon':127}]
        c=client.post('/api/course',json={'start_lat':37.5,'start_lon':127,'distance_km':4})
        assert c.status_code==200,c.text
        assert c.json()['course'][0]==c.json()['course'][-1]

def test_same_and_outside_coordinates():
    with patch.object(server,'G_main',fixture_graph()):
        for end in [(37.5,127),(35,129),(91,127)]:
            assert client.post('/api/route',json={'start_lat':37.5,'start_lon':127,'end_lat':end[0],'end_lon':end[1]}).status_code==422

def test_weather_provider_failure_is_explicit_fallback():
    with patch.object(server,'HAS_WEATHER',True),patch.object(server,'get_weather_weight',side_effect=RuntimeError('provider'),create=True),patch.dict(os.environ,{'KMA_API_KEY':'fixture'}):
        r=client.get('/api/weather?lat=37.5&lon=127')
        assert r.status_code==200 and r.json()['fallback'] is True
        assert r.json()['reason']=='provider_unavailable'

def test_real_graph_readiness_and_route():
    assert client.get('/api/ready').status_code==200
    u,v=next(iter(server.G_main.edges))
    r=client.post('/api/route',json={'start_lat':u[0],'start_lon':u[1],'end_lat':v[0],'end_lon':v[1]})
    assert r.status_code==200,r.text
    assert r.json()['path'][0]=={'lat':u[0],'lon':u[1]}
    assert r.json()['path'][-1]=={'lat':v[0],'lon':v[1]}
