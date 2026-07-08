-- V70: 검색형 분석 안내 문구를 provider-neutral하게 정리
-- - GitHub 미지원처럼 보이는 "Google/Kakao" 한정 표현 제거
-- - 체크박스 라벨에서 "자료/회의록이 없어도" 문구 제거

UPDATE ui_metadata
SET label_text = trim(
    regexp_replace(
        replace(label_text, 'Google/Kakao 로그인에서는', '소셜 로그인에서는'),
        '자료/회의록이 없어도[[:space:]]*',
        '',
        'g'
    )
)
WHERE label_text LIKE '%Google/Kakao 로그인에서는%'
   OR label_text LIKE '%자료/회의록이 없어도%';
