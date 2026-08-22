import { describe, expect, it } from "vitest";
import { FRAMEWORKS, FRAMEWORK_IDS } from "./frameworks.ts";
import { DEPTHS, DEVICES, DEVICE_IDS, deviceLabel, isDeviceId } from "./devices.ts";

describe("the device vocabulary", () => {
  it("is closed", () => {
    expect(isDeviceId("nominalisation")).toBe(true);
    expect(isDeviceId("nominalization")).toBe(false);
    expect(isDeviceId("vibes")).toBe(false);
    expect(isDeviceId(null)).toBe(false);
  });

  // A device is a way of seeing, never a source of authority. One with no
  // framework behind it is the free-floating assertion the frameworks exist to
  // prevent, so this is the load-bearing assertion in the file.
  it("every device cites a framework that exists", () => {
    for (const id of DEVICE_IDS) {
      expect(FRAMEWORK_IDS).toContain(DEVICES[id].cites);
      expect(FRAMEWORKS[DEVICES[id].cites]).toBeDefined();
    }
  });

  it("every device is complete in both registers", () => {
    for (const id of DEVICE_IDS) {
      const device = DEVICES[id];
      expect(device.id).toBe(id);
      expect(device.advanced.trim()).not.toBe("");
      expect(device.basic.trim()).not.toBe("");
      expect(device.gloss.trim()).toMatch(/\.$/);
    }
  });

  // Two lists drift and the drift is invisible: a device added to Advanced and
  // forgotten in Basic silently stops appearing for the reader who needs plain
  // words most. One entry with two fields cannot do that, and this is what
  // says so.
  it("has no device that exists in one register only", () => {
    const missing = DEVICE_IDS.filter((id) => !DEVICES[id].basic || !DEVICES[id].advanced);
    expect(missing).toEqual([]);
  });

  // Basic is not a definition of the Advanced word. A reader who needs
  // "nominalisation" explained is not helped by a label that explains it; they
  // are helped by one that never used it.
  it("the plain label does not contain the term of art", () => {
    for (const id of DEVICE_IDS) {
      const { advanced, basic } = DEVICES[id];
      expect(basic.toLowerCase()).not.toContain(advanced.toLowerCase());
    }
  });

  it("the plain label avoids the vocabulary Advanced is for", () => {
    const termsOfArt = /nominalis|agentless|presuppos|euphemis|illocution|perlocution|modality|hedging/i;
    for (const id of DEVICE_IDS) {
      expect(DEVICES[id].basic).not.toMatch(termsOfArt);
    }
  });

  it("British spelling, including the one the deployed site gets American", () => {
    expect(DEVICE_IDS).toContain("nominalisation");
    for (const id of DEVICE_IDS) {
      const text = `${id} ${DEVICES[id].advanced} ${DEVICES[id].basic} ${DEVICES[id].gloss}`;
      // -ize/-ization, and the two other American forms most likely to appear
      // in prose about communication.
      expect(text).not.toMatch(/\b\w+iz(e|ed|es|ing|ation)\b/);
      expect(text).not.toMatch(/\bemphasiz|\bminimiz|\bbehavior\b|\bcolor\b/);
    }
  });

  it("switches register and nothing else", () => {
    expect(deviceLabel("nominalisation", "advanced")).toBe("nominalisation");
    expect(deviceLabel("nominalisation", "basic")).toBe("action turned into a thing");
    for (const id of DEVICE_IDS) {
      for (const depth of DEPTHS) {
        expect(deviceLabel(id, depth).trim()).not.toBe("");
      }
      // The same device either way. The switch changes the words, not which
      // devices are found — which is what makes it a lookup rather than a
      // second analysis.
      expect(deviceLabel(id, "basic")).not.toBe(deviceLabel(id, "advanced"));
    }
  });

  it("covers the five the running site is known to use", () => {
    for (const seen of [
      "agentless_framing", "nominalisation", "sentiment_softener",
      "value_claim", "strategic_vagueness",
    ] as const) {
      expect(DEVICE_IDS).toContain(seen);
    }
  });
});
