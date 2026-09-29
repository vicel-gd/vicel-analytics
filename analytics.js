/* ============================================================
   VICEL Analytics — Tracker
   Envía cada visita a Firestore sin instalar nada.
   Uso: <script src="analytics.js"></script> antes de </body>
   ============================================================ */
(function () {
  'use strict';

  // ═══════════════════════════════════════════════════════════
  // CONFIGURACIÓN — Cambiar SITE_ID y SITE_NAME por web
  // ═══════════════════════════════════════════════════════════
  var SITE_ID   = 'vicel-finanzas';        // <-- ID único de la web
  var SITE_NAME = 'VICEL Finanzas';        // <-- Nombre legible
  // ═══════════════════════════════════════════════════════════

  var PROJECT_ID = 'vicel-analytics';
  var API_KEY    = 'AIzaSyBImDQlp5zYCPvbZIjKtyZnpHRb0-yB1Y';
  var COLLECTION = 'visits';

  // --- Exclusión manual (para no contar tus propias visitas) ---
  try {
    var params = new URLSearchParams(location.search);
    if (params.get('notrack') === '1') {
      localStorage.setItem('_vicel_no_track', '1');
      return;
    }
    if (params.get('track') === '1') {
      localStorage.removeItem('_vicel_no_track');
    }
    if (localStorage.getItem('_vicel_no_track') === '1') return;
  } catch (e) { /* modo incógnito, seguimos */ }

  // --- IDs persistentes ---
  var visitorId;
  try {
    visitorId = localStorage.getItem('_vicel_vid');
    if (!visitorId) {
      visitorId = 'v_' + Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
      localStorage.setItem('_vicel_vid', visitorId);
    }
  } catch (e) { visitorId = 'v_tmp_' + Date.now(); }

  var sessionId;
  try {
    sessionId = sessionStorage.getItem('_vicel_sid');
    if (!sessionId) {
      sessionId = 's_' + Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
      sessionStorage.setItem('_vicel_sid', sessionId);
    }
  } catch (e) { sessionId = 's_tmp_' + Date.now(); }

  // --- Parsear user agent ---
  function parseUA(ua) {
    var browser = 'Otro', os = 'Otro', device = 'PC';
    if (/Edg\//.test(ua)) browser = 'Edge';
    else if (/OPR\/|Opera/.test(ua)) browser = 'Opera';
    else if (/Chrome\//.test(ua)) browser = 'Chrome';
    else if (/Firefox\//.test(ua)) browser = 'Firefox';
    else if (/Safari\//.test(ua)) browser = 'Safari';

    if (/Windows/.test(ua)) os = 'Windows';
    else if (/Mac OS X|Macintosh/.test(ua)) os = 'macOS';
    else if (/Android/.test(ua)) os = 'Android';
    else if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS';
    else if (/Linux/.test(ua)) os = 'Linux';

    if (/iPad|Tablet/.test(ua)) device = 'Tablet';
    else if (/Mobi|Android|iPhone/.test(ua)) device = 'Celular';

    return { browser: browser, os: os, device: device };
  }

  // --- Ubicación (con caché de sesión) ---
  function getLocation() {
    return new Promise(function (resolve) {
      try {
        var cached = sessionStorage.getItem('_vicel_loc');
        if (cached) { resolve(JSON.parse(cached)); return; }
      } catch (e) {}
      var done = false;
      var finish = function (loc) {
        if (done) return; done = true;
        try { sessionStorage.setItem('_vicel_loc', JSON.stringify(loc)); } catch (e) {}
        resolve(loc);
      };
      setTimeout(function () { finish({ country: '', city: '' }); }, 2500);
      try {
        fetch('https://ipwho.is/')
          .then(function (r) { return r.json(); })
          .then(function (d) {
            if (d && d.success !== false) {
              finish({ country: d.country || '', city: d.city || '' });
            } else { finish({ country: '', city: '' }); }
          })
          .catch(function () { finish({ country: '', city: '' }); });
      } catch (e) { finish({ country: '', city: '' }); }
    });
  }

  // --- Convertir a formato Firestore REST ---
  function toFsValue(v) {
    if (v === null || v === undefined) return { nullValue: null };
    if (typeof v === 'number') return { doubleValue: v };
    if (typeof v === 'boolean') return { booleanValue: v };
    return { stringValue: String(v) };
  }

  // --- Enviar a Firestore ---
  function send(payload) {
    var fields = {};
    Object.keys(payload).forEach(function (k) { fields[k] = toFsValue(payload[k]); });
    var url = 'https://firestore.googleapis.com/v1/projects/' + PROJECT_ID +
              '/databases/(default)/documents/' + COLLECTION + '?key=' + API_KEY;
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: fields }),
      keepalive: true
    }).catch(function () { /* silencioso */ });
  }

  // --- Rastrear visita ---
  function track() {
    var ua = navigator.userAgent;
    var parsed = parseUA(ua);
    var refFull = document.referrer || '';
    var refHost = '';
    try {
      if (refFull) refHost = new URL(refFull).hostname;
    } catch (e) {}
    // Referrer interno no cuenta
    if (refHost && refHost === location.hostname) { refHost = ''; refFull = ''; }

    var payload = {
      siteId: SITE_ID,
      siteName: SITE_NAME,
      url: location.href,
      path: location.pathname + location.search,
      title: document.title || '',
      referrer: refHost,
      referrerFull: refFull,
      browser: parsed.browser,
      os: parsed.os,
      device: parsed.device,
      language: navigator.language || '',
      screenW: screen.width || 0,
      screenH: screen.height || 0,
      viewportW: window.innerWidth || 0,
      viewportH: window.innerHeight || 0,
      visitorId: visitorId,
      sessionId: sessionId,
      timestamp: Date.now(),
      fecha: new Date().toISOString().slice(0, 10)
    };

    getLocation().then(function (loc) {
      payload.country = loc.country || '';
      payload.city = loc.city || '';
      send(payload);
    });
  }

  if (document.readyState === 'complete') track();
  else window.addEventListener('load', track);
})();