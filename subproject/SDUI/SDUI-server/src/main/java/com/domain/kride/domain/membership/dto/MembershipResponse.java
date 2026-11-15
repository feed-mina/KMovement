package com.domain.kride.domain.membership.dto;

import com.domain.kride.domain.membership.domain.Membership;
import lombok.Getter;

@Getter
public class MembershipResponse {
    private final Long id;
    private final String name;
    private final boolean canLearn;
    private final boolean canConverse;
    private final boolean canAnalyze;
    private final int durationDays;
    private final int priceCents;
    private final String description;

    public MembershipResponse(Membership m) {
        this.id           = m.getId();
        this.name         = m.getName();
        this.canLearn     = m.isCanLearn();
        this.canConverse  = m.isCanConverse();
        this.canAnalyze   = m.isCanAnalyze();
        this.durationDays = m.getDurationDays();
        this.priceCents   = m.getPriceCents();
        this.description  = m.getDescription();
    }
}
