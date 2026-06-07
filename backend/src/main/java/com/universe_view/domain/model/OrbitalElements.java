package com.universe_view.domain.model;

import java.time.Instant;

public class OrbitalElements {

    private static final double EARTH_RADIUS_KM = 6371.0;
    private static final double MU_KM3_S2       = 398600.4418;
    private static final double TWO_PI          = 2 * Math.PI;

    private final double semiMajorAxisKm;
    private final double eccentricity;
    private final double inclinationDeg;
    private final double raanDeg;
    private final double argPerigeeDeg;
    private final double meanAnomalyDeg;
    private final double meanMotionRevPerDay;
    private final Instant epoch;
    private final String tleLine1;
    private final String tleLine2;

    private OrbitalElements(Builder b) {
        this.semiMajorAxisKm     = b.semiMajorAxisKm;
        this.eccentricity        = b.eccentricity;
        this.inclinationDeg      = b.inclinationDeg;
        this.raanDeg             = b.raanDeg;
        this.argPerigeeDeg       = b.argPerigeeDeg;
        this.meanAnomalyDeg      = b.meanAnomalyDeg;
        this.meanMotionRevPerDay = b.meanMotionRevPerDay;
        this.epoch               = b.epoch;
        this.tleLine1            = b.tleLine1;
        this.tleLine2            = b.tleLine2;
    }

    public double  getSemiMajorAxisKm()     { return semiMajorAxisKm; }
    public double  getEccentricity()        { return eccentricity; }
    public double  getInclinationDeg()      { return inclinationDeg; }
    public double  getRaanDeg()             { return raanDeg; }
    public double  getArgPerigeeDeg()       { return argPerigeeDeg; }
    public double  getMeanAnomalyDeg()      { return meanAnomalyDeg; }
    public double  getMeanMotionRevPerDay() { return meanMotionRevPerDay; }
    public Instant getEpoch()               { return epoch; }
    public String  getTleLine1()            { return tleLine1; }
    public String  getTleLine2()            { return tleLine2; }

    public double getPeriodSeconds()  { return 86400.0 / meanMotionRevPerDay; }
    public double getAltitudeKm()     { return semiMajorAxisKm - EARTH_RADIUS_KM; }

    public static Builder builder() { return new Builder(); }

    public static final class Builder {
        private double  semiMajorAxisKm, eccentricity, inclinationDeg;
        private double  raanDeg, argPerigeeDeg, meanAnomalyDeg, meanMotionRevPerDay;
        private Instant epoch;
        private String  tleLine1, tleLine2;

        public Builder semiMajorAxisKm(double v)     { this.semiMajorAxisKm = v;     return this; }
        public Builder eccentricity(double v)         { this.eccentricity = v;         return this; }
        public Builder inclinationDeg(double v)       { this.inclinationDeg = v;       return this; }
        public Builder raanDeg(double v)              { this.raanDeg = v;              return this; }
        public Builder argPerigeeDeg(double v)        { this.argPerigeeDeg = v;        return this; }
        public Builder meanAnomalyDeg(double v)       { this.meanAnomalyDeg = v;       return this; }
        public Builder meanMotionRevPerDay(double v)  { this.meanMotionRevPerDay = v;  return this; }
        public Builder epoch(Instant v)               { this.epoch = v;               return this; }
        public Builder tleLine1(String v)             { this.tleLine1 = v;            return this; }
        public Builder tleLine2(String v)             { this.tleLine2 = v;            return this; }

        public OrbitalElements build() { return new OrbitalElements(this); }
    }
}
