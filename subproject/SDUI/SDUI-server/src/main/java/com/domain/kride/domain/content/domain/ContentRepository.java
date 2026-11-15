package com.domain.kride.domain.content.domain;

import com.domain.kride.domain.user.domain.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ContentRepository extends JpaRepository<Content, Long> {
    // 특정 사용자의 삭제가 되지 않은 콘텐츠 개수 세기 (User 객체 기준)
    int countByUserAndDelYn(User user, String delYn);

    // 특정 사용자의 콘텐츠 목록을 페이징하여 가져오기 (Spring Data JPA 명명 규칙 활용)
    // JOIN FETCH 대신 EntityGraph를 써서 N+1 문제를 방어하면서 페이징도 안전하게 처리
    @EntityGraph(attributePaths = {"user"})
    @Query("SELECT d FROM Content d WHERE d.user.userSqno = :userSqno AND d.delYn = :delYn")
    List<Content> findMemberContentList(@Param("userSqno") Long userSqno, @Param("delYn") String delYn, Pageable pageable);
    // 2. 특정 사용자의 콘텐츠 목록을 페이징하여 가져오기

    // 1, 단순 목록 조회 (페이징 없이)
//    List<ContentResponse> findByUserId(String userId, int pageSize, int offset);

    // 1-2. 만약 페이징을 수동으로 (pageSize, offset_ 하고 싶다면 @Query를 써야 한다.
    @Query(value = "SELECT * FROM content WHERE user_id = :userId LIMIT :limit OFFSET :offset", nativeQuery = true)
    List<Content> findByContentListCustom(@Param("userId") String userId, @Param("limit") int limit, @Param("offset") int offset);
    // 2. 특정 콘텐츠 상세 조회 (Optional 사용)
//    Collection<Object> findContentItemById(String userId);

    Optional<Content> findByContentIdAndUserIdAndDelYn(Long contentId, String userId, String delYn);

    Optional<Content> findByContentIdAndDelYn(Long contentId, String delYn);

    // 객체 대신 ID로 개수
    @Query("SELECT COUNT(d) FROM Content d WHERE d.user.userSqno = :userSqno AND d.delYn = :delYn")
    int countByUserIdAndDelYn(@Param("userSqno") Long userSqno, @Param("delYn") String delYn);
    // 3. 개수 세기
    int countByUserId(String userId);


    //  전체 목록 페이징 조회 시 User도 같이 가져오기
    @EntityGraph(attributePaths = {"user"})
    Page<Content> findByDelYnOrderByRegDtDesc(String delYn, Pageable pageable);

    //  특정 유저의 콘텐츠 목록 조회 시 User도 같이 가져오기
    @EntityGraph(attributePaths = {"user"})
    Page<Content> findByUserAndDelYnOrderByRegDtDesc(User user, String delYn, Pageable pageable);

    // User 객체 내부의 userSqno(또는 id)를 참조하도록 메서드명을 변경합니다.
// User 엔티티 내부의 PK 필드명이 id라면 findByUserId, userSqno라면 findByUserUserSqno가 됩니다.
    List<Content> findByUser_UserSqnoOrderByRegDtDesc(Long userSqno);

    // User 객체 내부의 userSqno(또는 id)를 참조하도록 메서드명을 변경합니다.
// User 엔티티 내부의 PK 필드명이 id라면 findByUserId, userSqno라면 findByUserUserSqno가 됩니다.
//    List<Content> findByUser_UserSqnoOrderByRegDtDesc(Long userSqno);

    // 엔티티의 private String userId 필드와 타입을 맞춥니다.
//  필드명 기준 조회 시에도 적용 가능
    @EntityGraph(attributePaths = {"user"})
    List<Content> findByUserIdOrderByRegDtDesc(String userId);
}