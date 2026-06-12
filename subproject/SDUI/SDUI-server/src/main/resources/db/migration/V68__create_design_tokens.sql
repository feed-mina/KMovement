-- ==========================================
-- V68: design_tokens 테이블 생성 + K-RIDE 기본 테마 시드
-- GitHub issue #4 · Phase 3 — DB 기반 테마(디자인 토큰) 시스템
-- token_key는 프론트 CSS 변수 --kride-{token_key}에 1:1 매핑된다
-- (예: token_key='primary' → --kride-primary)
-- ==========================================

CREATE TABLE design_tokens (
    token_id    BIGSERIAL PRIMARY KEY,
    theme_id    VARCHAR(50)  NOT NULL DEFAULT 'KRIDE_DEFAULT',
    category    VARCHAR(30)  NOT NULL,  -- color | spacing | radius | shadow | size
    token_key   VARCHAR(100) NOT NULL,
    token_value VARCHAR(300) NOT NULL,
    created_at  TIMESTAMP    DEFAULT now(),
    updated_at  TIMESTAMP    DEFAULT now(),
    CONSTRAINT uq_design_tokens_theme_key UNIQUE (theme_id, token_key)
);

-- K-RIDE 기본 테마 (metadata-project/app/styles/tokens.css와 동일 값)
INSERT INTO design_tokens (theme_id, category, token_key, token_value) VALUES
-- 브랜드 색상
('KRIDE_DEFAULT', 'color', 'primary',            '#E50914'),
('KRIDE_DEFAULT', 'color', 'primary-dark',       '#8B0610'),
('KRIDE_DEFAULT', 'color', 'primary-soft',       'rgba(229, 9, 20, 0.08)'),
('KRIDE_DEFAULT', 'color', 'gradient-primary',   'linear-gradient(135deg, #8B0610 0%, #E50914 100%)'),
-- 배경
('KRIDE_DEFAULT', 'color', 'bg-dark',            '#0A0A0A'),
('KRIDE_DEFAULT', 'color', 'bg-dark-2',          '#1C1C1C'),
('KRIDE_DEFAULT', 'color', 'bg-cream',           '#FDFBF7'),
('KRIDE_DEFAULT', 'color', 'bg-cream-2',         '#EAE5D9'),
('KRIDE_DEFAULT', 'color', 'bg-card',            '#FFFFFF'),
-- 텍스트
('KRIDE_DEFAULT', 'color', 'text-strong',        '#111111'),
('KRIDE_DEFAULT', 'color', 'text-main',          '#374151'),
('KRIDE_DEFAULT', 'color', 'text-sub',           '#6B7280'),
('KRIDE_DEFAULT', 'color', 'text-invert',        '#FFFFFF'),
-- 보더 / 상태
('KRIDE_DEFAULT', 'color', 'border',             '#E5E7EB'),
('KRIDE_DEFAULT', 'color', 'focus-ring',         'rgba(229, 9, 20, 0.18)'),
('KRIDE_DEFAULT', 'color', 'kakao',              '#FEE500'),
('KRIDE_DEFAULT', 'color', 'kakao-text',         '#191919'),
-- 간격
('KRIDE_DEFAULT', 'spacing', 'space-1',          '4px'),
('KRIDE_DEFAULT', 'spacing', 'space-2',          '8px'),
('KRIDE_DEFAULT', 'spacing', 'space-3',          '12px'),
('KRIDE_DEFAULT', 'spacing', 'space-4',          '16px'),
('KRIDE_DEFAULT', 'spacing', 'space-5',          '20px'),
('KRIDE_DEFAULT', 'spacing', 'space-6',          '24px'),
('KRIDE_DEFAULT', 'spacing', 'space-8',          '32px'),
-- 라운드
('KRIDE_DEFAULT', 'radius', 'radius-sm',         '8px'),
('KRIDE_DEFAULT', 'radius', 'radius-md',         '12px'),
('KRIDE_DEFAULT', 'radius', 'radius-lg',         '16px'),
('KRIDE_DEFAULT', 'radius', 'radius-xl',         '20px'),
('KRIDE_DEFAULT', 'radius', 'radius-pill',       '999px'),
-- 그림자
('KRIDE_DEFAULT', 'shadow', 'shadow-card',       '0 1px 4px rgba(0, 0, 0, 0.06)'),
('KRIDE_DEFAULT', 'shadow', 'shadow-float',      '0 10px 30px rgba(0, 0, 0, 0.08)'),
('KRIDE_DEFAULT', 'shadow', 'shadow-lift',       '0 10px 28px rgba(15, 23, 42, 0.12)'),
-- 모바일 / 터치 (safe-bottom은 env() 함수라 CSS 폴백 전용 — DB로 관리하지 않음)
('KRIDE_DEFAULT', 'size', 'touch-target',        '48px');
