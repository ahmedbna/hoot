import type { AppConfig } from './lib/types';

export const APP_CONFIG_DEFAULTS: AppConfig = {
  companyName: 'hoot',
  pageTitle: 'hoot',
  pageDescription: 'Acquire new language',

  supportsChatInput: true,
  supportsVideoInput: false,
  supportsScreenShare: false,
  isPreConnectBufferEnabled: true,

  accent: '#002cf2',
  accentDark: '#1fd5f9',
  logo: '/lk-logo.svg',
  logoDark: '/lk-logo-dark.svg',
  startButtonText: 'Start lesson',
};
