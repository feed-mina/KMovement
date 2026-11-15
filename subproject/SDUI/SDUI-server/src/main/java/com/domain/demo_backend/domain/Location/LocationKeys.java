package com.domain.demo_backend.domain.Location;

/** 작업자 위치 기능이 Redis에서 함께 쓰는 키. 쓰는 쪽(LocationService)과 읽는 쪽(LocationScheduler)이 같은 값을 보게 한다. */
public final class LocationKeys {

    /** 모든 작업자의 현재 좌표(Redis GEO). */
    public static final String GEO_KEY = "worker:locations";
    /** 작업자별 상태·갱신 시각(Redis Hash) 키 접두사. */
    public static final String INFO_PREFIX = "worker:info:";

    private LocationKeys() {
    }
}
