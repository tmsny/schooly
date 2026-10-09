(function () {
  const HM = window.HM, U = HM.U, E = U.esc;
  const A = (HM.actions = HM.actions || {}), F = (HM.forms = HM.forms || {});
  const KEY = 'hm.classsystem.v1';
  const DAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag'];
  const CS = (HM.ClassSystem = {});
  let data = { users: [], currentUserId: '', classes: [], selectedClassId: '' };

  function persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      U.toast('Klassen-Daten konnten nicht gespeichert werden.', true);
      return false;
    }
  }
  CS.save = persist;
  function keepSyncedTasksPersonal(cls, taskIds) {
    const ids = taskIds || cls.homework.map((h) => h.id);
    let changed = false;
    HM.state.homework.forEach((task) => {
      if (task.classTaskId && ids.includes(task.classTaskId)) {
        delete task.classTaskId;
        changed = true;
      }
    });
    if (changed) HM.save();
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.users) || !Array.isArray(parsed.classes)) throw new Error('Ungültiges Datenformat');
      data = {
        users: parsed.users.filter((x) => x && typeof x.id === 'string' && typeof x.email === 'string' && typeof x.passwordHash === 'string'),
        currentUserId: typeof parsed.currentUserId === 'string' ? parsed.currentUserId : '',
        selectedClassId: typeof parsed.selectedClassId === 'string' ? parsed.selectedClassId : '',
        classes: parsed.classes.filter((x) => x && typeof x.id === 'string' && typeof x.name === 'string').map((x) => ({
          id: x.id, name: String(x.name).slice(0, 80), teacher: String(x.teacher || '').slice(0, 80),
          inviteCode: String(x.inviteCode || '').slice(0, 12), createdBy: String(x.createdBy || ''),
          members: Array.isArray(x.members) ? x.members.filter((m) => m && typeof m.userId === 'string' && ['admin', 'teacher', 'student'].includes(m.role)).map((m) => ({ userId: m.userId, role: m.role, scheduleSync: !!m.scheduleSync })) : [],
          sync: { homework: !x.sync || x.sync.homework !== false, schedule: !!(x.sync && x.sync.schedule), teachers: !!(x.sync && x.sync.teachers) },
          schedule: Array.isArray(x.schedule) ? x.schedule.filter((s) => s && typeof s.id === 'string').map((s) => ({
            id: s.id, day: Math.max(1, Math.min(5, Number(s.day) || 1)), start: /^\d{2}:\d{2}$/.test(s.start) ? s.start : '08:00',
            end: /^\d{2}:\d{2}$/.test(s.end) ? s.end : '09:00', subject: String(s.subject || '').slice(0, 80), teacher: String(s.teacher || '').slice(0, 80)
          })) : [],
          homework: Array.isArray(x.homework) ? x.homework.filter((h) => h && typeof h.id === 'string').map((h) => ({
            id: h.id, title: String(h.title || '').slice(0, 140), subject: String(h.subject || '').slice(0, 80),
            due: U.parse(h.due) ? h.due : '', description: String(h.description || '').slice(0, 2000),
            type: HM.TYPES.includes(h.type) ? h.type : 'Hausaufgabe', priority: HM.PRIOS.includes(h.priority) ? h.priority : 'normal',
            teacher: String(h.teacher || '').slice(0, 80), link: String(h.link || '').slice(0, 500),
            createdBy: String(h.createdBy || ''), created: Number(h.created) || Date.now(), doneBy: Array.isArray(h.doneBy) ? h.doneBy.filter((id) => typeof id === 'string') : []
          })) : []
        }))
      };
      if (!data.users.some((u) => u.id === data.currentUserId)) data.currentUserId = '';
    } catch (e) {
      U.toast('Klassen-Daten konnten nicht gelesen werden. Bitte Browser-Speicher prüfen.', true);
      data = { users: [], currentUserId: '', classes: [], selectedClassId: '' };
    }
  }

  async function passwordHash(password) {
    if (!window.crypto || !window.crypto.subtle) throw new Error('Sichere Passwort-Prüfung nicht verfügbar. Bitte die App über localhost öffnen.');
    const bytes = new TextEncoder().encode(password);
    const digest = await window.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest)).map((x) => x.toString(16).padStart(2, '0')).join('');
  }

  CS.currentUser = () => data.users.find((x) => x.id === data.currentUserId) || null;
  CS.isLoggedIn = () => !!CS.currentUser();
  CS.reconcile = function () {
    const sharedTaskIds = new Set(data.classes.flatMap((cls) => cls.homework.map((h) => h.id)));
    let changed = false;
    HM.state.homework.forEach((task) => {
      if (task.classTaskId && !sharedTaskIds.has(task.classTaskId)) {
        delete task.classTaskId;
        changed = true;
      }
    });
    if (changed) HM.save();
  };
  CS.logout = function () { data.currentUserId = ''; persist(); HM.render(); };

  CS.renderLogin = function () {
    return '<div class="auth-wrap"><div class="card auth-card"><div class="brand">Hausaufgaben</div><h1>Willkommen</h1>' +
      '<p class="mute">Melde dich für den Klassen-Prototyp an oder erstelle ein lokales Testkonto.</p>' +
      '<div class="notice"><b>Debug-Modus:</b> Konten und Klassen bleiben nur in diesem Browser. Das ist kein echter Firebase-Login und eignet sich nicht für echte Passwörter.</div>' +
      '<form class="form" data-form="class-login" novalidate>' +
      HM.UI.fld('E-Mail', 'loginEmail', 'email', '', { required: true, max: 254, placeholder: 'du@beispiel.de' }) +
      HM.UI.fld('Passwort', 'loginPassword', 'password', '', { required: true, max: 128 }) +
      '<button class="btn">Anmelden</button></form>' +
      '<div class="auth-sep">Noch kein lokales Konto?</div><form class="form" data-form="class-register" novalidate>' +
      HM.UI.fld('E-Mail für Testkonto', 'registerEmail', 'email', '', { required: true, max: 254, placeholder: 'du@beispiel.de' }) +
      HM.UI.fld('Passwort (mindestens 8 Zeichen)', 'registerPassword', 'password', '', { required: true, max: 128 }) +
      '<button class="btn ghost">Lokales Konto erstellen</button></form>' +
      '<button class="btn ghost" disabled title="Wird nach Firebase-Einrichtung aktiviert">Mit Google anmelden (Firebase erforderlich)</button></div></div>';
  };

  function classRole(c, userId) {
    const m = c.members.find((x) => x.userId === userId);
    return m ? m.role : '';
  }

  function myClasses() {
    const user = CS.currentUser();
    return user ? data.classes.filter((c) => classRole(c, user.id)) : [];
  }
  CS.classes = myClasses;
  CS.roleFor = (cls, userId) => classRole(cls, userId);
  CS.getClass = (id) => data.classes.find((c) => c.id === id) || null;
  CS.currentUserId = () => data.currentUserId;
  CS.canManage = (cls) => !!cls && ['admin', 'teacher'].includes(classRole(cls, data.currentUserId));

  CS.mergeSchedule = function (cls, silent) {
    if (!cls) return 0;
    let added = 0;
    cls.schedule.forEach((lesson) => {
      if (!HM.state.schedule.some((x) => x.day === lesson.day && x.start === lesson.start && x.end === lesson.end && x.subject.toLowerCase() === lesson.subject.toLowerCase())) {
        HM.state.schedule.push(Object.assign({}, lesson, { id: U.uid('merged'), sourceClassId: cls.id, sourceLessonId: lesson.id }));
        added++;
      }
    });
    if (HM.save() && added && !silent) U.toast(added + ' Stunden zum persönlichen Stundenplan hinzugefügt. Eigene Einträge bleiben erhalten.');
    return added;
  };

  CS.toggleHomework = function (classId, taskId) {
    const cls = CS.getClass(classId), task = cls && cls.homework.find((h) => h.id === taskId), userId = data.currentUserId;
    if (!task || !userId) return U.toast('Klassen-Aufgabe nicht gefunden.', true);
    task.doneBy = Array.isArray(task.doneBy) ? task.doneBy : [];
    if (task.doneBy.includes(userId)) task.doneBy = task.doneBy.filter((id) => id !== userId);
    else task.doneBy.push(userId);
    if (persist()) HM.render();
  };
  CS.deleteHomework = async function (classId, taskId) {
    const cls = CS.getClass(classId), task = cls && cls.homework.find((h) => h.id === taskId);
    if (!cls || !task) return U.toast('Klassen-Aufgabe nicht gefunden.', true);
    if (!CS.canManage(cls) && task.createdBy !== data.currentUserId) return U.toast('Du darfst diese Klassen-Aufgabe nicht löschen.', true);
    if (!(await HM.UI.confirm('„' + task.title + '“ wird für die ganze Klasse gelöscht.', { title: 'Klassenaufgabe löschen', label: 'Für alle löschen' }))) return;
    keepSyncedTasksPersonal(cls, [taskId]);
    cls.homework = cls.homework.filter((x) => x.id !== taskId);
    if (persist()) { HM.render(); U.toast('Klassenaufgabe gelöscht. Eine bereits persönliche Kopie bleibt erhalten.'); }
  };

  function selectedClass() {
    const cls = myClasses();
    return cls.find((c) => c.id === data.selectedClassId) || cls[0] || null;
  }

  function timetable(entries, classId, canEdit) {
    if (!entries.length) return '<p class="mute small">Noch keine Stunden im Stundenplan.</p>';
    const sorted = entries.slice().sort((a, b) => a.day - b.day || a.start.localeCompare(b.start));
    return '<div class="table-wrap"><table class="class-table"><thead><tr><th>Tag</th><th>Zeit</th><th>Fach</th><th>Lehrer</th>' + (canEdit ? '<th></th>' : '') + '</tr></thead><tbody>' +
      sorted.map((s) => '<tr><td>' + DAYS[s.day - 1] + '</td><td>' + E(s.start) + '–' + E(s.end) + '</td><td>' + E(s.subject) + '</td><td>' + E(s.teacher || '—') + '</td>' + (canEdit ? '<td><button class="icon-btn" data-action="class-schedule-del" data-id="' + E(s.id) + '" data-class-id="' + E(classId) + '" aria-label="' + E(s.subject) + ' aus Klassen-Stundenplan löschen">' + U.icon('trash') + '</button></td>' : '') + '</tr>').join('') +
      '</tbody></table></div>';
  }
  function personalSchedulePreference(cls, userId) {
    const member = cls.members.find((x) => x.userId === userId);
    return !!(member && member.scheduleSync);
  }

  CS.render = function () {
    const user = CS.currentUser(), classes = myClasses(), cls = selectedClass();
    const create = '<button class="btn" data-action="class-new">' + U.icon('plus') + 'Klasse erstellen</button>';
    const join = '<form class="inline-form" data-form="class-join"><label for="join-code">Einladungscode</label><input id="join-code" name="code" maxlength="12" required placeholder="ABC123"><button class="btn ghost">Beitreten</button></form>';
    if (!classes.length) return '<div class="head"><div><h1>Klassen</h1><p class="mute">Erstelle eine Klasse oder tritt mit einem Einladungscode bei.</p></div><button class="btn ghost" data-action="class-logout">Abmelden (' + E(user.email) + ')</button></div>' +
      '<div class="notice"><b>Lokaler Prototyp:</b> Einladungen funktionieren nur innerhalb dieses Browsers. Für echte Einladungen und Synchronisierung wird Firebase benötigt.</div><div class="grid2"><section class="card class-start"><span class="tag">Admin wird automatisch zugewiesen</span><h2>Eine Klasse erstellen</h2><p class="mute">Verwalte Stundenplan, Hausaufgaben und Mitglieder an einem Ort.</p>' + create + '</section><section class="card class-start"><span class="tag">Einladungscode</span><h2>Einer Klasse beitreten</h2><p class="mute">Beim Beitritt entscheidest du, ob der Klassen-Stundenplan in deinen persönlichen Plan übernommen wird.</p>' + join + '</section></div>';
    const isAdmin = classRole(cls, user.id) === 'admin';
    const members = cls.members.map((m) => {
      const account = data.users.find((u) => u.id === m.userId);
      if (!account) return '';
      const role = isAdmin && m.userId !== user.id && m.userId !== cls.createdBy
        ? '<label class="role-control"><span class="sr-only">Rolle für ' + E(account.email) + '</span><select data-class-role data-class-id="' + E(cls.id) + '" data-user-id="' + E(m.userId) + '" aria-label="Rolle von ' + E(account.email) + '"><option value="student"' + (m.role === 'student' ? ' selected' : '') + '>Schüler</option><option value="teacher"' + (m.role === 'teacher' ? ' selected' : '') + '>Lehrer</option><option value="admin"' + (m.role === 'admin' ? ' selected' : '') + '>Admin</option></select></label>'
        : '<span class="role-badge role-' + E(m.role) + '">' + ({ admin: 'Admin', teacher: 'Lehrer', student: 'Schüler' }[m.role]) + (m.userId === user.id ? ' · Du' : '') + '</span>';
      return '<div class="member-row"><span class="member-avatar">' + E(account.email.charAt(0).toUpperCase()) + '</span><span class="member-email">' + E(account.email) + (m.userId === cls.createdBy ? '<small>Ersteller</small>' : '') + '</span>' + role + '</div>';
    }).join('');
    const currentRole = classRole(cls, user.id);
    const canEditClass = ['admin', 'teacher'].includes(currentRole);
    const adminActions = isAdmin
      ? '<button class="btn sm ghost" data-action="class-invite" data-id="' + E(cls.id) + '">Code teilen</button><button class="btn sm ghost" data-action="class-leave" data-id="' + E(cls.id) + '">Klasse verlassen</button><button class="btn sm danger" data-action="class-delete" data-id="' + E(cls.id) + '">Klasse löschen</button>'
      : '<button class="btn sm ghost" data-action="class-leave" data-id="' + E(cls.id) + '">Klasse verlassen</button>';
    return '<div class="head"><div><h1>Klassen</h1><p class="mute">Angemeldet als ' + E(user.email) + '</p></div><div class="head-actions">' + create + '<button class="btn ghost" data-action="class-logout">Abmelden</button></div></div>' +
      '<div class="notice"><b>Debug-Modus:</b> Klassen und Einladungscodes sind nur auf diesem Gerät verfügbar. Kein Firebase-Backend ist verbunden.</div>' +
      '<div class="class-layout"><aside class="card class-sidebar"><div class="sec"><h2>Meine Klassen</h2><span class="tag">' + classes.length + '</span></div>' +
      classes.map((c) => '<button class="class-select' + (c.id === cls.id ? ' selected' : '') + '" data-action="class-select" data-id="' + E(c.id) + '"><span><b>' + E(c.name) + '</b><small>' + E(c.teacher || 'Klassenraum') + '</small></span><span class="role-badge role-' + E(classRole(c, user.id)) + '">' + ({ admin: 'Admin', teacher: 'Lehrer', student: 'Schüler' }[classRole(c, user.id)]) + '</span></button>').join('') +
      '<div class="sidebar-join">' + join + '</div></aside>' +
      '<div class="stack class-detail"><section class="card class-overview"><div class="class-title"><div><span class="eyebrow">KLASSENRAUM</span><h2>' + E(cls.name) + '</h2><p class="mute">' + (cls.teacher ? 'Klassenleitung: ' + E(cls.teacher) + ' · ' : '') + cls.members.length + (cls.members.length === 1 ? ' Mitglied' : ' Mitglieder') + '</p></div><span class="role-badge role-' + E(currentRole) + '">Deine Rolle: ' + ({ admin: 'Admin', teacher: 'Lehrer', student: 'Schüler' }[currentRole]) + '</span></div><div class="head-actions class-actions">' + adminActions + '</div></section>' +
      '<section class="card"><div class="sec"><div><h2>Mitglieder &amp; Rollen</h2><p class="small mute">Admins verwalten hier die Rollen aller Mitglieder.</p></div></div><div class="member-list">' + members + '</div></section>' +
      '<section class="card"><div class="sec"><div><h2>Klassen-Stundenplan</h2><p class="small mute">Der Plan der Klasse ist getrennt von deinem persönlichen Plan.</p></div>' + (canEditClass ? '<button class="btn sm" data-action="schedule-new" data-id="' + E(cls.id) + '">' + U.icon('plus') + 'Stunde</button>' : '') + '</div>' + timetable(cls.schedule, cls.id, canEditClass) + (cls.schedule.length ? '<label class="schedule-opt"><input type="checkbox" data-class-schedule data-class-id="' + E(cls.id) + '"' + (personalSchedulePreference(cls, user.id) ? ' checked' : '') + '>Neue Klassenstunden automatisch in meinen Plan übernehmen</label>' : '') + '<a class="small" href="#/schedule">Meinen Stundenplan öffnen →</a></section>' +
      '<section class="card"><div class="sec"><div><h2>Klassen-Hausaufgaben</h2><p class="small mute">Klassenaufgaben findest du zusätzlich im Tab „Aufgaben“.</p></div>' + (canEditClass ? '<button class="btn sm" data-action="class-homework-new" data-id="' + E(cls.id) + '">' + U.icon('plus') + 'Aufgabe für Klasse</button>' : '') + '</div>' +
      (cls.homework.length ? '<div class="list">' + cls.homework.map((h) => '<div class="item"><span><b>' + E(h.title) + '</b><span class="meta">' + E(h.subject || 'Ohne Fach') + (h.due ? ' · fällig ' + E(U.fmt(h.due)) : '') + '</span></span>' + (canEditClass || h.createdBy === user.id ? '<div class="acts"><button class="icon-btn" data-action="class-task-edit" data-id="' + E(h.id) + '" data-class-id="' + E(cls.id) + '" aria-label="Klassenaufgabe ' + E(h.title) + ' bearbeiten">' + U.icon('edit') + '</button><button class="icon-btn" data-action="class-task-del" data-id="' + E(h.id) + '" data-class-id="' + E(cls.id) + '" aria-label="Klassenaufgabe ' + E(h.title) + ' löschen">' + U.icon('trash') + '</button></div>' : '') + '</div>').join('') + '</div>' : '<p class="mute small">Noch keine Klassenaufgaben.</p>') + '</section></div></div>';
  };

  function formClassSchedule(id) {
    HM.UI.open('Stunde hinzufügen', '<form class="form" data-form="class-schedule-save"><input type="hidden" name="classId" value="' + E(id) + '">' +
      HM.UI.fld('Wochentag', 'day', 'select', '1', { options: DAYS.map((d, i) => [String(i + 1), d]) }) +
      '<div class="row2">' + HM.UI.fld('Beginn', 'start', 'time', '08:00', { required: true }) + HM.UI.fld('Ende', 'end', 'time', '09:00', { required: true }) + '</div>' +
      HM.UI.fld('Fach / Aktivität', 'subject', 'text', '', { required: true, max: 80, placeholder: 'z. B. Sport' }) +
      HM.UI.fld('Lehrer (optional)', 'teacher', 'text', '', { max: 80 }) +
      '<div class="dlg-f"><button type="button" class="btn ghost" data-action="dlg-close">Abbrechen</button><button class="btn">Hinzufügen</button></div></form>');
  }

  function formClassHomework(id) {
    const task = id.taskId ? CS.getClass(id.classId).homework.find((x) => x.id === id.taskId) : null;
    const clsId = id.classId || id;
    HM.UI.open(task ? 'Klassenaufgabe bearbeiten' : 'Klassen-Hausaufgabe hinzufügen', '<form class="form" data-form="class-homework-save"><input type="hidden" name="classId" value="' + E(clsId) + '"><input type="hidden" name="taskId" value="' + E(task ? task.id : '') + '">' +
      HM.UI.fld('Titel', 'title', 'text', task ? task.title : '', { required: true, max: 140 }) +
      HM.UI.fld('Fach (optional)', 'subject', 'text', task ? task.subject : '', { max: 80 }) +
      HM.UI.fld('Fällig am (optional)', 'due', 'date', task ? task.due : '') +
      HM.UI.fld('Beschreibung (optional)', 'description', 'textarea', task ? task.description : '', { rows: 3 }) +
      '<div class="dlg-f"><button type="button" class="btn ghost" data-action="dlg-close">Abbrechen</button><button class="btn">' + (task ? 'Änderungen speichern' : 'Hinzufügen') + '</button></div></form>');
  }

  A['class-new'] = function () {
    HM.UI.open('Klasse erstellen', '<form class="form" data-form="class-create">' +
      HM.UI.fld('Klassenname', 'name', 'text', '', { required: true, max: 80, placeholder: 'z. B. 8a' }) +
      HM.UI.fld('Klassenlehrer (optional)', 'teacher', 'text', '', { max: 80 }) +
      '<p class="small mute">Du erhältst automatisch die Admin-Rolle und kannst Mitglieder sowie Rollen verwalten.</p>' +
      '<div class="dlg-f"><button type="button" class="btn ghost" data-action="dlg-close">Abbrechen</button><button class="btn">Klasse erstellen</button></div></form>');
  };
  A['class-logout'] = () => CS.logout();
  A['class-task-toggle'] = (el) => CS.toggleHomework(el.dataset.classId, el.dataset.id);
  A['class-task-del'] = (el) => CS.deleteHomework(el.dataset.classId, el.dataset.id);
  A['class-schedule-del'] = async function (el) {
    const cls = CS.getClass(el.dataset.classId);
    if (!cls || !CS.canManage(cls)) return U.toast('Nur Lehrer und Admins dürfen den Klassen-Stundenplan bearbeiten.', true);
    const lesson = cls.schedule.find((x) => x.id === el.dataset.id);
    if (!lesson) return;
    if (!(await HM.UI.confirm('„' + lesson.subject + '“ wird aus dem Stundenplan der ganzen Klasse entfernt. Deine persönliche Kopie bleibt bestehen.', { title: 'Klassenstunde löschen', label: 'Aus Klasse entfernen' }))) return;
    cls.schedule = cls.schedule.filter((x) => x.id !== lesson.id);
    if (persist()) { HM.render(); U.toast('Klassenstunde entfernt'); }
  };
  A['class-select'] = function (el) { data.selectedClassId = el.dataset.id; persist(); HM.render(); };
  A['schedule-new'] = (el) => formClassSchedule(el.dataset.id);
  A['class-homework-new'] = (el) => formClassHomework(el.dataset.id);
  A['class-task-edit'] = function (el) {
    const cls = CS.getClass(el.dataset.classId), task = cls && cls.homework.find((x) => x.id === el.dataset.id);
    if (!task || (!CS.canManage(cls) && task.createdBy !== data.currentUserId)) return U.toast('Du darfst diese Klassenaufgabe nicht bearbeiten.', true);
    formClassHomework({ classId: cls.id, taskId: task.id });
  };
  A['class-invite'] = function (el) {
    const cls = data.classes.find((x) => x.id === el.dataset.id);
    if (cls) HM.UI.open('Einladungscode', '<p>Teile diesen Code mit deiner Klasse. Im aktuellen Prototyp kann er nur auf diesem Gerät verwendet werden.</p><p class="invite-code">' + E(cls.inviteCode) + '</p><div class="dlg-f"><button class="btn" data-action="dlg-close">Fertig</button></div>');
  };
  A['class-leave'] = async function (el) {
    const cls = CS.getClass(el.dataset.id), member = cls && cls.members.find((m) => m.userId === data.currentUserId);
    if (!cls || !member) return;
    const otherMembers = cls.members.filter((m) => m.userId !== data.currentUserId);
    const needsSuccessor = member.role === 'admin' && otherMembers.length && !otherMembers.some((m) => m.role === 'admin');
    const message = !otherMembers.length
      ? 'Du bist das letzte Mitglied. Beim Verlassen wird auch die Klasse „' + cls.name + '“ mit ihrem Klassenplan und den Klassenaufgaben gelöscht.'
      : needsSuccessor
        ? 'Du bist der einzige Admin. Das älteste andere Mitglied erhält automatisch die Admin-Rolle, bevor du „' + cls.name + '“ verlässt. Deine persönlichen Aufgaben und dein Stundenplan bleiben erhalten.'
        : 'Du verlässt „' + cls.name + '“. Deine persönlichen Aufgaben und dein Stundenplan bleiben erhalten.';
    if (!(await HM.UI.confirm(message, { title: 'Klasse verlassen', label: 'Verlassen' }))) return;
    if (needsSuccessor) otherMembers[0].role = 'admin';
    keepSyncedTasksPersonal(cls);
    if (!otherMembers.length) data.classes = data.classes.filter((x) => x.id !== cls.id);
    else cls.members = otherMembers;
    if (data.selectedClassId === cls.id) data.selectedClassId = '';
    if (persist()) { HM.render(); U.toast(otherMembers.length ? 'Klasse verlassen' : 'Klasse verlassen und aufgelöst'); }
  };
  A['class-delete'] = async function (el) {
    const cls = CS.getClass(el.dataset.id);
    if (!cls || classRole(cls, data.currentUserId) !== 'admin') return U.toast('Nur ein Admin kann die Klasse löschen.', true);
    if (!(await HM.UI.confirm('„' + cls.name + '“ und die darin enthaltenen Klassenaufgaben sowie der Klassen-Stundenplan werden dauerhaft gelöscht. Persönliche Kopien bleiben erhalten.', { title: 'Klasse löschen', label: 'Klasse löschen', typed: cls.name }))) return;
    keepSyncedTasksPersonal(cls);
    data.classes = data.classes.filter((x) => x.id !== cls.id);
    if (data.selectedClassId === cls.id) data.selectedClassId = '';
    if (persist()) { HM.render(); U.toast('Klasse gelöscht'); }
  };

  F['class-login'] = async function (f) {
    const d = new FormData(f), email = String(d.get('loginEmail')).trim().toLowerCase(), password = String(d.get('loginPassword'));
    const errs = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.loginEmail = 'Bitte eine gültige E-Mail-Adresse eingeben.';
    if (!password) errs.loginPassword = 'Bitte ein Passwort eingeben.';
    if (HM.UI.errors(f, errs)) return;
    try {
      const hash = await passwordHash(password), user = data.users.find((x) => x.email === email && x.passwordHash === hash);
      if (!user) return U.toast('E-Mail oder Passwort stimmt nicht. Für den ersten Login bitte ein lokales Konto erstellen.', true);
      data.currentUserId = user.id;
      if (persist()) { HM.UI.close(); HM.render(); }
    } catch (e) { U.toast(e.message || 'Anmeldung fehlgeschlagen.', true); }
  };

  F['class-register'] = async function (f) {
    const d = new FormData(f), email = String(d.get('registerEmail')).trim().toLowerCase(), password = String(d.get('registerPassword'));
    const errs = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.registerEmail = 'Bitte eine gültige E-Mail-Adresse eingeben.';
    if (password.length < 8) errs.registerPassword = 'Das Passwort muss mindestens 8 Zeichen lang sein.';
    if (data.users.some((x) => x.email === email)) errs.registerEmail = 'Für diese E-Mail gibt es bereits ein lokales Konto.';
    if (HM.UI.errors(f, errs)) return;
    try {
      data.users.push({ id: U.uid('user'), email, passwordHash: await passwordHash(password) });
      data.currentUserId = data.users[data.users.length - 1].id;
      if (persist()) { U.toast('Lokales Testkonto erstellt'); HM.render(); }
    } catch (e) { U.toast(e.message || 'Konto konnte nicht erstellt werden.', true); }
  };

  F['class-create'] = function (f) {
    const d = new FormData(f), name = String(d.get('name')).trim();
    if (!name) return U.toast('Bitte einen Klassennamen eingeben.', true);
    const user = CS.currentUser(), cls = {
      id: U.uid('class'), name: name.slice(0, 80), teacher: String(d.get('teacher')).trim().slice(0, 80),
      inviteCode: Math.random().toString(36).slice(2, 8).toUpperCase(), createdBy: user.id,
      members: [{ userId: user.id, role: 'admin' }], sync: { homework: true, schedule: false, teachers: false }, schedule: [], homework: []
    };
    data.classes.push(cls); data.selectedClassId = cls.id;
    if (persist()) { HM.UI.close(); HM.render(); U.toast('Klasse erstellt'); }
  };

  F['class-join'] = async function (f) {
    const d = new FormData(f), code = String(d.get('code')).trim().toUpperCase(), cls = data.classes.find((x) => x.inviteCode === code);
    if (!cls) return U.toast('Einladungscode nicht gefunden. Codes funktionieren derzeit nur auf diesem Gerät.', true);
    if (cls.members.some((m) => m.userId === data.currentUserId)) return U.toast('Du bist bereits Mitglied dieser Klasse.');
    let useSchedule = false;
    if (cls.schedule.length) useSchedule = await HM.UI.confirm('Passt dir der Stundenplan von „' + cls.name + '“? Wenn du bestätigst, werden die Stunden in deinen persönlichen Plan kopiert. Du kannst sie dort später einzeln ändern oder löschen.', { title: 'Stundenplan übernehmen?', label: 'Ja, übernehmen', cancelLabel: 'Nein, ohne Plan beitreten' });
    cls.members.push({ userId: data.currentUserId, role: 'student', scheduleSync: useSchedule });
    data.selectedClassId = cls.id;
    if (persist()) {
      if (useSchedule) CS.mergeSchedule(cls);
      HM.render(); U.toast('Du bist der Klasse beigetreten');
    }
  };

  F['class-schedule-save'] = function (f) {
    const d = new FormData(f), cls = data.classes.find((x) => x.id === d.get('classId'));
    const start = String(d.get('start')), end = String(d.get('end')), subject = String(d.get('subject')).trim();
    if (!cls || !CS.canManage(cls)) return U.toast('Nur Lehrer und Admins dürfen den Klassen-Stundenplan bearbeiten.', true);
    if (!subject || start >= end) return U.toast('Bitte Fach und gültige Zeitspanne eingeben.', true);
    const entry = { id: U.uid('lesson'), day: Number(d.get('day')), start, end, subject, teacher: String(d.get('teacher')).trim() };
    if (!cls.schedule.some((x) => x.day === entry.day && x.start === start && x.end === end && x.subject.toLowerCase() === subject.toLowerCase())) cls.schedule.push(entry);
    if (persist()) {
      const member = cls.members.find((x) => x.userId === data.currentUserId);
      if (member && member.scheduleSync) CS.mergeSchedule(cls, true);
      HM.UI.close(); HM.render(); U.toast('Stunde hinzugefügt');
    }
  };

  F['class-homework-save'] = function (f) {
    const d = new FormData(f), cls = data.classes.find((x) => x.id === d.get('classId')), taskId = String(d.get('taskId') || ''), title = String(d.get('title')).trim(), due = String(d.get('due'));
    if (!cls || !title || (due && !U.parse(due))) return U.toast('Bitte einen Titel und ein gültiges Fälligkeitsdatum eingeben.', true);
    const existing = cls.homework.find((x) => x.id === taskId);
    if (taskId && (!existing || (!CS.canManage(cls) && existing.createdBy !== data.currentUserId))) return U.toast('Du darfst diese Klassenaufgabe nicht bearbeiten.', true);
    if (!taskId && !CS.canManage(cls)) return U.toast('Nur Lehrer und Admins dürfen Klassenaufgaben erstellen.', true);
    const fields = { title: title.slice(0, 140), subject: String(d.get('subject')).trim().slice(0, 80), due, description: String(d.get('description')).trim().slice(0, 2000) };
    if (existing) Object.assign(existing, fields);
    else cls.homework.push(Object.assign({ id: U.uid('chtask'), createdBy: data.currentUserId, created: Date.now(), type: 'Hausaufgabe', priority: 'normal', teacher: '', link: '', doneBy: [] }, fields));
    if (persist()) { HM.UI.close(); HM.render(); U.toast(existing ? 'Klassenaufgabe aktualisiert' : 'Klassen-Hausaufgabe hinzugefügt'); }
  };

  A['class-sync'] = function (el) {
    const cls = data.classes.find((x) => x.id === el.dataset.id);
    if (!cls) return U.toast('Klasse nicht gefunden.', true);
    let addedHomework = 0, addedLessons = 0;
    if (cls.sync.homework) cls.homework.forEach((h) => {
      if (!HM.state.homework.some((x) => x.classTaskId === h.id)) {
        HM.state.homework.push({ id: U.uid('h'), classTaskId: h.id, subjectId: null, subjectName: h.subject, teacherId: null, teacherName: '',
          title: h.title, description: h.description, type: 'Hausaufgabe', assigned: '', due: h.due, priority: 'normal', done: false, notes: '', link: '', created: Date.now() });
        addedHomework++;
      }
    });
    if (cls.sync.schedule) addedLessons = CS.mergeSchedule(cls);
    if (cls.sync.teachers) cls.schedule.forEach((lesson) => {
      const name = lesson.teacher.trim();
      if (name && !HM.state.teachers.some((t) => t.name.toLowerCase() === name.toLowerCase())) HM.state.teachers.push({ id: U.uid('t'), name, subjectIds: [], notes: '' });
    });
    const appSaved = HM.save(), classSaved = persist();
    if (appSaved && classSaved) U.toast(addedHomework + ' Hausaufgaben und ' + addedLessons + ' Stunden ergänzt. Vorhandene Einträge bleiben erhalten.');
    HM.render();
  };

  document.addEventListener('change', (e) => {
    const el = e.target;
    if (el.matches('[data-class-schedule]')) {
      const cls = CS.getClass(el.dataset.classId), member = cls && cls.members.find((m) => m.userId === data.currentUserId);
      if (!member) return U.toast('Klasse konnte nicht gefunden werden.', true);
      member.scheduleSync = el.checked;
      if (persist() && el.checked) { CS.mergeSchedule(cls); HM.render(); }
      else HM.render();
    }
    if (el.matches('[data-class-role]')) {
      const cls = data.classes.find((x) => x.id === el.dataset.classId);
      const member = cls && cls.members.find((x) => x.userId === el.dataset.userId);
      if (!cls || classRole(cls, data.currentUserId) !== 'admin' || !member) return U.toast('Rolle konnte nicht geändert werden.', true);
      if (member.userId === cls.createdBy && el.value !== 'admin') {
        el.value = 'admin';
        return U.toast('Der Ersteller muss Admin bleiben.', true);
      }
      member.role = ['admin', 'teacher', 'student'].includes(el.value) ? el.value : 'student';
      if (persist()) HM.render();
    }
    if (el.matches('[data-class-sync]')) {
      const cls = data.classes.find((x) => x.id === el.dataset.classId);
      if (!cls) return U.toast('Klasse nicht gefunden.', true);
      cls.sync[el.dataset.classSync] = el.checked;
      persist();
    }
  });

  load();
})();
