package com.domain.kride.global.security;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.util.Map;

public class SsoHelper {

    public static void rememberMeSubmit(HttpServletRequest request, HttpServletResponse response, Cookie c) {
        try {
            if (c != null) {
                String dec = JwtUtil.decryptAesByBase64(c.getValue());
                String[] r = dec.split("\\|");
                if (r.length > 0 && "SSO_REMEMBER_ME_SITE".equals(r[0])) ;
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

    }


    // 자동로그인 관련 유틸
    private static String generateSsoLoginHtml(Map<String, String> map) {
        StringBuilder sb = new StringBuilder();

        // HTML 문서 시작
        sb.append("<html xmlns=\"http://www.w3.org/1999/xhtml\">");
        sb.append("<head><meta http-equiv=\"Content-Type\" content=\"text/html; charset=utf-8\"></head>");
        sb.append("<body onload=\"document.forms[0].submit()\">"); // 페이지 로드 시 자동 제출

        // javaScript 미지원 시 메시지 표시
        sb.append("<noscript>");
        sb.append("<p><strong>Note:</strong> Since your browser does not support JavaScript, you must press the Continue button once to proceed.</p>");
        sb.append("</noscript>");

        // 로그인 폼 생성
        sb.append("<form action=\"");
        sb.append(map.get("authUrl"));
        sb.append("\" method=\"post\">");
        sb.append("<div>");

        // map에 담긴 데이터를 <input hidden> 태그로 추가
        for (Map.Entry<String, String> entry : map.entrySet()) {
            sb.append("<input type=\"hidden\" name=\"");
            sb.append(entry.getKey());
            sb.append("\" value=\"");
            sb.append(entry.getValue());
            sb.append("\" />");
        }

        // 보안 관련 데이터 추가 (암호화된 값)
        sb.append("<input type=\"hidden\" name=\"c\" value=\"");
        sb.append(JwtUtil.encryptAesByBase64("secureToken"));
        sb.append("\" />");

        // 폼 마무리
        sb.append("</div>");
        sb.append("</form>");
        sb.append("</body></html>");

        return sb.toString();
    }

}
