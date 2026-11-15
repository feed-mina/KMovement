package com.domain.kride.domain.content.service;

import com.domain.kride.domain.content.domain.Content;
import com.domain.kride.domain.content.domain.ContentRepository;
import com.domain.kride.domain.content.dto.ContentRequest;
import com.domain.kride.domain.content.dto.ContentResponse;
import com.domain.kride.domain.user.domain.User;
import com.domain.kride.domain.user.domain.UserRepository;
import com.domain.kride.global.security.CustomUserDetails;
import com.domain.kride.global.security.JwtUtil;
import com.github.pagehelper.PageInfo;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.math.BigInteger;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;


@Service
public class ContentService {
    private static final Logger log = LoggerFactory.getLogger(ContentService.class);
    private final JwtUtil jwtUtil;
    @Autowired
    private ContentRepository contentRepository;
    private UserRepository userRepository;


    public ContentService(ContentRepository contentRepository, UserRepository userRepository, JwtUtil jwtUtil) {
        this.contentRepository = contentRepository;
        this.userRepository = userRepository;
        this.jwtUtil = jwtUtil;
    }

    public PageInfo<ContentResponse> selectContentList(String userId, int pageNo, int pageSize) {
        log.debug("콘텐츠 서비스 selectContentList 진입");
//        PageHelper.startPage(pageNo, pageSize);

        int totalCount = contentRepository.countByUserId(userId);

        List<Content> diaries;
        int offset = (pageNo - 1) * pageSize; //  OFFSET 미리 계산
        log.debug("offset: {}", offset);
        try {
            // 콘텐츠 목록 가져오기
//            contentResponseList = contentRepository.selectContentList(userId, pageSize, offset) ;
            diaries = contentRepository.findByContentListCustom(userId, pageSize, offset);
//            System.out.println("@@@1--diaries:: " + diaries);
            // 2. 엔티티 목록을 DTO(ContentResponse) 목록으로 변환한다.
            List<ContentResponse> contentResponseList = diaries.stream()
                    .map(this::convertToDto)
                    .collect(Collectors.toList());
            // PageInfo 객체로 페이징 결과를 반환
            PageInfo<ContentResponse> pageInfo = new PageInfo<>(contentResponseList);
            pageInfo.setPageNum(pageNo);
            pageInfo.setPageSize(pageSize);
            pageInfo.setTotal(totalCount);  //  전체 콘텐츠 개수 꼭 넣기!

            return pageInfo;
        } catch (Exception e) {
            log.error("Error fetching content list: {}", e.getMessage(), e);
            throw new RuntimeException("콘텐츠를 조회하는 도중 오류가 발생했습니다.", e);
        }
    }

    public Set<ContentResponse> findContentById(ContentRequest contentReq) {

        log.debug("findContentById 서비스 로직 진입: {}", contentReq);
        log.debug("findContentItemById sql 시작: {}", contentReq);
        // 1. contentReq 에서 필요한 값을 꺼내서 변수에 담는다.
        String userId = contentReq.getUserId();
        int pageSize = 10; // 만약 요청이 없다면 임시로 10개
        int offset = 0; // 첫 페이지부터
//     return contentMapper.selectContentItem(contentReq)
        return contentRepository.findByContentListCustom(userId, pageSize, offset) // 1. List를 받는다
                .stream()                                               // 2. 하나씩 꺼낸다 .map(this::convertToDto)
                .map(content -> {
                    // Content 엔티티를 ContentResponse로 바꾸는 과정이 필요
                    ContentResponse res = new ContentResponse();
                    res.setContentId(BigInteger.valueOf(content.getContentId()));
                    res.setTitle(content.getTitle());
                    return res;
                }) // 3. 모양을 바꾼다
                .collect(Collectors.toSet());

    }

    private ContentResponse convertToDto(Content content) {
        ContentResponse dto = new ContentResponse();
        dto.setContentId(BigInteger.valueOf(content.getContentId()));
        dto.setTitle(content.getTitle());
        dto.setContent(content.getContent());
        dto.setRegDt(content.getRegDt());
        dto.setUserId(content.getUserId());
        // dto.setUserId(content.getUser().getUserId());
        return dto;
    }

