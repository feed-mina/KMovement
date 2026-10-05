package com.domain.demo_backend.domain.kpop.controller;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.mock.web.MockHttpServletResponse;
import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.file.Path;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/** Optional browser runner: real controller/SQL behind a loopback HTTP bridge, not a deployed Spring app. */
@EnabledIfEnvironmentVariable(named="F6B_BROWSER",matches="1")
class EventCatalogBrowserEvidenceTest {
    @Test void collectB01ThroughB06AcrossFiveWidths() throws Exception {
        EventCatalogFixture fixture=new EventCatalogFixture();
        HttpServer server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        var executor=Executors.newSingleThreadExecutor();
        server.setExecutor(executor);
        server.createContext("/",exchange->{
            try {
                if(!exchange.getRequestMethod().equals("GET")||!exchange.getRequestURI().getPath().matches("/api/v1/kpop/events(?:/[0-9]+)?")) {
                    exchange.sendResponseHeaders(404,-1);return;
                }
                MockHttpServletResponse response=fixture.mvc.perform(get(URI.create(exchange.getRequestURI().toString()))).andReturn().getResponse();
                for(String header:response.getHeaderNames())exchange.getResponseHeaders().put(header,response.getHeaders(header));
                byte[] body=response.getContentAsByteArray();
                exchange.sendResponseHeaders(response.getStatus(),body.length);
                exchange.getResponseBody().write(body);
            } catch(Exception ex){exchange.sendResponseHeaders(500,-1);}
            finally{exchange.close();}
        });
        server.start();
        try {
            Path web=Path.of(System.getenv("F6B_WEB_SOURCE"));
            Path evidence=Path.of(System.getenv("F6B_EVIDENCE_DIR"));
            java.nio.file.Files.createDirectories(evidence);
            ProcessBuilder runner=new ProcessBuilder("node",web.resolve("tests/e2e/f6b-events-review.cjs").toString());
            runner.directory(web.toFile());
            runner.environment().put("F6B_API_URL","http://127.0.0.1:"+server.getAddress().getPort());
            runner.redirectErrorStream(true).redirectOutput(evidence.resolve("browser-run.log").toFile());
            Process process=runner.start();
            boolean finished=process.waitFor(8,TimeUnit.MINUTES);
            if(!finished)process.destroyForcibly();
            assertTrue(finished,"Browser exceeded eight minutes; inspect browser-run.log");
            assertEquals(0,process.exitValue(),"Inspect browser-run.log");
        } finally {server.stop(0);executor.shutdownNow();}
    }
}
