(function () {
  const HM = window.HM, U = HM.U, E = U.esc;
  const A = (HM.actions = HM.actions || {}), F = (HM.forms = HM.forms || {});
  const T = (HM.Teachers = {});

  T.render = function () {
    const list = HM.state.teachers.slice().sort((a, b) => a.name.localeCompare(b.name, 'de'));
    const body = list.length
      ? list.map((t) => {
          const subs = t.subjectIds.map((id) => { const s = HM.state.subjects.find((x) => x.id === id); return s ? s.name : null; }).filter(Boolean).join(', ');
          return '<div class="item"><div><b>' + E(t.name) + '</b><div class="meta">' + (E(subs) || 'Keine Fächer zugeordnet') + (t.notes ? ' · ' + E(t.notes) : '') + '</div></div>' +
            '<div class="acts"><button class="icon-btn" data-action="teacher-edit" data-id="' + E(t.id) + '" aria-label="Lehrer ' + E(t.name) + ' bearbeiten">' + U.icon('edit') + '</button>' +
            '<button class="icon-btn" data-action="teacher-del" data-id="' + E(t.id) + '" aria-label="Lehrer ' + E(t.name) + ' löschen">' + U.icon('trash') + '</button></div></div>';
        }).join('')
      : '<div class="empty"><b>Noch keine Lehrer</b>Lehrer sind optional, helfen aber bei der Suche.</div>';
    return '<section class="card"><div class="sec"><h2>Lehrer</h2><button class="btn sm" data-action="teacher-new">' + U.icon('plus') + 'Lehrer hinzufügen</button></div>' + body + '</section>';
  };

  function form(id) {
    const t = HM.state.teachers.find((x) => x.id === id) || { name: '', subjectIds: [], notes: '' };
    const checks = HM.state.subjects.length
      ? HM.state.subjects.map((s) => '<label><input type="checkbox" name="subjectIds" value="' + E(s.id) + '"' + (t.subjectIds.includes(s.id) ? ' checked' : '') + '>' + E(s.name) + '</label>').join('')
      : '<span class="mute small">Lege zuerst Fächer an.</span>';
    HM.UI.open(id ? 'Lehrer bearbeiten' : 'Neuer Lehrer',
      '<form class="form" data-form="teacher-save" novalidate><input type="hidden" name="id" value="' + E(id || '') + '">' +
      HM.UI.fld('Name', 'name', 'text', t.name, { required: 1, max: 80 }) +
      '<div class="fld"><label>Unterrichtete Fächer</label><div class="checks">' + checks + '</div></div>' +
      HM.UI.fld('Notizen (optional)', 'notes', 'textarea', t.notes, { rows: 3 }) +
      '<div class="dlg-f"><button type="button" class="btn ghost" data-action="dlg-close">Abbrechen</button><button class="btn">Speichern</button></div></form>');
  }
  A['teacher-new'] = () => form();
  A['teacher-edit'] = (el) => form(el.dataset.id);

  F['teacher-save'] = function (f) {
    const d = new FormData(f), id = d.get('id'), name = String(d.get('name')).trim();
    const errs = {};
    if (!name) errs.name = 'Bitte einen Namen eingeben.';
    if (HM.UI.errors(f, errs)) return;
    const data = { name, subjectIds: d.getAll('subjectIds'), notes: String(d.get('notes')).trim() };
    const ex = HM.state.teachers.find((t) => t.id === id);
    if (ex) Object.assign(ex, data); else HM.state.teachers.push(Object.assign({ id: U.uid('t') }, data));
    if (HM.save()) U.toast('Lehrer gespeichert');
    HM.UI.close(); HM.render();
  };

  A['teacher-del'] = async function (el) {
    const t = HM.state.teachers.find((x) => x.id === el.dataset.id);
    if (!t) return;
    const n = HM.state.homework.filter((h) => h.teacherId === t.id).length;
    const msg = n ? '„' + t.name + '“ ist bei ' + n + (n === 1 ? ' Aufgabe' : ' Aufgaben') + ' eingetragen. Die Aufgaben bleiben erhalten und zeigen den Namen weiterhin an.' : '„' + t.name + '“ wirklich löschen?';
    if (!(await HM.UI.confirm(msg, { title: 'Lehrer löschen', label: 'Löschen' }))) return;
    HM.state.homework.forEach((h) => { if (h.teacherId === t.id) { h.teacherName = t.name; h.teacherId = null; } });
    HM.state.teachers = HM.state.teachers.filter((x) => x.id !== t.id);
    if (HM.save()) U.toast('Lehrer gelöscht');
    HM.render();
  };
})();
