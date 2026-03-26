const DEFAULT_OPTIONS = {
  enabled: true,
  lowercase: true,
  replaceNumbers: true,
  replaceFloats: true,
  expandContractions: true,
  expandModelNames: true,
  expandOrdinals: true,
  expandPercentages: true,
  expandCurrency: true,
  expandTime: true,
  expandRanges: true,
  expandUnits: true,
  expandScaleSuffixes: true,
  expandScientificNotation: true,
  expandFractions: true,
  expandDecades: true,
  expandPhoneNumbers: true,
  expandIpAddresses: true,
  normalizeLeadingDecimals: true,
  removeExtraWhitespace: true
};

const ONES = [
  "",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen"
];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
const SCALES = ["", "thousand", "million", "billion", "trillion"];
const CURRENCY_UNITS = {
  "$": "dollar",
  "€": "euro",
  "£": "pound",
  "¥": "yen",
  "₹": "rupee",
  "₩": "won",
  "₿": "bitcoin"
};
const UNIT_MAP = {
  km: "kilometers",
  kg: "kilograms",
  mg: "milligrams",
  ml: "milliliters",
  gb: "gigabytes",
  mb: "megabytes",
  kb: "kilobytes",
  tb: "terabytes",
  hz: "hertz",
  khz: "kilohertz",
  mhz: "megahertz",
  ghz: "gigahertz",
  mph: "miles per hour",
  kph: "kilometers per hour",
  ms: "milliseconds",
  ns: "nanoseconds",
  "°c": "degrees celsius",
  "°f": "degrees fahrenheit"
};
const DIGIT_WORDS = ["zero", ...ONES.slice(1)];
const DECADE_WORDS = {
  0: "hundreds",
  1: "tens",
  2: "twenties",
  3: "thirties",
  4: "forties",
  5: "fifties",
  6: "sixties",
  7: "seventies",
  8: "eighties",
  9: "nineties"
};

function threeDigitsToWords(n) {
  if (n === 0) return "";
  const parts = [];
  const hundreds = Math.floor(n / 100);
  const remainder = n % 100;
  if (hundreds) parts.push(`${ONES[hundreds]} hundred`);
  if (remainder < 20) {
    if (remainder) parts.push(ONES[remainder]);
  } else {
    const tensWord = TENS[Math.floor(remainder / 10)];
    const onesWord = ONES[remainder % 10];
    parts.push(onesWord ? `${tensWord}-${onesWord}` : tensWord);
  }
  return parts.join(" ");
}

export function numberToWords(value) {
  let n = typeof value === "number" ? value : Number.parseInt(String(value), 10);
  if (!Number.isFinite(n)) return String(value);
  if (n === 0) return "zero";
  if (n < 0) return `negative ${numberToWords(-n)}`;

  if (n >= 100 && n <= 9999 && n % 100 === 0 && n % 1000 !== 0) {
    const hundreds = Math.floor(n / 100);
    return hundreds < 20 ? `${ONES[hundreds]} hundred` : `${threeDigitsToWords(hundreds)} hundred`;
  }

  const parts = [];
  let scaleIndex = 0;
  while (n > 0) {
    const chunk = n % 1000;
    if (chunk) {
      const chunkWords = threeDigitsToWords(chunk);
      parts.push(SCALES[scaleIndex] ? `${chunkWords} ${SCALES[scaleIndex]}` : chunkWords);
    }
    n = Math.floor(n / 1000);
    scaleIndex += 1;
  }
  return parts.reverse().join(" ");
}

export function floatToWords(value, decimalSeparator = "point") {
  let text = typeof value === "string" ? value : String(value);
  const negative = text.startsWith("-");
  if (negative) text = text.slice(1);
  if (!text.includes(".")) {
    const plain = numberToWords(text);
    return negative ? `negative ${plain}` : plain;
  }
  const [intPart, decPart] = text.split(".", 2);
  const intWords = intPart ? numberToWords(intPart) : "zero";
  const decWords = decPart
    .split("")
    .filter((digit) => /\d/.test(digit))
    .map((digit) => DIGIT_WORDS[Number.parseInt(digit, 10)])
    .join(" ");
  const result = `${intWords} ${decimalSeparator} ${decWords}`.trim();
  return negative ? `negative ${result}` : result;
}

function normalizeLeadingDecimals(text) {
  return text.replace(/(^|[^\d])-\.(\d+)/g, "$1-0.$2").replace(/(^|[^\d])\.(\d+)/g, "$10.$2");
}

