(function () {
  const HM = window.HM, U = HM.U, E = U.esc;
  const A = (HM.actions = HM.actions || {}), F = (HM.forms = HM.forms || {});
  const DAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag'];
  const S = (HM.Schedule = {});

  function entriesForDay(entries, day) {
    return entries.filter((x) => x.day === day).sort((a, b) => a.start.localeCompare(b.start));
  }

  function table(entries, personal) {
    return '<div class="table-wrap"><table class="class-table"><thead><tr><th>Uhrzeit</th><th>Fach</th><th>Lehrer</th>' + (personal ? '<th></th>' : '') + '</tr></thead><tbody>' +
      entries.map((x) => '<tr><td>' + E(x.start) + '–' + E(x.end) + '</td><td><b>' + E(x.subject) + '</b></td><td>' + E(x.teacher || '—') + '</td>' +
        (personal ? '<td><button class="icon-btn" data-action="schedule-del" data-id="' + E(x.id) + '" aria-label="' + E(x.subject) + ' aus meinem Stundenplan löschen">' + U.icon('trash') + '</button></td>' : '') + '</tr>').join('') +
      '</tbody></table></div>';
  }

  S.render = function () {
    const classes = HM.ClassSystem.classes();
    const myDays = DAYS.map((day, i) => {
      const items = entriesForDay(HM.state.schedule, i + 1);
      return '<section class="card schedule-day"><div class="sec"><div><span class="eyebrow">WOCHENPLAN</span><h2>' + day + '</h2></div>' +
        '<button class="btn sm ghost" data-action="personal-schedule-new" data-day="' + (i + 1) + '">' + U.icon('plus') + 'Stunde</button></div>' +
        (items.length ? table(items, true) : '<p class="mute small">Keine Stunden geplant.</p>') + '</section>';
    }).join('');
    const classPlans = classes.map((cls) => {
      const mine = cls.members.find((m) => m.userId === HM.ClassSystem.currentUserId());
      return '<section class="card"><div class="sec"><div><span class="eyebrow">KLASSENPLAN</span><h2>' + E(cls.name) + '</h2></div>' +
        (cls.schedule.length ? '<label class="schedule-opt"><input type="checkbox" data-class-schedule data-class-id="' + E(cls.id) + '"' + (mine && mine.scheduleSync ? ' checked' : '') + '>Kopien automatisch übernehmen</label>' : '') +
        '</div>' + (cls.schedule.length ? DAYS.map((day, i) => {
          const items = entriesForDay(cls.schedule, i + 1);
          return items.length ? '<div class="class-day"><h3>' + day + '</h3>' + table(items, false) + '</div>' : '';
        }).join('') : '<p class="mute small">Für diese Klasse wurde noch kein Stundenplan eingetragen.</p>') + '</section>';
    }).join('');
    return '<div class="head"><div><h1>Stundenplan</h1><p class="mute">Dein persönlicher Plan ist unabhängig von den Stundenplänen deiner Klassen.</p></div><button class="btn" data-action="personal-schedule-new">' + U.icon('plus') + 'Stunde hinzufügen</button></div>' +
      '<div class="notice">Entferne hier zum Beispiel ein abgewähltes Fach aus <b>deinem</b> Plan. Der Stundenplan der Klasse wird dadurch nicht verändert.</div>' +
      '<section class="schedule-section"><div class="sec"><div><h2>Mein Stundenplan</h2><p class="small mute">Persönliche Kopien lassen sich jederzeit ändern oder löschen.</p></div></div><div class="schedule-grid">' + myDays + '</div></section>' +
      (classes.length ? '<section class="schedule-section"><div class="sec"><div><h2>Stundenpläne der Klassen</h2><p class="small mute">Klassenpläne bleiben unverändert, wenn du deine persönliche Kopie bearbeitest.</p></div></div><div class="stack">' + classPlans + '</div></section>' : '');
  };

  function form(day) {
    HM.UI.open('Stunde hinzufügen', '<form class="form" data-form="schedule-save">' +
      HM.UI.fld('Wochentag', 'day', 'select', String(day || 1), { options: DAYS.map((x, i) => [String(i + 1), x]) }) +
      '<div class="row2">' + HM.UI.fld('Beginn', 'start', 'time', '08:00', { required: true }) + HM.UI.fld('Ende', 'end', 'time', '09:00', { required: true }) + '</div>' +
      HM.UI.fld('Fach / Aktivität', 'subject', 'text', '', { required: true, max: 80, placeholder: 'z. B. Sport' }) +
      HM.UI.fld('Lehrer (optional)', 'teacher', 'text', '', { max: 80 }) +
      '<p class="small mute">Diese Änderung betrifft nur deinen persönlichen Stundenplan.</p>' +
      '<div class="dlg-f"><button type="button" class="btn ghost" data-action="dlg-close">Abbrechen</button><button class="btn">Hinzufügen</button></div></form>');
  }

  A['personal-schedule-new'] = (el) => form(el && el.dataset.day ? Number(el.dataset.day) : 1);
  A['schedule-del'] = async function (el) {
    const lesson = HM.state.schedule.find((x) => x.id === el.dataset.id);
    if (!lesson) return;
    if (!(await HM.UI.confirm('„' + lesson.subject + '“ wird nur aus deinem persönlichen Stundenplan entfernt. Der Klassenplan bleibt unverändert.', { title: 'Stunde entfernen', label: 'Aus meinem Plan entfernen' }))) return;
    HM.state.schedule = HM.state.schedule.filter((x) => x.id !== lesson.id);
    if (HM.save()) { HM.render(); U.toast('Stunde aus deinem Plan entfernt'); }
  };

  F['schedule-save'] = function (f) {
    const d = new FormData(f), start = String(d.get('start')), end = String(d.get('end')), subject = String(d.get('subject')).trim();
    if (!subject || start >= end) return U.toast('Bitte ein Fach und eine gültige Zeitspanne eingeben.', true);
    if (HM.state.schedule.some((x) => x.day === Number(d.get('day')) && x.start === start && x.end === end && x.subject.toLowerCase() === subject.toLowerCase())) return U.toast('Diese Stunde steht bereits an diesem Tag in deinem Plan.', true);
    HM.state.schedule.push({ id: U.uid('lesson'), day: Number(d.get('day')), start, end, subject: subject.slice(0, 80), teacher: String(d.get('teacher')).trim().slice(0, 80), sourceClassId: '' });
    if (HM.save()) { HM.UI.close(); HM.render(); U.toast('Stunde hinzugefügt'); }
  };
})();
