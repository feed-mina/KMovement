-- Rename the image-led K-POP CTA and hide redundant standalone product-search
-- CTAs now that the AI result screen embeds the text search UI.

UPDATE ui_metadata
SET label_text = '사진으로 상품 찾기'
WHERE screen_id = 'KPOP_EXPLORE'
  AND component_id = 'kpop_ai_cta';

UPDATE ui_metadata
SET is_visible = 'false'
WHERE (screen_id = 'KPOP_EXPLORE' AND component_id = 'kpop_products_cta')
   OR (screen_id = 'KPOP_AI_RESULT' AND component_id = 'kpop_result_products_cta');