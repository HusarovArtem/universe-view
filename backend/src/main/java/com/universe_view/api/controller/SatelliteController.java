package com.universe_view.api.controller;

import com.universe_view.orbit.dto.OrbitPathDto;
import com.universe_view.orbit.service.OrbitPropagationService;
import com.universe_view.satellite.dto.SatelliteDto;
import com.universe_view.satellite.service.SatelliteDataService;
import com.universe_view.simulation.service.SimulationTimeService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "Satellites", description = "Satellite data and orbital information")
@RestController
@RequestMapping("/api/satellites")
public class SatelliteController {

    private final SatelliteDataService      dataService;
    private final OrbitPropagationService   propagationService;
    private final SimulationTimeService     timeService;

    public SatelliteController(SatelliteDataService dataService,
                                OrbitPropagationService propagationService,
                                SimulationTimeService timeService) {
        this.dataService       = dataService;
        this.propagationService = propagationService;
        this.timeService       = timeService;
    }

    @Operation(summary = "Get all satellites for a given group")
    @GetMapping
    public List<SatelliteDto> getSatellites(
            @Parameter(description = "active | iss | starlink")
            @RequestParam(defaultValue = "active") String group) {
        return dataService.getByGroup(group).stream()
                .map(SatelliteDto::from)
                .toList();
    }

    @Operation(summary = "Get a satellite by its internal ID")
    @GetMapping("/{id}")
    public ResponseEntity<SatelliteDto> getSatellite(@PathVariable String id) {
        return dataService.findById(id)
                .map(SatelliteDto::from)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @Operation(summary = "Get orbit path for a satellite at current simulation time")
    @GetMapping("/{id}/orbit")
    public ResponseEntity<OrbitPathDto> getOrbit(
            @PathVariable String id,
            @Parameter(description = "Number of path points (default 128)")
            @RequestParam(defaultValue = "128") int steps) {

        return dataService.findById(id)
                .map(sat -> {
                    var simTime = timeService.getCurrentSimTime();
                    return propagationService.computeOrbitPath(sat, simTime, steps);
                })
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @Operation(summary = "Get raw TLE text for a group (proxied from CelesTrak)")
    @GetMapping("/tle/{group}")
    public ResponseEntity<List<SatelliteDto>> getTleGroup(@PathVariable String group) {
        try {
            List<SatelliteDto> result = dataService.getByGroup(group).stream()
                    .map(SatelliteDto::from)
                    .toList();
            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }
}
