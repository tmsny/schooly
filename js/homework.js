(function () {
  const HM = window.HM, U = HM.U, E = U.esc;
  const A = (HM.actions = HM.actions || {}), F = (HM.forms = HM.forms || {});
  const H = (HM.Homework = {});
  const flt = (H.filter = { q: '', subject: '', status: 'open', range: 'all', sort: 'due' });

  H.subjectName = (h) => { const s = HM.state.subjects.find((x) => x.id === h.subjectId); return s ? s.name : h.subjectName ? h.subjectName + ' (gelöscht)' : '—'; };
  H.teacherName = (h) => { const t = HM.state.teachers.find((x) => x.id === h.teacherId); return t ? t.name : h.teacherName ? h.teacherName + ' (gelöscht)' : ''; };
  H.status = function (h) {
    if (h.done) return 'done';
    if (!h.due) return 'open';
    const d = U.diff(h.due, U.today());
    return d < 0 ? 'overdue' : d === 0 ? 'today' : d <= 2 ? 'soon' : 'open';
  };
  function dueLabel(h) {
    if (!h.due) return 'Ohne Datum';
    const d = U.diff(h.due, U.today());
    if (h.done) return U.fmt(h.due);
    if (d < 0) return 'Überfällig seit ' + -d + (d === -1 ? ' Tag' : ' Tagen');
    return d === 0 ? 'Heute fällig' : d === 1 ? 'Morgen fällig' : 'Fällig ' + U.fmt(h.due, { weekday: 'short', day: '2-digit', month: '2-digit' });
  }
  H.item = function (h) {
    const st = H.status(h), t = H.teacherName(h);
    return '<article class="hw' + (h.done ? ' done' : '') + '">' +
      '<button class="chk" data-action="hw-toggle" data-id="' + E(h.id) + '" aria-pressed="' + h.done + '" aria-label="' + E(h.title) + ' als ' + (h.done ? 'offen' : 'erledigt') + ' markieren">' + U.icon('check') + '</button>' +
      '<div><button class="t" data-action="hw-open" data-id="' + E(h.id) + '">' + E(h.title) + '</button>' +
      '<div class="meta"><span>' + E(H.subjectName(h)) + '</span>' + (h.type !== 'Hausaufgabe' ? '<span class="tag">' + E(h.type) + '</span>' : '') +
      (t ? '<span>' + E(t) + '</span>' : '') + '<span class="tag ' + st + '">' + E(dueLabel(h)) + '</span>' +
      (h.priority === 'hoch' && !h.done ? '<span class="tag high">Hohe Priorität</span>' : '') + '</div></div>' +
      '<div class="acts"><button class="icon-btn" data-action="hw-edit" data-id="' + E(h.id) + '" aria-label="Bearbeiten">' + U.icon('edit') + '</button>' +
      '<button class="icon-btn" data-action="hw-del" data-id="' + E(h.id) + '" aria-label="Löschen">' + U.icon('trash') + '</button></div></article>';
  };

  H.filtered = function () {
    const today = U.today(), q = flt.q.trim().toLowerCase(), end = U.addDays(today, 6);
    let l = HM.state.homework.filter((h) => {
      if (q && ![h.title, h.description, H.teacherName(h), H.subjectName(h)].some((x) => String(x).toLowerCase().includes(q))) return false;
      if (flt.subject && h.subjectId !== flt.subject) return false;
      if (flt.status === 'open' && h.done) return false;
      if (flt.status === 'done' && !h.done) return false;
      if (flt.status === 'overdue' && H.status(h) !== 'overdue') return false;
      if (flt.range === 'today' && h.due !== today) return false;
      if (flt.range === 'week' && !(h.due && h.due >= today && h.due <= end)) return false;
      if (flt.range === 'overdue' && !(h.due && h.due < today && !h.done)) return false;
      return true;
    });
    const dueKey = (h) => h.due || '9999-99-99', pr = { hoch: 0, normal: 1, niedrig: 2 };
    const cmp = {
      due: (a, b) => dueKey(a).localeCompare(dueKey(b)) || a.title.localeCompare(b.title, 'de'),
      subject: (a, b) => H.subjectName(a).localeCompare(H.subjectName(b), 'de') || dueKey(a).localeCompare(dueKey(b)),
      priority: (a, b) => pr[a.priority] - pr[b.priority] || dueKey(a).localeCompare(dueKey(b)),
      status: (a, b) => a.done - b.done || dueKey(a).localeCompare(dueKey(b))
    }[flt.sort];
    return l.sort(cmp);
  };

  function results() {
    const l = H.filtered(), total = HM.state.homework.length;
    if (!l.length) {
      return total
        ? '<div class="empty"><b>Keine Treffer</b>Passe Suche oder Filter an.</div>'
        : '<div class="empty"><b>Noch keine Hausaufgaben</b>Trage deine erste Aufgabe ein, um den Überblick zu behalten.<br><button class="btn" data-action="hw-new">' + U.icon('plus') + 'Hausaufgabe hinzufügen</button></div>';
    }
    return '<p class="small mute" style="margin-bottom:8px">' + l.length + (l.length === 1 ? ' Aufgabe' : ' Aufgaben') + '</p><div class="list' + (HM.state.settings.view === 'cards' ? ' cards' : '') + '">' + l.map(H.item).join('') + '</div>';
  }
  H.refresh = () => { const el = document.getElementById('hw-results'); if (el) el.innerHTML = results(); };

  H.render = function () {
    const opt = (arr, cur) => arr.map(([v, l]) => '<option value="' + E(v) + '"' + (v === cur ? ' selected' : '') + '>' + E(l) + '</option>').join('');
    const v = HM.state.settings.view;
    return '<div class="head"><h1>Hausaufgaben</h1><button class="btn" data-action="hw-new">' + U.icon('plus') + 'Neue Hausaufgabe</button></div>' +
      '<div class="toolbar" role="search"><input type="search" data-filter="q" value="' + E(flt.q) + '" placeholder="Suchen …" aria-label="Suche nach Titel, Beschreibung, Lehrer oder Fach">' +
      '<select data-filter="subject" aria-label="Fach filtern">' + opt([['', 'Alle Fächer']].concat(HM.state.subjects.map((s) => [s.id, s.name])), flt.subject) + '</select>' +
      '<select data-filter="status" aria-label="Status filtern">' + opt([['all', 'Alle Status'], ['open', 'Offen'], ['overdue', 'Überfällig'], ['done', 'Erledigt']], flt.status) + '</select>' +
      '<select data-filter="range" aria-label="Zeitraum filtern">' + opt([['all', 'Jeder Zeitraum'], ['today', 'Heute'], ['week', 'Nächste 7 Tage'], ['overdue', 'Überfällig']], flt.range) + '</select>' +
      '<select data-filter="sort" aria-label="Sortierung">' + opt([['due', 'Nach Datum'], ['subject', 'Nach Fach'], ['priority', 'Nach Priorität'], ['status', 'Nach Status']], flt.sort) + '</select>' +
      '<div class="seg" role="group" aria-label="Ansicht"><button data-action="view-list" aria-pressed="' + (v === 'list') + '" aria-label="Liste">' + U.icon('list') + '</button><button data-action="view-cards" aria-pressed="' + (v === 'cards') + '" aria-label="Karten">' + U.icon('grid') + '</button></div></div>' +
      '<div id="hw-results">' + results() + '</div>';
  };
  H.setFilter = (el) => { flt[el.dataset.filter] = el.value; H.refresh(); };

  function form(id, preset) {
    const h = HM.state.homework.find((x) => x.id === id) || Object.assign({ subjectId: '', teacherId: '', title: '', description: '', type: 'Hausaufgabe', assigned: U.today(), due: '', priority: 'normal', notes: '', link: '' }, preset);
    const so = [['', 'Fach wählen …']].concat(HM.state.subjects.map((s) => [s.id, s.name]));
    const to = [['', '— kein Lehrer —']].concat(HM.state.teachers.map((t) => [t.id, t.name]));
    HM.UI.open(id ? 'Aufgabe bearbeiten' : 'Neue Hausaufgabe',
      '<form class="form" data-form="hw-save" novalidate><input type="hidden" name="id" value="' + E(id || '') + '">' +
      '<div class="row2">' + HM.UI.fld('Fach', 'subjectId', 'select', h.subjectId, { required: 1, options: so }) + HM.UI.fld('Aufgabentyp', 'type', 'select', h.type, { options: HM.TYPES.map((x) => [x, x]) }) + '</div>' +
      HM.UI.fld('Titel / Thema', 'title', 'text', h.title, { required: 1, max: 140 }) +
      HM.UI.fld('Beschreibung', 'description', 'textarea', h.description, { rows: 3 }) +
      '<div class="row2">' + HM.UI.fld('Lehrer', 'teacherId', 'select', h.teacherId, { options: to }) + HM.UI.fld('Priorität', 'priority', 'select', h.priority, { options: HM.PRIOS.map((x) => [x, x[0].toUpperCase() + x.slice(1)]) }) + '</div>' +
      '<div class="row2">' + HM.UI.fld('Aufgabedatum', 'assigned', 'date', h.assigned) + HM.UI.fld('Fällig am', 'due', 'date', h.due, { required: 1 }) + '</div>' +
      HM.UI.fld('Buchseite oder Link (optional)', 'link', 'text', h.link, { max: 500, placeholder: 'S. 42 oder https://…' }) +
      HM.UI.fld('Notizen (optional)', 'notes', 'textarea', h.notes, { rows: 2 }) +
      '<div class="dlg-f"><button type="button" class="btn ghost" data-action="dlg-close">Abbrechen</button><button class="btn">Speichern</button></div></form>');
  }
  A['hw-new'] = (el) => form(null, el && el.dataset.due ? { due: el.dataset.due } : null);
  A['hw-edit'] = (el) => form(el.dataset.id);

  F['hw-save'] = function (f) {
    const d = new FormData(f), g = (k) => String(d.get(k) || '').trim(), id = g('id'), errs = {};
    if (!g('subjectId')) errs.subjectId = 'Bitte ein Fach auswählen.';
    if (!g('title')) errs.title = 'Bitte einen Titel eingeben.';
    if (!U.parse(g('due'))) errs.due = 'Bitte ein gültiges Fälligkeitsdatum wählen.';
    else if (g('assigned') && U.parse(g('assigned')) && g('due') < g('assigned')) errs.due = 'Das Fälligkeitsdatum liegt vor dem Aufgabedatum.';
    if (HM.UI.errors(f, errs)) return;
    const data = { subjectId: g('subjectId'), teacherId: g('teacherId') || null, title: g('title'), description: g('description'), type: g('type'), assigned: g('assigned'), due: g('due'), priority: g('priority'), notes: g('notes'), link: g('link'), subjectName: '', teacherName: '' };
    const ex = HM.state.homework.find((h) => h.id === id);
    if (ex) Object.assign(ex, data); else HM.state.homework.push(Object.assign({ id: U.uid('h'), done: false, created: Date.now(), demo: false }, data));
    if (HM.save()) U.toast(ex ? 'Änderungen gespeichert' : 'Hausaufgabe hinzugefügt');
    HM.UI.close(); HM.render();
  };

  A['hw-toggle'] = function (el) {
    const h = HM.state.homework.find((x) => x.id === el.dataset.id);
    if (!h) return;
    h.done = !h.done;
    HM.save(); HM.render();
  };
  A['hw-del'] = async function (el) {
    const h = HM.state.homework.find((x) => x.id === el.dataset.id);
    if (!h) return;
    if (!(await HM.UI.confirm('„' + h.title + '“ wird dauerhaft gelöscht.', { title: 'Aufgabe löschen', label: 'Löschen' }))) return;
    HM.state.homework = HM.state.homework.filter((x) => x.id !== h.id);
    if (HM.save()) U.toast('Aufgabe gelöscht');
    HM.render();
  };
  A['hw-open'] = function (el) {
    const h = HM.state.homework.find((x) => x.id === el.dataset.id);
    if (!h) return;
    const url = U.safeUrl(h.link), row = (k, v) => (v ? '<dt>' + k + '</dt><dd>' + v + '</dd>' : '');
    const link = h.link ? (url ? '<a href="' + E(url) + '" target="_blank" rel="noopener noreferrer">' + E(h.link) + '</a>' : E(h.link)) : '';
    HM.UI.open(h.title,
      '<dl class="dl">' + row('Fach', E(H.subjectName(h))) + row('Typ', E(h.type)) + row('Lehrer', E(H.teacherName(h))) + row('Aufgabedatum', U.fmt(h.assigned)) +
      row('Fällig', E(U.fmt(h.due, { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }))) + row('Priorität', E(h.priority)) +
      row('Status', h.done ? 'Erledigt' : 'Offen') + row('Beschreibung', E(h.description).replace(/\n/g, '<br>')) + row('Notizen', E(h.notes).replace(/\n/g, '<br>')) + row('Link / Seite', link) + '</dl>' +
      '<div class="dlg-f"><button class="btn ghost" data-action="hw-toggle-close" data-id="' + E(h.id) + '">' + (h.done ? 'Als offen markieren' : 'Als erledigt markieren') + '</button>' +
      '<button class="btn" data-action="hw-edit" data-id="' + E(h.id) + '">' + U.icon('edit') + 'Bearbeiten</button></div>');
  };
  A['hw-toggle-close'] = (el) => { A['hw-toggle'](el); HM.UI.close(); };
  A['view-list'] = () => { HM.state.settings.view = 'list'; HM.save(); HM.render(); };
  A['view-cards'] = () => { HM.state.settings.view = 'cards'; HM.save(); HM.render(); };
})();
