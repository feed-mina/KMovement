package com.domain.demo_backend.domain.community.controller;

import com.domain.demo_backend.domain.community.dto.LikeStatusResponse;
import com.domain.demo_backend.domain.community.dto.PostCreateRequest;
import com.domain.demo_backend.domain.community.dto.PostListResponse;
import com.domain.demo_backend.domain.community.dto.PostResponse;
import com.domain.demo_backend.domain.community.dto.ReportRequest;
import com.domain.demo_backend.domain.community.service.CommunityPostService;
import com.domain.demo_backend.domain.community.service.PostLikeService;
import com.domain.demo_backend.domain.community.service.PostReportService;
import com.domain.demo_backend.domain.community.service.UserFollowService;
import com.domain.demo_backend.domain.user.domain.User;
import com.domain.demo_backend.global.security.CustomUserDetails;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "openai.api-key=test-key",
        "openai.model=gpt-4o-mini",
        "openai.whisper-model=whisper-1"
})
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DisplayName("Community controller integration tests")
class CommunityControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private CommunityPostService postService;

    @MockBean
    private PostLikeService likeService;

    @MockBean
    private PostReportService reportService;

    @MockBean
    private UserFollowService followService;

    @Test
    @DisplayName("GET /api/v1/community/posts returns paged post list")
    void getPostList_returnsPagedPosts() throws Exception {
        PostListResponse post = PostListResponse.builder()
                .postId(101L)
                .title("Seoul concert route")
                .contentPreview("Best spots near the venue")
                .authorSqno(7L)
                .authorNickname("traveler")
                .likeCount(3L)
                .thumbnailUrl(null)
                .createdAt(LocalDateTime.of(2026, 5, 20, 10, 0))
                .build();
        Page<PostListResponse> page = new PageImpl<>(List.of(post), PageRequest.of(1, 5), 1);

        when(postService.getPostList(1, 5)).thenReturn(page);

        mockMvc.perform(get("/api/v1/community/posts")
                        .param("page", "1")
                        .param("size", "5")
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.status").value("success"))
                .andExpect(jsonPath("$.data.content", hasSize(1)))
                .andExpect(jsonPath("$.data.content[0].postId").value(101))
                .andExpect(jsonPath("$.data.content[0].title").value("Seoul concert route"));

        verify(postService).getPostList(1, 5);
    }

    @Test
    @DisplayName("POST /api/v1/community/posts binds multipart post JSON and images")
    void createPost_bindsMultipartRequest() throws Exception {
        PostResponse response = PostResponse.builder()
                .postId(101L)
                .title("Seoul concert route")
                .content("Best spots near the venue")
                .authorSqno(7L)
                .authorNickname("traveler")
                .likeCount(0L)
                .reportCount(0L)
                .images(List.of())
                .build();

        when(postService.createPost(eq(7L), any(PostCreateRequest.class), anyList()))
                .thenReturn(response);

        MockMultipartFile postPart = new MockMultipartFile(
                "post",
                "post.json",
                MediaType.APPLICATION_JSON_VALUE,
                "{\"title\":\"Seoul concert route\",\"content\":\"Best spots near the venue\"}"
                        .getBytes(StandardCharsets.UTF_8)
        );
        MockMultipartFile imagePart = new MockMultipartFile(
                "images",
                "route.jpg",
                MediaType.IMAGE_JPEG_VALUE,
                "image-bytes".getBytes(StandardCharsets.UTF_8)
        );

        mockMvc.perform(multipart("/api/v1/community/posts")
                        .file(postPart)
                        .file(imagePart)
                        .with(user(authenticatedUser()))
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("success"))
                .andExpect(jsonPath("$.data.postId").value(101))
                .andExpect(jsonPath("$.data.title").value("Seoul concert route"));

        ArgumentCaptor<PostCreateRequest> requestCaptor = ArgumentCaptor.forClass(PostCreateRequest.class);
        verify(postService).createPost(eq(7L), requestCaptor.capture(), anyList());
        assertThat(requestCaptor.getValue().getTitle()).isEqualTo("Seoul concert route");
        assertThat(requestCaptor.getValue().getContent()).isEqualTo("Best spots near the venue");
    }

    @Test
    @DisplayName("POST /api/v1/community/posts/{postId}/likes returns like status")
    void toggleLike_returnsLikeStatus() throws Exception {
        when(likeService.toggleLike(101L, 7L))
                .thenReturn(LikeStatusResponse.builder().liked(true).likeCount(4L).build());

        mockMvc.perform(post("/api/v1/community/posts/101/likes")
                        .with(user(authenticatedUser()))
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("success"))
                .andExpect(jsonPath("$.data.liked").value(true))
                .andExpect(jsonPath("$.data.likeCount").value(4));

        verify(likeService).toggleLike(101L, 7L);
    }

    @Test
    @DisplayName("POST /api/v1/community/posts/{postId}/reports binds report payload")
    void reportPost_bindsReportPayload() throws Exception {
        mockMvc.perform(post("/api/v1/community/posts/101/reports")
                        .with(user(authenticatedUser()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reasonCode\":\"SPAM\",\"detailText\":\"Repeated promotional content\"}")
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("success"));

        ArgumentCaptor<ReportRequest> requestCaptor = ArgumentCaptor.forClass(ReportRequest.class);
        verify(reportService).reportPost(eq(101L), eq(7L), requestCaptor.capture());
        assertThat(requestCaptor.getValue().getReasonCode()).isEqualTo("SPAM");
        assertThat(requestCaptor.getValue().getDetailText()).isEqualTo("Repeated promotional content");
    }

    @Test
    @DisplayName("POST /api/v1/community/users/{userSqno}/follow returns follow status")
    void toggleFollow_returnsFollowStatus() throws Exception {
        when(followService.toggleFollow(7L, 22L))
                .thenReturn(Map.of("following", true, "followerCount", 11L));

        mockMvc.perform(post("/api/v1/community/users/22/follow")
                        .with(user(authenticatedUser()))
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("success"))
                .andExpect(jsonPath("$.data.following").value(true))
                .andExpect(jsonPath("$.data.followerCount").value(11));

        verify(followService).toggleFollow(7L, 22L);
    }

    private CustomUserDetails authenticatedUser() {
        User user = User.builder()
                .userSqno(7L)
                .userId("traveler")
                .email("traveler@example.com")
                .role("ROLE_USER")
                .delYn("N")
                .build();
        return new CustomUserDetails(user);
    }
}
