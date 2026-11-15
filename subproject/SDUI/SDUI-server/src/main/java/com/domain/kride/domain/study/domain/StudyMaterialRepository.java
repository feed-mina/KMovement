package com.domain.kride.domain.study.domain;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface StudyMaterialRepository extends JpaRepository<StudyMaterial, Long> {
    Optional<StudyMaterial> findFirstBySentDateIsNullOrderByDisplayOrderAsc();
}
