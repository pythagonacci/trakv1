export type ChartCustomizationOverrides = {
  labels?: string[];
  values?: number[];
  colors?: string[];
  title?: string | null;
  height?: number | null;
  previousTitle?: string | null;
};

const ARRAY_RE = (key: string) => new RegExp(`${key}\\s*:\\s*\\[([\\s\\S]*?)\\]`);
const STRING_RE = (key: string) => new RegExp(`${key}\\s*:\\s*["'][^"']*["']`);

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function serializeStrings(values: string[]) {
  return values.map((value) => JSON.stringify(value)).join(", ");
}

function serializeNumbers(values: number[]) {
  return values
    .map((value) => (Number.isFinite(value) ? String(value) : "0"))
    .join(", ");
}

function replaceArray(
  code: string,
  key: string,
  values: string[] | number[] | undefined,
  serialize: (values: any[]) => string
) {
  if (!values || values.length === 0) return code;
  const pattern = ARRAY_RE(key);
  if (!pattern.test(code)) return code;
  return code.replace(pattern, `${key}: [${serialize(values)}]`);
}

function replaceStringProp(code: string, key: string, value: string | undefined) {
  if (!value) return code;
  const pattern = STRING_RE(key);
  if (!pattern.test(code)) return code;
  return code.replace(pattern, `${key}: ${JSON.stringify(value)}`);
}

function replaceTitleInOptions(code: string, titleText: string) {
  const titlePattern = /title\s*:\s*\{[\s\S]*?\}/;
  if (!titlePattern.test(code)) return code;
  return code.replace(titlePattern, (match) => {
    if (!/text\s*:/.test(match)) return match;
    return match.replace(/text\s*:\s*["'][^"']*["']/, `text: ${JSON.stringify(titleText)}`);
  });
}

function replaceHeadingText(code: string, titleText: string) {
  let didReplace = false;
  let next = code.replace(
    /(<[^>]*font-semibold[^>]*>)([^<]*)(<\/[^>]+>)/,
    (_match, start, _text, end) => {
      didReplace = true;
      return `${start}${titleText}${end}`;
    }
  );
  return { code: next, didReplace };
}

function replaceHeight(code: string, height: number) {
  const normalized = Math.max(0, Math.round(height));
  const px = `${normalized}px`;
  let next = code;

  next = next.replace(/height\s*:\s*["']\d+(\.\d+)?px?["']/, `height: "${px}"`);
  next = next.replace(/height\s*:\s*\d+(\.\d+)?/, `height: ${normalized}`);
  next = next.replace(/minHeight\s*:\s*["']\d+(\.\d+)?px?["']/, `minHeight: "${px}"`);
  next = next.replace(/minHeight\s*:\s*\d+(\.\d+)?/, `minHeight: ${normalized}`);
  next = next.replace(/h-\[(\d+(\.\d+)?)px\]/, `h-[${normalized}px]`);

  return next;
}

export function applyChartCustomizationToCode(
  code: string,
  overrides: ChartCustomizationOverrides
) {
  if (!code || typeof code !== "string") return code;

  let next = code;

  next = replaceArray(next, "labels", overrides.labels, serializeStrings);
  next = replaceArray(next, "data", overrides.values, serializeNumbers);

  if (overrides.colors && overrides.colors.length > 0) {
    next = replaceArray(next, "backgroundColor", overrides.colors, serializeStrings);
    next = replaceArray(next, "borderColor", overrides.colors, serializeStrings);
    next = replaceArray(next, "pointBackgroundColor", overrides.colors, serializeStrings);
    next = replaceArray(next, "pointBorderColor", overrides.colors, serializeStrings);

    const firstColor = overrides.colors[0];
    next = replaceStringProp(next, "backgroundColor", firstColor);
    next = replaceStringProp(next, "borderColor", firstColor);
    next = replaceStringProp(next, "pointBackgroundColor", firstColor);
    next = replaceStringProp(next, "pointBorderColor", firstColor);
  }

  if (overrides.title !== undefined) {
    const titleText = overrides.title ?? "";
    next = replaceTitleInOptions(next, titleText);
    const heading = replaceHeadingText(next, titleText);
    next = heading.code;

    if (!heading.didReplace && overrides.previousTitle) {
      const escaped = escapeRegExp(overrides.previousTitle);
      const textNode = new RegExp(`>${escaped}<`);
      if (textNode.test(next)) {
        next = next.replace(textNode, `>${titleText}<`);
      } else {
        const stringLiteral = new RegExp(`(["'])${escaped}\\1`);
        if (stringLiteral.test(next)) {
          next = next.replace(stringLiteral, `$1${titleText}$1`);
        }
      }
    }
  }

  if (overrides.height !== undefined && overrides.height !== null) {
    next = replaceHeight(next, overrides.height);
  }

  return next;
}
