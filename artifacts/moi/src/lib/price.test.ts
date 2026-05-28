import { describe, it, expect } from "vitest";
import { parseEGP } from "./price";

describe("parseEGP", () => {
  it("parses a thousands-separated EGP string", () => {
    expect(parseEGP("1.399 EGP")).toBe(1399);
  });

  it("parses a plain integer EGP string", () => {
    expect(parseEGP("899 EGP")).toBe(899);
  });

  it("parses without a currency label", () => {
    expect(parseEGP("2.500")).toBe(2500);
  });

  it("parses a number with space-separated thousands", () => {
    expect(parseEGP("1 399 EGP")).toBe(1399);
  });

  it("returns 0 for an empty string", () => {
    expect(parseEGP("")).toBe(0);
  });

  it("returns 0 for a non-numeric string", () => {
    expect(parseEGP("EGP")).toBe(0);
  });

  it("does not treat dots as decimal points", () => {
    expect(parseEGP("1.399")).toBe(1399);
    expect(parseEGP("0.899")).toBe(899);
  });
});
