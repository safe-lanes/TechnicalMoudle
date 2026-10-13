import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const { harness, metadataKeys, withoutMetadata } = createRequire(import.meta.url)(
  "./helpers/authContextProbe.cjs",
);
const nullMetadata = Object.fromEntries(metadataKeys.map((key: string) => [key, null]));
const fleet = [{ vesselId: "ship-fixture", vessel: "Fixture Vessel", imoNumber: "1234567" }];

function fixture(userType: string, role: string) {
  return {
    id: 7, username: "fixture-login", fullName: "Fixture User", email: "fixture@example.invalid",
    userUuid: "identity-fixture", userId: "identity-fixture", userType, role,
    vesselId: "ship-fixture", department: "Deck", isActive: true,
    crewDesignation: "Fixture Designation", rank_name: "Master",
    createdAt: new Date(0), updatedAt: new Date(1), myVessels: fleet,
    password: "must-not-escape", arbitraryExtra: "must-not-escape",
  };
}

function decisions(value: any) {
  return {
    authenticated: value.isAuthenticated, ship: value.isShipUser, office: value.isOfficeUser,
    admin: value.isPMSAdmin, role: value.userType,
    resolution: withoutMetadata(value.uiRoleResolution),
    hasShip: value.hasRole("Ship"), hasOffice: value.hasRole(["Office", "Sail Admin"]),
    view: [value.canViewDocument(false), value.canViewDocument(true)],
    download: [value.canDownloadDocument(false), value.canDownloadDocument(true)],
    modify: value.canModifyData(), approve: value.canApproveChanges(),
    fleet: value.myVessels, domain: value.domain,
  };
}

function sameBehavior(before: any, after: any) {
  expect(withoutMetadata(after.value.currentUser)).toEqual(withoutMetadata(before.value.currentUser));
  expect(decisions(after.value)).toEqual(decisions(before.value));
  expect(withoutMetadata(after.events)).toEqual(withoutMetadata(before.events));
  expect(after.reads).toEqual(before.reads);
}

function checkCapture(h: any, invalidationCount = 1) {
  const requests = h.events.filter((event: any[]) => event[0] === "request");
  expect(requests).toEqual([
    ["request", "POST", "/technical/api/shipskart/vessel-assignments", { myVessels: fleet }],
  ]);
  const identityIndex = h.events.findIndex((event: any[]) =>
    event[0] === "identity" && event[1]?.userId === "identity-fixture");
  const requestIndex = h.events.findIndex((event: any[]) => event[0] === "request");
  expect(identityIndex).toBeGreaterThanOrEqual(0);
  expect(identityIndex).toBeLessThan(requestIndex);
  expect(h.events[identityIndex][1]).toEqual({
    userId: "identity-fixture", name: "Fixture User", email: "fixture@example.invalid",
    userType: h.value.currentUser.userType, role: h.value.currentUser.role,
  });
  expect(h.events.filter((event: any[]) => event[0] === "invalidate"))
    .toEqual(Array.from({ length: invalidationCount }, () => ["invalidate", [true, true, false, false]]));
}

