package com.domain.kride.domain.content.domain;

import com.domain.kride.domain.user.domain.User;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigInteger;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Entity
@Table(name = "content")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor // 빌더를 위해 추가
@Builder // 클래스 위에 붙으면 모든 빌드에 대해 빌더가 생긴다.
public class Content {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "content_id")
    private Long contentId;

    private String title;
    private String content;
    // 문자열 userId 필드
    @Column(name = "user_id")
    private String userId;
    // 실제 연관관계 필드(DB의  user_sqno 칼럼을 실제로 관리함)
    @ManyToOne(fetch = FetchType.LAZY)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    @JoinColumn(name = "user_sqno")
    private User user;

    // 숫자 PK 값만 따로 확인하고 싶은 경우
    // insertable=false, updatable=false를 넣어야 중복 매핑 에러가 사라진다.
    @Column(name = "user_sqno", insertable = false, updatable = false)
    private Long userSqno;


    @Column(name = "day_tag1")
    private String dayTag1;

    @Column(name = "day_tag2")
    private String dayTag2;

    @Column(name = "day_tag3")
    private String dayTag3;
    private String date;
    private String email;


    @Column(name = "last_updt_dt")
    private String lastUpdtDt;

    @Column(name = "img_url")
    private String imgUrl; // Added for V35/V23 compatibility

    private LocalDateTime regDt;
    private String contentStatus;

    @Column(name = "frst_reg_ip")
    private String frstRegIp;

    @Column(name = "frst_rgst_usps_sqno")
    private BigInteger frstRgstUspsSqno;

    private Integer emotion; // 감정지수 추가

    @Column(name = "updt_dt")
    private LocalDateTime updtDt;

    @Column(name = "content_type")
    private String contentType;

    @Builder.Default
    @Column(name = "del_yn")
    private String delYn = "N";

    @Column(name = "del_dt")
    private LocalDateTime delDt;

    @Column(name = "frst_dt")
    private LocalDateTime frstRegDt;

    @Builder.Default
    @Column(name = "is_private")
    private boolean isPrivate = false;

    @Column(name = "role_cd")
    private String roleCd;

    @Column(name = "role_nm")
    private String roleNm;

    @Column(name = "last_updt_ip")
    private String lastUpdtIp;

    @Column(name = "last_updt_usps_sqno")
    private BigInteger lastUpdtUspsSqno;

    @JdbcTypeCode(SqlTypes.JSON) // Hibernate 6 이상에서 JSONB 매핑 방식
    @Column(name = "selected_times")
    private List<Integer> selectedTimes; // [22, 23, 0, 1] 형태로 자동 매핑

    @JdbcTypeCode(SqlTypes.JSON)

    @Column(name = "daily_slots")
    private Map<String, Object> dailySlots; // {"morning": "...", "lunch": "..."} 형태로 매핑



    @PrePersist
    public void prePersist() {
        this.regDt = LocalDateTime.now();
        this.updtDt = LocalDateTime.now();
        if (this.selectedTimes == null) this.selectedTimes = new ArrayList<>();
        if (this.dailySlots == null) this.dailySlots = new HashMap<>();
    }
}
