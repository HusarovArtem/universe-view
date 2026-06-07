package com.universe_view.simulation.dto;

import java.time.Instant;

public record SimulationTimeDto(
        Instant simTime,
        double  speedMultiplier,
        boolean paused
) {}