describe("AuthContext metadata: offline actual-provider probes", () => {
  it("fresh Replit default adds unknown metadata only, with one user state update", () => {
    const after = harness({ replit: true });
    sameBehavior(harness({ before: true, replit: true }), after);
    expect(after.value.currentUser).toMatchObject(nullMetadata);
    expect(after.events.filter((e: any[]) => e[0] === "state" && e[1] === 0)).toHaveLength(1);
    expect(after.events.filter((e: any[]) => e[0] === "request")).toHaveLength(0);
  });

  it.each([["Ship", "Ship"], ["Office", "Office"], ["Office", "Sail Admin"]])(
    "encrypted hydration preserves identity, role/data decisions and capture for %s/%s",
    (userType, role) => {
      const options = { userType, profile: {
        ...fixture(userType, role), isSync: true, isDeleted: true,
        createdByUuid: "untrusted-creator", updatedByUuid: "untrusted-updater", sortOrder: 99,
      } };
      const after = harness(options);
      const before = harness({ ...options, before: true });
      sameBehavior(before, after);
      expect(after.value.currentUser).toMatchObject(nullMetadata);
      expect(after.value.currentUser).not.toHaveProperty("password");
      expect(after.value.currentUser).not.toHaveProperty("arbitraryExtra");
      checkCapture(after);
      expect(after.events.filter((e: any[]) => e[0] === "state" && e[1] === 0)).toHaveLength(1);
      before.value.login(fixture(userType, role));
      after.value.login(fixture(userType, role));
      before.render();
      after.render();
      sameBehavior(before, after);
      checkCapture(after, 2); // Once-per-user capture guard also applies to explicit login.
    },
  );

  const metadataCases = [
    { isSync: true, isDeleted: true, createdByUuid: "creator-fixture", updatedByUuid: "updater-fixture", sortOrder: 9 },
    { isSync: false, isDeleted: false, createdByUuid: "", updatedByUuid: "", sortOrder: 0 },
    nullMetadata,
    {},
    Object.fromEntries(metadataKeys.map((key: string) => [key, undefined])),
  ];
  for (const [userType, role] of [["Ship", "Ship"], ["Office", "Office"], ["Office", "Sail Admin"]]) {
    it.each(metadataCases)(`explicit login allowlists metadata without changing ${userType}/${role} behavior: %j`,
      metadata => {
        const options = { userType, profile: fixture(userType, role), marker: true, rankChanged: false };
        const before = harness({ ...options, before: true }), after = harness(options);
        before.sessionStorage.removeItem("pms.vesselAssignmentsPosted:identity-fixture");
        after.sessionStorage.removeItem("pms.vesselAssignmentsPosted:identity-fixture");
        before.events.length = after.events.length = 0;
        const input = { ...fixture(userType, role), ...metadata };
        before.value.login(input);
        after.value.login(input);
        before.render();
        after.render();
        sameBehavior(before, after);
        const user = after.value.currentUser;
        for (const key of metadataKeys) expect(user[key]).toBe(input[key] ?? null);
        expect(user).not.toHaveProperty("password");
        expect(user).not.toHaveProperty("arbitraryExtra");
        expect(user).not.toHaveProperty("myVessels");
        expect(user.isActive).toBe(true); // isDeleted true is inert metadata, not an auth guard.
        expect(after.localStorage.getItem("pms_logged_out")).toBeNull();
        expect(after.events.filter((e: any[]) => e[0] === "state" && e[1] === 0)).toHaveLength(1);
        expect(after.events.filter((e: any[]) => e[0] === "invalidate")).toHaveLength(0);
        const identityIndex = after.events.findIndex((e: any[]) => e[0] === "identity");
        const requestIndex = after.events.findIndex((e: any[]) => e[0] === "request");
        expect(identityIndex).toBeLessThan(requestIndex);
        expect(after.events.filter((e: any[]) => e[0] === "request")).toEqual([
          ["request", "POST", "/technical/api/shipskart/vessel-assignments", { myVessels: fleet }],
        ]);
      });
  }

  it.each([
    { replit: false },
    { replit: false, corrupt: true },
    { replit: false, plaintext: fixture("Office", "Sail Admin") },
    { replit: false, profile: fixture("Office", "Sail Admin") }, // Missing encrypted userType.
    { replit: false, userType: "Office" }, // Missing encrypted profile.
    { replit: true, marker: true },
    { replit: true, marker: true, corrupt: true },
    { replit: true, marker: true, plaintext: fixture("Office", "Sail Admin") },
  ])("signed-out and intentional-logout guards are unchanged: %j", options => {
    const after = harness(options);
    sameBehavior(harness({ ...options, before: true }), after);
    expect(after.value.currentUser).toBeNull();
    expect(after.value.isAuthenticated).toBe(false);
    expect(after.value.myVessels).toEqual([]);
    expect(after.events.filter((e: any[]) => e[0] === "request")).toHaveLength(0);
    expect(after.events.filter((e: any[]) => e[0] === "identity")).toEqual([["identity", null]]);
  });

  it.each([{ corrupt: true }, { plaintext: fixture("Office", "Sail Admin") }])(
    "unreadable credentials in fresh Replit use only the pre-existing default: %j", options => {
      const after = harness({ ...options, replit: true });
      sameBehavior(harness({ ...options, replit: true, before: true }), after);
      expect(after.value.currentUser.id).toBe(1);
      expect(after.value.currentUser).toMatchObject(nullMetadata);
      expect(after.value.myVessels).toEqual([]);
      expect(after.events.filter((e: any[]) => e[0] === "request")).toHaveLength(0);
    },
  );

  it("logout retains storage clearing, marker suppression, and same-tab recapture", () => {
    const options = { replit: true, userType: "Ship", profile: fixture("Ship", "Ship") };
    const before = harness({ ...options, before: true }), after = harness(options);
    before.value.logout();
    after.value.logout();
    before.render();
    after.render();
    sameBehavior(before, after);
    expect(after.value.currentUser).toBeNull();
    expect(after.value.domain).toBeNull();
    expect(after.value.myVessels).toEqual([]);
    expect(after.localStorage.getItem("userProfile")).toBeNull();
    expect(after.localStorage.getItem("userType")).toBeNull();
    expect(after.localStorage.getItem("domain")).toBeNull();
    expect(after.localStorage.getItem("pms_logged_out")).toBe("1");
    expect(after.sessionStorage.getItem("pms.vesselAssignmentsPosted:identity-fixture")).toBeNull();
    expect(after.events.filter((e: any[]) => e[0] === "request")).toEqual([
      ["request", "POST", "/technical/api/shipskart/vessel-assignments", { myVessels: fleet }],
      ["request", "POST", "/technical/api/shipskart/sso/logout", { role: "Ship" }],
    ]);
    expect(after.events.filter((e: any[]) => e[0] === "state" && e[1] === 0)).toHaveLength(2);
    expect(after.events.filter((e: any[]) => e[0] === "clearQueries")).toEqual([["clearQueries"]]);
    // Model the encrypted storage written by the external login, without any API.
    const restored = harness(options);
    for (const h of [before, after]) {
      h.localStorage.setItem("userProfile", restored.localStorage.getItem("userProfile"));
      h.value.login(fixture("Ship", "Ship"));
      h.render();
    }
    sameBehavior(before, after);
    expect(after.events.filter((e: any[]) => e[0] === "request" &&
      e[2] === "/technical/api/shipskart/vessel-assignments")).toHaveLength(2);
    expect(after.localStorage.getItem("pms_logged_out")).toBeNull();
  });
});
