const apiBaseUrl = process.env.NODE_ENV === "production"
  ? "/api"
  : "http://localhost:4000";

export function apiUrl(path: `/${string}`) {
  return `${apiBaseUrl}${path}`;
}
