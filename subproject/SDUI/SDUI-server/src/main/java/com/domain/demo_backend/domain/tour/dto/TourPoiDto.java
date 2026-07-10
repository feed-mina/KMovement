package com.domain.demo_backend.domain.tour.dto;

/**
 * TourAPI(한국관광공사) 지역기반 관광정보를 정규화한 POI DTO.
 * Epic #74 · Dev-2(#76).
 *
 * @param contentId     TourAPI contentid
 * @param contentTypeId 12=관광지, 39=음식점 등
 * @param title         명칭
 * @param addr          주소(addr1)
 * @param mapX          경도(lng)
 * @param mapY          위도(lat)
 * @param firstImage    대표 이미지 URL
 * @param tel           전화
 * @param cat1          대분류
 * @param cat2          중분류
 * @param cat3          소분류
 * @param areaCode      지역 코드
 */
public record TourPoiDto(
        String contentId,
        String contentTypeId,
        String title,
        String addr,
        Double mapX,
        Double mapY,
        String firstImage,
        String tel,
        String cat1,
        String cat2,
        String cat3,
        String areaCode
) {}
