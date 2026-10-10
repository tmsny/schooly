(function () {
  const HM = window.HM, U = HM.U, KEY = 'hm.timer.v1';
  const TYPES = ['normal', 'flight'];
  const DEFAULT_DURATION = 25 * 60 * 1000;
  const ROUTE = { start: { x: 210, y: 168 }, control: { x: 410, y: 52 }, end: { x: 630, y: 174 } };

  let state = { type: 'normal', durationMs: DEFAULT_DURATION, remainingMs: DEFAULT_DURATION, deadline: null, running: false, completed: false };
  let interval = null, lastDisplayedSecond = null;

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      return true;
    } catch (error) {
      console.error('Schooly Timer-Speicherung fehlgeschlagen', error);
      U.toast('Timer konnte nicht gespeichert werden. Prüfe den verfügbaren Browser-Speicher.', true);
      return false;
    }
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const stored = JSON.parse(raw);
      if (!stored || !Number.isFinite(stored.durationMs) || stored.durationMs < 1000) return;
      const type = stored.type === 'flip' ? 'normal' : stored.type;
      if (!TYPES.includes(type)) return;
      state = {
        type,
        durationMs: Math.min(stored.durationMs, 180 * 60 * 1000),
        remainingMs: Number.isFinite(stored.remainingMs) ? Math.max(0, stored.remainingMs) : stored.durationMs,
        deadline: Number.isFinite(stored.deadline) ? stored.deadline : null,
        running: stored.running === true,
        completed: stored.completed === true
      };
      if (stored.type === 'flip') save();
      if (state.running && state.deadline) state.remainingMs = Math.max(0, state.deadline - Date.now());
      else if (state.running) state.running = false;
    } catch (error) {
      console.error('Schooly Timer konnte nicht geladen werden', error);
      U.toast('Der gespeicherte Timer konnte nicht geladen werden.', true);
    }
  }

  function secondsLeft() {
    return Math.ceil(Math.max(0, state.remainingMs) / 1000);
  }

  function clockText() {
    const seconds = secondsLeft();
    return String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
  }

  function modeMarkup() {
    const modes = [
      ['normal', 'Normal', 'Klar und übersichtlich'],
      ['flight', 'Weltreise', 'Flieg der Zeit davon']
    ];
    return '<div class="timer-modes" role="group" aria-label="Timer-Design">' + modes.map(([type, title, subtitle]) =>
      '<button class="timer-mode' + (state.type === type ? ' selected' : '') + '" type="button" data-action="timer-type" data-type="' + type + '" aria-pressed="' + (state.type === type) + '">' +
      '<strong>' + title + '</strong><span>' + subtitle + '</span></button>'
    ).join('') + '</div>';
  }

  function flightMarkup() {
    return '<section class="flight-card' + (state.type === 'flight' ? ' active' : '') + '" id="flight-card" aria-label="Flug von Berlin nach Tokio">' +
      '<div class="flight-heading"><div><p class="timer-kicker">FOCUS FLIGHT</p><h2>Deine Lernreise</h2></div><span class="flight-status" id="flight-status">Bereit zum Abflug</span></div>' +
      '<div class="flight-map"><svg viewBox="0 0 800 300" role="img" aria-labelledby="map-title map-desc">' +
      '<title id="map-title">Flugroute von Berlin nach Tokio</title><desc id="map-desc">Ein Flugzeug fliegt auf einer stilisierten Weltkarte von Berlin nach Tokio. Die zurückgelegte Strecke entspricht deiner Timer-Zeit.</desc>' +
      '<defs><linearGradient id="flight-gradient" x1="0" x2="1"><stop offset="0" stop-color="#6178e8"/><stop offset="1" stop-color="#7787e8"/></linearGradient></defs>' +
      '<path class="map-land" d="M65 97 84 73l28-13 28 3 13 13 23 1 18 13-4 15-19 5-8 19-21 8-9 23-20 8-13-13-17 1-13-13-22-5-8-16-18-7-5-13 15-10 14 4 9-9zm159-26 17-5 15 9-3 15-14 5-10-10zm102-24 24-13 33 3 18 13 28 5 21 17 16 7 11 18-10 13-22-2-5 15-15 4-3 19-18 2-12 16-15-8-4-18-16-9 1-17-13-10 3-14-13-9zm89 108 17-8 16 10 1 17-13 13-18-7zm99-91 20-7 24 8 22-2 24 10 20 17-7 12-20 3-13 12-22-4-20-11-18-3-13-13zm83 64 17-5 18 9 17-2 18 13-6 14-20 3-9 13-16 2-15-14-16-7zM345 224l17-5 18 7 5 11-15 7-19-4z"/>' +
      '<path class="flight-route" d="M210 168 Q410 52 630 174"/>' +
      '<path class="flight-progress" id="flight-progress" d="M210 168 Q410 52 630 174" pathLength="1000"/>' +
      '<circle class="flight-origin" cx="210" cy="168" r="6"/><circle class="flight-destination" cx="630" cy="174" r="7"/>' +
      '<text class="map-label" x="190" y="198">Berlin</text><text class="map-label" x="641" y="198">Tokio</text>' +
      '<g class="flight-plane" id="flight-plane" transform="translate(210 168) rotate(-30)" aria-hidden="true"><path d="M-15 1.5 14-1 18 0l-4 2-29 1.5 7 7-2 1-11-7-5 .3 4-2.6-4-2.2 5 .3 11-7 2 1z"/></g></svg></div>' +
      '<div class="flight-cities"><span class="flight-city"><b>BER</b><small>Berlin</small></span><span class="flight-arrival" id="flight-arrival">Noch nicht gestartet</span><span class="flight-city"><b>HND</b><small>Tokio</small></span></div>' +
      '<div class="flight-progress-track" role="progressbar" id="flight-progress-bar" aria-label="Flugfortschritt" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span id="flight-progress-fill"></span></div>' +
      '</section>';
  }

  function render() {
    const initialDisplay = clockText();
    return '<div class="head"><div><h1>Lern-Timer</h1><p class="mute">Fokussiere dich auf eine Sache und lass die Zeit für dich arbeiten.</p></div></div>' +
      '<div class="timer-layout"><section class="card timer-card" aria-label="Countdown-Timer">' +
      '<div class="timer-card-head"><div><p class="timer-kicker">DEIN FOKUS-BLOCK</p><h2 id="timer-title">' + (state.type === 'flight' ? 'Auf nach Tokio' : 'Zeit für dich') + '</h2></div><span class="timer-running" id="timer-running">' + (state.running ? 'Läuft' : state.completed ? 'Angekommen' : 'Bereit') + '</span></div>' +
      '<div class="timer-display-wrap"><div class="timer-display" id="timer-display" role="timer" aria-label="' + Math.floor(secondsLeft() / 60) + ' Minuten ' + (secondsLeft() % 60) + ' Sekunden" aria-live="off">' + initialDisplay + '</div></div>' +
      '<div class="timer-duration"><label for="timer-minutes">Dauer</label><div class="timer-duration-inputs"><input id="timer-minutes" type="number" min="1" max="180" step="1" value="' + Math.max(1, Math.floor(state.durationMs / 60000)) + '" aria-label="Minuten"><span>Min</span><input id="timer-seconds" type="number" min="0" max="59" step="1" value="' + Math.floor((state.durationMs % 60000) / 1000) + '" aria-label="Sekunden"><span>Sek</span></div><small>1 bis 180 Minuten</small></div>' +
      '<div class="timer-controls"><button class="btn" id="timer-toggle" type="button" data-action="timer-toggle">' + (state.running ? 'Pause' : state.completed ? 'Nochmal starten' : 'Timer starten') + '</button><button class="btn ghost" type="button" data-action="timer-reset">Zurücksetzen</button></div>' +
      '<p class="timer-hint" id="timer-hint">' + (state.completed ? 'Geschafft! Dein Timer ist abgelaufen.' : state.running ? 'Bleib dran – du bist auf Kurs.' : 'Stell deine Zeit ein und wähle deinen Lieblingsstil.') + '</p>' +
      '</section><section class="timer-options"><div><div class="sec"><h2>Dein Timer-Stil</h2></div>' + modeMarkup() + '</div>' + flightMarkup() + '</section></div>';
  }

  function updateMode() {
    const display = document.getElementById('timer-display');
    if (!display) return;
    const flight = document.getElementById('flight-card');
    if (flight) flight.classList.toggle('active', state.type === 'flight');
    document.querySelectorAll('.timer-mode').forEach((button) => {
      const selected = button.dataset.type === state.type;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    const title = document.getElementById('timer-title');
    if (title) title.textContent = state.type === 'flight' ? 'Auf nach Tokio' : 'Zeit für dich';
  }

  function pointOnRoute(progress) {
    const t = Math.max(0, Math.min(1, progress)), inverse = 1 - t;
    return {
      x: inverse * inverse * ROUTE.start.x + 2 * inverse * t * ROUTE.control.x + t * t * ROUTE.end.x,
      y: inverse * inverse * ROUTE.start.y + 2 * inverse * t * ROUTE.control.y + t * t * ROUTE.end.y
    };
  }

  function updateFlight() {
    const progress = state.completed ? 1 : 1 - Math.max(0, state.remainingMs) / state.durationMs;
    const path = document.getElementById('flight-progress');
    if (path) path.style.strokeDashoffset = String(1000 * (1 - Math.max(0, Math.min(1, progress))));
    const percent = Math.round(progress * 100);
    const progressBar = document.getElementById('flight-progress-bar');
    const progressFill = document.getElementById('flight-progress-fill');
    if (progressBar) progressBar.setAttribute('aria-valuenow', String(percent));
    if (progressFill) progressFill.style.width = percent + '%';
    const plane = document.getElementById('flight-plane');
    if (plane) {
      const point = pointOnRoute(progress);
      const t = Math.max(0, Math.min(1, progress)), inverse = 1 - t;
      const dx = 2 * inverse * (ROUTE.control.x - ROUTE.start.x) + 2 * t * (ROUTE.end.x - ROUTE.control.x);
      const dy = 2 * inverse * (ROUTE.control.y - ROUTE.start.y) + 2 * t * (ROUTE.end.y - ROUTE.control.y);
      const angle = Math.atan2(dy, dx) * 180 / Math.PI;
      plane.setAttribute('transform', 'translate(' + point.x.toFixed(1) + ' ' + point.y.toFixed(1) + ') rotate(' + angle.toFixed(1) + ')');
    }
    const status = document.getElementById('flight-status');
    const arrival = document.getElementById('flight-arrival');
    if (status) status.textContent = state.completed ? 'Angekommen!' : state.running ? 'Unterwegs' : progress > 0 ? 'Pausiert' : 'Bereit zum Abflug';
    if (arrival) arrival.textContent = state.completed ? 'Du bist in Tokio gelandet' : progress > 0 ? Math.round(progress * 100) + '% der Strecke' : 'Noch nicht gestartet';
  }

  function updateDisplay() {
    const display = document.getElementById('timer-display');
    if (!display) return;
    const text = clockText();
    display.textContent = text;
    display.setAttribute('aria-label', Math.floor(secondsLeft() / 60) + ' Minuten ' + (secondsLeft() % 60) + ' Sekunden');
    const button = document.getElementById('timer-toggle');
    if (button) button.textContent = state.running ? 'Pause' : state.completed ? 'Nochmal starten' : 'Timer starten';
    const running = document.getElementById('timer-running');
    if (running) running.textContent = state.running ? 'Läuft' : state.completed ? 'Angekommen' : 'Bereit';
    const hint = document.getElementById('timer-hint');
    if (hint) hint.textContent = state.completed ? 'Geschafft! Dein Timer ist abgelaufen.' : state.running ? 'Bleib dran – du bist auf Kurs.' : 'Stell deine Zeit ein und wähle deinen Lieblingsstil.';
    updateFlight();
  }

  function finish() {
    state.remainingMs = 0;
    state.running = false;
    state.completed = true;
    state.deadline = null;
    clearInterval(interval);
    interval = null;
    lastDisplayedSecond = null;
    save();
    updateDisplay();
    U.toast(state.type === 'flight' ? 'Du bist in Tokio angekommen! Timer beendet.' : 'Timer beendet – gut gemacht!');
  }

  function tick() {
    if (!state.running) return;
    state.remainingMs = Math.max(0, state.deadline - Date.now());
    const seconds = secondsLeft();
    updateFlight();
    if (state.remainingMs <= 0) return finish();
    if (seconds !== lastDisplayedSecond) {
      lastDisplayedSecond = seconds;
      updateDisplay();
    }
  }

  function start() {
    if (state.running) {
      state.remainingMs = Math.max(0, state.deadline - Date.now());
      state.running = false;
      state.deadline = null;
      clearInterval(interval);
      interval = null;
      save();
      updateDisplay();
      return;
    }
    if (state.completed || state.remainingMs <= 0) {
      state.remainingMs = state.durationMs;
      state.completed = false;
    }
    state.deadline = Date.now() + state.remainingMs;
    state.running = true;
    lastDisplayedSecond = null;
    save();
    updateDisplay();
    clearInterval(interval);
    interval = setInterval(tick, 250);
  }

  function reset() {
    state.running = false;
    state.completed = false;
    state.deadline = null;
    state.remainingMs = state.durationMs;
    clearInterval(interval);
    interval = null;
    lastDisplayedSecond = null;
    save();
    updateDisplay();
  }

  function setDuration() {
    const minutesField = document.getElementById('timer-minutes'), secondsField = document.getElementById('timer-seconds');
    if (!minutesField || !secondsField) return;
    const minutes = Number(minutesField.value), seconds = Number(secondsField.value);
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 180 || !Number.isInteger(seconds) || seconds < 0 || seconds > 59 || (minutes === 180 && seconds > 0)) {
      U.toast('Bitte gib 1 bis 180 Minuten und 0 bis 59 Sekunden ein.', true);
      minutesField.value = Math.max(1, Math.floor(state.durationMs / 60000));
      secondsField.value = Math.floor((state.durationMs % 60000) / 1000);
      return;
    }
    state.durationMs = (minutes * 60 + seconds) * 1000;
    if (state.durationMs < 1000) {
      U.toast('Der Timer muss mindestens eine Sekunde lang sein.', true);
      state.durationMs = 1000;
    }
    reset();
  }

  HM.Timer = {
    render,
    sync() { updateMode(); updateDisplay(); },
    setMode(type) {
      if (!TYPES.includes(type)) return;
      state.type = type;
      save();
      updateMode();
      updateDisplay();
    },
    toggle: start,
    reset,
    setDuration
  };

  load();
  if (state.running && state.remainingMs <= 0) finish();
  else if (state.running) interval = setInterval(tick, 250);
  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    if (button.dataset.action === 'timer-type') HM.Timer.setMode(button.dataset.type);
    else if (button.dataset.action === 'timer-toggle') HM.Timer.toggle();
    else if (button.dataset.action === 'timer-reset') HM.Timer.reset();
  });
  document.addEventListener('change', (event) => {
    if (event.target.id === 'timer-minutes' || event.target.id === 'timer-seconds') HM.Timer.setDuration();
  });
})();
