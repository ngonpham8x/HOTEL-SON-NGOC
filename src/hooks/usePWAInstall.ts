import { useSyncExternalStore } from 'react';
import { detectInstallEnvironment, type InstallEnvironment } from '../utils/installGuides';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

interface InstallState { deferredPrompt: BeforeInstallPromptEvent | null; isInstalled: boolean; isIOS: boolean; environment: InstallEnvironment }
let state: InstallState = { deferredPrompt: null, isInstalled: false, isIOS: false, environment: { platform: 'OTHER', browser: 'OTHER', inAppBrowser: false } };
const listeners = new Set<() => void>();
let listening = false;
const update = (changes: Partial<InstallState>) => {
  state = { ...state, ...changes };
  listeners.forEach(listener => listener());
};
const beforeInstall = (event: Event) => { event.preventDefault(); update({ deferredPrompt: event as BeforeInstallPromptEvent }); };
const installed = () => update({ isInstalled: true, deferredPrompt: null });
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  if (!listening) {
    listening = true;
    window.addEventListener('beforeinstallprompt', beforeInstall);
    window.addEventListener('appinstalled', installed);
    update({
      isInstalled: window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true,
      isIOS: /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
      environment: detectInstallEnvironment(navigator),
    });
  }
  return () => { listeners.delete(listener); };
};
const getSnapshot = () => state;

// Retain the browser prompt when the login screen unmounts and the menu mounts.
export function usePWAInstall() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot);
  const installApp = async () => {
    const prompt = state.deferredPrompt;
    if (!prompt) return;
    update({ deferredPrompt: null });
    await prompt.prompt();
    await prompt.userChoice;
    // Only appinstalled confirms completion; accepting a prompt is not enough.
  };
  return { ...snapshot, isInstallable: !!snapshot.deferredPrompt || snapshot.isIOS, installApp };
}
if (import.meta.hot) import.meta.hot.dispose(() => {
  window.removeEventListener('beforeinstallprompt', beforeInstall);
  window.removeEventListener('appinstalled', installed);
});
