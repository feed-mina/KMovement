package com.domain.kride.architecture;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Data access rules (architecture guide, improvement step 3 and 6):
 * <ul>
 *   <li>Entity-level save/read uses JPA repositories.</li>
 *   <li>Multi-table queries and query_master execution use JdbcTemplate, only inside repository classes.</li>
 *   <li>Controllers never touch SQL. MyBatis is not used.</li>
 * </ul>
 * Plain source scan so no extra test dependency is needed.
 */
class DataAccessRulesTest {

    private static final Path MAIN = Path.of("src/main/java/com/domain/kride");

    /**
     * Services that still run SQL directly. Shrink this list as their SQL moves into repository classes;
     * never add to it.
     */
    private static final Set<String> LEGACY_SERVICE_SQL = Set.of(
            "domain/admin/service/B2bPilotService.java",
            "domain/admin/service/GoalDashboardService.java",
            "domain/kpop/service/ArtistCatalogService.java",
            "domain/kpop/service/EventCatalogService.java",
            "domain/kpop/service/FanEventFeedService.java",
            "domain/kpop/service/KpopProductService.java",
            "domain/kpop/service/PersonalSavedService.java",
            "domain/kpop/service/PublicProductCatalogService.java",
            "domain/time/service/GoalTimeQueryService.java",
            "global/common/util/LocationScheduler.java"
    );

    @Test
    void controllersDoNotUseJdbcDirectly() throws IOException {
        assertThat(filesMatching(path -> path.contains("/controller/"), this::usesJdbc))
                .as("Controllers must call a service; SQL belongs in a repository class")
                .isEmpty();
    }

    @Test
    void jdbcTemplateLivesInRepositoriesOrKnownLegacyServices() throws IOException {
        assertThat(filesMatching(path -> !isRepository(path) && !LEGACY_SERVICE_SQL.contains(path), this::usesJdbc))
                .as("New SQL goes into a *Repository class (repository/ or domain/ package)")
                .isEmpty();
    }

    @Test
    void legacyAllowListOnlyShrinks() throws IOException {
        Set<String> stillUsing = filesMatching(LEGACY_SERVICE_SQL::contains, this::usesJdbc);
        assertThat(stillUsing)
                .as("Remove a file from LEGACY_SERVICE_SQL once its SQL has moved to a repository")
                .containsExactlyInAnyOrderElementsOf(LEGACY_SERVICE_SQL);
    }

    @Test
    void myBatisIsNotUsed() throws IOException {
        assertThat(filesMatching(path -> true,
                source -> source.contains("org.apache.ibatis") || source.contains("org.mybatis")))
                .isEmpty();
    }

    private boolean usesJdbc(String source) {
        return source.contains("JdbcTemplate") || source.contains("JdbcOperations");
    }

    private static boolean isRepository(String path) {
        return path.contains("/repository/") || (path.contains("/domain/") && path.endsWith("Repository.java"));
    }

    private Set<String> filesMatching(java.util.function.Predicate<String> pathFilter,
                                      java.util.function.Predicate<String> sourceFilter) throws IOException {
        Set<String> hits = new TreeSet<>();
        try (Stream<Path> files = Files.walk(MAIN)) {
            List<Path> javaFiles = files.filter(p -> p.toString().endsWith(".java")).toList();
            for (Path file : javaFiles) {
                String relative = MAIN.relativize(file).toString().replace('\\', '/');
                if (!pathFilter.test(relative)) continue;
                if (sourceFilter.test(Files.readString(file, StandardCharsets.UTF_8))) hits.add(relative);
            }
        }
        return hits;
    }
}
