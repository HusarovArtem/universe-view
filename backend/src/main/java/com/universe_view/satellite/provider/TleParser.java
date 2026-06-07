package com.universe_view.satellite.provider;

import com.universe_view.domain.model.OrbitalElements;
import com.universe_view.domain.model.Satellite;
import com.universe_view.domain.model.SpaceObjectCategory;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;

public final class TleParser {

    private static final double EARTH_RADIUS_KM = 6371.0;
    private static final double MU_KM3_S2       = 398600.4418;
    private static final double TWO_PI          = 2 * Math.PI;

    private TleParser() {}

    public static List<Satellite> parse(String tleText, SpaceObjectCategory category) {
        String[] lines  = tleText.strip().split("\\r?\\n");
        List<Satellite> result = new ArrayList<>();

        for (int i = 0; i < lines.length - 2; i += 3) {
            try {
                String name  = lines[i].trim().replaceFirst("^0 ", "");
                String line1 = lines[i + 1].trim();
                String line2 = lines[i + 2].trim();

                if (!line1.startsWith("1 ") || !line2.startsWith("2 ")) continue;

                OrbitalElements elements = parseElements(line1, line2);
                String noradId           = line1.substring(2, 7).trim();

                Satellite sat = Satellite.builder()
                        .id("tle-" + noradId)
                        .name(name)
                        .noradId(noradId)
                        .cosparId(line1.substring(9, 17).trim())
                        .category(category)
                        .discoveredAt(elements.getEpoch())
                        .orbitalElements(elements)
                        .build();

                result.add(sat);
            } catch (Exception ignored) {
                // malformed TLE — skip and continue
            }
        }

        return result;
    }

    private static OrbitalElements parseElements(String line1, String line2) {
        int    epochYear2d   = Integer.parseInt(line1.substring(18, 20).trim());
        double epochDay      = Double.parseDouble(line1.substring(20, 32).trim());
        int    fullYear      = epochYear2d < 57 ? 2000 + epochYear2d : 1900 + epochYear2d;

        long epochMs = LocalDate.of(fullYear, 1, 1)
                .atStartOfDay(ZoneOffset.UTC)
                .toInstant()
                .toEpochMilli()
                + (long) ((epochDay - 1) * 86400_000L);

        double inclinationDeg  = Double.parseDouble(line2.substring(8,  16).trim());
        double raanDeg         = Double.parseDouble(line2.substring(17, 25).trim());
        double eccentricity    = Double.parseDouble("0." + line2.substring(26, 33).trim());
        double argPerigeeDeg   = Double.parseDouble(line2.substring(34, 42).trim());
        double meanAnomalyDeg  = Double.parseDouble(line2.substring(43, 51).trim());
        double meanMotion      = Double.parseDouble(line2.substring(52, 63).trim());

        double n               = meanMotion * TWO_PI / 86400.0;
        double semiMajorAxisKm = Math.cbrt(MU_KM3_S2 / (n * n));

        return OrbitalElements.builder()
                .semiMajorAxisKm(semiMajorAxisKm)
                .eccentricity(eccentricity)
                .inclinationDeg(inclinationDeg)
                .raanDeg(raanDeg)
                .argPerigeeDeg(argPerigeeDeg)
                .meanAnomalyDeg(meanAnomalyDeg)
                .meanMotionRevPerDay(meanMotion)
                .epoch(Instant.ofEpochMilli(epochMs))
                .tleLine1(line1)
                .tleLine2(line2)
                .build();
    }
}
