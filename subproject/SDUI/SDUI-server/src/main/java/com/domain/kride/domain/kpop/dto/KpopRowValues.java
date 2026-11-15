package com.domain.kride.domain.kpop.dto;

import java.time.LocalDate;
import java.util.Map;

/** JDBC 행(Map)에서 DTO 값을 꺼내는 작은 도우미. */
final class KpopRowValues {

    private KpopRowValues() {
    }

    static Long longValue(Map<String, Object> row, String key) {
        Object value = row.get(key);
        if (value == null) return null;
        if (value instanceof Number number) return number.longValue();
        return Long.valueOf(value.toString());
    }

    static String text(Map<String, Object> row, String key) {
        Object value = row.get(key);
        return value == null ? null : value.toString();
    }

    static LocalDate date(Map<String, Object> row, String key) {
        Object value = row.get(key);
        if (value == null) return null;
        if (value instanceof LocalDate localDate) return localDate;
        if (value instanceof java.sql.Date sqlDate) return sqlDate.toLocalDate();
        return LocalDate.parse(value.toString().substring(0, 10));
    }
}
