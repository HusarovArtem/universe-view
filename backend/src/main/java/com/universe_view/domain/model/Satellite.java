package com.universe_view.domain.model;

import java.time.Instant;
import java.util.Optional;

public class Satellite extends SpaceObject {

    private final String          noradId;
    private final String          cosparId;
    private final SpaceObjectCategory category;
    private final String          country;
    private final Instant         launchDate;
    private       OrbitalElements orbitalElements;

    private Satellite(Builder b) {
        super(b.id, b.name, SpaceObjectType.SATELLITE, b.discoveredAt);
        this.noradId          = b.noradId;
        this.cosparId         = b.cosparId;
        this.category         = b.category;
        this.country          = b.country;
        this.launchDate       = b.launchDate;
        this.orbitalElements  = b.orbitalElements;
    }

    public String                 getNoradId()         { return noradId; }
    public Optional<String>       getCosparId()        { return Optional.ofNullable(cosparId); }
    public String                 getCountry()         { return country; }
    public Optional<Instant>      getLaunchDate()      { return Optional.ofNullable(launchDate); }
    public Optional<OrbitalElements> getOrbitalElements() { return Optional.ofNullable(orbitalElements); }

    @Override public SpaceObjectCategory getCategory() { return category; }

    public void setOrbitalElements(OrbitalElements elements) { this.orbitalElements = elements; }

    public static Builder builder() { return new Builder(); }

    public static final class Builder {
        private String          id, name, noradId, cosparId, country;
        private SpaceObjectCategory category = SpaceObjectCategory.OTHER_SATELLITE;
        private Instant         discoveredAt = Instant.now();
        private Instant         launchDate;
        private OrbitalElements orbitalElements;

        public Builder id(String v)                   { this.id = v;              return this; }
        public Builder name(String v)                 { this.name = v;            return this; }
        public Builder noradId(String v)              { this.noradId = v;         return this; }
        public Builder cosparId(String v)             { this.cosparId = v;        return this; }
        public Builder category(SpaceObjectCategory v){ this.category = v;        return this; }
        public Builder country(String v)              { this.country = v;         return this; }
        public Builder launchDate(Instant v)          { this.launchDate = v;      return this; }
        public Builder discoveredAt(Instant v)        { this.discoveredAt = v;    return this; }
        public Builder orbitalElements(OrbitalElements v){ this.orbitalElements = v; return this; }

        public Satellite build() {
            if (id == null || noradId == null || name == null)
                throw new IllegalStateException("id, name, noradId are required");
            return new Satellite(this);
        }
    }
}
