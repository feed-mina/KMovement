package com.domain.kride.global.common.util;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public class QueryValidator {

    // 한 줄 정의: 필수 파라미터 존재 여부와 비어있는지 체크하는 도구
    // 왜 필요한지: 컨트롤러마다 if문을 쓰지 않고, 공통된 규칙으로 검증하기 위해
    public static List<String> validateParams(String required, Map<String, Object> params) {
        List<String> missingFields = new ArrayList<>();

        // 1. 필수 파라미터 설정이 없으면 검증 통과
        if (required == null || required.trim().isEmpty()) {
            return missingFields;
        }

        // 2. 콤마로 구분된 필수 항목들을 하나씩 확인
        String[] requiredKeys = required.split(",");

        for (String key : requiredKeys) {
            String targetKey = key.trim();

            // params에 키가 없거나, 값이 null이거나, 문자열인데 비어있는 경우
            if (!params.containsKey(targetKey) || params.get(targetKey) == null ||
                    (params.get(targetKey) instanceof String && ((String) params.get(targetKey)).trim().isEmpty())) {
                missingFields.add(targetKey);
            }
        }

        return missingFields;
    }
}