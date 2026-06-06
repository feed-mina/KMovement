package com.domain.demo_backend.domain.community.service;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class AnimationRunPodOutputTest {

    @Test
    void parsesTopLevelResultUrl() {
        AnimationRunPodOutput.Parsed parsed = AnimationRunPodOutput.parse(
                Map.of("status", "success", "result_url", "https://cdn.example/final.mp4")
        );

        assertThat(parsed.succeeded()).isTrue();
        assertThat(parsed.resultUrl()).isEqualTo("https://cdn.example/final.mp4");
    }

    @Test
    void parsesFinalVideoArtifactUrl() {
        AnimationRunPodOutput.Parsed parsed = AnimationRunPodOutput.parse(
                Map.of(
                        "status", "success",
                        "artifacts", List.of(
                                Map.of("kind", "metadata", "url", "https://cdn.example/meta.json"),
                                Map.of("kind", "final_video", "url", "https://cdn.example/final.mp4")
                        )
                )
        );

        assertThat(parsed.resultUrl()).isEqualTo("https://cdn.example/final.mp4");
    }

    @Test
    void treatsWorkerErrorAsFailure() {
        AnimationRunPodOutput.Parsed parsed = AnimationRunPodOutput.parse(
                Map.of("status", "failed", "error", "CUDA kernel image is unavailable")
        );

        assertThat(parsed.succeeded()).isFalse();
        assertThat(parsed.errorMessage()).contains("CUDA kernel");
    }

    @Test
    void rejectsCompletedOutputWithoutPublicUrl() {
        AnimationRunPodOutput.Parsed parsed = AnimationRunPodOutput.parse(
                Map.of("status", "success", "artifacts", List.of())
        );

        assertThat(parsed.succeeded()).isFalse();
        assertThat(parsed.errorMessage()).contains("public result URL");
    }
}
