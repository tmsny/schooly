(function () {
  const HM = window.HM, U = HM.U, E = U.esc;
  const A = (HM.actions = HM.actions || {}), F = (HM.forms = HM.forms || {});
  const DAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag'];
  const CS = (HM.ClassSystem = {});

  function hasFirebase() {
    return !!(window.SchoolyAuth && window.SchoolyAuth.configured && window.SchoolyClasses);
  }

  CS.currentUser = function () {
    if (window.SchoolyAuth && window.SchoolyAuth.user) {
      const u = window.SchoolyAuth.user;
      return { id: u.uid, email: u.email || '', name: u.displayName || u.email || 'Benutzer' };
    }
    return null;
  };

  CS.currentUserId = function () {
    return (window.SchoolyAuth && window.SchoolyAuth.user && window.SchoolyAuth.user.uid) || '';
  };

  CS.isLoggedIn = function () {
    return !!(window.SchoolyAuth && window.SchoolyAuth.user);
  };

  CS.classes = function () {
    if (window.SchoolyClasses && typeof window.SchoolyClasses.getClassesList === 'function') {
      return window.SchoolyClasses.getClassesList();
    }
    return [];
  };

  CS.getClass = function (id) {
    if (window.SchoolyClasses && typeof window.SchoolyClasses.getClassById === 'function') {
      return window.SchoolyClasses.getClassById(id);
    }
    return null;
  };

  function classRole(c, userId) {
    if (!c || !userId) return '';
    if (c.ownerId === userId) return 'admin';
    if (Array.isArray(c.adminIds) && c.adminIds.includes(userId)) return 'admin';
    const m = Array.isArray(c.members) ? c.members.find((x) => (x.uid || x.userId) === userId) : null;
    return m ? (m.role || 'student') : (Array.isArray(c.memberIds) && c.memberIds.includes(userId) ? 'student' : '');
  }
  CS.roleFor = classRole;

  CS.canManage = function (cls) {
    const uid = CS.currentUserId();
    if (!cls || !uid) return false;
    return cls.ownerId === uid || (Array.isArray(cls.adminIds) && cls.adminIds.includes(uid));
  };

  CS.reconcile = function () {
    const classes = CS.classes();
    const sharedTaskIds = new Set(classes.flatMap((cls) => (cls.homework || []).map((h) => h.id)));
    let changed = false;
    HM.state.homework.forEach((task) => {
      if (task.classTaskId && !sharedTaskIds.has(task.classTaskId)) {
        delete task.classTaskId;
        changed = true;
      }
    });
    if (changed) HM.save();
  };

  CS.logout = async function () {
    if (window.SchoolyAuth) await window.SchoolyAuth.logout();
    location.assign('login.html');
  };

  CS.renderLogin = function () {
    return '<div class="auth-wrap"><div class="card auth-card"><div class="brand">Schooly</div><h1>Willkommen</h1>' +
      '<p class="mute">Bitte melde dich an, um auf deine Klassen und Aufgaben zuzugreifen.</p>' +
      '<div style="margin-top:16px;display:flex;flex-direction:column;gap:10px;">' +
      '<a class="btn" href="login.html" style="text-align:center;">Jetzt einloggen →</a>' +
      '<a class="btn ghost" href="login.html?mode=signup" style="text-align:center;">Kostenlos registrieren</a>' +
      '</div></div></div>';
  };

  CS.mergeSchedule = function (cls, silent) {
    if (!cls || !Array.isArray(cls.schedule)) return 0;
    let added = 0;
    cls.schedule.forEach((lesson) => {
      if (!HM.state.schedule.some((x) => x.day === lesson.day && x.start === lesson.start && x.end === lesson.end && x.subject.toLowerCase() === lesson.subject.toLowerCase())) {
        HM.state.schedule.push(Object.assign({}, lesson, { id: U.uid('merged'), sourceClassId: cls.id, sourceLessonId: lesson.id }));
        added++;
      }
    });
    if (HM.save() && added && !silent) {
      U.toast(added + ' Stunde(n) zum persönlichen Stundenplan hinzugefügt. Eigene Einträge bleiben erhalten.');
    }
    return added;
  };

  CS.toggleHomework = async function (classId, taskId) {
    if (window.SchoolyClasses) {
      try {
        await window.SchoolyClasses.toggleTaskStatus(classId, taskId);
      } catch (e) {
        U.toast(e.message, true);
      }
    }
  };

  CS.deleteHomework = async function (classId, taskId) {
    if (window.SchoolyClasses) {
      try {
        await window.SchoolyClasses.deleteTask(classId, taskId);
        U.toast('Klassenaufgabe gelöscht.');
      } catch (e) {
        U.toast(e.message, true);
      }
    }
  };

  function formClassSchedule(id) {
    HM.UI.open('Stunde zu Klassenplan hinzufügen', '<form class="form" data-form="class-schedule-save"><input type="hidden" name="classId" value="' + E(id) + '">' +
      HM.UI.fld('Wochentag', 'day', 'select', '1', { options: DAYS.map((d, i) => [String(i + 1), d]) }) +
      '<div class="row2">' + HM.UI.fld('Beginn', 'start', 'time', '08:00', { required: true }) + HM.UI.fld('Ende', 'end', 'time', '09:00', { required: true }) + '</div>' +
      HM.UI.fld('Fach / Aktivität', 'subject', 'text', '', { required: true, max: 80, placeholder: 'z. B. Sport' }) +
      HM.UI.fld('Lehrer (optional)', 'teacher', 'text', '', { max: 80 }) +
      '<div class="dlg-f"><button type="button" class="btn ghost" data-action="dlg-close">Abbrechen</button><button class="btn">Hinzufügen</button></div></form>');
  }

  function formClassHomework(id) {
    const clsId = id.classId || id;
    const cls = CS.getClass(clsId);
    const task = (id.taskId && cls && cls.homework) ? cls.homework.find((x) => x.id === id.taskId) : null;
    HM.UI.open(task ? 'Klassenaufgabe bearbeiten' : 'Klassen-Aufgabe hinzufügen', '<form class="form" data-form="class-homework-save"><input type="hidden" name="classId" value="' + E(clsId) + '"><input type="hidden" name="taskId" value="' + E(task ? task.id : '') + '">' +
      HM.UI.fld('Titel', 'title', 'text', task ? task.title : '', { required: true, max: 140 }) +
      HM.UI.fld('Fach (optional)', 'subject', 'text', task ? task.subject : '', { max: 80 }) +
      HM.UI.fld('Fällig am (optional)', 'due', 'date', task ? (task.dueDate || task.due || '') : '') +
      HM.UI.fld('Beschreibung (optional)', 'description', 'textarea', task ? task.description : '', { rows: 3 }) +
      '<div class="dlg-f"><button type="button" class="btn ghost" data-action="dlg-close">Abbrechen</button><button class="btn">' + (task ? 'Änderungen speichern' : 'In Firebase speichern') + '</button></div></form>');
  }

  A['class-new'] = function () {
    HM.UI.open('Eigene Klasse erstellen', '<form class="form" data-form="class-create">' +
      HM.UI.fld('Klassenname *', 'name', 'text', '', { required: true, max: 70, placeholder: 'z. B. 9A Mathematik' }) +
      HM.UI.fld('Beschreibung (optional)', 'description', 'text', '', { max: 140, placeholder: 'z. B. Hausaufgaben, Lösungen und Termine' }) +
      '<p class="small mute">Die Klasse wird in Firebase synchronisiert. Du erhältst automatisch einen 8-stelligen Klassencode zum Teilen.</p>' +
      '<div class="dlg-f"><button type="button" class="btn ghost" data-action="dlg-close">Abbrechen</button><button class="btn">Klasse erstellen</button></div></form>');
  };

  A['class-logout'] = () => CS.logout();
  A['class-task-toggle'] = (el) => CS.toggleHomework(el.dataset.classId, el.dataset.id);
  A['class-task-del'] = async function (el) {
    if (!(await HM.UI.confirm('Möchtest du diese Klassenaufgabe wirklich für alle löschen?', { title: 'Klassenaufgabe löschen', label: 'Für alle löschen' }))) return;
    await CS.deleteHomework(el.dataset.classId, el.dataset.id);
  };

  A['class-schedule-del'] = async function (el) {
    const classId = el.dataset.classId, lessonId = el.dataset.id;
    if (!classId || !lessonId) return;
    if (!(await HM.UI.confirm('„' + (el.getAttribute('aria-label') || 'Stunde') + '“ wird aus dem Stundenplan der Klasse entfernt.', { title: 'Klassenstunde löschen', label: 'Aus Klasse entfernen' }))) return;
    if (window.SchoolyClasses) {
      try {
        await window.SchoolyClasses.deleteLesson(classId, lessonId);
        U.toast('Stunde aus dem Klassen-Stundenplan entfernt.');
        HM.render();
      } catch (err) {
        U.toast(err.message, true);
      }
    }
  };

  A['schedule-new'] = (el) => formClassSchedule(el.dataset.id);
  A['class-homework-new'] = (el) => formClassHomework(el.dataset.id);
  A['class-task-edit'] = function (el) {
    formClassHomework({ classId: el.dataset.classId, taskId: el.dataset.id });
  };

  A['class-invite'] = function (el) {
    const cls = CS.getClass(el.dataset.id);
    if (cls) {
      HM.UI.open('Klassencode teilen', '<p>Teile diesen Code mit deinen Schülern oder Mitschülern. Sie können damit direkt in Schooly beitreten:</p>' +
        '<p class="invite-code" style="font-size:1.8rem;letter-spacing:4px;font-weight:700;text-align:center;padding:14px;background:#f3f0ff;border-radius:8px;color:var(--purple);margin:14px 0;">' + E(cls.code) + '</p>' +
        '<div class="dlg-f"><button class="btn" data-action="dlg-close">Fertig</button></div>');
    }
  };

  A['class-leave'] = async function (el) {
    const cls = CS.getClass(el.dataset.id);
    if (!cls) return;
    if (cls.ownerId === CS.currentUserId()) {
      return U.toast('Als Besitzer kannst du die Klasse in den Einstellungen löschen, aber nicht verlassen.', true);
    }
    if (!(await HM.UI.confirm('Möchtest du die Klasse „' + cls.name + '“ wirklich verlassen? Deine persönlichen Aufgaben bleiben erhalten.', { title: 'Klasse verlassen', label: 'Verlassen' }))) return;
    if (window.SchoolyClasses) {
      try {
        await window.SchoolyClasses.leaveClass(cls.id);
        U.toast('Du hast die Klasse verlassen.');
        HM.render();
      } catch (err) {
        U.toast(err.message, true);
      }
    }
  };

  A['class-delete'] = async function (el) {
    const cls = CS.getClass(el.dataset.id);
    if (!cls || !CS.canManage(cls)) return U.toast('Nur der Besitzer kann die Klasse löschen.', true);
    if (!(await HM.UI.confirm('„' + cls.name + '“ und alle Aufgaben darin werden dauerhaft aus Firebase gelöscht.', { title: 'Klasse löschen', label: 'Klasse löschen', typed: cls.name }))) return;
    if (window.SchoolyClasses) {
      try {
        await window.SchoolyClasses.deleteClass(cls.id, cls.code);
        U.toast('Klasse erfolgreich gelöscht.');
        HM.render();
      } catch (err) {
        U.toast(err.message, true);
      }
    }
  };

  F['class-create'] = async function (f) {
    const d = new FormData(f), name = String(d.get('name') || '').trim(), desc = String(d.get('description') || '').trim();
    if (!name) return U.toast('Bitte einen Klassennamen eingeben.', true);
    if (window.SchoolyClasses) {
      try {
        const created = await window.SchoolyClasses.create(name, desc);
        U.toast(`Klasse „${created.name}“ erfolgreich in Firebase erstellt! Code: ${created.code}`);
        HM.UI.close();
        if (location.hash === '#/classes') {
          await window.SchoolyClasses.render();
        } else {
          HM.render();
        }
      } catch (err) {
        U.toast(err.message, true);
      }
    }
  };

  F['class-join'] = async function (f) {
    const d = new FormData(f), code = String(d.get('code') || '').trim().toUpperCase();
    if (!code) return U.toast('Bitte den Klassencode eingeben.', true);
    if (window.SchoolyClasses) {
      try {
        const name = await window.SchoolyClasses.join(code);
        U.toast(`Du bist der Klasse „${name}“ beigetreten.`);
        HM.UI.close();
        if (location.hash === '#/classes') {
          await window.SchoolyClasses.render();
        } else {
          HM.render();
        }
      } catch (err) {
        U.toast(err.message, true);
      }
    }
  };

  F['class-schedule-save'] = async function (f) {
    const d = new FormData(f), classId = String(d.get('classId') || '');
    const start = String(d.get('start') || ''), end = String(d.get('end') || ''), subject = String(d.get('subject') || '').trim();
    if (!classId || !subject || start >= end) return U.toast('Bitte Fach und gültige Uhrzeiten eingeben.', true);
    if (window.SchoolyClasses) {
      try {
        await window.SchoolyClasses.saveLesson(classId, {
          day: Number(d.get('day')),
          start,
          end,
          subject,
          teacher: String(d.get('teacher') || '').trim()
        });
        HM.UI.close();
        U.toast('Stunde in den Klassenplan übernommen.');
        HM.render();
      } catch (err) {
        U.toast(err.message, true);
      }
    }
  };

  F['class-homework-save'] = async function (f) {
    const d = new FormData(f), classId = String(d.get('classId') || ''), taskId = String(d.get('taskId') || '');
    const title = String(d.get('title') || '').trim(), due = String(d.get('due') || '');
    if (!classId || !title || (due && !U.parse(due))) return U.toast('Bitte einen Titel und ein gültiges Fälligkeitsdatum eingeben.', true);
    if (window.SchoolyClasses) {
      try {
        await window.SchoolyClasses.saveTask(classId, {
          title,
          subject: String(d.get('subject') || '').trim() || 'Allgemein',
          dueDate: due,
          description: String(d.get('description') || '').trim(),
          priority: 'normal',
          status: 'offen'
        }, taskId || null);
        HM.UI.close();
        U.toast(taskId ? 'Klassenaufgabe aktualisiert' : 'Klassenaufgabe hinzugefügt');
        HM.render();
      } catch (err) {
        U.toast(err.message, true);
      }
    }
  };

  A['class-sync'] = function (el) {
    const cls = CS.getClass(el.dataset.id);
    if (!cls) return U.toast('Klasse nicht gefunden.', true);
    let addedHomework = 0, addedLessons = 0;
    if (Array.isArray(cls.homework)) {
      cls.homework.forEach((h) => {
        if (!HM.state.homework.some((x) => x.classTaskId === h.id)) {
          HM.state.homework.push({
            id: U.uid('h'),
            classTaskId: h.id,
            subjectId: null,
            subjectName: h.subject || 'Allgemein',
            teacherId: null,
            teacherName: '',
            title: h.title,
            description: h.description || '',
            type: h.type || 'Hausaufgabe',
            assigned: '',
            due: h.dueDate || h.due || '',
            priority: h.priority || 'normal',
            done: h.status === 'erledigt',
            notes: '',
            link: '',
            created: Date.now()
          });
          addedHomework++;
        }
      });
    }
    addedLessons = CS.mergeSchedule(cls, true);
    const appSaved = HM.save();
    if (appSaved) {
      U.toast(`${addedHomework} Aufgaben und ${addedLessons} Stunden in deinen persönlichen Bereich übernommen.`);
      HM.render();
    }
  };

  document.addEventListener('change', (e) => {
    const el = e.target;
    if (el.matches('[data-class-schedule]')) {
      const cls = CS.getClass(el.dataset.classId);
      if (!cls) return;
      if (el.checked) CS.mergeSchedule(cls);
    }
  });
})();
