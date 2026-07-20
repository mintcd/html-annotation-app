const DARK_MODE_STYLE_ID = 'annotation-dark-mode-styles';
const DARK_MODE_CLASS = 'annotation-dark-mode';
const DARK_MODE_TRANSFORM_ATTRIBUTE = 'data-annotation-dark-mode';
const DARK_MODE_TARGET_BACKGROUND = '#0f172a';
const DARK_MODE_TARGET_SURFACE = '#111827';
const DARK_LUMINANCE_THRESHOLD = 0.35;
const TRANSPARENT_ALPHA_THRESHOLD = 0.04;

const DARK_MODE_CSS = `
  html.annotation-dark-mode {
    background: ${DARK_MODE_TARGET_BACKGROUND} !important;
    color-scheme: dark !important;
  }

  html.annotation-dark-mode body {
    background: ${DARK_MODE_TARGET_BACKGROUND} !important;
    color-scheme: dark !important;
  }

  html.annotation-dark-mode :where(input, textarea, select, button) {
    color-scheme: dark !important;
  }

  html.annotation-dark-mode.annotation-reading-mode,
  html.annotation-dark-mode.annotation-reading-mode body {
    background: ${DARK_MODE_TARGET_BACKGROUND} !important;
    color: #e5e7eb !important;
  }

  html.annotation-dark-mode.annotation-reading-mode [data-annotation-reading-root="true"] {
    background: transparent !important;
    color: #e5e7eb !important;
  }

  html.annotation-dark-mode :where(img, picture, video, canvas, iframe, embed, object) {
    opacity: 0.94;
  }
`;

const COLOR_PROPERTIES = [
  'color',
  'background-color',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'outline-color',
  'text-decoration-color',
  'column-rule-color',
  'caret-color',
  'fill',
  'stroke',
] as const;

const BORDER_PROPERTIES = new Set([
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
]);

const EXCLUDED_ELEMENT_SELECTOR = [
  'script',
  'style',
  'noscript',
  'template',
  'meta',
  'link',
  'img',
  'picture',
  'video',
  'canvas',
  'iframe',
  'embed',
  'object',
].join(',');

export type RgbColor = {
  r: number;
  g: number;
  b: number;
  a: number;
};

type OklchColor = {
  l: number;
  c: number;
  h: number;
};

type SavedProperty = {
  property: string;
  value: string;
  priority: string;
};

type SavedElementStyles = {
  element: HTMLElement | SVGElement;
  properties: SavedProperty[];
};

type SavedRootState = {
  element: HTMLElement;
  hadClass: boolean;
  colorScheme: string;
  colorSchemePriority: string;
  backgroundColor: string;
  backgroundColorPriority: string;
};

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function srgbChannelToLinear(value: number): number {
  const channel = clamp(value / 255);
  return channel <= 0.04045
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4;
}

function linearChannelToSrgb(value: number): number {
  const channel = clamp(value);
  return channel <= 0.0031308
    ? channel * 12.92
    : 1.055 * (channel ** (1 / 2.4)) - 0.055;
}

function colorToLinearRgb(color: RgbColor): { r: number; g: number; b: number } {
  return {
    r: srgbChannelToLinear(color.r),
    g: srgbChannelToLinear(color.g),
    b: srgbChannelToLinear(color.b),
  };
}

