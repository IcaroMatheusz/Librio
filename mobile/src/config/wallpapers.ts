import type { ImageSourcePropType } from 'react-native';

export const wallpaperAssets = {
  bleach: require('../../assets/bleach_wallpaper.jpg'),
  daredevil: require('../../assets/daredevil_wallpaper.jpg'),
  fullmetal: require('../../assets/fullmetal_wallpaper.jpg'),
  nightwing: require('../../assets/nightwing_wallpaper.jpg'),
  hellboy: require('../../../src/assets/mobile/hellboy_wallpaper.jpg'),
  onePiece: require('../../../src/assets/mobile/onepiece_wallpaper.jpg'),
} satisfies Record<string, ImageSourcePropType>;

// Escolha aqui uma arte para cada tela. Os arquivos e suas dimensões estão no README.
export const wallpapers = {
  library: wallpaperAssets.nightwing,
  profile: wallpaperAssets.daredevil,
  volumes: wallpaperAssets.fullmetal,
  login: wallpaperAssets.bleach,
  register: wallpaperAssets.onePiece,
  recovery: wallpaperAssets.hellboy,
};
