package com.universe_view.orbit.dto;

import com.universe_view.domain.valueobject.Position;
import com.universe_view.domain.valueobject.Velocity;

import java.time.Instant;

public record PropagatedStateDto(
        String   satelliteId,
        Instant  epoch,
        Position position,
        Velocity velocity,
        double   altitudeKm
) {}
