import { describe, expect, it } from "vitest";
import { formatMoney, toMinorUnits } from "./money";

describe("formatMoney", () => {
  it("formats whole-rupee minor amounts with the INR symbol", () => {
    expect(formatMoney(150000)).toBe("₹1,500");
  });

  it("formats fractional-rupee minor amounts", () => {
    expect(formatMoney(15050)).toBe("₹150.5");
  });

  it("returns an em dash for null or undefined", () => {
    expect(formatMoney(null)).toBe("—");
    expect(formatMoney(undefined)).toBe("—");
  });

  it("treats zero as a real amount, not a missing one", () => {
    expect(formatMoney(0)).toBe("₹0");
  });

  it("falls back to the currency code for an unknown currency", () => {
    expect(formatMoney(10000, "GBP")).toBe("GBP 100");
  });

  it("formats USD and EUR with their symbols", () => {
    expect(formatMoney(250000, "USD")).toBe("$2,500");
    expect(formatMoney(99900, "EUR")).toBe("€999");
  });
});

describe("toMinorUnits", () => {
  it("converts a plain decimal rupee string to integer paise", () => {
    expect(toMinorUnits("150.50")).toBe(15050);
  });

  it("converts a whole-number string with no decimal point", () => {
    expect(toMinorUnits("500")).toBe(50000);
  });

  it("rounds to the nearest paisa to avoid floating-point drift", () => {
    expect(toMinorUnits("10.005")).toBe(1001);
  });

  it("returns null for an empty or whitespace-only string", () => {
    expect(toMinorUnits("")).toBeNull();
    expect(toMinorUnits("   ")).toBeNull();
  });

  it("returns null for a non-numeric string", () => {
    expect(toMinorUnits("abc")).toBeNull();
  });

  it("accepts zero as a valid amount", () => {
    expect(toMinorUnits("0")).toBe(0);
  });

  it("accepts a negative amount as-is (callers are responsible for rejecting it)", () => {
    expect(toMinorUnits("-5")).toBe(-500);
  });
});
