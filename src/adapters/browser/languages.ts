/** The browser's preferred languages, most preferred first. */
export const browserLanguages = (): readonly string[] =>
  navigator.languages?.length ? navigator.languages : [navigator.language];