function expandContractions(text) {
  const contractions = [
    [/\bcan't\b/gi, "cannot"],
    [/\bwon't\b/gi, "will not"],
    [/\bshan't\b/gi, "shall not"],
    [/\bain't\b/gi, "is not"],
    [/\blet's\b/gi, "let us"],
    [/\b(\w+)n't\b/gi, "$1 not"],
    [/\b(\w+)'re\b/gi, "$1 are"],
    [/\b(\w+)'ve\b/gi, "$1 have"],
    [/\b(\w+)'ll\b/gi, "$1 will"],
    [/\b(\w+)'d\b/gi, "$1 would"],
    [/\b(\w+)'m\b/gi, "$1 am"],
    [/\bit's\b/gi, "it is"]
  ];
  let out = text;
  for (const [pattern, replacement] of contractions) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

function expandIpAddresses(text) {
  return text.replace(/\b(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\b/g, (_, a, b, c, d) =>
    [a, b, c, d]
      .map((octet) => octet.split("").map((digit) => DIGIT_WORDS[Number.parseInt(digit, 10)]).join(" "))
      .join(" dot ")
  );
}

function expandCurrency(text) {
  return text.replace(/([$€£¥₹₩₿])(-?\d[\d,]*)(?:\.(\d+))?([KMBT])?\b/g, (_, symbol, rawInt, rawDec = "", scale = "") => {
    const unit = CURRENCY_UNITS[symbol] || "";
    const normalizedInt = rawInt.replace(/,/g, "");
    if (scale) {
      const scaleWord = { K: "thousand", M: "million", B: "billion", T: "trillion" }[scale];
      const numeric = rawDec ? `${normalizedInt}.${rawDec}` : normalizedInt;
      const amount = numeric.includes(".") ? floatToWords(numeric) : numberToWords(numeric);
      return `${amount} ${scaleWord} ${unit}s`.trim();
    }
    if (rawDec) {
      const cents = Number.parseInt(rawDec.slice(0, 2).padEnd(2, "0"), 10);
      const major = numberToWords(normalizedInt);
      const unitWord = `${unit}${normalizedInt === "1" ? "" : "s"}`;
      if (!cents) return `${major} ${unitWord}`.trim();
      return `${major} ${unitWord} and ${numberToWords(cents)} cent${cents === 1 ? "" : "s"}`.trim();
    }
    const value = Number.parseInt(normalizedInt, 10);
    return `${numberToWords(value)} ${unit}${value === 1 ? "" : "s"}`.trim();
  });
}

function expandPercentages(text) {
  return text.replace(/(-?\d[\d,]*(?:\.\d+)?)%/g, (_, raw) => {
    const normalized = raw.replace(/,/g, "");
    return `${normalized.includes(".") ? floatToWords(normalized) : numberToWords(normalized)} percent`;
  });
}

function expandScientificNotation(text) {
  return text.replace(/\b(-?\d+(?:\.\d+)?)[eE]([+-]?\d+)\b/g, (_, coeff, exponent) => {
    const coeffWords = coeff.includes(".") ? floatToWords(coeff) : numberToWords(coeff);
    const expValue = Number.parseInt(exponent, 10);
    const expWords = numberToWords(Math.abs(expValue));
    return `${coeffWords} times ten to the ${expValue < 0 ? "negative " : ""}${expWords}`;
  });
}

function expandTime(text) {
  return text.replace(/\b(\d{1,2}):(\d{2})(\s*([aApP][mM]))?\b/g, (_, hoursRaw, minsRaw, _suffixGroup, suffixRaw) => {
    const hours = Number.parseInt(hoursRaw, 10);
    const mins = Number.parseInt(minsRaw, 10);
    const suffix = suffixRaw ? ` ${suffixRaw.toLowerCase()}` : "";
    const hoursWords = numberToWords(hours);
    if (mins === 0) return suffixRaw ? `${hoursWords}${suffix}` : `${hoursWords} hundred`;
    if (mins < 10) return `${hoursWords} oh ${numberToWords(mins)}${suffix}`;
    return `${hoursWords} ${numberToWords(mins)}${suffix}`;
  });
}

function ordinalWord(n) {
  const exceptions = {
    one: "first",
    two: "second",
    three: "third",
    five: "fifth",
    eight: "eighth",
    nine: "ninth",
    twelve: "twelfth"
  };
  const word = numberToWords(n);
  const parts = word.includes("-") ? word.split("-") : word.split(" ");
  const last = parts.at(-1);
  let replacement = exceptions[last];
  if (!replacement) {
    if (last.endsWith("y")) replacement = `${last.slice(0, -1)}ieth`;
    else if (last.endsWith("e")) replacement = `${last.slice(0, -1)}th`;
    else replacement = `${last}th`;
  }
  parts[parts.length - 1] = replacement;
  return word.includes("-") ? parts.join("-") : parts.join(" ");
}

function expandOrdinals(text) {
  return text.replace(/\b(\d+)(st|nd|rd|th)\b/gi, (_, value) => ordinalWord(Number.parseInt(value, 10)));
}

function expandUnits(text) {
  return text.replace(/\b(-?\d+(?:\.\d+)?)(km|kg|mg|ml|gb|mb|kb|tb|hz|khz|mhz|ghz|mph|kph|ms|ns|°c|°f)\b/gi, (_, raw, unit) => {
    const expandedUnit = UNIT_MAP[unit.toLowerCase()] || unit;
    const amount = raw.includes(".") ? floatToWords(raw) : numberToWords(raw);
    return `${amount} ${expandedUnit}`;
  });
}

function expandScaleSuffixes(text) {
  return text.replace(/\b(-?\d+(?:\.\d+)?)([KMBT])\b/g, (_, raw, suffix) => {
    const scaleWord = { K: "thousand", M: "million", B: "billion", T: "trillion" }[suffix];
    const amount = raw.includes(".") ? floatToWords(raw) : numberToWords(raw);
    return `${amount} ${scaleWord}`;
  });
}

function expandFractions(text) {
  return text.replace(/\b(\d+)\/(\d+)\b/g, (_, numRaw, denRaw) => {
    const numerator = Number.parseInt(numRaw, 10);
    const denominator = Number.parseInt(denRaw, 10);
    if (!denominator) return `${numRaw}/${denRaw}`;
    const numeratorWords = numberToWords(numerator);
    let denominatorWord;
    if (denominator === 2) denominatorWord = numerator === 1 ? "half" : "halves";
    else if (denominator === 4) denominatorWord = numerator === 1 ? "quarter" : "quarters";
    else {
      denominatorWord = ordinalWord(denominator);
      if (numerator !== 1) denominatorWord += "s";
    }
    return `${numeratorWords} ${denominatorWord}`;
  });
}

function expandDecades(text) {
  return text.replace(/\b'?(\d{2,4})0s\b/gi, (_, rawBase) => {
    const base = Number.parseInt(rawBase, 10);
    if (base < 10) return DECADE_WORDS[base] || `${numberToWords(base)}s`;
    return `${numberToWords(Math.floor(base / 10))} ${DECADE_WORDS[base % 10] || "tens"}`;
  });
}

function expandPhoneNumbers(text) {
  return text
    .replace(/\b1-(\d{3})-(\d{3})-(\d{4})\b/g, (_, a, b, c) => [a, b, c].join("").split("").map((digit) => DIGIT_WORDS[Number.parseInt(digit, 10)]).join(" "))
    .replace(/\b(\d{3})-(\d{3})-(\d{4})\b/g, (_, a, b, c) => [a, b, c].join("").split("").map((digit) => DIGIT_WORDS[Number.parseInt(digit, 10)]).join(" "))
    .replace(/\b(\d{3})-(\d{4})\b/g, (_, a, b) => [a, b].join("").split("").map((digit) => DIGIT_WORDS[Number.parseInt(digit, 10)]).join(" "));
}

function expandRanges(text) {
  return text.replace(/\b(-?\d+)\s*-\s*(-?\d+)\b/g, (_, lo, hi) => `${numberToWords(lo)} to ${numberToWords(hi)}`);
}

function expandModelNames(text) {
  return text.replace(/\b([A-Za-z]{2,})-(\d+(?:\.\d+)?)\b/g, "$1 $2");
}

function replaceNumbers(text, replaceFloats = true) {
  return text.replace(/(?<![A-Za-z])-?\d[\d,]*(?:\.\d+)?/g, (raw) => {
    const normalized = raw.replace(/,/g, "");
    if (normalized.includes(".")) {
      return replaceFloats ? floatToWords(normalized) : normalized;
    }
    return numberToWords(normalized);
  });
}

function removeExtraWhitespace(text) {
  return text.replace(/\s+/g, " ").trim();
}

export function preprocessText(text, options = {}) {
  const cfg = { ...DEFAULT_OPTIONS, ...(options || {}) };
  let out = String(text || "");
  if (!cfg.enabled || !out.trim()) return out.trim();

  out = out.normalize("NFC");
  if (cfg.expandContractions) out = expandContractions(out);
  if (cfg.expandIpAddresses) out = expandIpAddresses(out);
  if (cfg.normalizeLeadingDecimals) out = normalizeLeadingDecimals(out);
  if (cfg.expandCurrency) out = expandCurrency(out);
  if (cfg.expandPercentages) out = expandPercentages(out);
  if (cfg.expandScientificNotation) out = expandScientificNotation(out);
  if (cfg.expandTime) out = expandTime(out);
  if (cfg.expandOrdinals) out = expandOrdinals(out);
  if (cfg.expandUnits) out = expandUnits(out);
  if (cfg.expandScaleSuffixes) out = expandScaleSuffixes(out);
  if (cfg.expandFractions) out = expandFractions(out);
  if (cfg.expandDecades) out = expandDecades(out);
  if (cfg.expandPhoneNumbers) out = expandPhoneNumbers(out);
  if (cfg.expandRanges) out = expandRanges(out);
  if (cfg.expandModelNames) out = expandModelNames(out);
  if (cfg.replaceNumbers) out = replaceNumbers(out, cfg.replaceFloats);
  if (cfg.lowercase) out = out.toLowerCase();
  if (cfg.removeExtraWhitespace) out = removeExtraWhitespace(out);
  return out;
}
