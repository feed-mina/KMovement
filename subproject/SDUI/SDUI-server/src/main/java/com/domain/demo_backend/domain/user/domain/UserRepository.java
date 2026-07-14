package com.domain.demo_backend.domain.user.domain;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import jakarta.persistence.LockModeType;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    // 여기서 JPA가 쿼리를 만든다 !
    Optional<User> findByEmail(String email);

    Optional<User> findByPhone(String phone);

    Optional<User> findByuserId(String userId);

    boolean existsByUserIdIgnoreCase(String userId);

    Optional<User> findByUserSqno(Long userSqno);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT u FROM User u WHERE u.userSqno = :userSqno")
    Optional<User> findByUserSqnoForAnimationLimit(@Param("userSqno") Long userSqno);

    // 2026.01.11 update 관련ㄹ 메서드들은 더티 체킹을 사용한다.
    // 2026.01.11 insert 대신 기본 제공되는 save()를 사용하면 된다.

    // 2026.01.11 탈퇴유저 확인
    Optional<User> findByEmailAndDelYn(String email, String delYn);

    // 관리자 사용자 목록 조회 (keyword: userId 또는 email 검색, role: 권한 필터)
    @Query("SELECT u FROM User u WHERE u.delYn = 'N'" +
           " AND (:keyword IS NULL OR u.userId LIKE %:keyword% OR u.email LIKE %:keyword%)" +
           " AND (:role IS NULL OR u.role = :role)")
    List<User> findUsersForAdmin(@Param("keyword") String keyword, @Param("role") String role, Pageable pageable);

    @Query("SELECT COUNT(u) FROM User u WHERE u.delYn = 'N'" +
           " AND (:keyword IS NULL OR u.userId LIKE %:keyword% OR u.email LIKE %:keyword%)" +
           " AND (:role IS NULL OR u.role = :role)")
    int countUsersForAdmin(@Param("keyword") String keyword, @Param("role") String role);

}
