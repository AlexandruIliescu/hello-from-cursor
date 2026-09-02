import { captureAndSend } from '../lib/capture';
import { getPendingSync, clearPendingSync, getSettings, getLicense } from '../lib/storage';
import { syncPacks, verifyLicense } from '../lib/license';
import { isPaidTier } from '../lib/types';

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => {
    browser.contextMenus.create({
      id: 'contextdrop-capture',
      title: 'ContextDrop: capture page',
      contexts: ['page', 'selection'],
    });
    browser.contextMenus.create({
      id: 'contextdrop-selection',
      title: 'ContextDrop: capture selection',
      contexts: ['selection'],
    });

    // Popup is default; side panel remains available via chrome side panel UI.
  });

  browser.contextMenus.onClicked.addListener(async (info) => {
    try {
      if (info.menuItemId === 'contextdrop-capture') {
        await captureAndSend();
      } else if (info.menuItemId === 'contextdrop-selection') {
        await captureAndSend(undefined, 'selection');
      }
    } catch (err) {
      console.error('ContextDrop capture failed', err);
    }
  });

  browser.commands.onCommand.addListener(async (command) => {
    if (command === 'capture-page') {
      try {
        await captureAndSend();
      } catch (err) {
        console.error(err);
      }
    }
  });

  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    (async () => {
      if (message?.type === 'CAPTURE_AND_SEND') {
        const result = await captureAndSend(message.destination, message.templateId);
        sendResponse({ ok: true, result });
        return;
      }
      if (message?.type === 'SYNC_NOW') {
        const settings = await getSettings();
        if (!settings.syncEnabled) {
          sendResponse({ ok: false, error: 'Sync disabled' });
          return;
        }
        const pending = await getPendingSync();
        if (!pending.length) {
          sendResponse({ ok: true, syncedIds: [] });
          return;
        }
        const { syncedIds } = await syncPacks(pending);
        await clearPendingSync(syncedIds);
        sendResponse({ ok: true, syncedIds });
        return;
      }
      sendResponse({ ok: false, error: 'Unknown message' });
    })().catch((err) => {
      sendResponse({ ok: false, error: String(err?.message ?? err) });
    });
    return true;
  });

  // Periodic license re-check + sync
  browser.alarms.create('contextdrop-maintenance', { periodInMinutes: 60 });
  browser.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name !== 'contextdrop-maintenance') return;
    const license = await getLicense();
    if (license.licenseKey) {
      try {
        await verifyLicense(license.licenseKey);
      } catch {
        /* offline grace handled in verifyLicense */
      }
    }
    const settings = await getSettings();
    if (settings.syncEnabled && isPaidTier(license)) {
      try {
        const pending = await getPendingSync();
        if (pending.length) {
          const { syncedIds } = await syncPacks(pending);
          await clearPendingSync(syncedIds);
        }
      } catch {
        /* retry next hour */
      }
    }
  });
});
