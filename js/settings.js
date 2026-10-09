(function () {
  const HM = window.HM, U = HM.U, E = U.esc;
  const A = (HM.actions = HM.actions || {});
  const S = (HM.Settings = {});

  S.render = function () {
    const st = HM.state.settings, demo = HM.state.homework.some((h) => h.demo);
    const row = (t, d, c) => '<div class="set"><div><b>' + t + '</b><div class="small mute">' + d + '</div></div><div class="btns">' + c + '</div></div>';
    return '<div class="head"><h1>Einstellungen</h1></div><div class="stack">' +
      '<div class="card" style="padding:4px 18px"><p class="small" style="padding:14px 0 0"><b>Lokal gespeichert:</b> Alle Daten liegen nur in diesem Browser auf diesem Gerät. Es gibt keine Synchronisierung. Exportiere regelmäßig eine Sicherung.</p>' +
      row('Wochenbeginn', 'Gilt für den Kalender.', '<select data-setting="weekStart" aria-label="Wochenbeginn"><option value="1"' + (st.weekStart === 1 ? ' selected' : '') + '>Montag</option><option value="0"' + (st.weekStart === 0 ? ' selected' : '') + '>Sonntag</option></select>') +
      row('Standardansicht', 'Darstellung der Hausaufgaben.', '<select data-setting="view" aria-label="Standardansicht"><option value="list"' + (st.view === 'list' ? ' selected' : '') + '>Liste</option><option value="cards"' + (st.view === 'cards' ? ' selected' : '') + '>Karten</option></select>') +
      row('Standardfächer', 'Fügt fehlende Fächer wie Mathematik, Deutsch oder Englisch hinzu.', '<button class="btn ghost" data-action="set-defaults">Hinzufügen</button>') + '</div>' +
      '<div class="card" style="padding:4px 18px">' +
      row('Sicherung (JSON)', 'Exportiert oder importiert alle Daten. Ein Import ersetzt den aktuellen Bestand.', '<button class="btn ghost" data-action="set-export">' + U.icon('down') + 'Exportieren</button><button class="btn ghost" data-action="set-import">' + U.icon('up') + 'Importieren</button><input type="file" id="import-file" accept="application/json,.json" hidden>') +
      row('Hausaufgaben (CSV)', 'Tabelle für Excel oder Numbers.', '<button class="btn ghost" data-action="set-csv">' + U.icon('down') + 'CSV exportieren</button>') +
      row('Demo-Modus', 'Lädt Beispielaufgaben, die sich separat wieder entfernen lassen.', demo ? '<button class="btn ghost" data-action="demo-off">Demo-Daten entfernen</button>' : '<button class="btn ghost" data-action="demo-on">Demo-Daten laden</button>') + '</div>' +
      '<div class="card" style="padding:4px 18px">' + row('Alle Daten zurücksetzen', 'Löscht Aufgaben, Fächer, Lehrer und Einstellungen unwiderruflich.', '<button class="btn" data-action="set-reset">Zurücksetzen</button>') + '</div></div>';
  };
  S.set = function (el) {
    const k = el.dataset.setting;
    HM.state.settings[k] = k === 'weekStart' ? +el.value : el.value === 'cards' ? 'cards' : 'list';
    if (HM.save()) U.toast('Einstellung gespeichert');
  };

  A['set-export'] = () => HM.exportJSON();
  A['set-csv'] = () => HM.exportCSV();
  A['set-import'] = () => document.getElementById('import-file').click();
  S.import = function (input) {
    const file = input.files[0]; input.value = '';
    if (!file) return;
    if (file.size > 5e6) return U.toast('Import fehlgeschlagen: Datei ist zu groß.', true);
    const r = new FileReader();
    r.onerror = () => U.toast('Import fehlgeschlagen: Datei konnte nicht gelesen werden.', true);
    r.onload = async () => {
      let st = null;
      try { st = HM.sanitize(JSON.parse(r.result)); } catch (e) {}
      if (!st) return U.toast('Import fehlgeschlagen: Das ist keine gültige Hausaufgaben-Sicherung.', true);
      const msg = 'Die Sicherung enthält ' + st.homework.length + ' Aufgaben, ' + st.subjects.length + ' Fächer und ' + st.teachers.length + ' Lehrer. Der aktuelle Bestand wird ersetzt.';
      if (!(await HM.UI.confirm(msg, { title: 'Sicherung importieren', label: 'Importieren' }))) return;
      HM.state = st;
      if (HM.save()) U.toast('Sicherung importiert');
      HM.render();
    };
    r.readAsText(file);
  };
  A['set-defaults'] = function () {
    let added = 0;
    HM.DEFAULT_SUBJECTS.forEach(([name, abbr]) => {
      if (!HM.state.subjects.some((s) => s.name.toLowerCase() === name.toLowerCase())) { HM.state.subjects.push({ id: U.uid('s'), name, abbr, description: '' }); added++; }
    });
    if (HM.save()) U.toast(added ? added + ' Fächer hinzugefügt' : 'Alle Standardfächer sind schon vorhanden');
  };
  A['demo-on'] = function () {
    const t = U.today(), ensure = (name, abbr) => {
      let s = HM.state.subjects.find((x) => x.name === name);
      if (!s) { s = { id: U.uid('s'), name, abbr, description: '' }; HM.state.subjects.push(s); }
      return s.id;
    };
    const mk = (sub, abbr, title, type, off, prio, desc, done) => ({ id: U.uid('h'), subjectId: ensure(sub, abbr), subjectName: '', teacherId: null, teacherName: '', title, description: desc, type, assigned: U.addDays(t, -3), due: U.addDays(t, off), priority: prio, done: !!done, notes: '', link: '', created: Date.now() + off, demo: true });
    HM.state.homework.push(
      mk('Mathematik', 'Ma', 'Textaufgaben Seite 84', 'Hausaufgabe', -1, 'hoch', 'Aufgaben 3 bis 7 lösen.'),
      mk('Deutsch', 'De', 'Erörterung zum Thema Social Media', 'Hausaufgabe', 0, 'normal', 'Mindestens zwei Seiten.'),
      mk('Englisch', 'En', 'Vokabeltest Unit 5', 'Test', 2, 'hoch', 'Alle Wörter der Unit lernen.'),
      mk('Informatik', 'Inf', 'Webprojekt abgeben', 'Projekt', 6, 'normal', 'HTML, CSS und JavaScript.'),
      mk('Geschichte', 'Ge', 'Referat Industrialisierung', 'Referat', 12, 'niedrig', '10 Minuten Vortrag.'),
      mk('Mathematik', 'Ma', 'Arbeitsblatt Funktionen', 'Hausaufgabe', -2, 'normal', '', true));
    if (HM.save()) U.toast('Demo-Daten geladen');
    HM.render();
  };
  A['demo-off'] = function () {
    HM.state.homework = HM.state.homework.filter((h) => !h.demo);
    if (HM.save()) U.toast('Demo-Daten entfernt');
    HM.render();
  };
  A['set-reset'] = async function () {
    if (!(await HM.UI.confirm('Alle Daten werden unwiderruflich gelöscht. Exportiere vorher eine Sicherung, wenn du sie behalten möchtest.', { title: 'Alles zurücksetzen', label: 'Alles löschen', typed: 'LÖSCHEN' }))) return;
    if (HM.reset()) U.toast('Alle Daten wurden zurückgesetzt');
    HM.render();
  };
})();
