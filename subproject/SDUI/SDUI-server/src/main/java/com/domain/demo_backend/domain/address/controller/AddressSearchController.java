package com.domain.demo_backend.domain.address.controller;

import com.domain.demo_backend.domain.address.service.AddressSearchService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/address")
@Tag(name = "주소 검색 컨트롤러", description = "회원가입 주소 입력용 도로명 주소 검색 (카카오 로컬 API 프록시)")
public class AddressSearchController {

    private final Logger log = LoggerFactory.getLogger(AddressSearchController.class);
    private final AddressSearchService addressSearchService;

    public AddressSearchController(AddressSearchService addressSearchService) {
        this.addressSearchService = addressSearchService;
    }

    @Operation(summary = "도로명 주소 검색", description = "키워드로 도로명 주소를 검색해 우편번호와 함께 반환한다.")
    @GetMapping("/search")
    public ResponseEntity<Map<String, Object>> search(@RequestParam String keyword) {
        try {
            List<Map<String, String>> items = addressSearchService.search(keyword);
            return ResponseEntity.ok(Map.of("items", items));
        } catch (Exception e) {
            log.error("주소 검색 실패 - keyword={}", keyword, e);
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                    .body(Map.of("items", List.of(), "message", "주소 검색에 실패했습니다."));
        }
    }
}