export function relativeLuminance(color: RgbColor): number {
  const { r, g, b } = colorToLinearRgb(color);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(left: RgbColor, right: RgbColor): number {
  const leftLuminance = relativeLuminance(left);
  const rightLuminance = relativeLuminance(right);
  const lighter = Math.max(leftLuminance, rightLuminance);
  const darker = Math.min(leftLuminance, rightLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

function parseCssChannel(value: string): number {
  const trimmed = value.trim();
  const parsed = Number.parseFloat(trimmed);
  if (!Number.isFinite(parsed)) return 0;
  if (trimmed.endsWith('%')) {
    return clamp(parsed / 100) * 255;
  }
  return clamp(parsed / 255) * 255;
}

function parseAlpha(value: string | undefined): number {
  if (!value) return 1;
  const trimmed = value.trim();
  const parsed = Number.parseFloat(trimmed);
  if (!Number.isFinite(parsed)) return 1;
  if (trimmed.endsWith('%')) return clamp(parsed / 100);
  return clamp(parsed);
}

export function parseCssColor(value: string): RgbColor | null {
  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized === 'transparent') {
    return { r: 0, g: 0, b: 0, a: 0 };
  }

  const hex = /^#([\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.exec(normalized);
  if (hex) {
    const raw = hex[1];
    const expanded = raw.length <= 4
      ? raw.split('').map((part) => part + part).join('')
      : raw;
    const alpha = expanded.length === 8
      ? Number.parseInt(expanded.slice(6, 8), 16) / 255
      : 1;
    return {
      r: Number.parseInt(expanded.slice(0, 2), 16),
      g: Number.parseInt(expanded.slice(2, 4), 16),
      b: Number.parseInt(expanded.slice(4, 6), 16),
      a: alpha,
    };
  }

  const rgb = /^rgba?\((.+)\)$/.exec(normalized);
  if (!rgb) return null;

  const parts = rgb[1]
    .replace(/\s*\/\s*/, ' ')
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean);
  if (parts.length < 3) return null;

  return {
    r: parseCssChannel(parts[0]),
    g: parseCssChannel(parts[1]),
    b: parseCssChannel(parts[2]),
    a: parseAlpha(parts[3]),
  };
}

function serializeCssColor(color: RgbColor): string {
  const r = Math.round(clamp(color.r / 255) * 255);
  const g = Math.round(clamp(color.g / 255) * 255);
  const b = Math.round(clamp(color.b / 255) * 255);
  const alpha = clamp(color.a);

  if (alpha >= 0.995) return `rgb(${r}, ${g}, ${b})`;
  return `rgba(${r}, ${g}, ${b}, ${Number(alpha.toFixed(3))})`;
}

function rgbToOklch(color: RgbColor): OklchColor {
  const { r, g, b } = colorToLinearRgb(color);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const labL = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
  const labA = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
  const labB = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;

  return {
    l: labL,
    c: Math.sqrt(labA * labA + labB * labB),
    h: Math.atan2(labB, labA),
  };
}

function oklchToRgb({ l, c, h }: OklchColor, alpha: number): RgbColor {
  const a = Math.cos(h) * c;
  const b = Math.sin(h) * c;

  const lPrime = l + 0.3963377774 * a + 0.2158037573 * b;
  const mPrime = l - 0.1055613458 * a - 0.0638541728 * b;
  const sPrime = l - 0.0894841775 * a - 1.2914855480 * b;

  const lCube = lPrime ** 3;
  const mCube = mPrime ** 3;
  const sCube = sPrime ** 3;

  const red = 4.0767416621 * lCube - 3.3077115913 * mCube + 0.2309699292 * sCube;
  const green = -1.2684380046 * lCube + 2.6097574011 * mCube - 0.3413193965 * sCube;
  const blue = -0.0041960863 * lCube - 0.7034186147 * mCube + 1.7076147010 * sCube;

  return {
    r: linearChannelToSrgb(red) * 255,
    g: linearChannelToSrgb(green) * 255,
    b: linearChannelToSrgb(blue) * 255,
    a: alpha,
  };
}

function targetLuminanceForContrast(
  sourceColor: RgbColor,
  sourceBackground: RgbColor,
  targetBackground: RgbColor,
  mode: 'text' | 'surface',
): number {
  const sourceColorLuminance = relativeLuminance(sourceColor);
  const sourceBackgroundLuminance = relativeLuminance(sourceBackground);
  const targetBackgroundLuminance = relativeLuminance(targetBackground);
  const ratio = contrastRatio(sourceColor, sourceBackground);
  const backgroundsChangePolarity = (
    sourceBackgroundLuminance < DARK_LUMINANCE_THRESHOLD
  ) !== (
    targetBackgroundLuminance < DARK_LUMINANCE_THRESHOLD
  );

  const sourceColorIsLighter = sourceColorLuminance >= sourceBackgroundLuminance;
  const shouldBeLighter = mode === 'surface'
    ? targetBackgroundLuminance < DARK_LUMINANCE_THRESHOLD
      ? ratio < 3 || sourceColorIsLighter
      : ratio >= 3 && sourceColorIsLighter
    : backgroundsChangePolarity
      ? !sourceColorIsLighter
      : sourceColorIsLighter;

  const luminance = shouldBeLighter
    ? ratio * (targetBackgroundLuminance + 0.05) - 0.05
    : (targetBackgroundLuminance + 0.05) / ratio - 0.05;

  return clamp(luminance);
}

function colorWithTargetLuminance(sourceColor: RgbColor, targetLuminance: number): RgbColor {
  const source = rgbToOklch(sourceColor);
  let bestColor = oklchToRgb(
    { l: source.l, c: source.c, h: source.h },
    sourceColor.a,
  );
  let bestScore = Math.abs(relativeLuminance(bestColor) - targetLuminance);
  let chroma = source.c;

  for (let attempt = 0; attempt < 8; attempt++) {
    let low = 0;
    let high = 1;

    for (let step = 0; step < 18; step++) {
      const mid = (low + high) / 2;
      const candidate = oklchToRgb({ l: mid, c: chroma, h: source.h }, sourceColor.a);
      const luminance = relativeLuminance(candidate);
      const score = Math.abs(luminance - targetLuminance);

      if (score < bestScore) {
        bestScore = score;
        bestColor = candidate;
      }

      if (luminance < targetLuminance) low = mid;
      else high = mid;
    }

    if (bestScore < 0.004 || chroma < 0.002) break;
    chroma *= 0.72;
  }

  return bestColor;
}

export function retargetColorForBackground(
  sourceColor: RgbColor,
  sourceBackground: RgbColor,
  targetBackground: RgbColor,
  mode: 'text' | 'surface' = 'text',
): RgbColor {
  const targetLuminance = targetLuminanceForContrast(
    sourceColor,
    sourceBackground,
    targetBackground,
    mode,
  );
  return colorWithTargetLuminance(sourceColor, targetLuminance);
}

function blend(top: RgbColor, bottom: RgbColor): RgbColor {
  const topAlpha = clamp(top.a);
  const bottomAlpha = clamp(bottom.a);
  const alpha = topAlpha + bottomAlpha * (1 - topAlpha);
  if (alpha <= 0) return { r: 0, g: 0, b: 0, a: 0 };

  return {
    r: (top.r * topAlpha + bottom.r * bottomAlpha * (1 - topAlpha)) / alpha,
    g: (top.g * topAlpha + bottom.g * bottomAlpha * (1 - topAlpha)) / alpha,
    b: (top.b * topAlpha + bottom.b * bottomAlpha * (1 - topAlpha)) / alpha,
    a: alpha,
  };
}

function discoverBackgroundColor(doc: Document, contentRoot: HTMLElement): RgbColor {
  const win = doc.defaultView;
  if (!win) return parseCssColor('#ffffff')!;

  const chain: Element[] = [];
  for (let element: Element | null = contentRoot; element; element = element.parentElement) {
    chain.unshift(element);
  }

  if (!chain.includes(doc.documentElement)) chain.unshift(doc.documentElement);
  if (doc.body && !chain.includes(doc.body)) chain.push(doc.body);

  return chain.reduce((background, element) => {
    const color = parseCssColor(win.getComputedStyle(element).backgroundColor);
    return color && color.a > TRANSPARENT_ALPHA_THRESHOLD
      ? blend(color, background)
      : background;
  }, parseCssColor('#ffffff')!);
}

function saveRootState(element: HTMLElement): SavedRootState {
  return {
    element,
    hadClass: element.classList.contains(DARK_MODE_CLASS),
    colorScheme: element.style.getPropertyValue('color-scheme'),
    colorSchemePriority: element.style.getPropertyPriority('color-scheme'),
    backgroundColor: element.style.getPropertyValue('background-color'),
    backgroundColorPriority: element.style.getPropertyPriority('background-color'),
  };
}

function restoreRootState(state: SavedRootState) {
  if (!state.hadClass) state.element.classList.remove(DARK_MODE_CLASS);
  state.element.style.setProperty('color-scheme', state.colorScheme, state.colorSchemePriority);
  state.element.style.setProperty('background-color', state.backgroundColor, state.backgroundColorPriority);
}

function restoreSavedStyles(savedStyles: SavedElementStyles[]) {
  for (const saved of savedStyles) {
    for (const { property, value, priority } of saved.properties) {
      saved.element.style.setProperty(property, value, priority);
    }
    saved.element.removeAttribute(DARK_MODE_TRANSFORM_ATTRIBUTE);
  }
}

function isVisibleBorder(computed: CSSStyleDeclaration, property: string): boolean {
  const side = property.slice('border-'.length, -'-color'.length);
  return computed.getPropertyValue(`border-${side}-style`) !== 'none'
    && computed.getPropertyValue(`border-${side}-width`) !== '0px';
}

function shouldTransformElement(element: Element): element is HTMLElement | SVGElement {
  const view = element.ownerDocument.defaultView;
  if (!view) return false;
  if (!(element instanceof view.HTMLElement || element instanceof view.SVGElement)) return false;
  if (element.matches(EXCLUDED_ELEMENT_SELECTOR)) return false;
  return true;
}

function transformElement(
  element: HTMLElement | SVGElement,
  sourceBackground: RgbColor,
  targetBackground: RgbColor,
  savedStyles: SavedElementStyles[],
) {
  if (element.getAttribute(DARK_MODE_TRANSFORM_ATTRIBUTE) === 'true') return;

  const win = element.ownerDocument.defaultView;
  if (!win) return;

  const computed = win.getComputedStyle(element);
  const savedProperties: SavedProperty[] = [];
  const isSvgElement = element instanceof win.SVGElement;

  for (const property of COLOR_PROPERTIES) {
    if ((property === 'fill' || property === 'stroke') && !isSvgElement) {
      continue;
    }

    if (
      BORDER_PROPERTIES.has(property)
      && !isVisibleBorder(computed, property)
    ) {
      continue;
    }

    if (
      property === 'outline-color'
      && computed.getPropertyValue('outline-style') === 'none'
    ) {
      continue;
    }

    if (
      property === 'text-decoration-color'
      && computed.getPropertyValue('text-decoration-line') === 'none'
    ) {
      continue;
    }

    if (
      property === 'background-color'
      && element.classList.contains('highlighted-text')
    ) {
      continue;
    }

    const parsed = parseCssColor(computed.getPropertyValue(property));
    if (!parsed || parsed.a <= TRANSPARENT_ALPHA_THRESHOLD) continue;

    savedProperties.push({
      property,
      value: element.style.getPropertyValue(property),
      priority: element.style.getPropertyPriority(property),
    });

    const target = retargetColorForBackground(
      parsed,
      sourceBackground,
      targetBackground,
      property === 'color' || property === 'fill' || property === 'stroke' || property === 'caret-color'
        ? 'text'
        : 'surface',
    );

    element.style.setProperty(property, serializeCssColor(target), 'important');
  }

  if (savedProperties.length > 0) {
    element.setAttribute(DARK_MODE_TRANSFORM_ATTRIBUTE, 'true');
    savedStyles.push({ element, properties: savedProperties });
  }
}

function transformTree(
  root: Element,
  sourceBackground: RgbColor,
  targetBackground: RgbColor,
  savedStyles: SavedElementStyles[],
) {
  if (shouldTransformElement(root)) {
    transformElement(root, sourceBackground, targetBackground, savedStyles);
  }

  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const element = node as Element;
    if (shouldTransformElement(element)) {
      transformElement(element, sourceBackground, targetBackground, savedStyles);
    }
  }
}

