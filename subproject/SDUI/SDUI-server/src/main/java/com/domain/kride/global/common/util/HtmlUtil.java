package com.domain.kride.global.common.util;

import org.springframework.web.util.UriComponentsBuilder;

public class HtmlUtil {
    // URL에 파라미터를 안전하게 추가하는 역할
    public static String addParams(String url, String key, String value) {
        return UriComponentsBuilder.fromUriString(url).queryParam(key, value).build().toUriString();
    }

    // XSS(Cross Site Scripting, 교차 사이트 스크립팅) 공격을 방어하기 위해 특수문자를 치환함
    public static String xssFilter(String str) {
        if (str != null) {
            str = str.replaceAll("<", "&lt;");
            str = str.replaceAll(">", "&gt;");
            str = str.replaceAll("'", "&apos;");
            str = str.replaceAll("\"", "&quot;");
            str = str.replaceAll("script", "");
            str = str.replaceAll("src", "");
            str = str.replaceAll("style", "");
        }
        return str;
    }
}