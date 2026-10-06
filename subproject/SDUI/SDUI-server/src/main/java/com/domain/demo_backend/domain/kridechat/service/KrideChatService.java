package com.domain.demo_backend.domain.kridechat.service;

import com.domain.demo_backend.domain.kridechat.dto.ChatQueryRequest;
import com.domain.demo_backend.domain.kridechat.dto.ChatQueryResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import reactor.core.Disposable;
import reactor.core.Disposables;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Executor;

@Slf4j
@Service
@RequiredArgsConstructor
public class KrideChatService {

    private final FastApiChatClient fastApiClient;

    public ChatQueryResponse chat(ChatQueryRequest request) {
        String intent = resolveIntent(request);

        if ("itinerary".equals(intent)) {
            return handleItinerary(request);
        } else if ("recommend".equals(intent)) {
            return handleRecommend(request);
        } else {
            return handleQa(request);
        }
    }

    public void streamChat(ChatQueryRequest request, SseEmitter emitter, Executor executor) {
        // swap() also cancels subscriptions installed after an early disconnect.
        Disposable.Swap subscription = Disposables.swap();
        AtomicBoolean ended = new AtomicBoolean();
        AtomicBoolean firstChunk = new AtomicBoolean();
        long started = System.nanoTime();
        Runnable cancel = () -> { ended.set(true); subscription.dispose(); };
        emitter.onCompletion(cancel);
        emitter.onTimeout(cancel);
        emitter.onError(error -> cancel.run());
        try {
            executor.execute(() -> {
                if (ended.get()) return;
                try {
                    subscription.update(fastApiClient.streamChat(request.getMessage())
                            .takeUntil(chunk -> "[DONE]".equals(chunk) || "\"[DONE]\"".equals(chunk))
                            .filter(chunk -> !"[DONE]".equals(chunk) && !"\"[DONE]\"".equals(chunk))
                            .subscribe(chunk -> {
                                if (ended.get()) return;
                                if (firstChunk.compareAndSet(false, true)) {
                                    log.info("KRIDE first stream event ms={}", (System.nanoTime() - started) / 1_000_000);
                                }
                                try {
                                    emitter.send(SseEmitter.event().data(chunk));
                                } catch (Exception error) {
                                    cancel.run();
                                    emitter.completeWithError(error);
                                }
                            }, error -> {
                                if (!ended.getAndSet(true)) {
                                    subscription.dispose();
                                    emitter.completeWithError(error);
                                }
                            }, () -> {
                                if (ended.getAndSet(true)) return;
                                subscription.dispose();
                                try {
                                    emitter.send(SseEmitter.event().data("[DONE]"));
                                    emitter.complete();
                                } catch (Exception error) {
                                    emitter.completeWithError(error);
                                }
                            }));
                } catch (Exception error) {
                    cancel.run();
                    emitter.completeWithError(error);
                }
            });
        } catch (RuntimeException error) {
            cancel.run();
            emitter.completeWithError(error);
        }
    }

    private String resolveIntent(ChatQueryRequest request) {
        if (request.getIntent() != null) {
            return request.getIntent();
        }

        String msg = request.getMessage();
        if (msg == null) return "qa";

        if (msg.contains("일정") || msg.contains("코스") || msg.contains("여행 계획")) {
            return "itinerary";
        }
        if (msg.contains("추천") || msg.contains("맛집") || msg.contains("관광지") || msg.contains("촬영지")) {
            return "recommend";
        }
        return "qa";
    }

    private ChatQueryResponse handleRecommend(ChatQueryRequest request) {
        try {
            Map<String, Object> result = fastApiClient.recommendAi(
                    request.getMessage(), request.getArtists(), request.getRegions(), request.getPurposes(),
                    request.getBudget(), request.getUserSqno(), request.getUserId()
            ).block();

            if (result == null) {
                return fallbackResponse("recommend", "추천 결과를 가져올 수 없습니다.");
            }

            @SuppressWarnings("unchecked")
            List<Map<String, Object>> pois = (List<Map<String, Object>>) result.get("pois");
            String recText = (String) result.get("recommendation_text");

            return ChatQueryResponse.builder()
                    .intent("recommend")
                    .pois(pois)
                    .recommendationText(recText)
                    .reply(recText)
                    .build();
        } catch (Exception e) {
            log.error("추천 API 호출 실패: {}", e.getMessage());
            return fallbackResponse("recommend", "추천 서비스 연결에 실패했습니다. 잠시 후 다시 시도해주세요.");
        }
    }

    private ChatQueryResponse handleItinerary(ChatQueryRequest request) {
        try {
            int duration = request.getDuration() != null ? request.getDuration() : 2;
            Map<String, Object> result = fastApiClient.generateItinerary(
                    request.getMessage(), request.getArtists(), request.getRegions(), request.getPurposes(), duration,
                    request.getBudget(), request.getUserSqno(), request.getUserId()
            ).block();

            if (result == null) {
                return fallbackResponse("itinerary", "일정 생성 결과를 가져올 수 없습니다.");
            }

            return ChatQueryResponse.builder()
                    .intent("itinerary")
                    .itinerary(result)
                    .reply("일정이 생성되었습니다.")
                    .build();
        } catch (Exception e) {
            log.error("일정 생성 API 호출 실패: {}", e.getMessage());
            return fallbackResponse("itinerary", "일정 생성 서비스 연결에 실패했습니다.");
        }
    }

    private ChatQueryResponse handleQa(ChatQueryRequest request) {
        try {
            String reply = fastApiClient.chatSync(request.getMessage());
            return ChatQueryResponse.builder()
                    .intent("qa")
                    .reply(reply)
                    .build();
        } catch (Exception e) {
            log.error("QA API 호출 실패: {}", e.getMessage());
            return fallbackResponse("qa", "죄송합니다. 답변 서비스에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.");
        }
    }

    private ChatQueryResponse fallbackResponse(String intent, String message) {
        return ChatQueryResponse.builder()
                .intent(intent)
                .reply(message)
                .build();
    }
}
