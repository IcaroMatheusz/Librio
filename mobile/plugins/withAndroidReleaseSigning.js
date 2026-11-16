const { withAppBuildGradle } = require('@expo/config-plugins');

module.exports = function withAndroidReleaseSigning(config) {
  return withAppBuildGradle(config, (mod) => {
    let gradle = mod.modResults.contents;
    if (!gradle.includes('librioRelease')) {
      gradle = gradle.replace(
        'signingConfigs {\n        debug {',
        `signingConfigs {
        librioRelease {
            storeFile file(System.getenv("LIBRIO_UPLOAD_STORE_FILE"))
            storePassword System.getenv("LIBRIO_UPLOAD_STORE_PASSWORD")
            keyAlias System.getenv("LIBRIO_UPLOAD_KEY_ALIAS")
            keyPassword System.getenv("LIBRIO_UPLOAD_KEY_PASSWORD")
        }
        debug {`,
      );
    }
    const buildTypesIndex = gradle.indexOf('buildTypes {');
    const releaseIndex = gradle.indexOf('release {', buildTypesIndex);
    const releaseSigningIndex = gradle.indexOf('signingConfig signingConfigs.debug', releaseIndex);
    if (buildTypesIndex >= 0 && releaseIndex >= 0 && releaseSigningIndex >= 0) {
      const signingLine = 'signingConfig signingConfigs.debug';
      gradle = `${gradle.slice(0, releaseSigningIndex)}signingConfig signingConfigs.librioRelease${gradle.slice(releaseSigningIndex + signingLine.length)}`;
    }
    if (!gradle.includes('signingConfig signingConfigs.librioRelease')) {
      throw new Error('Não foi possível configurar a assinatura estável do APK do Librio.');
    }
    mod.modResults.contents = gradle;
    return mod;
  });
};
