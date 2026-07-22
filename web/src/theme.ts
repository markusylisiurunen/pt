const DEFAULT_THEME_HUE = 60;

function isThemeHue(value: unknown): value is number {
  return typeof value === "number" && value >= 0 && value <= 360;
}

function applyThemeHue(themeHue: number): void {
  document.documentElement.style.setProperty("--theme-hue", String(themeHue));
  document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')!.content =
    `lch(7.2% 2 ${themeHue})`;
}

export { applyThemeHue, DEFAULT_THEME_HUE, isThemeHue };
