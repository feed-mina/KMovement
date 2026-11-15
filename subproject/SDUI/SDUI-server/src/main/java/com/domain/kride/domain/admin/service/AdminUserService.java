package com.domain.kride.domain.admin.service;

import com.domain.kride.domain.admin.dto.AdminUserResponse;
import com.domain.kride.domain.user.domain.User;
import com.domain.kride.domain.user.domain.UserRepository;
import com.github.pagehelper.PageInfo;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class AdminUserService {

    private static final Logger log = LoggerFactory.getLogger(AdminUserService.class);
    private final UserRepository userRepository;

    public AdminUserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public PageInfo<AdminUserResponse> getUserList(String keyword, String role, int page, int size) {
        Pageable pageable = PageRequest.of(page - 1, size, Sort.by("userSqno").descending());
        List<User> users = userRepository.findUsersForAdmin(keyword, role, pageable);
        int totalCount = userRepository.countUsersForAdmin(keyword, role);

        List<AdminUserResponse> dtos = users.stream()
                .map(u -> AdminUserResponse.builder()
                        .userSqno(u.getUserSqno())
                        .userId(u.getUserId())
                        .email(u.getEmail())
                        .role(u.getRole())
                        .build())
                .collect(Collectors.toList());

        PageInfo<AdminUserResponse> pageInfo = new PageInfo<>(dtos);
        pageInfo.setPageNum(page);
        pageInfo.setPageSize(size);
        pageInfo.setTotal(totalCount);
        return pageInfo;
    }

    @Transactional
    public void updateUserRole(List<Long> userIds, String newRole) {
        if (userIds == null || userIds.size() < 1) {
            throw new IllegalArgumentException("최소 1명을 선택해야 합니다.");
        }
        if (userIds.size() > 5) {
            throw new IllegalArgumentException("최대 5명까지 변경 가능합니다.");
        }
        if (!Set.of("ROLE_USER", "ROLE_ADMIN").contains(newRole)) {
            throw new IllegalArgumentException("유효하지 않은 권한 값입니다: " + newRole);
        }

        List<User> users = userRepository.findAllById(userIds);
        users.forEach(u -> u.setRole(newRole));
        userRepository.saveAll(users);
        log.info("관리자 권한 변경: userIds={}, newRole={}", userIds, newRole);
    }
}
