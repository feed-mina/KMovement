'use client';
import { useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
export type RoadPoint = {lat:number;lon:number};
function Bounds({points}:{points:RoadPoint[]}) {
 const map=useMap();
 useEffect(()=>{if(points.length>1)map.fitBounds(points.map(p=>[p.lat,p.lon]),{padding:[20,20],maxZoom:16});},[map,points]);
 return null;
}
export default function RoadRouteMap({points,pois=[]}:{points:RoadPoint[];pois?:{lat:number;lon:number;title:string}[]}) {
 if(!points.length)return null;
 return <MapContainer center={[points[0].lat,points[0].lon]} zoom={13} style={{height:400,width:'100%'}}>
  <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
  {pois.map((p,i)=><CircleMarker key={i} center={[p.lat,p.lon]} radius={5} pathOptions={{color:"#2563eb"}}><Popup>{p.title}</Popup></CircleMarker>)}
  <Bounds points={points}/><Polyline positions={points.map(p=>[p.lat,p.lon])} color="#dc2626"/>
  {[points[0],points[points.length-1]].map((p,i)=><CircleMarker key={i} center={[p.lat,p.lon]} radius={7}/>)}
 </MapContainer>;
}
