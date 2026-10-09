(function () {
  const HM = window.HM, U = HM.U, E = U.esc;
  const A = (HM.actions = HM.actions || {}), F = (HM.forms = HM.forms || {});
  const dlg = document.getElementById('dlg');
  let pending = null, lastFocus = null;

  const UI = (HM.UI = {
    fld(label, name, type, value, o) {
      o = o || {};
      const id = 'f-' + name, req = o.required ? ' aria-required="true"' : '', v = E(value == null ? '' : value);
      let c;
      if (type === 'select') c = '<select id="' + id + '" name="' + name + '"' + req + '>' + o.options.map(([k, l]) => '<option value="' + E(k) + '"' + (String(k) === String(value) ? ' selected' : '') + '>' + E(l) + '</option>').join('') + '</select>';
      else if (type === 'textarea') c = '<textarea id="' + id + '" name="' + name + '" rows="' + (o.rows || 3) + '">' + v + '</textarea>';
      else c = '<input id="' + id + '" name="' + name + '" type="' + type + '" value="' + v + '"' + req + (o.max ? ' maxlength="' + o.max + '"' : '') + (o.placeholder ? ' placeholder="' + E(o.placeholder) + '"' : '') + '>';
      return '<div class="fld" data-fld="' + name + '"><label for="' + id + '">' + E(label) + (o.required ? ' *' : '') + '</label>' + c + '<span class="err" id="e-' + name + '"></span></div>';
    },
    errors(form, errs) {
      form.querySelectorAll('.fld').forEach((f) => {
        const k = f.dataset.fld, msg = errs[k] || '', inp = f.querySelector('input,select,textarea');
        f.classList.toggle('bad', !!msg);
        const out = f.querySelector('.err'); if (out) out.textContent = msg;
        if (inp) { if (msg) { inp.setAttribute('aria-invalid', 'true'); inp.setAttribute('aria-describedby', 'e-' + k); } else { inp.removeAttribute('aria-invalid'); inp.removeAttribute('aria-describedby'); } }
      });
      const first = Object.keys(errs)[0];
      if (first) { const el = form.querySelector('[name="' + first + '"]'); if (el) el.focus(); }
      return !!first;
    },
    open(title, body) {
      if (!dlg.open) lastFocus = document.activeElement;
      dlg.innerHTML = '<div class="dlg-in"><div class="dlg-h"><h2 id="dlg-title">' + E(title) + '</h2><button class="icon-btn" data-action="dlg-close" aria-label="Schließen">' + U.icon('x') + '</button></div>' + body + '</div>';
      if (!dlg.open) dlg.showModal();
      const f = dlg.querySelector('input:not([type=hidden]),select,textarea'); if (f) f.focus();
    },
    close() { if (dlg.open) dlg.close(); },
    confirm(msg, o) {
      o = o || {};
      return new Promise((res) => {
        if (pending) pending(false);
        pending = res;
        UI.open(o.title || 'Bestätigen',
          '<p>' + E(msg) + '</p>' + (o.typed ? '<div class="fld"><label for="cf-typed">Tippe „' + E(o.typed) + '“ zur Bestätigung</label><input id="cf-typed" autocomplete="off"></div>' : '') +
          '<div class="dlg-f"><button class="btn ghost" data-action="dlg-close">Abbrechen</button><button class="btn" id="cf-yes" data-action="cf-yes"' + (o.typed ? ' disabled' : '') + '>' + E(o.label || 'Bestätigen') + '</button></div>');
        if (o.typed) dlg.querySelector('#cf-typed').addEventListener('input', (e) => { dlg.querySelector('#cf-yes').disabled = e.target.value.trim() !== o.typed; });
      });
    }
  });
  dlg.addEventListener('close', () => { if (pending) { const r = pending; pending = null; r(false); } if (lastFocus && lastFocus.isConnected) lastFocus.focus(); });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  A['dlg-close'] = () => UI.close();
  A['cf-yes'] = () => { const r = pending; pending = null; if (r) r(true); UI.close(); };

  function dashboard() {
    const hw = HM.state.homework, t = U.today(), open = hw.filter((h) => !h.done);
    const stats = [['Offen', open.length, 1], ['Heute fällig', open.filter((h) => h.due === t).length], ['Überfällig', open.filter((h) => h.due && h.due < t).length], ['Erledigt', hw.length - open.length]];
    const hr = new Date().getHours(), greet = hr < 11 ? 'Guten Morgen' : hr < 18 ? 'Guten Tag' : 'Guten Abend';
    const next = open.slice().sort((a, b) => (a.due || '9').localeCompare(b.due || '9')).slice(0, 5);
    const recent = hw.slice().sort((a, b) => b.created - a.created).slice(0, 5);
    const list = (l, empty) => (l.length ? '<div class="list">' + l.map(HM.Homework.item).join('') + '</div>' : '<p class="mute small">' + empty + '</p>');
    return '<div class="head"><div><h1>' + greet + '</h1><p class="mute">' + E(U.fmt(t, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })) + '</p></div><button class="btn" data-action="hw-new">' + U.icon('plus') + 'Neue Hausaufgabe</button></div>' +
      '<div class="stack"><div class="grid4">' + stats.map(([l, n, hl]) => '<div class="card stat' + (hl ? ' hl' : '') + '"><b>' + n + '</b><span class="small mute">' + l + '</span></div>').join('') + '</div>' +
      '<div class="grid2"><section><div class="sec"><h2>Als Nächstes fällig</h2><a class="small" href="#/homework">Alle ansehen</a></div>' + list(next, 'Alles erledigt. Keine offenen Aufgaben.') + '</section>' +
      '<section><div class="sec"><h2>Zuletzt hinzugefügt</h2></div>' + list(recent, 'Noch keine Aufgaben angelegt.') + '</section></div></div>';
  }

  const NAV = [['dashboard', 'Übersicht', 'home'], ['homework', 'Aufgaben', 'list'], ['calendar', 'Kalender', 'calendar'], ['subjects', 'Fächer', 'users'], ['classes', 'Meine Klassen', 'users'], ['settings', 'Einstellungen', 'settings']];
  const ROUTES = {
    dashboard, homework: HM.Homework.render, calendar: HM.Cal.render, settings: HM.Settings.render,
    subjects: () => '<div class="head"><h1>Fächer &amp; Lehrer</h1></div><div class="grid2">' + HM.Subjects.render() + HM.Teachers.render() + '</div>',
    classes: () => '<div class="head"><div><h1>Meine Klassen</h1><p class="mute">Lerne und organisiere gemeinsam mit deiner Klasse.</p></div></div><div id="class-view" class="stack"><p>Deine Klassen werden geladen …</p></div>'
  };
  HM.render = function () {
    const key = ROUTES[location.hash.replace(/^#\//, '')] ? location.hash.replace(/^#\//, '') : 'dashboard';
    document.getElementById('view').innerHTML = ROUTES[key]();
    document.getElementById('nav').innerHTML = '<div class="brand"><img class="brand-logo" src="src/icons/schooly_icon.svg" alt="Schooly"><span>Schooly</span></div>' + NAV.map(([k, l, i]) => '<a href="#/' + k + '"' + (k === key ? ' aria-current="page"' : '') + '>' + U.icon(i) + '<span>' + l + '</span></a>').join('');
    document.title = NAV.find((n) => n[0] === key)[1] + ' · Schooly';
    if (key === 'classes' && window.SchoolyClasses) window.SchoolyClasses.render();
  };

  document.addEventListener('click', (e) => { const el = e.target.closest('[data-action]'); if (el && A[el.dataset.action]) A[el.dataset.action](el, e); });
  document.addEventListener('submit', (e) => { const f = e.target.closest('[data-form]'); if (f && F[f.dataset.form]) { e.preventDefault(); F[f.dataset.form](f); } });
  document.addEventListener('input', (e) => { if (e.target.dataset.filter === 'q') HM.Homework.setFilter(e.target); });
  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.filter) HM.Homework.setFilter(t);
    else if (t.dataset.setting) HM.Settings.set(t);
    else if (t.id === 'import-file') HM.Settings.import(t);
  });
  window.addEventListener('hashchange', () => { HM.render(); window.scrollTo(0, 0); });

  HM.load();
  HM.render();
  const accountLabel = document.getElementById('account-label');
  const signOut = document.getElementById('sign-out');
  if (signOut) signOut.addEventListener('click', async () => { if (window.SchoolyAuth) await SchoolyAuth.logout(); });
  if (window.SchoolyAuth) SchoolyAuth.ready.then(user => {
    if (accountLabel && user) accountLabel.textContent = user.displayName || user.email || 'Angemeldet';
  });
})();
