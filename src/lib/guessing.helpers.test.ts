import { describe, expect, it } from "vitest";
import { duplicateGuessMessage, normalizeMobile } from "./guessing.helpers";

describe("normalizeMobile", () => {
  it.each([
    ["+92 300 123-4567", "+923001234567"],
    ["0092 (300) 1234567", "+923001234567"],
    ["03001234567", "+03001234567"],
  ])("normalizes %s", (input, expected) => expect(normalizeMobile(input)).toBe(expected));
  it.each(["123", "+12abc345678", "++923001234567", "1234567890123456"])("rejects %s", (input) =>
    expect(normalizeMobile(input)).toBeNull(),
  );
});

it("maps adult duplicate errors without implying kids need contact", () => {
  expect(duplicateGuessMessage("adult")).toContain("mobile number");
  expect(duplicateGuessMessage("kid")).not.toContain("mobile");
});
