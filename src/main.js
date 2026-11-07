import './ui/styles.css';
import { App } from './game/app.js';

const app = new App({
  canvas: document.getElementById('c'),
  root: document.getElementById('ui'),
  stage: document.getElementById('app'),
});
if (app.debug) window.__tilt = app;
app.start();

// Offline support: register the service worker on secure origins in production builds.
if (!__DEV__ && 'serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
