package com.domain.demo_backend.domain.kridechat;

import com.domain.demo_backend.domain.kridechat.dto.ChatQueryRequest;
import com.domain.demo_backend.domain.kridechat.service.FastApiChatClient;
import com.domain.demo_backend.domain.kridechat.service.KrideChatService;
import org.junit.jupiter.api.Test;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Sinks;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Consumer;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class KrideChatStreamTest {
    static class Emitter extends SseEmitter {
        Runnable completion, timeout;
        Consumer<Throwable> error;
        List<String> events = new ArrayList<>();
        boolean failSend, complete;
        Throwable failure;
        @Override public void onCompletion(Runnable callback) { completion = callback; }
        @Override public void onTimeout(Runnable callback) { timeout = callback; }
        @Override public void onError(Consumer<Throwable> callback) { error = callback; }
        @Override public void send(SseEventBuilder event) throws IOException {
            if (failSend) throw new IOException("disconnected");
            event.build().forEach(item -> events.add(String.valueOf(item.getData())));
        }
        @Override public void complete() { complete = true; }
        @Override public void completeWithError(Throwable error) { failure = error; }
    }
    ChatQueryRequest request() { var r = new ChatQueryRequest(); r.setMessage("question"); return r; }

    @Test void completionIsSentOnceAndLateDataIsIgnored() {
        var client = mock(FastApiChatClient.class);
        when(client.streamChat("question")).thenReturn(Flux.just("{\"content\":\"one\"}", "[DONE]", "late"));
        var emitter = new Emitter();
        new KrideChatService(client).streamChat(request(), emitter, Runnable::run);
        assertThat(emitter.events).contains("{\"content\":\"one\"}");
        assertThat(emitter.events.stream().filter("[DONE]"::equals).count()).isEqualTo(1);
        assertThat(emitter.events).doesNotContain("late");
        assertThat(emitter.complete).isTrue();
    }

    @Test void disconnectTimeoutAndErrorCancelUpstream() {
        for (int mode = 0; mode < 3; mode++) {
            var client = mock(FastApiChatClient.class);
            var cancelled = new AtomicBoolean();
            when(client.streamChat("question")).thenReturn(Flux.<String>never().doOnCancel(() -> cancelled.set(true)));
            var emitter = new Emitter();
            new KrideChatService(client).streamChat(request(), emitter, Runnable::run);
            if (mode == 0) emitter.completion.run();
            if (mode == 1) emitter.timeout.run();
            if (mode == 2) emitter.error.accept(new IOException());
            assertThat(cancelled).isTrue();
            assertThat(emitter.events).isEmpty();
        }
    }

    @Test void failedWriteCancelsAndDoesNotSendCompletion() {
        var client = mock(FastApiChatClient.class);
        var source = Sinks.many().unicast().<String>onBackpressureBuffer();
        var cancelled = new AtomicBoolean();
        when(client.streamChat("question")).thenReturn(source.asFlux().doOnCancel(() -> cancelled.set(true)));
        var emitter = new Emitter(); emitter.failSend = true;
        new KrideChatService(client).streamChat(request(), emitter, Runnable::run);
        source.tryEmitNext("token");
        assertThat(cancelled).isTrue();
        assertThat(emitter.failure).isInstanceOf(IOException.class);
        assertThat(emitter.complete).isFalse();
    }

    @Test void disconnectBeforeExecutorStartsDoesNotCallProvider() {
        var client = mock(FastApiChatClient.class);
        var emitter = new Emitter();
        List<Runnable> tasks = new ArrayList<>();
        new KrideChatService(client).streamChat(request(), emitter, tasks::add);
        emitter.completion.run(); tasks.get(0).run();
        verifyNoInteractions(client);
    }
}
