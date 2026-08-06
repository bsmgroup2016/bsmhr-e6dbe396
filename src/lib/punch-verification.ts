/**
 * Pure selfie + GPS punch verification rules.
 *
 * Shared by the web punch screen, the API v1 endpoints and (later) the Flutter
 * apps — no framework, no network, no Supabase. Given a punch and the site's
 * geofence config it returns a verdict plus human-readable flags.
 */
import { distanceMeters } from "@/lib/qr-attendance";

export type GeoStatus = "inside" | "outside" | "unknown" | "no_site_geo";
export type PunchVerification = "verified" | "flagged" | "unverified";

export interface SiteGeofence {
  lat?: number | null;
  lng?: number | null;
  /** Allowed radius in metres (default 300 m). */
  radiusM?: number | null;
  /** Reject the punch outright when outside the radius. */
  enforced?: boolean | null;
  /** Selfie proof is mandatory at this site. */
  selfieRequired?: boolean | null;
}

export interface PunchProof {
  lat?: number | null;
  lng?: number | null;
  /** GPS accuracy reported by the device, in metres. */
  accuracyM?: number | null;
  /** Storage key of the uploaded selfie (from POST /v1/uploads). */
  selfieKey?: string | null;
}

export interface PunchVerdict {
  geoStatus: GeoStatus;
  distanceM: number | null;
  verification: PunchVerification;
  /** True when the punch must be refused (enforced geofence breach). */
  rejected: boolean;
  flags: string[];
  message: string | null;
}

export const DEFAULT_GEOFENCE_RADIUS_M = 300;
/** Above this the fix is too vague to trust as proof of presence. */
export const MAX_TRUSTED_ACCURACY_M = 150;

export function verifyPunch(proof: PunchProof, site?: SiteGeofence | null): PunchVerdict {
  const flags: string[] = [];
  const hasPunchGeo = proof.lat != null && proof.lng != null;
  const hasSiteGeo = Boolean(site && site.lat != null && site.lng != null);
  const radius = Math.max(25, Number(site?.radiusM ?? DEFAULT_GEOFENCE_RADIUS_M));

  let geoStatus: GeoStatus = "unknown";
  let distanceM: number | null = null;

  if (!hasPunchGeo) {
    flags.push("no_location");
  } else if (!hasSiteGeo) {
    geoStatus = "no_site_geo";
    flags.push("site_has_no_coordinates");
  } else {
    distanceM = distanceMeters(
      { lat: Number(proof.lat), lng: Number(proof.lng) },
      { lat: Number(site!.lat), lng: Number(site!.lng) },
    );
    geoStatus = distanceM <= radius ? "inside" : "outside";
    if (geoStatus === "outside") flags.push(`outside_geofence_${distanceM}m`);
  }

  if (proof.accuracyM != null && Number(proof.accuracyM) > MAX_TRUSTED_ACCURACY_M) {
    flags.push("low_gps_accuracy");
  }

  const selfieRequired = Boolean(site?.selfieRequired);
  if (!proof.selfieKey) flags.push(selfieRequired ? "selfie_missing" : "no_selfie");

  const rejected =
    Boolean(site?.enforced) &&
    (geoStatus === "outside" || (selfieRequired && !proof.selfieKey));

  let verification: PunchVerification = "unverified";
  if (geoStatus === "inside" && proof.selfieKey && !flags.includes("low_gps_accuracy")) {
    verification = "verified";
  } else if (geoStatus === "outside" || flags.includes("selfie_missing")) {
    verification = "flagged";
  }

  const message = rejected
    ? geoStatus === "outside"
      ? `You are ${distanceM} m from the site (allowed ${radius} m). Move closer and try again.`
      : "A selfie is required to punch at this site."
    : verification === "flagged"
      ? "Punch saved but flagged for supervisor review."
      : null;

  return { geoStatus, distanceM, verification, rejected, flags, message };
}
