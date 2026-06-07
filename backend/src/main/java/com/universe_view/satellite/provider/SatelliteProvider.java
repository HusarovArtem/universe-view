package com.universe_view.satellite.provider;

import com.universe_view.domain.model.Satellite;

import java.util.List;

public interface SatelliteProvider {
    List<Satellite> fetchActive();
    List<Satellite> fetchISS();
    List<Satellite> fetchStarlink();
    List<Satellite> fetchByGroup(String group);
    String          getProviderName();
}
