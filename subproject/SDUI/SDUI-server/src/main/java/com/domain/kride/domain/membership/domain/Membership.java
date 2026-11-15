package com.domain.kride.domain.membership.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "memberships")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Membership {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 100)
    private String name;

    @Column(name = "can_learn", nullable = false)
    private boolean canLearn;

    @Column(name = "can_converse", nullable = false)
    private boolean canConverse;

    @Column(name = "can_analyze", nullable = false)
    private boolean canAnalyze;

    @Column(name = "duration_days", nullable = false)
    private int durationDays;

    @Column(name = "price_cents", nullable = false)
    private int priceCents;

    private String description;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}
