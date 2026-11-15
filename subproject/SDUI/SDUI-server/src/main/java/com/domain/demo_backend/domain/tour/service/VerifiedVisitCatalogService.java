package com.domain.demo_backend.domain.tour.service;

import com.domain.demo_backend.domain.tour.domain.VerifiedVisitCatalogJdbcRepository;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class VerifiedVisitCatalogService {

    private final VerifiedVisitCatalogJdbcRepository repository;

    @Transactional(readOnly = true)
    public List<JsonNode> catalog() {
        return repository.findAllPayloads();
    }
}
