import { useEffect } from 'react';
import { useRecoilState } from 'recoil';
import TagManager from 'react-gtm-module';
import { installCloudFrontImageRetry } from '@librechat/client';
import {
  getTokenHeader,
  LocalStorageKeys,
  PermissionTypes,
  Permissions,
  resolveModelSpecEndpoint,
} from 'librechat-data-provider';
import type { TStartupConfig, TUser } from 'librechat-data-provider';
import { cleanupTimestampedStorage } from '~/utils/timestamps';
import useSpeechSettingsInit from './useSpeechSettingsInit';
import { useHasAccess, useCatalogReady } from '~/hooks';
import { useMCPServersQuery } from '~/data-provider';
import store from '~/store';

export default function useAppStartup({
  startupConfig,
  user,
}: {
  startupConfig?: TStartupConfig;
  user?: TUser;
}) {
  const [defaultPreset, setDefaultPreset] = useRecoilState(store.defaultPreset);
  const canUseMcp = useHasAccess({
    permissionType: PermissionTypes.MCP_SERVERS,
    permission: Permissions.USE,
  });

  useSpeechSettingsInit(!!user);
  /** Server metadata may warm after first paint because it powers lightweight
   * navigation affordances. Tool discovery stays owned by visible MCP consumers. */
  const mcpServersReady = useCatalogReady('mcpServers');
  useMCPServersQuery({ enabled: canUseMcp && mcpServersReady });

  /** Clean up old localStorage entries on startup */
  useEffect(() => {
    cleanupTimestampedStorage();
  }, []);

  /** Set the app title */
  useEffect(() => {
    const appTitle = startupConfig?.appTitle ?? '';
    // #region agent log
    {
      const faviconHrefs = Array.from(
        document.querySelectorAll('link[rel="icon"], link[rel="apple-touch-icon"]'),
      ).map((el) => (el as HTMLLinkElement).href);
      const metaDescription =
        document.querySelector('meta[name="description"]')?.getAttribute('content') ?? null;
      const storedTitle = localStorage.getItem(LocalStorageKeys.APP_TITLE);
      fetch('http://127.0.0.1:7415/ingest/2fe0b457-50fa-426a-b6b7-bf9ada7ea33a', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '2a1742' },
        body: JSON.stringify({
          sessionId: '2a1742',
          runId: 'post-fix',
          hypothesisId: 'A,B,C,D,E',
          location: 'client/src/hooks/Config/useAppStartup.ts:setTitle',
          message: 'client title/favicon state',
          data: {
            configAppTitle: appTitle || null,
            documentTitleBefore: document.title,
            metaDescription,
            faviconHrefs,
            storedTitle,
            willSetTitle: !!appTitle,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
    }
    // #endregion
    if (!appTitle) {
      return;
    }
    document.title = appTitle;
    localStorage.setItem(LocalStorageKeys.APP_TITLE, appTitle);
  }, [startupConfig]);

  /** Set the default spec's preset as default */
  useEffect(() => {
    if (defaultPreset && defaultPreset.spec != null) {
      return;
    }

    const modelSpecs = startupConfig?.modelSpecs?.list;

    if (!modelSpecs || !modelSpecs.length) {
      return;
    }

    const defaultSpec = modelSpecs.find((spec) => spec.default);

    if (!defaultSpec) {
      return;
    }

    setDefaultPreset({
      ...defaultSpec.preset,
      endpoint: resolveModelSpecEndpoint(defaultSpec) ?? null,
      iconURL: defaultSpec.iconURL,
      spec: defaultSpec.name,
    });
  }, [defaultPreset, setDefaultPreset, startupConfig?.modelSpecs?.list]);

  useEffect(() => {
    return installCloudFrontImageRetry(startupConfig, { getAuthorizationHeader: getTokenHeader });
  }, [startupConfig]);

  useEffect(() => {
    if (startupConfig?.analyticsGtmId != null && typeof window.google_tag_manager === 'undefined') {
      const tagManagerArgs = {
        gtmId: startupConfig.analyticsGtmId,
      };
      TagManager.initialize(tagManagerArgs);
    }
  }, [startupConfig?.analyticsGtmId]);
}
