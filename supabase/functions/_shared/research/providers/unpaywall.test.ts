import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { unpaywall } from "./unpaywall.ts";
import type { Fetcher } from "./types.ts";

const fixtures = JSON.parse(
  readFileSync(fileURLToPath(new URL("../fixtures/unpaywall-synthetic.json", import.meta.url)), "utf8"),
);

const service = unpaywall({ contactEmail: "someone@example.org" });
const returning = (body: unknown, ok = true, status = 200): Fetcher =>
  async () => ({ ok, status, json: async () => body });

describe("constructing the adapter", () => {
  // The API requires an email rather than merely asking for one, so refusing
  // here beats making a request that comes back 422 with a message nobody reads.
  it("refuses without a contact email", () => {
    expect(() => unpaywall({ contactEmail: "" })).toThrow(/contact email/);
    expect(() => unpaywall({ contactEmail: "not-an-address" })).toThrow(/contact email/);
  });
});

describe("locating an open copy", () => {
  it("finds a published open version", async () => {
    const outcome = await service.locate("10.1000/x", returning(fixtures.published));
    expect(outcome.state).toBe("open");
    if (outcome.state !== "open") return;
    expect(outcome.location.version).toBe("published");
    expect(outcome.location.licence).toBe("cc-by");
    expect(outcome.location.hostType).toBe("publisher");
  });

  it("reports a closed paper as closed", async () => {
    expect(await service.locate("10.1000/x", returning(fixtures.closed))).toEqual({ state: "closed" });
  });

  // is_oa true with nothing to fetch happens. Reporting it as open would
  // promise a passage that can never arrive.
  it("treats open-with-no-location as closed", async () => {
    expect(await service.locate("10.1000/x", returning(fixtures.openButNowhere)))
      .toEqual({ state: "closed" });
  });

  it("reports an unknown DOI as not_found", async () => {
    expect(await service.locate("10.1000/x", returning({}, false, 404))).toEqual({ state: "not_found" });
  });

  it("refuses a malformed DOI without spending a request", async () => {
    let called = false;
    const outcome = await service.locate("nonsense", async () => {
      called = true;
      return { ok: true, status: 200, json: async () => fixtures.published };
    });
    expect(outcome).toEqual({ state: "malformed" });
    expect(called).toBe(false);
  });

  // Unreachable must never read as closed. Treating an outage as "no open copy
  // exists" would silently strip the passage feature from every reference and
  // look exactly like the papers being paywalled.
  it("reports a thrown request as unreachable, not closed", async () => {
    const outcome = await service.locate("10.1000/x", async () => {
      throw new Error("ETIMEDOUT");
    });
    expect(outcome).toEqual({ state: "unreachable" });
  });

  it("reports a 500 as unreachable, not closed", async () => {
    expect(await service.locate("10.1000/x", returning({}, false, 500)))
      .toEqual({ state: "unreachable" });
  });

  it("sends the email the API requires", async () => {
    let seen = "";
    await service.locate("10.1000/abc", async (url) => {
      seen = url;
      return { ok: true, status: 200, json: async () => fixtures.published };
    });
    expect(seen).toContain("email=someone%40example.org");
    expect(seen).toContain("10.1000%2Fabc");
  });
});

describe("choosing between copies", () => {
  it("takes the accepted manuscript when that is all there is", async () => {
    const outcome = await service.locate("10.1000/x", returning(fixtures.acceptedOnly));
    if (outcome.state !== "open") throw new Error("expected open");
    expect(outcome.location.version).toBe("accepted");
  });

  // The version of record outranks Unpaywall's own host preference. Quoting the
  // published text is worth more than any convenience about where it lives,
  // because it is the text the marker will open.
  it("prefers a published version buried in the list over the accepted best_oa_location", async () => {
    const outcome = await service.locate("10.1000/x", returning(fixtures.publishedBuriedInList));
    if (outcome.state !== "open") throw new Error("expected open");
    expect(outcome.location.version).toBe("published");
    expect(outcome.location.url).toBe("https://publisher.example.org/final/3.pdf");
  });

  it("records an unrecognised version as unknown rather than passing it through", async () => {
    const outcome = await service.locate("10.1000/x", returning(fixtures.unknownVersion));
    if (outcome.state !== "open") throw new Error("expected open");
    expect(outcome.location.version).toBe("unknown");
  });

  it("leaves the licence undefined rather than guessing when it is null", async () => {
    const outcome = await service.locate("10.1000/x", returning(fixtures.acceptedOnly));
    if (outcome.state !== "open") throw new Error("expected open");
    expect(outcome.location.licence).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Against real Unpaywall lookups. `npm run research:record` with
// OPENALEX_CONTACT set writes this; until then these skip, visibly.
// ---------------------------------------------------------------------------

function loadRecorded(): Record<string, unknown> | null {
  try {
    return JSON.parse(
      readFileSync(fileURLToPath(new URL("../fixtures/unpaywall-recorded.json", import.meta.url)), "utf8"),
    );
  } catch {
    return null;
  }
}

const recorded = loadRecorded();

describe.skipIf(recorded === null)("against recorded Unpaywall lookups", () => {
  it("classifies every recorded lookup without throwing", async () => {
    for (const [doi, body] of Object.entries(recorded!)) {
      const outcome = await service.locate(doi, returning(body));
      expect(["open", "closed"]).toContain(outcome.state);
    }
  });

  it("never reports open without something to fetch", async () => {
    for (const [doi, body] of Object.entries(recorded!)) {
      const outcome = await service.locate(doi, returning(body));
      if (outcome.state === "open") {
        expect(outcome.location.url).toMatch(/^https?:\/\//);
      }
    }
  });

  it("assigns a known version to every open copy", async () => {
    for (const [doi, body] of Object.entries(recorded!)) {
      const outcome = await service.locate(doi, returning(body));
      if (outcome.state === "open") {
        expect(["published", "accepted", "submitted", "unknown"]).toContain(outcome.location.version);
      }
    }
  });

  it("agrees with Unpaywall's own is_oa flag, except where there is nowhere to fetch from", async () => {
    for (const [doi, body] of Object.entries(recorded!)) {
      const record = body as { is_oa?: boolean };
      const outcome = await service.locate(doi, returning(body));
      if (record.is_oa === false) expect(outcome.state).toBe("closed");
    }
  });
});
