package com.domain.kride.architecture;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 모듈 경계 규칙 (아키텍처 가이드 개선 ⑥). 새 테스트 의존성 없이 소스를 읽어 import 를 검사한다.
 * <ul>
 *   <li>K-Ride 핵심 도메인은 이전 프로젝트 도메인(면접·공부·리트코드·타이머·작업자 위치)을 import 하지 않는다.</li>
 *   <li>kpop 과 community 는 서로를 직접 import 하지 않는다.</li>
 *   <li>어떤 도메인도 다른 도메인의 controller 패키지를 import 하지 않는다.</li>
 * </ul>
 */
class ModuleBoundaryRulesTest {

    private static final String BASE_PACKAGE = ModuleBoundaryRulesTest.class.getPackageName()
            .replaceAll("\\.architecture$", "");
    private static final Path MAIN = Path.of("src/main/java").resolve(BASE_PACKAGE.replace('.', '/'));
    private static final Pattern DOMAIN_IMPORT = Pattern.compile(
            "^import\\s+" + Pattern.quote(BASE_PACKAGE) + "\\.domain\\.(\\w+)\\.(\\w+)", Pattern.MULTILINE);

    private static final Set<String> LEGACY_DOMAINS = Set.of("interview", "study", "leetcode", "time", "location", "Location");
    private static final Set<String> KRIDE_CORE_DOMAINS = Set.of(
            "kpop", "tour", "community", "kridechat", "celery", "address", "content",
            "ui", "query", "theme", "membership", "user", "token", "notification");

    @Test
    void krideCoreDomainsDoNotDependOnLegacyDomains() throws IOException {
        assertThat(violations((from, to, layer) -> KRIDE_CORE_DOMAINS.contains(from) && LEGACY_DOMAINS.contains(to)))
                .as("K-Ride 기능이 이전 프로젝트 도메인에 기대면 그 도메인을 떼어 낼 수 없다")
                .isEmpty();
    }

    @Test
    void kpopAndCommunityDoNotCallEachOtherDirectly() throws IOException {
        assertThat(violations((from, to, layer) ->
                ("kpop".equals(from) && "community".equals(to)) || ("community".equals(from) && "kpop".equals(to))))
                .as("kpop ↔ community 는 공용 서비스나 이벤트로만 연결한다")
                .isEmpty();
    }

    @Test
    void noDomainImportsAnotherDomainsController() throws IOException {
        assertThat(violations((from, to, layer) -> !from.equals(to) && "controller".equals(layer)))
                .as("다른 도메인의 기능은 service 로 부른다")
                .isEmpty();
    }

    @FunctionalInterface
    private interface Rule {
        boolean broken(String fromDomain, String toDomain, String toLayer);
    }

    private Set<String> violations(Rule rule) throws IOException {
        Set<String> found = new TreeSet<>();
        Path domainRoot = MAIN.resolve("domain");
        try (Stream<Path> files = Files.walk(domainRoot)) {
            List<Path> javaFiles = files.filter(p -> p.toString().endsWith(".java")).toList();
            assertThat(javaFiles).as("domain 소스를 찾지 못하면 규칙이 아무것도 검사하지 않는다").hasSizeGreaterThan(100);
            for (Path file : javaFiles) {
                String from = domainRoot.relativize(file).getName(0).toString();
                String source = Files.readString(file, StandardCharsets.UTF_8);
                Matcher m = DOMAIN_IMPORT.matcher(source);
                while (m.find()) {
                    if (rule.broken(from, m.group(1), m.group(2))) {
                        found.add(MAIN.relativize(file).toString().replace('\\', '/') + " -> " + m.group(1) + "." + m.group(2));
                    }
                }
            }
        }
        return found;
    }
}
