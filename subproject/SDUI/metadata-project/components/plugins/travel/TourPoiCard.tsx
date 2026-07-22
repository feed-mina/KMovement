'use client';

import type {TourPoi} from '@/services/tourApi';
import PoiImage from '@/components/plugins/travel/PoiImage';

interface TourPoiCardProps {
    poi: TourPoi;
    isSaved: boolean;
    onOpen: (poi: TourPoi, trigger: HTMLElement) => void;
    onToggleSave: (contentId?: string) => void;
}

const RED = '#E50914';

export default function TourPoiCard({poi, isSaved, onOpen, onToggleSave}: TourPoiCardProps) {
    const recommendReason = poi.recommendReason?.trim();

    return (
        <article style={{border: '0.5px solid #eee', borderRadius: 14, overflow: 'hidden', background: '#fff', position: 'relative'}}>
            <button
                type="button"
                aria-haspopup="dialog"
                aria-label={`${poi.title} 상세 보기`}
                onClick={(event) => onOpen(poi, event.currentTarget)}
                style={{display: 'block', width: '100%', padding: 0, border: 'none', background: 'transparent', color: 'inherit', textAlign: 'left', cursor: 'pointer'}}
            >
                <span style={{height: 100, background: '#f5f5f5', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                    <PoiImage src={poi.firstImage} title={poi.title} variant="card"/>
                    {poi.contentTypeId === 'HOLY' && (
                        <span style={{position: 'absolute', top: 6, left: 6, fontSize: 10, background: RED, color: '#fff', padding: '2px 7px', borderRadius: 20}}>성지</span>
                    )}
                </span>
                <span style={{display: 'block', padding: '8px 10px'}}>
                    <span style={{display: 'block', margin: 0, fontSize: 13, fontWeight: 500}}>{poi.title}</span>
                    {poi.addr && (
                        <span style={{display: 'block', margin: '3px 0 0', fontSize: 11, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                            {poi.addr}
                        </span>
                    )}
                    {recommendReason && (
                        <span
                            data-testid="tour-poi-recommend-reason"
                            title={recommendReason}
                            style={{
                                display: '-webkit-box',
                                marginTop: 6,
                                overflow: 'hidden',
                                color: '#791F1F',
                                fontSize: 11,
                                lineHeight: 1.45,
                                overflowWrap: 'anywhere',
                                WebkitBoxOrient: 'vertical',
                                WebkitLineClamp: 2,
                            }}
                        >
                            {recommendReason}
                        </span>
                    )}
                </span>
            </button>
            <button
                type="button"
                aria-label={isSaved ? `${poi.title} 저장 취소` : `${poi.title} 저장`}
                onClick={() => onToggleSave(poi.contentId)}
                style={{position: 'absolute', top: 6, right: 6, width: 28, height: 28, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.35)', color: isSaved ? RED : '#fff', cursor: 'pointer', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center'}}
            >
                {isSaved ? '♥' : '♡'}
            </button>
        </article>
    );
}
