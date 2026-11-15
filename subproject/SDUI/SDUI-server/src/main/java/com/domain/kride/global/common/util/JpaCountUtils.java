package com.domain.kride.global.common.util;

import org.hibernate.stat.Statistics;

// 핵심 로직 위주로 작성하되, 공통 검증 메서드를 활용할 것
public class JpaCountUtils {
    public static void assertQueryCount(Statistics stats, long expectedCount) {
        long actualCount = stats.getPrepareStatementCount();
        if (actualCount != expectedCount) {
            throw new AssertionError(
                    String.format("\n[N+1 발생 경고] 기대한 쿼리 수: %d, 실제 실행된 쿼리 수: %d",expectedCount, actualCount)
            );
        }
    }
}
