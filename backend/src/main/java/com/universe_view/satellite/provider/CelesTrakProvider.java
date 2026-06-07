package com.universe_view.satellite.provider;

import com.universe_view.domain.model.Satellite;
import com.universe_view.domain.model.SpaceObjectCategory;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;

@Component("celestrakProvider")
public class CelesTrakProvider implements SatelliteProvider {

    private static final Logger log = LoggerFactory.getLogger(CelesTrakProvider.class);

    private static final String BASE_URL = "https://celestrak.org/SOCRATES/query.php";

    private static final Map<String, String> GROUP_URLS = Map.of(
            "active",   "https://celestrak.org/SOCRATES/query.php?GROUP=active&FORMAT=TLE",
            "iss",      "https://celestrak.org/SOCRATES/query.php?CATNR=25544&FORMAT=TLE",
            "starlink", "https://celestrak.org/SOCRATES/query.php?GROUP=starlink&FORMAT=TLE",
            "weather",  "https://celestrak.org/SOCRATES/query.php?GROUP=weather&FORMAT=TLE",
            "gps",      "https://celestrak.org/SOCRATES/query.php?GROUP=gps-ops&FORMAT=TLE"
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
        this.restClient = builder.build();
    }

    @Override
    public List<Satellite> fetchActive() {
        return fetch("active");
    }

    @Override
    public List<Satellite> fetchISS() {
        return fetch("iss");
    }

    @Override
    public List<Satellite> fetchStarlink() {
        return fetch("starlink");
    }

    @Override
    public List<Satellite> fetchByGroup(String group) {
        if (!GROUP_URLS.containsKey(group)) {
            throw new IllegalArgumentException("Unknown group: " + group);
        }
        return fetch(group);
    }

    @Override
    public String getProviderName() {
        return "CelesTrak";
    }

    private List<Satellite> fetch(String group) {
        String url      = GROUP_URLS.get(group);
        SpaceObjectCategory category = GROUP_CATEGORIES.getOrDefault(group, SpaceObjectCategory.OTHER_SATELLITE);

        log.info("Fetching TLEs from CelesTrak group={} url={}", group, url);

        String tleText = restClient.get()
                .uri(url)
                .retrieve()
                .body(String.class);

        if (tleText == null || tleText.isBlank()) {
            log.warn("Empty TLE response for group={}", group);
            return List.of();
        }

        List<Satellite> sats = TleParser.parse(tleText, category);
        log.info("Parsed {} satellites for group={}", sats.size(), group);
        return sats;
    }
}
