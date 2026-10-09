(function () {
  const HM = window.HM, U = HM.U, E = U.esc;
  const A = (HM.actions = HM.actions || {}), F = (HM.forms = HM.forms || {});
  const S = (HM.Subjects = {});

  S.render = function () {
    const list = HM.state.subjects.slice().sort((a, b) => a.name.localeCompare(b.name, 'de'));
    const body = list.length
      ? list.map((s) => {
          const n = HM.state.homework.filter((h) => h.subjectId === s.id).length;
          return '<div class="item"><div><b>' + E(s.name) + '</b> ' + (s.abbr ? '<span class="tag">' + E(s.abbr) + '</span>' : '') +
            '<div class="meta">' + n + (n === 1 ? ' Aufgabe' : ' Aufgaben') + (s.description ? ' · ' + E(s.description) : '') + '</div></div>' +
            '<div class="acts"><button class="icon-btn" data-action="subject-edit" data-id="' + E(s.id) + '" aria-label="Fach ' + E(s.name) + ' bearbeiten">' + U.icon('edit') + '</button>' +
            '<button class="icon-btn" data-action="subject-del" data-id="' + E(s.id) + '" aria-label="Fach ' + E(s.name) + ' löschen">' + U.icon('trash') + '</button></div></div>';
        }).join('')
      : '<div class="empty"><b>Noch keine Fächer</b>Lege ein Fach an, um Hausaufgaben zuzuordnen.</div>';
    return '<section class="card"><div class="sec"><h2>Fächer</h2><button class="btn sm" data-action="subject-new">' + U.icon('plus') + 'Fach hinzufügen</button></div>' + body + '</section>';
  };

  function form(id) {
    const s = HM.state.subjects.find((x) => x.id === id) || { name: '', abbr: '', description: '' };
    HM.UI.open(id ? 'Fach bearbeiten' : 'Neues Fach',
      '<form class="form" data-form="subject-save" novalidate><input type="hidden" name="id" value="' + E(id || '') + '">' +
      HM.UI.fld('Name', 'name', 'text', s.name, { required: 1, max: 80 }) +
      HM.UI.fld('Kürzel', 'abbr', 'text', s.abbr, { max: 6 }) +
      HM.UI.fld('Beschreibung (optional)', 'description', 'textarea', s.description, { rows: 3 }) +
      '<div class="dlg-f"><button type="button" class="btn ghost" data-action="dlg-close">Abbrechen</button><button class="btn">Speichern</button></div></form>');
  }
  A['subject-new'] = () => form();
  A['subject-edit'] = (el) => form(el.dataset.id);

  F['subject-save'] = function (f) {
    const d = new FormData(f), id = d.get('id'), name = String(d.get('name')).trim();
    const errs = {};
    if (!name) errs.name = 'Bitte einen Namen eingeben.';
    else if (HM.state.subjects.some((s) => s.id !== id && s.name.toLowerCase() === name.toLowerCase())) errs.name = 'Dieses Fach gibt es bereits.';
    if (HM.UI.errors(f, errs)) return;
    const abbr = String(d.get('abbr')).trim() || name.slice(0, 2), desc = String(d.get('description')).trim();
    const ex = HM.state.subjects.find((s) => s.id === id);
    if (ex) Object.assign(ex, { name, abbr, description: desc });
    else HM.state.subjects.push({ id: U.uid('s'), name, abbr, description: desc });
    if (HM.save()) U.toast('Fach gespeichert');
    HM.UI.close(); HM.render();
  };

  A['subject-del'] = async function (el) {
    const s = HM.state.subjects.find((x) => x.id === el.dataset.id);
    if (!s) return;
    const n = HM.state.homework.filter((h) => h.subjectId === s.id).length;
    const msg = n ? '„' + s.name + '“ wird in ' + n + (n === 1 ? ' Aufgabe' : ' Aufgaben') + ' verwendet. Die Aufgaben bleiben erhalten und zeigen den Fachnamen weiterhin an.' : '„' + s.name + '“ wirklich löschen?';
    if (!(await HM.UI.confirm(msg, { title: 'Fach löschen', label: 'Löschen' }))) return;
    HM.state.homework.forEach((h) => { if (h.subjectId === s.id) { h.subjectName = s.name; h.subjectId = null; } });
    HM.state.teachers.forEach((t) => { t.subjectIds = t.subjectIds.filter((x) => x !== s.id); });
    HM.state.subjects = HM.state.subjects.filter((x) => x.id !== s.id);
    if (HM.save()) U.toast('Fach gelöscht');
    HM.render();
  };
})();
