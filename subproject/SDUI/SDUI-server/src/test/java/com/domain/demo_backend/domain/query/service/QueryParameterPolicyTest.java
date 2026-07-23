package com.domain.demo_backend.domain.query.service;

import com.domain.demo_backend.domain.query.domain.QueryMaster;
import com.domain.demo_backend.domain.user.domain.User;
import com.domain.demo_backend.global.security.CustomUserDetails;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class QueryParameterPolicyTest {

    private final QueryParameterPolicy policy = new QueryParameterPolicy(new ObjectMapper());

    @Test
    void malformedRequiredParamsFailsClosedAsConfigurationError() {
        QueryMaster query = query("SELECT * FROM event WHERE region = :region", "not-json", "{\"region\":\"string\"}");

        assertThatThrownBy(() -> policy.validate(query, Map.of("region", "Seoul"), null))
                .isInstanceOfSatisfying(QueryParameterPolicy.PolicyException.class, error -> {
                    assertThat(error.getStatus()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
                    assertThat(error.getCode()).isEqualTo("QUERY_CONFIGURATION_ERROR");
                    assertThat(error.getMessage()).doesNotContain("Seoul");
                });
    }

    @Test
    void malformedParamMappingFailsClosedAsConfigurationError() {
        QueryMaster query = query("SELECT * FROM event WHERE region = :region", "[]", "[\"region\"]");

        assertThatThrownBy(() -> policy.validate(query, Map.of("region", "Seoul"), null))
                .isInstanceOfSatisfying(QueryParameterPolicy.PolicyException.class, error -> {
                    assertThat(error.getStatus()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
                    assertThat(error.getCode()).isEqualTo("QUERY_CONFIGURATION_ERROR");
                });
    }

    @Test
    void undeclaredSqlParameterFailsClosed() {
        QueryMaster query = query(
                "SELECT * FROM event WHERE region = :region AND artist_id = :artistId",
                "[]",
                "{\"region\":\"string\"}");

        assertThatThrownBy(() -> policy.validate(query, Map.of("region", "Seoul"), null))
                .isInstanceOfSatisfying(QueryParameterPolicy.PolicyException.class, error -> {
                    assertThat(error.getStatus()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
                    assertThat(error.getCode()).isEqualTo("QUERY_CONFIGURATION_ERROR");
                    assertThat(error.getKeyNames()).containsExactly("artistId");
                });
    }

    @Test
    void clientCannotOverrideServerOwnedIdentity() {
        QueryMaster query = query(
                "SELECT * FROM saved_course WHERE user_sqno = :userSqno",
                "[]",
                "{}");

        assertThatThrownBy(() -> policy.validate(query, Map.of("userSqno", "999"), principal()))
                .isInstanceOfSatisfying(QueryParameterPolicy.PolicyException.class, error -> {
                    assertThat(error.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
                    assertThat(error.getCode()).isEqualTo("IDENTITY_PARAMETER_FORBIDDEN");
                    assertThat(error.getKeyNames()).containsExactly("userSqno");
                });
    }

    @Test
    void authenticatedIdentityIsInjectedFromPrincipal() {
        QueryMaster query = query(
                "SELECT * FROM saved_course WHERE user_sqno = :userSqno AND user_id = :userId",
                "[]",
                "{}");

        QueryParameterPolicy.ValidationResult result = policy.validate(query, Map.of(), principal());

        assertThat(result.parameters())
                .containsEntry("userSqno", 42L)
                .containsEntry("userId", "member-42");
        assertThat(result.clientKeyNames()).isEmpty();
    }

    @Test
    void typedParametersAreNormalizedBeforeExecution() {
        QueryMaster query = query(
                "SELECT * FROM event WHERE capacity >= :capacity AND featured = :featured "
                        + "AND event_date = :eventDate AND score >= :score AND artist_id IN (:artistIds)",
                "[\"capacity\"]",
                "{"
                        + "\"capacity\":\"integer\","
                        + "\"featured\":\"boolean\","
                        + "\"eventDate\":\"date\","
                        + "\"score\":\"decimal\","
                        + "\"artistIds\":\"long_list\""
                        + "}");

        QueryParameterPolicy.ValidationResult result = policy.validate(query, Map.of(
                "capacity", "120",
                "featured", "true",
                "eventDate", "2026-07-23",
                "score", "4.75",
                "artistIds", "7, 9"), null);

        assertThat(result.parameters())
                .containsEntry("capacity", 120)
                .containsEntry("featured", true)
                .containsEntry("eventDate", LocalDate.of(2026, 7, 23))
                .containsEntry("score", new BigDecimal("4.75"))
                .containsEntry("artistIds", List.of(7L, 9L));
    }

    @Test
    void invalidTypedValueIsRejectedWithoutEchoingTheValue() {
        QueryMaster query = query(
                "SELECT * FROM event WHERE capacity >= :capacity",
                "[]",
                "{\"capacity\":\"integer\"}");

        assertThatThrownBy(() -> policy.validate(query, Map.of("capacity", "secret-not-a-number"), null))
                .isInstanceOfSatisfying(QueryParameterPolicy.PolicyException.class, error -> {
                    assertThat(error.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
                    assertThat(error.getCode()).isEqualTo("QUERY_PARAMETER_TYPE_MISMATCH");
                    assertThat(error.getKeyNames()).containsExactly("capacity");
                    assertThat(error.getMessage()).doesNotContain("secret-not-a-number");
                });
    }

    @Test
    void sqlParserIgnoresQuotedColonsCommentsAndPostgresCasts() {
        QueryMaster query = query(
                "SELECT to_char(now(), 'HH:MI'), 1::text /* :ignored */ -- :also_ignored\n"
                        + "FROM event LIMIT :limit",
                "[]",
                "{\"limit\":\"integer\"}");

        QueryParameterPolicy.ValidationResult result = policy.validate(query, Map.of("limit", "5"), null);

        assertThat(result.parameters()).containsOnlyKeys("limit").containsEntry("limit", 5);
    }

    private QueryMaster query(String sql, String requiredParams, String paramMapping) {
        QueryMaster query = new QueryMaster();
        ReflectionTestUtils.setField(query, "sqlKey", "TEST_QUERY");
        ReflectionTestUtils.setField(query, "queryText", sql);
        ReflectionTestUtils.setField(query, "requiredParams", requiredParams);
        ReflectionTestUtils.setField(query, "paramMapping", paramMapping);
        return query;
    }

    private CustomUserDetails principal() {
        User user = User.builder()
                .userSqno(42L)
                .userId("member-42")
                .email("member-42@example.test")
                .role("ROLE_USER")
                .delYn("N")
                .build();
        return new CustomUserDetails(user);
    }
}
