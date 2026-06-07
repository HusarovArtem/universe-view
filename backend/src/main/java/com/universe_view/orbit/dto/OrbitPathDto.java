package com.universe_view.orbit.dto;

import com.universe_view.domain.valueobject.Position;

import java.time.Instant;
import java.util.List;

public record OrbitPathDto(
        String         satelliteId,
        Instant        computedAt,
        double         periodSeconds,
        List<Position> points
) {}
