package com.universe_view.satellite.dto;

import com.universe_view.domain.model.OrbitalElements;

import java.time.Instant;

public record OrbitalElementsDto(
        double  semiMajorAxisKm,
        double  eccentricity,
        double  inclinationDeg,
        double  raanDeg,
        double  argPerigeeDeg,
        double  meanAnomalyDeg,
        double  meanMotionRevPerDay,
        double  periodSeconds,
        double  altitudeKm,
        Instant epoch,
        String  tleLine1,
        String  tleLine2
) {
    public static OrbitalElementsDto from(OrbitalElements el) {
        return new OrbitalElementsDto(
                el.getSemiMajorAxisKm(),
                el.getEccentricity(),
                el.getInclinationDeg(),
                el.getRaanDeg(),
                el.getArgPerigeeDeg(),
                el.getMeanAnomalyDeg(),
                el.getMeanMotionRevPerDay(),
                el.getPeriodSeconds(),
                el.getAltitudeKm(),
                el.getEpoch(),
                el.getTleLine1(),
                el.getTleLine2()
        );
    }
}
