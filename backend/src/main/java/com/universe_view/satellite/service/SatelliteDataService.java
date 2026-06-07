package com.universe_view.satellite.service;

import com.universe_view.domain.model.Satellite;
import com.universe_view.satellite.provider.SatelliteProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class SatelliteDataService {

    private static final Logger log = LoggerFactory.getLogger(SatelliteDataService.class);

    private final SatelliteProvider provider;
    private final Map<String, Satellite> index = new ConcurrentHashMap<>();

    public SatelliteDataService(SatelliteProvider provider) {
        this.provider = provider;
    }

    @Cacheable("satellites-active")
    public List<Satellite> getActive() {
        List<Satellite> sats = provider.fetchActive();
        indexSatellites(sats);
        return sats;
    }

    @Cacheable("satellites-iss")
    public List<Satellite> getISS() {
        List<Satellite> sats = provider.fetchISS();
        indexSatellites(sats);
        return sats;
    }

    @Cacheable("satellites-starlink")
    public List<Satellite> getStarlink() {
        List<Satellite> sats = provider.fetchStarlink();
        indexSatellites(sats);
        return sats;
    }

    public List<Satellite> getByGroup(String group) {
        return switch (group.toLowerCase()) {
            case "iss"      -> getISS();
            case "starlink" -> getStarlink();
            default         -> getActive();
        };
    }

    public Optional<Satellite> findById(String id) {
        // Try existing index first before triggering a full fetch
        Satellite cached = index.get(id);
        if (cached != null) return Optional.of(cached);
        // Trigger active load to populate index
        getActive();
        return Optional.ofNullable(index.get(id));
    }

    @Scheduled(fixedDelayString = "PT6H")
    @CacheEvict(value = { "satellites-active", "satellites-iss", "satellites-starlink" }, allEntries = true)
    public void evictCaches() {
        index.clear();
        log.info("Satellite TLE caches evicted — will reload on next request");
    }

    private void indexSatellites(List<Satellite> sats) {
        for (Satellite sat : sats) {
            index.put(sat.getId(), sat);
        }
    }
}
