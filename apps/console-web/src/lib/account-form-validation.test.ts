import { expect, it } from "vitest";
import { accountFormErrors, validDisplayName, validNewPassword } from "./account-form-validation";

it.each([14,15,128,129])("counts %i password code points, including astral characters", length => {
  for (const character of ["a", "😀"]) expect(validNewPassword(character.repeat(length))).toBe(length >= 15 && length <= 128);
});
it("does not trim or normalize passwords", () => {
  expect(validNewPassword(" ".repeat(15))).toBe(true);
  expect(validNewPassword("e\u0301".repeat(7))).toBe(false);
  expect(validNewPassword("e\u0301".repeat(8))).toBe(true);
});
it("matches the server name's UTF-16, blank and control rules", () => {
  expect(validDisplayName("a".repeat(100))).toBe(true);
  expect(validDisplayName("a".repeat(101))).toBe(false);
  expect(validDisplayName("😀".repeat(50))).toBe(true);
  expect(validDisplayName("😀".repeat(51))).toBe(false);
  for (const value of ["", "  ", "\u2003", "a\nb", "a\u0085b"]) expect(validDisplayName(value)).toBe(false);
  expect(validDisplayName("\u00a0")).toBe(true); // Java isWhitespace excludes NBSP.
});
it("validates creation/reset without applying creation policy to login", () => {
  expect(accountFormErrors("sign-in", "", "short")).toEqual({});
  expect(accountFormErrors("reset", "", "short")).toEqual({password:"password_policy"});
  expect(accountFormErrors("register", " ", "short")).toEqual({name:"name_invalid",password:"password_policy"});
});
