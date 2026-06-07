package com.universe_view.simulation.dto;

import java.time.Instant;

public record SimulationTimeRequestDto(
        Instant simTime,
        Double  speedMultiplier,
        Boolean paused
) {}
