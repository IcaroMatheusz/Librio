import AsyncStorage from '@react-native-async-storage/async-storage';

const LATEST_RELEASE_API = 'https://api.github.com/repos/IcaroMatheusz/Librio/releases/latest';
const APK_ASSET_NAME = 'librio-android.apk';
const DISMISSED_VERSION_KEY = 'librio.dismissed-android-update';

export type AppUpdate = { version: string; downloadUrl: string };

function versionParts(value: string) {
  return value.replace(/^v/i, '').split(/[.+-]/).map((part) => Number.parseInt(part, 10) || 0);
}

export function isVersionNewer(candidate: string, current: string) {
  const next = versionParts(candidate);
  const installed = versionParts(current);
  for (let index = 0; index < Math.max(next.length, installed.length); index += 1) {
    const delta = (next[index] ?? 0) - (installed[index] ?? 0);
    if (delta !== 0) return delta > 0;
  }
  return false;
}

export async function checkForAppUpdate(currentVersion: string): Promise<AppUpdate | null> {
  const response = await fetch(LATEST_RELEASE_API, {
    headers: { Accept: 'application/vnd.github+json' },
  });
  if (!response.ok) throw new Error(`GitHub respondeu com HTTP ${response.status}.`);

  const release: unknown = await response.json();
  if (typeof release !== 'object' || release === null) return null;
  const data = release as { tag_name?: unknown; assets?: unknown };
  if (typeof data.tag_name !== 'string' || !Array.isArray(data.assets)) return null;
  const asset = data.assets.find((entry) => {
    if (typeof entry !== 'object' || entry === null) return false;
    const candidate = entry as { name?: unknown; browser_download_url?: unknown };
    return typeof candidate.name === 'string'
      && candidate.name.toLowerCase() === APK_ASSET_NAME
      && typeof candidate.browser_download_url === 'string';
  }) as { browser_download_url: string } | undefined;

  if (!asset || !isVersionNewer(data.tag_name, currentVersion)) return null;
  const dismissed = await AsyncStorage.getItem(DISMISSED_VERSION_KEY);
  if (dismissed === data.tag_name) return null;
  return { version: data.tag_name.replace(/^v/i, ''), downloadUrl: asset.browser_download_url };
}

export async function dismissAppUpdate(version: string) {
  await AsyncStorage.setItem(DISMISSED_VERSION_KEY, `v${version.replace(/^v/i, '')}`);
}
