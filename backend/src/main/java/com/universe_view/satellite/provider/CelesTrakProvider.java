package com.universe_view.satellite.provider;

import com.universe_view.domain.model.Satellite;
import com.universe_view.domain.model.SpaceObjectCategory;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;

@Component("celestrakProvider")
public class CelesTrakProvider implements SatelliteProvider {

    private static final Logger log = LoggerFactory.getLogger(CelesTrakProvider.class);

    private static final String GP_BASE = "https://celestrak.org/NORAD/elements/gp.php";

    private static final Map<String, String> GROUP_URLS = Map.of(
            "active",   GP_BASE + "?GROUP=ACTIVE&FORMAT=TLE",
            "iss",      GP_BASE + "?CATNR=25544&FORMAT=TLE",
            "starlink", GP_BASE + "?GROUP=STARLINK&FORMAT=TLE",
            "weather",  GP_BASE + "?GROUP=WEATHER&FORMAT=TLE",
            "gps",      GP_BASE + "?GROUP=GPS-OPS&FORMAT=TLE"
    );

    private static final Map<String, SpaceObjectCategory> GROUP_CATEGORIES = Map.of(
            "active",   SpaceObjectCategory.ACTIVE,
            "iss",      SpaceObjectCategory.ISS,
            "starlink", SpaceObjectCategory.STARLINK,
            "weather",  SpaceObjectCategory.WEATHER,
            "gps",      SpaceObjectCategory.GPS
    );

    private final RestClient restClient;

    public CelesTrakProvider(RestClient.Builder builder) {
        this.restClient = builder
                .defaultHeader("User-Agent", "UniverseView/1.0 (educational project)")
                .defaultHeader("Accept", "text/plain,text/html,*/*")
                .build();
    }

    @Override public List<Satellite> fetchActive()   { return fetchOrEmpty("active"); }
    @Override public List<Satellite> fetchISS()      { return fetchOrEmpty("iss"); }
    @Override public List<Satellite> fetchStarlink() { return fetchOrEmpty("starlink"); }

    @Override
    public List<Satellite> fetchByGroup(String group) {
        if (!GROUP_URLS.containsKey(group)) {
            throw new IllegalArgumentException("Unknown CelesTrak group: " + group);
        }
        return fetchOrEmpty(group);
    }

    @Override
    public String getProviderName() { return "CelesTrak"; }

    /**
     * Returns parsed satellites, or null when CelesTrak signals data hasn't changed (403).
     * Null = caller should keep existing cached data unchanged.
     * Never throws — all errors are logged and mapped to null.
     */
    public List<Satellite> fetchOrNull(String group) {
        String url              = GROUP_URLS.get(group);
        SpaceObjectCategory cat = GROUP_CATEGORIES.getOrDefault(group, SpaceObjectCategory.OTHER_SATELLITE);

        log.info("Fetching TLEs from CelesTrak group={}", group);

        try {
            String tleText = restClient.get()
                    .uri(url)
                    .retrieve()
                    .body(String.class);

            if (tleText == null || tleText.isBlank()) {
                log.warn("Empty TLE response for group={}", group);
                return null;
            }

            List<Satellite> sats = TleParser.parse(tleText, cat);
            log.info("Parsed {} satellites for group={}", sats.size(), group);
            return sats;

        } catch (HttpClientErrorException.Forbidden e) {
            // CelesTrak returns 403 when the data hasn't been updated since the last download.
            // This is documented behaviour — not an error. Serve from cache.
            log.info("CelesTrak group={} unchanged since last fetch (403) — cache remains valid", group);
            return null;

        } catch (HttpClientErrorException e) {
            log.error("CelesTrak HTTP {} for group={}: {}", e.getStatusCode(), group, e.getStatusText());
            return null;

        } catch (Exception e) {
            log.error("Error fetching CelesTrak group={}: {}", group, e.getMessage());
            return null;
        }
    }

    private List<Satellite> fetchOrEmpty(String group) {
        List<Satellite> result = fetchOrNull(group);
        return result != null ? result : List.of();
    }
}
