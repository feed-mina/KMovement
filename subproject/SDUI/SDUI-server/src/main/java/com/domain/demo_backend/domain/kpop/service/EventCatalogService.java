package com.domain.demo_backend.domain.kpop.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Map;

/** Public event reads. Dates are inclusive calendar days in Korea, not event end instants. */
@Service
public class EventCatalogService {
    public static final ZoneId ZONE = ZoneId.of("Asia/Seoul");
    private final NamedParameterJdbcTemplate jdbc;
    private final Clock clock;
    @Autowired
    public EventCatalogService(NamedParameterJdbcTemplate jdbc) { this(jdbc, Clock.systemUTC()); }
    public EventCatalogService(NamedParameterJdbcTemplate jdbc, Clock clock) { this.jdbc = jdbc; this.clock = clock; }
    public LocalDate today() { return LocalDate.now(clock.withZone(ZONE)); }

    private static final String COLUMNS = """
            e.event_id AS id, e.artist_id AS "artistId", a.name_ko AS "artistNameKo",
            e.title_ko AS "titleKo", e.title_en AS "titleEn", e.region, e.venue,
            CAST(e.event_date AS text) AS date, e.official_url AS "officialUrl", e.description,
            (e.event_date < CAST(:today AS date)) AS ended
            """;
    public List<Map<String, Object>> events(String region, String from, String to, Long userSqno, LocalDate today) {
        String area = region == null || region.isBlank() ? null : region.trim();
        if (area != null && area.length() > 100) throw bad("지역은 100자 이내로 입력해 주세요.");
        LocalDate start = date(from), end = date(to);
        if (start == null) start = today;
        if (end != null && end.isBefore(start)) throw bad(
                from == null || from.isBlank() ? "종료일이 한국 시간 오늘보다 이전입니다. 과거 일정은 시작일도 입력해 주세요."
                        : "종료일은 시작일보다 빠를 수 없습니다.");
        return jdbc.queryForList("SELECT " + COLUMNS + """
                , (af.artist_id IS NOT NULL) AS followed
                FROM event e JOIN artist a ON a.artist_id = e.artist_id
                LEFT JOIN artist_follow af ON af.artist_id = e.artist_id AND af.user_sqno = CAST(:userSqno AS bigint)
                WHERE e.approved_yn = 'Y' AND a.approved_yn = 'Y'
                  AND (CAST(:region AS text) IS NULL OR e.region = :region)
                  AND e.event_date >= CAST(:fromDate AS date)
                  AND (CAST(:toDate AS date) IS NULL OR e.event_date <= CAST(:toDate AS date))
                ORDER BY (af.artist_id IS NOT NULL) DESC, e.event_date ASC, e.event_id ASC
                """, new MapSqlParameterSource().addValue("region", area).addValue("fromDate", start.toString())
                .addValue("toDate", end == null ? null : end.toString()).addValue("userSqno", userSqno)
                .addValue("today", today.toString()));
    }
    public Map<String, Object> event(Long id, LocalDate today) {
        List<Map<String, Object>> rows = jdbc.queryForList("SELECT " + COLUMNS + """
                FROM event e JOIN artist a ON a.artist_id = e.artist_id
                WHERE e.event_id = :id AND e.approved_yn = 'Y' AND a.approved_yn = 'Y'
                """, new MapSqlParameterSource("id", id).addValue("today", today.toString()));
        if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "공개된 이벤트를 찾을 수 없습니다.");
        return rows.get(0);
    }
    private LocalDate date(String value) {
        if (value == null || value.isBlank()) return null;
        String clean = value.trim();
        try {
            if (!clean.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}")) throw bad("날짜는 YYYY-MM-DD 형식으로 입력해 주세요.");
            LocalDate date = LocalDate.parse(clean);
            if (date.getYear() < 1) throw bad("유효한 날짜를 입력해 주세요.");
            return date;
        } catch (DateTimeParseException ex) { throw bad("유효한 날짜를 입력해 주세요."); }
    }
    private ResponseStatusException bad(String message) { return new ResponseStatusException(HttpStatus.BAD_REQUEST, message); }
}
