
'use client';
import {useSearchParams} from 'next/navigation';
export function artistReturnPath(value:string|null):string|null {
    if(!value||!/^\/view\/KPOP_ARTIST_DETAIL\/[A-Za-z0-9_%.-]+(?:\?[^#]*)?$/.test(value))return null;
    return value;
}
export default function ArtistReturn(){
    const path=artistReturnPath(useSearchParams().get('returnArtist'));
    return path?<p><a href={path}>아티스트로 돌아가기</a></p>:null;
}
