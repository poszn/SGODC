/* ═══════════════════════════════════════════
   SGDC – gps.js
   Rastreamento GPS de percurso e km
═══════════════════════════════════════════ */

const GPS = (() => {
  let watchId = null;
  let points = [];
  let totalDistance = 0;
  let startTime = null;
  let onUpdate = null;

  // Haversine formula (returns km)
  function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 +
              Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) *
              Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  function isTracking() { return watchId !== null; }

  function start(callback) {
    if (!navigator.geolocation) {
      showToast('GPS não suportado neste dispositivo', 'error');
      return false;
    }
    if (isTracking()) return false;

    points = [];
    totalDistance = 0;
    startTime = new Date();
    onUpdate = callback;

    watchId = navigator.geolocation.watchPosition(
      pos => {
        const { latitude, longitude, accuracy } = pos.coords;
        if (accuracy > 50) return; // Ignore low-accuracy readings
        const pt = { lat: latitude, lon: longitude, time: pos.timestamp };
        if (points.length > 0) {
          const prev = points[points.length - 1];
          const d = haversine(prev.lat, prev.lon, latitude, longitude);
          if (d > 0.005) { // Ignore micro-movements < 5 metres
            totalDistance += d;
          }
        }
        points.push(pt);
        if (onUpdate) onUpdate(getState());
      },
      err => {
        let msg = 'Erro GPS';
        if (err.code === 1) msg = 'Permissão GPS negada';
        else if (err.code === 2) msg = 'GPS indisponível';
        else if (err.code === 3) msg = 'Tempo limite GPS expirado';
        showToast(msg, 'error');
        stop();
      },
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 5000 }
    );

    showToast('GPS iniciado ✓', 'success');
    return true;
  }

  function stop() {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }
  }

  function reset() {
    stop();
    points = [];
    totalDistance = 0;
    startTime = null;
  }

  function getState() {
    const elapsed = startTime ? Math.floor((Date.now() - startTime.getTime()) / 1000) : 0;
    const hh = Math.floor(elapsed / 3600);
    const mm = Math.floor((elapsed % 3600) / 60);
    const ss = elapsed % 60;
    return {
      tracking: isTracking(),
      distance: totalDistance,
      distanceFormatted: totalDistance >= 1
        ? `${totalDistance.toFixed(2)} km`
        : `${(totalDistance * 1000).toFixed(0)} m`,
      points: points.length,
      elapsed,
      elapsedFormatted: `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`,
      startTime,
      lastPoint: points[points.length - 1] || null,
    };
  }

  function getCurrentPosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) { reject(new Error('GPS não suportado')); return; }
      navigator.geolocation.getCurrentPosition(
        pos => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude, acc: pos.coords.accuracy }),
        err => reject(err),
        { enableHighAccuracy: true, timeout: 15000 }
      );
    });
  }

  // Get static map URL (OpenStreetMap tile)
  function getMapUrl(lat, lon, zoom = 14) {
    return `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lon}&zoom=${zoom}&size=400x200&markers=${lat},${lon},red`;
  }

  return { start, stop, reset, isTracking, getState, getCurrentPosition, getMapUrl, haversine };
})();


/* ─── GPS UI CONTROLLER ─── */
let gpsTimer = null;
let gpsTargetField = null; // which form km field to fill

function startGPSTracking(targetField) {
  gpsTargetField = targetField;
  const modal = document.getElementById('modal-gps');
  if (!modal) return;

  GPS.reset();
  modal.classList.remove('hidden');
  updateGPSDisplay(GPS.getState());

  const ok = GPS.start(state => {
    updateGPSDisplay(state);
    if (gpsTargetField) {
      const el = document.getElementById(gpsTargetField);
      if (el) el.value = state.distance.toFixed(2);
    }
  });

  if (ok) {
    gpsTimer = setInterval(() => {
      updateGPSDisplay(GPS.getState());
    }, 1000);
  }
}

function stopGPSTracking() {
  GPS.stop();
  if (gpsTimer) { clearInterval(gpsTimer); gpsTimer = null; }
  const state = GPS.getState();
  updateGPSDisplay(state);

  // Fill target field
  if (gpsTargetField) {
    const el = document.getElementById(gpsTargetField);
    if (el) el.value = state.distance.toFixed(2);
  }
}

function closeGPSModal() {
  stopGPSTracking();
  document.getElementById('modal-gps')?.classList.add('hidden');
}

function updateGPSDisplay(state) {
  const distEl = document.getElementById('gps-distance');
  const timeEl = document.getElementById('gps-time');
  const ptsEl  = document.getElementById('gps-points');
  const btnEl  = document.getElementById('gps-toggle-btn');

  if (distEl) distEl.textContent = state.distanceFormatted;
  if (timeEl) timeEl.textContent = state.elapsedFormatted;
  if (ptsEl)  ptsEl.textContent  = state.points + ' pontos';
  if (btnEl) {
    btnEl.textContent = state.tracking ? '⏹ Parar Rastreamento' : '▶ Iniciar Rastreamento';
    btnEl.className = 'btn btn-full ' + (state.tracking ? 'btn-danger' : 'btn-success');
  }
}
