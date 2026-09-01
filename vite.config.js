import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

import content from '@originjs/vite-plugin-content';
import preact from '@preact/preset-vite';
import { defineConfig, loadEnv } from 'vite';

async function loadHomePrerender() {
  const href = pathToFileURL(
    path.join(process.cwd(), 'scripts/home-prerender.mjs'),
  ).href;
  return import(href);
}

const commitHash = require('child_process')
  .execSync('git rev-parse --short HEAD')
  .toString()
  .trim();

const googleAnalyticsPlugin = (gaId) => ({
  name: 'inject-google-analytics',
  transformIndexHtml() {
    if (!gaId) return [];
    return [
      {
        tag: 'script',
        attrs: {
          async: true,
          src: `https://www.googletagmanager.com/gtag/js?id=${gaId}`,
        },
        injectTo: 'head',
      },
      {
        tag: 'script',
        children:
          'window.dataLayer = window.dataLayer || [];' +
          'function gtag(){dataLayer.push(arguments);}' +
          "gtag('js', new Date());" +
          `gtag('config', '${gaId}');`,
        injectTo: 'head',
      },
    ];
  },
});

/** Build-time SEO: static copy in index.html (outside #app so Preact does not wipe it) + study hub HTML. */
const homeSsgPrerenderPlugin = () => {
  let resolvedOutDir;
  return {
    name: 'home-ssg-prerender',
    configResolved(config) {
      resolvedOutDir = path.resolve(config.root, config.build.outDir);
    },
    async transformIndexHtml(html) {
      const { buildHomePrerenderHtml } = await loadHomePrerender();
      const block = buildHomePrerenderHtml();
      if (!html.includes('<div id="app"></div>')) {
        console.warn(
          '[home-ssg-prerender] <div id="app"></div> not found; skip inject',
        );
        return html;
      }
      return html.replace(
        '<div id="app"></div>',
        `${block}\n    <div id="app"></div>`,
      );
    },
    async closeBundle() {
      const { buildHskStudyGuideHtml } = await loadHomePrerender();
      const studyDir = path.join(resolvedOutDir, 'study');
      fs.mkdirSync(studyDir, { recursive: true });
      fs.writeFileSync(
        path.join(studyDir, 'chinese-idiom-hsk-guide.html'),
        buildHskStudyGuideHtml(),
        'utf8',
      );
    },
  };
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const gaId = env.VITE_GA_MEASUREMENT_ID || '';

  return {
    base: './',
    define: {
      __COMMIT_HASH__: JSON.stringify(commitHash),
    },
    plugins: [
      preact(),
      content(),
      googleAnalyticsPlugin(gaId),
      homeSsgPrerenderPlugin(),
    ],
    server: {
      port: 3030,
      host: true,
    },
    preview: {
      host: true,
      // https: true,
    },
    build: {
      assetsInlineLimit: 0,
      target: 'es2020',
      sourcemap: false,
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        output: {
          manualChunks(id) {
            const normalizedId = id.replace(/\\/g, '/');
            if (normalizedId.includes('.css')) return; // Do nothing for CSS
            if (normalizedId.includes('all-idioms')) return 'all-idioms';
            if (normalizedId.includes('game-idioms')) return 'game-idioms';
            if (normalizedId.includes('node_modules/pinyin-pro/data'))
              return 'pinyin-data';
            if (normalizedId.includes('node_modules')) return 'vendor';
          },
        },
      },
    },
    test: {
      include: ['**/*.test.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    },
  };
});
