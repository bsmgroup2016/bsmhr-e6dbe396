import { createServerFn } from "@tanstack/react-start";

/** Returns the website-restricted Google Maps browser key (safe to expose to the browser). */
export const getGoogleMapsKey = createServerFn({ method: "GET" }).handler(async () => {
  return { key: process.env["GOOGLE_MAPS_API_KEY"] ?? "" };
});
