package com.domain.demo_backend.domain.tour.service;

import java.util.HashSet;
import java.util.Set;

/**
 * 성지 POI 와 TourAPI POI 가 같은 장소인지 이름으로 판정한다.
 *
 * <p>성지 시드(V90)는 자체 content_id 를 쓰므로 TourAPI ID 로 이어 붙일 수 없다.
 * 좌표 반경 검색으로 후보를 좁힌 뒤 이름으로 최종 확인하는데, 이때 기준을 느슨하게 잡으면
 * 옆 건물 사진이 붙는다. <b>잘못된 사진은 사진이 없는 것보다 나쁘므로</b> 보수적으로 판정한다.</p>
 */
public final class PoiTitleMatcher {

    /** 이 값 미만이면 같은 장소로 보지 않는다. */
    static final double MIN_SIMILARITY = 0.6d;

    /** 한쪽이 다른 쪽을 포함할 때의 점수. 완전 일치(1.0)보다 낮게 둔다. */
    static final double CONTAINMENT_SCORE = 0.9d;

    private PoiTitleMatcher() {}

    /**
     * 비교용 정규화 — 공백·괄호·구두점과 지점 표기를 지운다.
     * '셀렉토커피 남양주호평점' 과 '셀렉토커피남양주호평' 이 같게 취급되도록.
     */
    static String normalize(String value) {
        if (value == null) return "";
        String stripped = value.replaceAll("[\\s()\\[\\]{}·,.&'\"-]", "");
        return stripped.toLowerCase();
    }

    /** 문자 바이그램 집합. 한 글자 이름은 그 글자 자체를 원소로 둔다. */
    static Set<String> bigrams(String normalized) {
        Set<String> out = new HashSet<>();
        if (normalized.isEmpty()) return out;
        if (normalized.length() == 1) {
            out.add(normalized);
            return out;
        }
        for (int i = 0; i < normalized.length() - 1; i += 1) {
            out.add(normalized.substring(i, i + 2));
        }
        return out;
    }

    /**
     * 0.0 ~ 1.0. 한쪽이 다른 쪽을 통째로 포함하면 1.0,
     * 그 외에는 바이그램 자카드 유사도를 쓴다.
     */
    public static double similarity(String left, String right) {
        String a = normalize(left);
        String b = normalize(right);
        if (a.isEmpty() || b.isEmpty()) return 0d;
        if (a.equals(b)) return 1d;
        // 지점명이 붙어 길어지는 경우가 많아 포함 관계를 동일 장소로 본다.
        // 다만 '카페' 같은 두 글자가 아무 이름에나 들어가는 것을 막으려 최소 길이를 둔다.
        // 완전 일치보다는 낮게 매겨, 후보가 여럿일 때 정확히 같은 이름이 이기도록 한다.
        if (a.length() >= 3 && b.length() >= 3 && (a.contains(b) || b.contains(a))) return CONTAINMENT_SCORE;

        Set<String> aGrams = bigrams(a);
        Set<String> bGrams = bigrams(b);
        Set<String> intersection = new HashSet<>(aGrams);
        intersection.retainAll(bGrams);
        Set<String> union = new HashSet<>(aGrams);
        union.addAll(bGrams);
        if (union.isEmpty()) return 0d;
        return (double) intersection.size() / union.size();
    }

    /** 같은 장소로 보고 사진을 옮겨도 되는지. */
    public static boolean isSamePlace(String left, String right) {
        return similarity(left, right) >= MIN_SIMILARITY;
    }
}
