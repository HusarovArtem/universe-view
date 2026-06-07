package com.universe_view.satellite.dto;

import com.universe_view.domain.model.OrbitalElements;
import com.universe_view.domain.model.Satellite;
import com.universe_view.domain.model.SpaceObjectCategory;

import java.time.Instant;

public record SatelliteDto(
        String              id,
        String              name,
        String              noradId,
        String              cosparId,
        SpaceObjectCategory category,
        String              country,
        Instant             launchDate,
        OrbitalElementsDto  orbitalElements
) {
    public static SatelliteDto from(Satellite sat) {
        return new SatelliteDto(
                sat.getId(),
                sat.getName(),
                sat.getNoradId(),
                sat.getCosparId().orElse(null),
                sat.getCategory(),
                sat.getCountry(),
                sat.getLaunchDate().orElse(null),
                sat.getOrbitalElements().map(OrbitalElementsDto::from).orElse(null)
        );
    }
}