export function applyFrameDarkMode(doc: Document, contentRoot: HTMLElement): () => void {
  const html = doc.documentElement;
  const body = doc.body;
  const win = doc.defaultView;
  if (!html || !body || !win) return () => undefined;

  const htmlState = saveRootState(html);
  const bodyState = saveRootState(body);
  const savedStyles: SavedElementStyles[] = [];
  const sourceBackground = discoverBackgroundColor(doc, contentRoot);
  const sourceBackgroundIsDark = relativeLuminance(sourceBackground) < DARK_LUMINANCE_THRESHOLD;
  const targetBackground = parseCssColor(DARK_MODE_TARGET_BACKGROUND)!;
  const targetSurface = parseCssColor(DARK_MODE_TARGET_SURFACE)!;

  if (!sourceBackgroundIsDark) {
    transformTree(body, sourceBackground, targetSurface, savedStyles);
  }

  let style = doc.getElementById(DARK_MODE_STYLE_ID) as HTMLStyleElement | null;
  const createdStyle = !style;
  if (!style) {
    style = doc.createElement('style');
    style.id = DARK_MODE_STYLE_ID;
    style.textContent = DARK_MODE_CSS;
    (doc.head || doc.documentElement).appendChild(style);
  }

  html.classList.add(DARK_MODE_CLASS);
  body.classList.add(DARK_MODE_CLASS);
  html.style.setProperty('color-scheme', 'dark', 'important');
  body.style.setProperty('color-scheme', 'dark', 'important');

  if (!sourceBackgroundIsDark) {
    html.style.setProperty('background-color', serializeCssColor(targetBackground), 'important');
    body.style.setProperty('background-color', serializeCssColor(targetBackground), 'important');
  }

  let restored = false;
  return () => {
    if (restored) return;
    restored = true;

    restoreSavedStyles(savedStyles);
    restoreRootState(bodyState);
    restoreRootState(htmlState);
    if (createdStyle) style?.remove();
  };
}
