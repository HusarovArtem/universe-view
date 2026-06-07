package com.universe_view.domain.valueobject;

public record Position(double x, double y, double z, String referenceFrame) {

    public static Position eci(double x, double y, double z) {
        return new Position(x, y, z, "ECI");
    }

    public static Position ecef(double x, double y, double z) {
        return new Position(x, y, z, "ECEF");
    }

    public double magnitude() {
        return Math.sqrt(x * x + y * y + z * z);
    }

    public double distanceTo(Position other) {
        double dx = x - other.x;
        double dy = y - other.y;
        double dz = z - other.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
}
