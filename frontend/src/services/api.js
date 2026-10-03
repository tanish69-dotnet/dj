import axios from 'axios';

// Production serves the SPA and API from the same origin, so the default is the
// relative '/api'. Local development sets VITE_API_URL in frontend/.env to the
// local backend; if that file is missing a localhost port is used as a last
// resort so the dev server still works.
const LOCAL_API_URL = 'http://127.0.0.1:8010/api';
const API_URL = (import.meta.env.VITE_API_URL || '').trim()
  || (import.meta.env.DEV ? LOCAL_API_URL : '/api');

// The selector value is either "INDIA" (national scope) or a city name.
// "INDIA" and empty values are omitted so the backend returns the aggregate view.
export const cityQuery = (city) => (!city || city === 'INDIA') ? '' : `?city=${encodeURIComponent(city)}`;

const query = (city, ...extra) => {
  const parts = [...extra];
  if (city && city !== 'INDIA') parts.push(`city=${encodeURIComponent(city)}`);
  return parts.length ? `?${parts.join('&')}` : '';
};

export const api = {
    getCities:      () => axios.get(`${API_URL}/cities`),
    getDashboard:   (city) => axios.get(`${API_URL}/dashboard${cityQuery(city)}`),
    getLocations:   (city) => axios.get(`${API_URL}/locations${cityQuery(city)}`),
    getRoads:       (city) => axios.get(`${API_URL}/roads${cityQuery(city)}`),
    updateRoadStatus: (id, status) => axios.post(`${API_URL}/roads/${id}/status?status=${encodeURIComponent(status)}`),
    getDemands:     (city) => axios.get(`${API_URL}/demands${cityQuery(city)}`),
    getIncidents:   (city) => axios.get(`${API_URL}/incidents${cityQuery(city)}`),
    getResources:   () => axios.get(`${API_URL}/resources`),
    getInventory:   (city) => axios.get(`${API_URL}/inventory${cityQuery(city)}`),
    getAllocations: (city) => axios.get(`${API_URL}/allocations${cityQuery(city)}`),
    runAllocations: (city) => axios.post(`${API_URL}/allocations/run${cityQuery(city)}`),
    updateAllocationStatus: (id, status) => axios.post(`${API_URL}/allocations/${id}/status?status=${encodeURIComponent(status)}`),
    getAllocationRoutes: (id) => axios.get(`${API_URL}/allocations/${id}/routes`),
    getFunds:       (city) => axios.get(`${API_URL}/funds${cityQuery(city)}`),
    getAudit:       (city) => axios.get(`${API_URL}/audit${cityQuery(city)}`),
    verifyAudit:    () => axios.get(`${API_URL}/audit/verify`),
    triggerEvent:   (eventType, city) => axios.post(`${API_URL}/simulation/event${query(city, `event_type=${encodeURIComponent(eventType)}`)}`),
    resetSimulation: () => axios.post(`${API_URL}/simulation/reset`),
getScenarioBlueprint: (city) => axios.get(`${API_URL}/scenario/blueprint${cityQuery(city)}`),
    getAIStatus:      (city) => axios.get(`${API_URL}/ai/status${cityQuery(city)}`),
    askAI:            (message, city) => axios.post(`${API_URL}/ai/chat`, { message, city: city || null })
};