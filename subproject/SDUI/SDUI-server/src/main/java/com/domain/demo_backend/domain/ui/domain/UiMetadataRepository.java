package com.domain.demo_backend.domain.ui.domain;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface UiMetadataRepository extends JpaRepository<UiMetadata, Long> {
    // 화면 ID 별로 구성요소를 가져오되 순서(sort_order)를 정렬해서 가져온다.
    List<UiMetadata> findByScreenIdOrderBySortOrderAsc(String screenId);

    List<UiMetadata> findAllByOrderByScreenIdAscSortOrderAscUiIdAsc();
}
