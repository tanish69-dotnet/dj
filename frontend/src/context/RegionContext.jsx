import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../services/api";
import { INDIA_CENTER, OPERATIONAL_CITIES, regionSubtitle, regionTitle } from "../config/cities";

const RegionContext = createContext(null);

export function RegionProvider({ children }) {
  const [region, setRegion] = useState("INDIA"); // INDIA | city name
  // Backend /api/cities is the single source of truth for the selector. The
  // bundled config is only a fallback so the shell still renders if the API is
  // briefly unreachable.
  const [cities, setCities] = useState(OPERATIONAL_CITIES);
  const [indiaCenter, setIndiaCenter] = useState(INDIA_CENTER);
  const [citiesOnline, setCitiesOnline] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.getCities()
      .then(({ data }) => {
        if (cancelled) return;
        if (data?.cities && Object.keys(data.cities).length) {
          setCities(data.cities);
          setCitiesOnline(true);
        }
        if (data?.india_center) setIndiaCenter(data.india_center);
      })
      .catch(() => { /* keep bundled fallback */ });
    return () => { cancelled = true; };
  }, []);

  const value = useMemo(() => {
    const cfg = region && region !== "INDIA" ? cities[region] : null;
    const center = cfg
      ? { lat: cfg.lat, lng: cfg.lng, zoom: 12 }
      : { ...indiaCenter };
    return {
      region,
      city: region === "INDIA" ? null : region,
      isIndia: region === "INDIA",
      setRegion,
      cities,
      cityList: Object.keys(cities),
      citiesOnline,
      indiaCenter,
      mapCenter: center,
      stateName: cfg?.state ?? null,
      population: cfg?.population ?? null,
      title: regionTitle(region, cities),
      subtitle: regionSubtitle(region, cities),
    };
  }, [region, cities, citiesOnline, indiaCenter]);

  return (
    <RegionContext.Provider value={value}>
      {children}
    </RegionContext.Provider>
  );
}

export function useRegion() {
  const ctx = useContext(RegionContext);
  if (!ctx) throw new Error("useRegion must be used inside <RegionProvider>");
  return ctx;
}