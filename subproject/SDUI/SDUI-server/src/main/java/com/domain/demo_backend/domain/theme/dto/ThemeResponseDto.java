package com.domain.demo_backend.domain.theme.dto;

import com.domain.demo_backend.domain.theme.domain.DesignToken;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.List;

// 테마 조회 응답: 토큰 목록 (프론트 ThemeProvider가 --kride-{key}로 주입)
@Getter
@NoArgsConstructor
@AllArgsConstructor
public class ThemeResponseDto {
    private String themeId;
    private List<TokenDto> tokens;

    @Getter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TokenDto {
        private String category;
        private String key;
        private String value;

        public static TokenDto from(DesignToken entity) {
            return new TokenDto(entity.getCategory(), entity.getTokenKey(), entity.getTokenValue());
        }
    }
}
