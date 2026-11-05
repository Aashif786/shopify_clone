const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];

const TENS = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
];

function belowThousand(n: number): string {
  const parts: string[] = [];
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;

  if (hundreds > 0) {
    parts.push(`${ONES[hundreds]} Hundred`);
  }
  if (rest > 0) {
    if (rest < 20) {
      parts.push(ONES[rest] ?? "");
    } else {
      const tens = TENS[Math.floor(rest / 10)] ?? "";
      const ones = ONES[rest % 10] ?? "";
      parts.push(ones ? `${tens} ${ones}` : tens);
    }
  }
  return parts.join(" ");
}

/** Whole number in the Indian system: thousand, lakh, crore. */
function wholeNumberInWords(n: number): string {
  if (n === 0) return "Zero";

  const crore = Math.floor(n / 10_000_000);
  const lakh = Math.floor((n % 10_000_000) / 100_000);
  const thousand = Math.floor((n % 100_000) / 1_000);
  const rest = n % 1_000;

  const parts: string[] = [];
  if (crore > 0) parts.push(`${wholeNumberInWords(crore)} Crore`);
  if (lakh > 0) parts.push(`${belowThousand(lakh)} Lakh`);
  if (thousand > 0) parts.push(`${belowThousand(thousand)} Thousand`);
  if (rest > 0) parts.push(belowThousand(rest));
  return parts.join(" ");
}

/**
 * Writes a minor-unit INR amount out in words for the invoice total line,
 * e.g. 123456 -> "Rupees One Thousand Two Hundred Thirty Four and Fifty Six
 * Paise Only". Only meaningful for INR, so callers print it for INR invoices.
 */
export function amountInWordsInr(minorUnits: number): string {
  if (!Number.isSafeInteger(minorUnits) || minorUnits < 0) {
    throw new Error("Amount must be a non-negative integer of paise");
  }
  const rupees = Math.floor(minorUnits / 100);
  const paise = minorUnits % 100;

  const rupeeWords = `Rupees ${wholeNumberInWords(rupees)}`;
  if (paise === 0) {
    return `${rupeeWords} Only`;
  }
  return `${rupeeWords} and ${belowThousand(paise)} Paise Only`;
}
