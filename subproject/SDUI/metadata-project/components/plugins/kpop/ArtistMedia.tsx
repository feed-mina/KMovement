'use client';
import {useState} from 'react';
import photos from './artistPhotos.json';

export type ArtistPhoto = {src:string;alt:string;sourceUrl:string;credit:string;license:string;licenseUrl:string;caption:string};
export function reviewedPhoto(id:unknown):ArtistPhoto|undefined {
    return (photos as Record<string,ArtistPhoto>)[String(id)];
}
function Photo({photo, name, eager}:{photo?:ArtistPhoto;name:string;eager:boolean}) {
    const [failed,setFailed]=useState(false);
    return <figure className="artist-photo">
        <div className="artist-photo-frame">
            {photo&&!failed ? <img src={photo.src} alt={`${name} · 공개 자료 사진`} loading={eager?'eager':'lazy'} onError={()=>setFailed(true)}/>
                : <div className="artist-photo-placeholder"><span aria-hidden="true">♫</span><p>{name}</p><small>사진을 준비하고 있어요</small></div>}
        </div>
        {photo&&!failed&&<details className="artist-photo-credit"><summary>사진 출처</summary><p>{photo.caption}</p><p>{photo.credit}</p><a href={photo.sourceUrl} target="_blank" rel="noreferrer">원본 보기</a> · <a href={photo.licenseUrl} target="_blank" rel="noreferrer">{photo.license}</a></details>}
    </figure>;
}
export default function ArtistMedia({id,name,eager=false}:{id:unknown;name:string;eager?:boolean}) {
    const photo=reviewedPhoto(id);
    return <Photo key={String(id)+':'+(photo?.src||'')} photo={photo} name={name} eager={eager}/>;
}
