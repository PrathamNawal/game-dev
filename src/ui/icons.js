const s = (body, extra = '') => `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false" ${extra}>${body}</svg>`;
const stroke = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
export const ICON = {
  pause: s('<rect x="6" y="5" width="4" height="14" rx="1.2" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1.2" fill="currentColor"/>'),
  play: s('<path d="M7 4.5v15l13-7.5z" fill="currentColor"/>'),
  hint: s(`<path d="M9 21h6M10 17.5h4M12 3a6 6 0 0 0-3.6 10.8V16h7.2v-2.2A6 6 0 0 0 12 3z" ${stroke}/>`),
  recal: s(`<circle cx="12" cy="12" r="6.5" ${stroke}/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3" ${stroke}/>`),
  sliders: s(`<path d="M4 7h9M17 7h3M4 17h3M11 17h9" ${stroke}/><circle cx="15" cy="7" r="2" ${stroke}/><circle cx="9" cy="17" r="2" ${stroke}/>`),
  coin: s('<circle cx="12" cy="12" r="9" fill="#ffc933"/><circle cx="12" cy="12" r="6" fill="none" stroke="#b9780a" stroke-width="1.6"/><path d="M12 8.2v7.6M9.8 10.2h3.4a1.2 1.2 0 0 1 0 2.4h-2.4a1.2 1.2 0 0 0 0 2.4h3.4" fill="none" stroke="#b9780a" stroke-width="1.3" stroke-linecap="round"/>'),
  star: s('<path d="M12 2.5l2.9 6.3 6.9.7-5.2 4.6 1.5 6.9-6.1-3.5-6.1 3.5 1.5-6.9-5.2-4.6 6.9-.7z" fill="currentColor"/>'),
  flame: s('<path d="M12 2c1 3.5-2 4.8-2 8a2.3 2.3 0 0 0 4.6 0c0-1-.5-1.8-.8-2.4C16.7 9 18 11 18 13.5a6 6 0 0 1-12 0C6 9 10.5 7.5 12 2z" fill="#ff9d3d"/>'),
  levels: s('<rect x="4" y="4" width="7" height="7" rx="1.5" fill="currentColor"/><rect x="13" y="4" width="7" height="7" rx="1.5" fill="currentColor"/><rect x="4" y="13" width="7" height="7" rx="1.5" fill="currentColor"/><rect x="13" y="13" width="7" height="7" rx="1.5" fill="currentColor"/>'),
  share: s(`<path d="M12 15V3M8 7l4-4 4 4M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7" ${stroke}/>`),
  video: s(`<rect x="3" y="5" width="18" height="14" rx="3" ${stroke}/><path d="M10 9.2v5.6l4.6-2.8z" fill="currentColor"/>`),
  home: s(`<path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z" ${stroke}/>`),
  restart: s(`<path d="M20 12a8 8 0 1 1-2.6-5.9M20 4v5h-5" ${stroke}/>`),
  skip: s(`<path d="M5 5l9 7-9 7zM17 5v14" ${stroke}/>`),
  close: s(`<path d="M6 6l12 12M18 6L6 18" ${stroke}/>`),
  install: s(`<path d="M12 3v12M7 11l5 5 5-5M5 20h14" ${stroke}/>`),
};
