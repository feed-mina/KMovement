package com.domain.demo_backend.domain.kpop.repository;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * SQL for the public artist list/detail and follow/bookmark removal.
 * Moved out of KpopController so controllers no longer touch the database directly.
 */
@Repository
public class KpopArtistRepository {

    private final NamedParameterJdbcTemplate jdbcTemplate;

    public KpopArtistRepository(NamedParameterJdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<Map<String, Object>> findApprovedArtists(Object q) {
        return jdbcTemplate.queryForList("""
                SELECT artist_id AS id, slug, name_ko AS "nameKo", name_en AS "nameEn",
                       profile, image_url AS "imageUrl", official_url AS "officialUrl",
                       instagram_url AS "instagramUrl", youtube_url AS "youtubeUrl", x_url AS "xUrl"
                FROM artist
                WHERE approved_yn = 'Y'
                  AND (CAST(:q AS text) IS NULL
                       OR name_ko ILIKE CONCAT('%', :q, '%')
                       OR name_en ILIKE CONCAT('%', :q, '%'))
                ORDER BY sort_order ASC, name_ko ASC
                """, params("q", q));
    }

    /** artist_id를 파라미터로 캐스팅하면 slug 요청("aespa")이 bigint 변환에 실패하므로 컬럼을 text로 캐스팅한다. */
    public Optional<Map<String, Object>> findApprovedArtistByRef(String artistRef) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT artist_id AS id, slug, name_ko AS "nameKo", name_en AS "nameEn",
                       profile, image_url AS "imageUrl", official_url AS "officialUrl",
                       instagram_url AS "instagramUrl", youtube_url AS "youtubeUrl", x_url AS "xUrl"
                FROM artist
                WHERE approved_yn = 'Y'
                  AND (LOWER(slug) = LOWER(:artistRef) OR CAST(artist_id AS text) = :artistRef)
                """, params("artistRef", artistRef));
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.get(0));
    }

    /** 지난 일정도 함께 내려보내되, 다가오는 일정을 앞으로 끌어올린다(V119 타임라인 적재). */
    public List<Map<String, Object>> findApprovedEventsByArtist(Long artistId) {
        return jdbcTemplate.queryForList("""
                SELECT event_id AS id, artist_id AS "artistId", title_ko AS "titleKo", title_en AS "titleEn",
                       region, venue, event_date AS date, official_url AS "officialUrl"
                FROM event
                WHERE artist_id = :artistId AND approved_yn = 'Y'
                ORDER BY (event_date >= CURRENT_DATE) DESC, event_date ASC
                """, params("artistId", artistId));
    }

    public void deleteArtistFollow(Long userSqno, Long artistId) {
        jdbcTemplate.update("DELETE FROM artist_follow WHERE user_sqno = :userSqno AND artist_id = :id",
                params("userSqno", userSqno).addValue("id", artistId));
    }

    public void deleteEventBookmark(Long userSqno, Long eventId) {
        jdbcTemplate.update("DELETE FROM event_bookmark WHERE user_sqno = :userSqno AND event_id = :id",
                params("userSqno", userSqno).addValue("id", eventId));
    }

    private MapSqlParameterSource params(String name, Object value) {
        return new MapSqlParameterSource().addValue(name, value);
    }
}
