'use client';

import {motion} from 'framer-motion';
import {useCardTilt, useKrideReducedMotion} from '@/components/motion/KrideMotion';
import type {TourPoi} from '@/services/tourApi';
import PoiImage from '@/components/plugins/travel/PoiImage';

interface TourPoiCardProps {
    poi: TourPoi;
    isSaved: boolean;
    /** 첫 화면에 보이는 카드. lazy 를 끄고 우선순위를 올린다. */
    priority?: boolean;
    onOpen: (poi: TourPoi, trigger: HTMLElement) => void;
    onToggleSave: (contentId?: string) => void;
    selected?: boolean;
    /** 모바일: 지도 보기로 전환하며 이 장소를 고른다. */
    onMapSelect?: () => void;
    /** 데스크톱: 카드에 마우스를 올리거나 포커스하면 지도 핀을 강조한다 (벤치마킹 H4: 카드 = 핀). */
    onHighlight?: () => void;
    /** 성지가 아닐 때 보여줄 카테고리 라벨 (맛집 · 관광지 · 문화시설). */
    categoryLabel?: string;
    cardId?: string;
    entranceIndex?: number;
}

/** "서울 종로구 창경궁로 88" → "서울 종로구". 카드에는 동네까지만, 전체 주소는 title 로. */
export function shortAddress(addr?: string): string {
    if (!addr) return '';
    return addr.trim().split(/\s+/).slice(0, 2).join(' ');
}

export default function TourPoiCard({poi, isSaved, priority = false, onOpen, onToggleSave, selected, onMapSelect, onHighlight, categoryLabel, cardId, entranceIndex = 0}: TourPoiCardProps) {
    const tilt = useCardTilt();
    const reduced = useKrideReducedMotion();
    const recommendReason = poi.recommendReason?.trim();
    const isHoly = poi.contentTypeId === 'HOLY';

    return (
        <motion.article
            {...tilt}
            layout="position"
            initial={reduced ? false : {opacity: 0, y: 8}}
            animate={{opacity: 1, y: 0}}
            transition={{duration: 0.22, delay: entranceIndex < 6 ? entranceIndex * 0.04 : 0, layout: {duration: 0.2}}}
            whileHover={reduced ? undefined : {y: -3}}
            id={cardId}
            tabIndex={-1}
            data-selected={Boolean(selected)}
            className="tour-poi-card"
            onMouseEnter={onHighlight}
            onFocus={onHighlight}
        >
            <button
                type="button"
                className="tour-poi-card__open"
                aria-haspopup="dialog"
                aria-label={`${poi.title} 상세 보기`}
                onClick={(event) => onOpen(poi, event.currentTarget)}
            >
                <span className="tour-poi-card__media">
                    <PoiImage src={poi.firstImage} thumbnail={poi.thumbnail} title={poi.title} variant="card" priority={priority}/>
                    {isHoly && <span className="tour-poi-card__tag tour-poi-card__tag--holy">성지</span>}
                    {!isHoly && categoryLabel && <span className="tour-poi-card__tag">{categoryLabel}</span>}
                </span>
                <span className="tour-poi-card__body">
                    <span className="tour-poi-card__title">{poi.title}</span>
                    {poi.addr && <span className="tour-poi-card__addr" title={poi.addr}>{shortAddress(poi.addr)}</span>}
                    {recommendReason && (
                        <span
                            data-testid="tour-poi-recommend-reason"
                            title={recommendReason}
                            style={{
                                display: '-webkit-box',
                                marginTop: 6,
                                overflow: 'hidden',
                                color: 'var(--semantic-accent-strong, #8B0610)',
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
            {onMapSelect
                ? <button className="tour-poi-card__map" type="button" aria-pressed={Boolean(selected)} aria-label={`${poi.title} 지도에서 선택`} onClick={onMapSelect}>지도</button>
                : cardId ? <span className="tour-card-coordinate-note">좌표 없음 · 주소로 확인</span> : null}
            <motion.button
                initial={false}
                whileTap={reduced ? undefined : {scale: 0.88}}
                animate={{scale: isSaved && !reduced ? [1, 1.15, 1] : 1}}
                transition={{duration: 0.18}}
                type="button"
                className="tour-poi-card__save"
                aria-label={isSaved ? `${poi.title} 저장 취소` : `${poi.title} 저장`}
                aria-pressed={isSaved}
                onClick={() => onToggleSave(poi.contentId)}
            >
                {isSaved ? '♥' : '♡'}
            </motion.button>
        </motion.article>
    );
}
