export function normalizeMobile(value: string): string | null {
  const compact = value.trim().replace(/[\s().-]/g, "");
  const international = compact.startsWith("00") ? `+${compact.slice(2)}` : compact;
  const digits = international.startsWith("+") ? international.slice(1) : international;
  if (!/^\d{7,15}$/.test(digits)) return null;
  return `+${digits}`;
}

export function duplicateGuessMessage(entryType: "adult" | "kid") {
  return entryType === "adult"
    ? "This mobile number has already submitted a guess."
    : "This entry could not be saved. Please try again.";
}
