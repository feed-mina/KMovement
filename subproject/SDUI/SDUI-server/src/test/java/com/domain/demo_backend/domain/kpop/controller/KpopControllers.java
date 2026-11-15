package com.domain.demo_backend.domain.kpop.controller;

import com.domain.demo_backend.domain.kpop.repository.KpopArtistRepository;
import com.domain.demo_backend.domain.kpop.service.EventCatalogService;
import com.domain.demo_backend.domain.kpop.service.KpopAnalysisService;
import com.domain.demo_backend.domain.kpop.service.KpopArtistService;
import com.domain.demo_backend.domain.kpop.service.KpopCacheService;
import com.domain.demo_backend.domain.kpop.service.KpopProductService;
import com.domain.demo_backend.domain.kpop.service.PersonalSavedService;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;

import java.util.concurrent.Executor;

/** Test factory: wires KpopController the way Spring does, starting from one JDBC template. */
final class KpopControllers {

    private KpopControllers() {
    }

    static KpopController withJdbc(NamedParameterJdbcTemplate jdbc, KpopAnalysisService analysisService,
                                   KpopProductService productService, Executor executor) {
        return withJdbc(jdbc, analysisService, productService, executor, null, new EventCatalogService(jdbc));
    }

    static KpopController withJdbc(NamedParameterJdbcTemplate jdbc, KpopAnalysisService analysisService,
                                   KpopProductService productService, Executor executor,
                                   KpopCacheService cacheService, EventCatalogService eventCatalog) {
        KpopArtistService artistService = new KpopArtistService(
                new KpopArtistRepository(jdbc), new PersonalSavedService(jdbc), cacheService);
        return new KpopController(artistService, analysisService, productService, executor, cacheService, eventCatalog);
    }
}
