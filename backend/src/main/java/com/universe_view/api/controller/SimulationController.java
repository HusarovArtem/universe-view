package com.universe_view.api.controller;

import com.universe_view.simulation.dto.SimulationTimeDto;
import com.universe_view.simulation.dto.SimulationTimeRequestDto;
import com.universe_view.simulation.service.SimulationTimeService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.*;

@Tag(name = "Simulation", description = "Simulation time control")
@RestController
@RequestMapping("/api/simulation")
public class SimulationController {

    private final SimulationTimeService timeService;

    public SimulationController(SimulationTimeService timeService) {
        this.timeService = timeService;
    }

    @Operation(summary = "Get current simulation time state")
    @GetMapping("/time")
    public SimulationTimeDto getTime() {
        return timeService.getState();
    }

    @Operation(summary = "Update simulation time, speed, or pause state")
    @PostMapping("/time")
    public SimulationTimeDto updateTime(@RequestBody SimulationTimeRequestDto request) {
        return timeService.applyCommand(request);
    }
}
