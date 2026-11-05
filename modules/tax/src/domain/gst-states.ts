/**
 * GST state and union-territory codes, as used in a GSTIN prefix and for the
 * "place of supply" printed on a tax invoice.
 */
export const GST_STATE_CODES: Readonly<Record<string, string>> = {
  "01": "Jammu and Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  "26": "Dadra and Nagar Haveli and Daman and Diu",
  "27": "Maharashtra",
  "29": "Karnataka",
  "30": "Goa",
  "31": "Lakshadweep",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "35": "Andaman and Nicobar Islands",
  "36": "Telangana",
  "37": "Andhra Pradesh",
  "38": "Ladakh",
  "97": "Other Territory",
};

/** Postal / ISO 3166-2:IN abbreviations commonly typed into address forms. */
const STATE_ABBREVIATIONS: Readonly<Record<string, string>> = {
  JK: "01",
  HP: "02",
  PB: "03",
  CH: "04",
  UK: "05",
  UT: "05",
  HR: "06",
  DL: "07",
  RJ: "08",
  UP: "09",
  BR: "10",
  SK: "11",
  AR: "12",
  NL: "13",
  MN: "14",
  MZ: "15",
  TR: "16",
  ML: "17",
  AS: "18",
  WB: "19",
  JH: "20",
  OD: "21",
  OR: "21",
  CG: "22",
  CT: "22",
  MP: "23",
  GJ: "24",
  DH: "26",
  DN: "26",
  DD: "26",
  MH: "27",
  KA: "29",
  GA: "30",
  LD: "31",
  KL: "32",
  TN: "33",
  PY: "34",
  AN: "35",
  TS: "36",
  TG: "36",
  AP: "37",
  LA: "38",
};

/** Spelling variants and former names that people still type. */
const STATE_ALIASES: Readonly<Record<string, string>> = {
  orissa: "21",
  pondicherry: "34",
  uttaranchal: "05",
  tamilnadu: "33",
  telengana: "36",
  "nct of delhi": "07",
  "new delhi": "07",
  "delhi ncr": "07",
  "jammu and kashmir": "01",
  "andaman and nicobar": "35",
  "andaman and nicobar island": "35",
  "dadra and nagar haveli": "26",
  "daman and diu": "26",
  "dadra and nagar haveli and daman and diu": "26",
  "chattisgarh": "22",
};

function normalizeKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const NAME_TO_CODE: ReadonlyMap<string, string> = new Map(
  Object.entries(GST_STATE_CODES).map(([code, name]) => [normalizeKey(name), code]),
);

export function isValidGstStateCode(code: string | null | undefined): boolean {
  return typeof code === "string" && Object.hasOwn(GST_STATE_CODES, code);
}

export function gstStateName(code: string | null | undefined): string | null {
  if (typeof code !== "string") return null;
  return GST_STATE_CODES[code] ?? null;
}

/**
 * Resolves free-text address state input to a GST state code. Accepts the
 * full name, a known alias, a two-letter abbreviation, or the numeric code
 * itself. Returns null when nothing matches, so the caller can reject the
 * address instead of guessing.
 */
export function resolveGstStateCode(input: string | null | undefined): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;

  if (/^\d{2}$/.test(trimmed)) {
    return isValidGstStateCode(trimmed) ? trimmed : null;
  }

  if (/^[A-Za-z]{2}$/.test(trimmed)) {
    return STATE_ABBREVIATIONS[trimmed.toUpperCase()] ?? null;
  }

  const key = normalizeKey(trimmed);
  return NAME_TO_CODE.get(key) ?? STATE_ALIASES[key] ?? null;
}

/** True for any spelling of India in an address country field. */
export function isIndiaCountry(country: string | null | undefined): boolean {
  if (typeof country !== "string") return false;
  const key = normalizeKey(country);
  return key === "in" || key === "ind" || key === "india" || key === "bharat";
}
