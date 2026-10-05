package com.domain.demo_backend.domain.kpop.controller;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import java.net.*;
import java.nio.file.*;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
/** Actual controller/SQL/Redis via loopback bridge, not full deployed Spring Security. */
@EnabledIfEnvironmentVariable(named="F6C_BROWSER",matches="1")
class PublicProductBrowserEvidenceTest {
 @Test void collectC01ThroughC06AcrossFiveWidths() throws Exception {
  try(PublicProductFixture fixture=new PublicProductFixture()) {
   var server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
   var executor=Executors.newSingleThreadExecutor();server.setExecutor(executor);
   server.createContext("/",exchange->{try{
    if(!exchange.getRequestMethod().equals("GET")||!exchange.getRequestURI().getPath().equals("/api/v1/kpop/product-candidates")){exchange.sendResponseHeaders(404,-1);return;}
    var response=fixture.mvc.perform(get(URI.create(exchange.getRequestURI().toString()))).andReturn().getResponse();
    for(String header:response.getHeaderNames())exchange.getResponseHeaders().put(header,response.getHeaders(header));
    byte[] body=response.getContentAsByteArray();exchange.sendResponseHeaders(response.getStatus(),body.length);exchange.getResponseBody().write(body);
   }catch(Exception ex){exchange.sendResponseHeaders(500,-1);}finally{exchange.close();}});
   server.start();
   try {
    Path web=Path.of(System.getenv("F6C_WEB_SOURCE")),out=Path.of(System.getenv("F6C_EVIDENCE_DIR"));Files.createDirectories(out);
    var runner=new ProcessBuilder("node",web.resolve("tests/e2e/f6c-products-review.cjs").toString());runner.directory(web.toFile());
    runner.environment().put("F6C_API_URL","http://127.0.0.1:"+server.getAddress().getPort());
    runner.redirectErrorStream(true).redirectOutput(out.resolve("browser-run.log").toFile());
    Process process=runner.start();boolean finished=process.waitFor(8,TimeUnit.MINUTES);if(!finished)process.destroyForcibly();
    assertTrue(finished,"Browser timeout; inspect browser-run.log");assertEquals(0,process.exitValue(),"Inspect browser-run.log");
   }finally{server.stop(0);executor.shutdownNow();}
  }
 }
}
