package com.universe_view.domain.valueobject;

public record Velocity(double vx, double vy, double vz, String referenceFrame) {

    public static Velocity eci(double vx, double vy, double vz) {
        return new Velocity(vx, vy, vz, "ECI");
    }

    public double magnitude() {
        return Math.sqrt(vx * vx + vy * vy + vz * vz);
    }
}
