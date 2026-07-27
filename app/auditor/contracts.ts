export const auditorEndpoints = {
  list: "/auditor/events?limit=200",
  detail: (id: string) => `/auditor/events/${encodeURIComponent(id)}`,
  verify: (id: string) => `/auditor/events/${encodeURIComponent(id)}/verify`,
};
