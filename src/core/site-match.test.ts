import { describe, expect, test } from "bun:test";
import { matchSites, distanceMeters, type SiteGeo } from "./site-match";
import { dailyState } from "./daily-availability";

const changi: SiteGeo = { id: "c", projectId: "pc", name: "Changi", lat: 1.3644, lng: 103.9915, radiusM: 500 };
const jurong: SiteGeo = { id: "j", projectId: "pj", name: "Jurong Island", lat: 1.2660, lng: 103.6990, radiusM: 500 };
const changiNear: SiteGeo = { ...changi, id: "c2", projectId: "pc2", lat: 1.3650 };

describe("site matching", () => {
  test("one site in range auto-assigns", () => {
    const m = matchSites({ lat: 1.3646, lng: 103.9916 }, [changi, jurong]);
    expect(m.status).toBe("single");
    if (m.status === "single") expect(m.site.id).toBe("c");
  });
  test("next day at Jurong matches Jurong", () => {
    const m = matchSites({ lat: 1.2661, lng: 103.6991 }, [changi, jurong]);
    expect(m.status === "single" && m.site.id).toBe("j");
  });
  test("two sites in range asks worker", () => {
    expect(matchSites({ lat: 1.3646, lng: 103.9915 }, [changi, changiNear]).status).toBe("multiple");
  });
  test("far away matches nothing", () => {
    expect(matchSites({ lat: 1.30, lng: 103.85 }, [changi, jurong]).status).toBe("none");
    expect(distanceMeters(changi, jurong)).toBeGreaterThan(30000);
  });
});

// 2026-11-26 is Thursday; 2026-11-29 Sunday. Times in UTC (SGT = UTC+8).
describe("daily availability", () => {
  const thu1130 = new Date("2026-11-26T03:30:00Z");
  const thu1201 = new Date("2026-11-26T04:01:00Z");
  const sun1300 = new Date("2026-11-29T05:00:00Z");
  test("no attendance after 12:00 → Available", () => expect(dailyState(thu1201, { checkedIn: false, onLeave: false })).toBe("available_no_attendance"));
  test("before 12:00 not yet Available", () => expect(dailyState(thu1130, { checkedIn: false, onLeave: false })).toBe("pending"));
  test("Sunday is weekly off", () => expect(dailyState(sun1300, { checkedIn: false, onLeave: false })).toBe("weekly_off"));
  test("leave (incl. medical) never Available", () => expect(dailyState(thu1201, { checkedIn: false, onLeave: true })).toBe("on_leave"));
  test("checked in → working, even Sunday", () => expect(dailyState(sun1300, { checkedIn: true, onLeave: false })).toBe("working"));
});
