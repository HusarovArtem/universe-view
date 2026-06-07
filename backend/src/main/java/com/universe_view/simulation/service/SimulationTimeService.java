package com.universe_view.simulation.service;

import com.universe_view.simulation.dto.SimulationTimeDto;
import com.universe_view.simulation.dto.SimulationTimeRequestDto;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;

@Service
public class SimulationTimeService {

    private final AtomicReference<Instant> simTime     = new AtomicReference<>(Instant.now());
    private final AtomicReference<Double>  speed       = new AtomicReference<>(1.0);
    private final AtomicLong               lastWallMs  = new AtomicLong(System.currentTimeMillis());
    private volatile boolean               paused      = false;

    public SimulationTimeDto getState() {
        advance();
        return new SimulationTimeDto(simTime.get(), speed.get(), paused);
    }

    public SimulationTimeDto applyCommand(SimulationTimeRequestDto req) {
        if (req.simTime() != null) {
            simTime.set(req.simTime());
            lastWallMs.set(System.currentTimeMillis());
        }
        if (req.speedMultiplier() != null) {
            advance();
            speed.set(req.speedMultiplier());
            lastWallMs.set(System.currentTimeMillis());
        }
        if (req.paused() != null) {
            advance();
            paused = req.paused();
            lastWallMs.set(System.currentTimeMillis());
        }
        return getState();
    }

    public Instant getCurrentSimTime() {
        advance();
        return simTime.get();
    }

    private void advance() {
        if (paused) {
            lastWallMs.set(System.currentTimeMillis());
            return;
        }
        long   now     = System.currentTimeMillis();
        long   wallMs  = now - lastWallMs.getAndSet(now);
        long   simMs   = (long) (wallMs * speed.get());
        simTime.updateAndGet(t -> t.plusMillis(simMs));
    }
}
