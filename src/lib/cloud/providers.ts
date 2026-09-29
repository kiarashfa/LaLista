/**
 * Registry of cloud providers available in this build. A provider appears
 * only when configured (its public client ID is set at build time), so an
 * unconfigured build simply shows the local-file options.
 *
 * Adding a provider (e.g. OneDrive, Dropbox) = one adapter implementing
 * CloudProvider + an entry here; the sync engine and UI are shared.
 */
import { googleDrive, googleDriveConfigured } from './googleDrive';
import { mockEnabled, mockProvider } from './mockProvider';
import type { CloudProvider, ProviderId } from './types';

export function availableProviders(): CloudProvider[] {
  const list: CloudProvider[] = [];
  if (googleDriveConfigured) list.push(googleDrive);
  if (import.meta.env.DEV && typeof localStorage !== 'undefined' && mockEnabled()) list.push(mockProvider);
  return list;
}

export function getProvider(id: ProviderId): CloudProvider | null {
  return availableProviders().find((p) => p.id === id) ?? null;
}