    @Transactional(readOnly = true)
    public Optional<Content> viewContentItem(ContentRequest contentReq, Authentication authentication) {

        log.debug("viewContentItem 서비스 로직 진입: {}", contentReq);
        if (contentReq.getContentId() == null) {
            throw new IllegalArgumentException("contentId가 누락되었습니다.");
        }

        Long contentId = contentReq.getContentId().longValue();
        String userId = contentReq.getUserId();

        // 삭제 여부만 필터링하여 조회 (user_id 무관)
        Optional<Content> contentOpt = contentRepository.findByContentIdAndDelYn(contentId, "N");

        if (contentOpt.isEmpty()) {
            throw new NoSuchElementException("해당 콘텐츠를 찾을 수 없습니다.");
        }

        Content content = contentOpt.get();

        // 비공개 콘텐츠: 작성자 또는 어드민만 접근 가능
        if (content.isPrivate()) {
            boolean isOwner = content.getUserId() != null && content.getUserId().equals(userId);
            boolean isAdmin = authentication != null && authentication.getAuthorities().stream()
                    .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
            if (!isOwner && !isAdmin) {
                throw new NoSuchElementException("해당 콘텐츠를 찾을 수 없습니다.");
            }
        }

        return contentOpt;
    }


    @Transactional
    public void addContent(ContentRequest contentRequest, String ip, Authentication authentication) {

        CustomUserDetails userDetails = (CustomUserDetails) authentication.getPrincipal();
        log.debug("contentRequest-콘텐츠서비스: {}", contentRequest);
        //먼저 DB에서 유저를 찾는다.
        User user = userRepository.findByUserSqno(userDetails.getUserSqno()).orElseThrow(() -> new IllegalArgumentException("존재하지 않은 사용자입니다."));

        //   한국 시간(KST) 기준 현재 시간 구하기
        LocalDateTime nowKst = ZonedDateTime.now(ZoneId.of("Asia/Seoul")).toLocalDateTime();

        //   한국어 요일 추출 (예: 월요일)
        String dayOfWeek = nowKst.format(DateTimeFormatter.ofPattern("EEEE", Locale.KOREAN));
        // 빌더를 사용해 콘텐츠를 만든다

        Content content = Content.builder()
                .user(user)
                .userId(user.getUserId())
                .email(user.getEmail())
                .roleNm(user.getRole()) //   User 엔티티의 role 정보를 매핑
                .title(contentRequest.getTitle() != null ? contentRequest.getTitle() : "Untitled")
                .content(contentRequest.getContent() != null ? contentRequest.getContent() : "")
                .emotion(contentRequest.getEmotion() != null ? contentRequest.getEmotion() : 0)
                .frstRegIp(ip != null ? ip : "127.0.0.1")
                .selectedTimes(contentRequest.getSelectedTimes())
                .dailySlots(contentRequest.getDailySlots())
                .dayTag1(contentRequest.getDayTag1() != null ? contentRequest.getDayTag1() : "")
                .dayTag2(contentRequest.getDayTag2() != null ? contentRequest.getDayTag2() : "")
                .dayTag3(contentRequest.getDayTag3() != null ? contentRequest.getDayTag3() : "")
                .isPrivate(Boolean.TRUE.equals(contentRequest.getIsPrivate()))
                .contentStatus(contentRequest.getContentStatus() != null ? contentRequest.getContentStatus() : "true")
                .contentType(contentRequest.getContentType() != null ? contentRequest.getContentType() : "N")
                .delYn("N")
                .regDt(nowKst)
                .updtDt(nowKst)
                .date(dayOfWeek)
                .build();

        log.debug("Content 객체 생성 값: {}", content);
        contentRepository.save(content);
    }

    public PageInfo<ContentResponse> selectMemberContentList(Authentication authentication, int pageNo, int pageSize) {
        // 1. 현재 로그인한 사용자 정보 가져오기
        CustomUserDetails userDetails = (CustomUserDetails) authentication.getPrincipal();

        Long userSqno = userDetails.getUser().getUserSqno();
        // 3. 페이징 설정 및 해당 유저의 데이터만 조회
        Pageable pageable = PageRequest.of(pageNo - 1, pageSize, Sort.by("regDt").descending());

        List<Content> diaries = contentRepository.findMemberContentList(userSqno, "N", pageable);
        int totalCount = contentRepository.countByUserIdAndDelYn(userSqno, "N");
        // 4. DTO 변환 및 결과 반환
        List<ContentResponse> contentResponseList = diaries.stream().map(this::convertToDto).collect(Collectors.toList());
        PageInfo<ContentResponse> pageInfo = new PageInfo<>(contentResponseList);
        pageInfo.setTotal(totalCount);
        return pageInfo;
    }
}