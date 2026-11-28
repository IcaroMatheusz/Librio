// Explicit web colors and the sRGB fallbacks of the project's Tailwind theme.
export const dark = {
  background: '#171A27', surface: '#202435', raised: '#222638', inset: '#151827',
  text: '#FFFFFF', secondary: '#CAD5E2', muted: '#90A1B9',
  border: 'rgba(255,255,255,0.10)', controlBorder: '#62748E',
  accent: '#A685FF', onAccent: '#1D1930', accentSoft: 'rgba(166,133,255,0.12)',
  editorial: '#FEE685', onEditorial: '#302347',
  progress: '#A685FF', track: 'rgba(255,255,255,0.12)',
  danger: '#FFA2AE', dangerSoft: 'rgba(255,162,174,0.10)', success: '#5EE9B5',
  scrim: 'rgba(10,12,21,0.68)',
};

export type LibraryColors = Readonly<typeof dark>;

// The web reader uses paper and cream in ComicReader/EpubReader, with white
// menus, stone text and violet-700 in ChapterSelector.
export const light: LibraryColors = {
  background: '#FFFAF0', surface: '#FFFFFF', raised: '#FFFFFF', inset: '#F2EADC',
  text: '#292524', secondary: '#44403B', muted: '#57534D',
  border: '#D6D3D1', controlBorder: '#79716B',
  accent: '#7008E7', onAccent: '#FFFFFF', accentSoft: '#EDE9FE',
  editorial: '#FEE685', onEditorial: '#302347',
  progress: '#7008E7', track: '#D6D3D1',
  danger: '#A30037', dangerSoft: 'rgba(163,0,55,0.07)', success: '#005F46',
  scrim: 'rgba(23,26,39,0.48)',
};

export const libraryInk = {
  canvas: '#0F111A', white: '#FFFFFF', hero: '#211D30', softOnHero: '#E2E8F0',
  yellow: '#FEE685', labelOnYellow: '#302347', formatBackdrop: 'rgba(23,26,39,0.85)',
} as const;

export const libraryGradients = {
  hero: 'linear-gradient(115deg, #211D30 0%, #32274F 65%, #2B1F24 100%)',
  heroShade: 'linear-gradient(90deg, #211D30 0%, rgba(33,29,48,0.93) 34%, rgba(33,29,48,0.38) 68%, rgba(33,29,48,0) 100%)',
  feature: 'linear-gradient(135deg, #32274F 0%, #28243F 50%, #202238 100%)',
  featureLight: 'linear-gradient(135deg, #FFFFFF 0%, #FFFAF0 50%, #F2EADC 100%)',
  cover: 'linear-gradient(135deg, #322B55 0%, #222638 50%, #171A27 100%)',
} as const;
