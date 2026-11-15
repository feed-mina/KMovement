package com.domain.kride.domain.time.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "goal_settings")
@Getter
@Setter
public class GoalSetting {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_sqno", nullable = false)
    private Long userSqno;

    @Column(name = "user_id")
    private String userId;

    @Column(name = "target_time", nullable = false)
    private LocalDateTime targetTime;

    @Column(name = "recorded_time")
    private LocalDateTime recordedTime;

    @Column(name = "todays_message", nullable = true)
    private String todaysMessage;

    @Column(name = "status", length = 20)
    private String status;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "notif_sent_30min")
    private boolean notifSent30min = false;

    @Column(name = "notif_sent_90min")
    private boolean notifSent90min = false;

    @Column(name = "notif_sent_180min")
    private boolean notifSent180min = false;

    @Column(name = "google_calendar_event_id", length = 200)
    private String googleCalendarEventId;
}