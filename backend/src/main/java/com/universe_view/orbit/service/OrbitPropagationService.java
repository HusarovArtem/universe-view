package com.universe_view.orbit.service;

import com.universe_view.domain.model.OrbitalElements;
import com.universe_view.domain.model.Satellite;
import com.universe_view.domain.valueobject.Position;
import com.universe_view.domain.valueobject.Velocity;
import com.universe_view.orbit.dto.OrbitPathDto;
import com.universe_view.orbit.dto.PropagatedStateDto;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Analytical Keplerian propagation service.
 * Replace with a Orekit-backed implementation in a future sprint by swapping this bean.
 */
@Service
public class OrbitPropagationService {

    private static final double EARTH_RADIUS_KM = 6371.0;
    private static final double MU_KM3_S2       = 398600.4418;
    private static final double TWO_PI          = 2 * Math.PI;
    private static final double DEG2RAD         = Math.PI / 180.0;

    public PropagatedStateDto propagate(Satellite satellite, Instant atTime) {
        OrbitalElements el = satellite.getOrbitalElements()
                .orElseThrow(() -> new IllegalArgumentException("No orbital elements for: " + satellite.getId()));

        double dtSec = (atTime.toEpochMilli() - el.getEpoch().toEpochMilli()) / 1000.0;
        double n     = el.getMeanMotionRevPerDay() * TWO_PI / 86400.0;
        double M     = (el.getMeanAnomalyDeg() * DEG2RAD + n * dtSec) % TWO_PI;
        double E     = solveKepler(M, el.getEccentricity());

        double nu    = 2 * Math.atan2(
                Math.sqrt(1 + el.getEccentricity()) * Math.sin(E / 2),
                Math.sqrt(1 - el.getEccentricity()) * Math.cos(E / 2)
        );

        double r     = el.getSemiMajorAxisKm() * (1 - el.getEccentricity() * Math.cos(E));

        double i     = el.getInclinationDeg()  * DEG2RAD;
        double om    = el.getRaanDeg()          * DEG2RAD;
        double w     = el.getArgPerigeeDeg()    * DEG2RAD;
        double u     = nu + w;

        double x = r * (Math.cos(om) * Math.cos(u) - Math.sin(om) * Math.sin(u) * Math.cos(i));
        double y = r * (Math.sin(om) * Math.cos(u) + Math.cos(om) * Math.sin(u) * Math.cos(i));
        double z = r * (Math.sin(u) * Math.sin(i));

        double p     = el.getSemiMajorAxisKm() * (1 - el.getEccentricity() * el.getEccentricity());
        double sqMup = Math.sqrt(MU_KM3_S2 / p);
        double vx = sqMup * (-Math.sin(om) * (Math.cos(w + nu) + el.getEccentricity() * Math.cos(w))
                + Math.cos(om) * (Math.sin(w + nu) + el.getEccentricity() * Math.sin(w)) * Math.cos(i));
        double vy = sqMup * ( Math.cos(om) * (Math.cos(w + nu) + el.getEccentricity() * Math.cos(w))
                + Math.sin(om) * (Math.sin(w + nu) + el.getEccentricity() * Math.sin(w)) * Math.cos(i));
        double vz = sqMup * (-(Math.sin(w + nu) + el.getEccentricity() * Math.sin(w)) * Math.sin(i));

        return new PropagatedStateDto(
                satellite.getId(),
                atTime,
                Position.eci(x, y, z),
                Velocity.eci(vx, vy, vz),
                r - EARTH_RADIUS_KM
        );
    }

    public OrbitPathDto computeOrbitPath(Satellite satellite, Instant startTime, int steps) {
        OrbitalElements el = satellite.getOrbitalElements()
                .orElseThrow(() -> new IllegalArgumentException("No orbital elements for: " + satellite.getId()));

        double periodMs  = el.getPeriodSeconds() * 1000.0;
        List<Position> points = new ArrayList<>(steps + 1);

        for (int i = 0; i <= steps; i++) {
            Instant t   = Instant.ofEpochMilli(startTime.toEpochMilli() + (long) (i * periodMs / steps));
            var state   = propagate(satellite, t);
            points.add(state.position());
        }

        return new OrbitPathDto(satellite.getId(), startTime, el.getPeriodSeconds(), points);
    }

    private double solveKepler(double M, double e) {
        double E = M;
        for (int i = 0; i < 50; i++) {
            double dE = (M - E + e * Math.sin(E)) / (1 - e * Math.cos(E));
            E += dE;
            if (Math.abs(dE) < 1e-10) break;
        }
        return E;
    }
}
