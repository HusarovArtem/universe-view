package com.universe_view.satellite.service;

import com.universe_view.domain.model.Satellite;
import com.universe_view.satellite.provider.CelesTrakProvider;
import com.universe_view.satellite.provider.SatelliteProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class SatelliteDataService {

    private static final Logger log = LoggerFactory.getLogger(SatelliteDataService.class);

    // In-memory store: group name → satellite list (never null once populated)
    private final Map<String, List<Satellite>> groupCache    = new ConcurrentHashMap<>();
    // Tracks last successful fetch time per group for logging/debugging
    private final Map<String, Instant>         lastFetchedAt = new ConcurrentHashMap<>();
    // Flat index for O(1) findById
    private final Map<String, Satellite>       index         = new ConcurrentHashMap<>();

    private final CelesTrakProvider provider;

    public SatelliteDataService(SatelliteProvider provider) {
        // Cast is safe — CelesTrakProvider is the only registered bean
        this.provider = (CelesTrakProvider) provider;
    }

    // ── Public API ────────────────────────────────────────────────────────────

    public List<Satellite> getByGroup(String group) {
        String key = group.toLowerCase();
        List<Satellite> cached = groupCache.get(key);

        if (cached != null) {
            log.debug("Serving group={} from in-memory cache ({} sats)", key, cached.size());
            return cached;
        }

        // First-time load
        return refreshGroup(key);
    }

    public Optional<Satellite> findById(String id) {
        Satellite sat = index.get(id);
        if (sat != null) return Optional.of(sat);
        // Index empty — trigger a load of active group to populate it
        if (index.isEmpty()) refreshGroup("active");
        return Optional.ofNullable(index.get(id));
    }

    // ── Scheduled refresh — every 2 hours, matching CelesTrak's update cycle ──

    @Scheduled(fixedDelay = 2 * 60 * 60 * 1000) // 2 hours in ms
    public void scheduledRefresh() {
        log.info("Scheduled TLE refresh starting for {} cached groups", groupCache.size());
        for (String group : groupCache.keySet()) {
            refreshGroup(group);
        }
    }

    // ── Internal ──────────────────────────────────────────────────────────────

    private List<Satellite> refreshGroup(String group) {
        List<Satellite> fresh = provider.fetchOrNull(group);

        if (fresh == null) {
            // CelesTrak said data unchanged (403) — serve whatever we have
            List<Satellite> existing = groupCache.get(group);
            if (existing != null) {
                log.info("group={} unchanged at CelesTrak, serving {} cached sats", group, existing.size());
                return existing;
            }
            // We have no cache at all (first boot + 403) — return empty, will retry next call
            log.warn("group={} returned 403 on first fetch — no cache available yet", group);
            return Collections.emptyList();
        }

        // Fresh data received — update cache and index
        groupCache.put(group, fresh);
        lastFetchedAt.put(group, Instant.now());
        indexSatellites(fresh);
        log.info("group={} cache updated: {} satellites", group, fresh.size());
        return fresh;
    }

    private void indexSatellites(List<Satellite> sats) {
        for (Satellite sat : sats) {
            index.put(sat.getId(), sat);
        }
    }
}
