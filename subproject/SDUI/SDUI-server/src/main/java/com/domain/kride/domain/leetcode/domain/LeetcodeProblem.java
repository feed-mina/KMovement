package com.domain.kride.domain.leetcode.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;

@Entity
@Table(name = "leetcode_problems")
@Getter
@Setter
public class LeetcodeProblem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "title", nullable = false)
    private String title;

    @Column(name = "slug", nullable = false, unique = true)
    private String slug;

    @Column(name = "difficulty", nullable = false)
    private String difficulty;  // Easy / Medium / Hard

    @Column(name = "category", nullable = false)
    private String category;

    @Column(name = "display_order", nullable = false)
    private int displayOrder;

    @Column(name = "sent_date")
    private LocalDate sentDate;  // null = 미발송
}
