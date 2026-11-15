package com.domain.kride.domain.query.repository;

import com.domain.kride.domain.query.domain.QueryMaster;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface QueryMasterRepository extends JpaRepository<QueryMaster, String> {
    // sql_key 로 쿼리 정보를 조회하는 기본 메서드 JpaReposistory 제공
    Optional<QueryMaster> findBySqlKey(String sqlKey);
}
