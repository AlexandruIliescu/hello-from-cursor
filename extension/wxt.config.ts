import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'ContextDrop',
    description:
      'Turn any webpage into a clean AI prompt pack and send it to ChatGPT, Claude, or Gemini in one click.',
    version: '0.1.0',
    icons: {
      16: 'icon-16.png',
      32: 'icon-32.png',
      48: 'icon-48.png',
      128: 'icon-128.png',
    },
    permissions: ['storage', 'activeTab', 'contextMenus', 'scripting', 'alarms', 'sidePanel'],
    host_permissions: [
      'https://chatgpt.com/*',
      'https://chat.openai.com/*',
      'https://claude.ai/*',
      'https://gemini.google.com/*',
      'http://localhost:8787/*',
      'https://api.contextdrop.app/*',
    ],
    action: {
      default_title: 'ContextDrop',
      default_popup: 'popup.html',
      default_icon: {
        16: 'icon-16.png',
        32: 'icon-32.png',
        48: 'icon-48.png',
        128: 'icon-128.png',
      },
    },
    commands: {
      'capture-page': {
        suggested_key: {
          default: 'Alt+Shift+D',
        },
        description: 'Capture page as ContextDrop pack',
      },
    },
  },
});