package com.universe_view.domain.model;

import com.universe_view.domain.valueobject.Position;
import com.universe_view.domain.valueobject.Velocity;

import java.time.Instant;

public abstract class SpaceObject {

    protected final String id;
    protected final String name;
    protected final SpaceObjectType type;
    protected Position position;
    protected Velocity velocity;
    protected final Instant discoveredAt;

    protected SpaceObject(String id, String name, SpaceObjectType type, Instant discoveredAt) {
        this.id           = id;
        this.name         = name;
        this.type         = type;
        this.discoveredAt = discoveredAt;
    }

    public String          getId()           { return id; }
    public String          getName()         { return name; }
    public SpaceObjectType getType()         { return type; }
    public Position        getPosition()     { return position; }
    public Velocity        getVelocity()     { return velocity; }
    public Instant         getDiscoveredAt() { return discoveredAt; }

    public void setPosition(Position position) { this.position = position; }
    public void setVelocity(Velocity velocity) { this.velocity = velocity; }

    public abstract SpaceObjectCategory getCategory();
}
