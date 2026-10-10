(function () {
  const HM = (window.HM = window.HM || {});
  const KEY = 'hm.v1';
  const TYPES = ['Hausaufgabe', 'Prüfung', 'Test', 'Referat', 'Projekt'];
  const PRIOS = ['niedrig', 'normal', 'hoch'];
  const DEFAULTS = [['Mathematik', 'Ma'], ['Deutsch', 'De'], ['Englisch', 'En'], ['Informatik', 'Inf'], ['Italienisch', 'It'], ['Geschichte', 'Ge']];
  HM.TYPES = TYPES; HM.PRIOS = PRIOS; HM.DEFAULT_SUBJECTS = DEFAULTS;

  const P = {
    home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
    timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6M12 2v3M19 6l1.5-1.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', check: '<path d="M20 6 9 17l-5-5"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
    edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>', left: '<path d="m15 18-6-6 6-6"/>', right: '<path d="m9 18 6-6-6-6"/>',
    grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
    down: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
    up: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>'
  };
  const pad = (n) => String(n).padStart(2, '0');
  const U = (HM.U = {
    esc: (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    uid: (p) => p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    iso: (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()),
    today: () => U.iso(new Date()),
    parse(s) {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
      if (!m) return null;
      const d = new Date(+m[1], +m[2] - 1, +m[3]);
      return d.getMonth() === +m[2] - 1 ? d : null;
    },
    addDays(s, n) { const d = U.parse(s); d.setDate(d.getDate() + n); return U.iso(d); },
    diff: (a, b) => Math.round((U.parse(a) - U.parse(b)) / 864e5),
    fmt(s, o) { const d = U.parse(s); return d ? d.toLocaleDateString('de-DE', o || { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''; },
    icon: (n) => '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">' + (P[n] || '') + '</svg>',
    safeUrl(u) { try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : ''; } catch (e) { return ''; } },
    toast(msg, err) {
      const el = document.createElement('div');
      el.className = 'toast' + (err ? ' err' : ''); el.textContent = msg;
      document.getElementById('toasts').appendChild(el);
      setTimeout(() => el.remove(), err ? 6000 : 2800);
    }
  });

  const str = (v, max) => String(v == null ? '' : v).slice(0, max || 2000);
  function fresh() {
    return {
      version: 1,
      subjects: DEFAULTS.map(([name, abbr]) => ({ id: U.uid('s'), name, abbr, description: '' })),
      teachers: [], homework: [], schedule: [], settings: { weekStart: 1, view: 'list' }
    };
  }
  function sanitize(raw) {
    if (!raw || typeof raw !== 'object' || !(Array.isArray(raw.homework) || Array.isArray(raw.subjects))) return null;
    const arr = (a) => (Array.isArray(a) ? a.filter((x) => x && typeof x === 'object' && typeof x.id === 'string') : []);
    const st = fresh();
    st.subjects = arr(raw.subjects).map((s) => ({ id: s.id, name: str(s.name, 80).trim() || 'Unbenannt', abbr: str(s.abbr, 6), description: str(s.description) }));
    st.teachers = arr(raw.teachers).map((t) => ({ id: t.id, name: str(t.name, 80).trim() || 'Unbenannt', subjectIds: Array.isArray(t.subjectIds) ? t.subjectIds.filter((x) => typeof x === 'string') : [], notes: str(t.notes) }));
    st.homework = arr(raw.homework).map((h) => ({
      id: h.id, subjectId: h.subjectId || null, subjectName: str(h.subjectName, 80), teacherId: h.teacherId || null, teacherName: str(h.teacherName, 80),
      title: str(h.title, 140).trim() || 'Ohne Titel', description: str(h.description), type: TYPES.includes(h.type) ? h.type : 'Hausaufgabe',
      assigned: U.parse(h.assigned) ? h.assigned : '', due: U.parse(h.due) ? h.due : '', priority: PRIOS.includes(h.priority) ? h.priority : 'normal',
      done: !!h.done, notes: str(h.notes), link: str(h.link, 500), created: Number(h.created) || Date.now(), demo: !!h.demo,
      classTaskId: typeof h.classTaskId === 'string' ? h.classTaskId : ''
    }));
    st.schedule = arr(raw.schedule).map((x) => ({
      id: x.id, day: Math.max(1, Math.min(5, Number(x.day) || 1)),
      start: /^\d{2}:\d{2}$/.test(x.start) ? x.start : '08:00',
      end: /^\d{2}:\d{2}$/.test(x.end) ? x.end : '09:00', sourceClassId: typeof x.sourceClassId === 'string' ? x.sourceClassId : '',
      subject: str(x.subject, 80).trim() || 'Unbenannt', teacher: str(x.teacher, 80)
    }));
    const s = raw.settings || {};
    st.settings = { weekStart: s.weekStart === 0 ? 0 : 1, view: s.view === 'cards' ? 'cards' : 'list' };
    return st;
  }
  HM.sanitize = sanitize; HM.fresh = fresh;

  HM.saveLocalOnly = function () {
    try { localStorage.setItem(KEY, JSON.stringify(HM.state)); return true; }
    catch (e) { U.toast('Speichern fehlgeschlagen. Der Browser-Speicher ist voll oder blockiert.', true); return false; }
  };
  let cloudTimer = null;
  HM.save = function () {
    const ok = HM.saveLocalOnly();
    if (ok && HM.cloudLoaded && window.SchoolyAuth && SchoolyAuth.user && SchoolyAuth.db) {
      clearTimeout(cloudTimer);
      cloudTimer = setTimeout(async () => {
        try {
          await SchoolyAuth.db.collection('users').doc(SchoolyAuth.user.uid).collection('private').doc('main').set({state: HM.state, schemaVersion: 1, updatedAt: firebase.firestore.FieldValue.serverTimestamp()});
        } catch (e) { console.error('Schooly Cloud-Speicherung fehlgeschlagen', e); U.toast('Cloud-Speicherung fehlgeschlagen. Deine Daten bleiben vorerst auf diesem Gerät.', true); }
      }, 450);
    }
    return ok;
  };
  HM.load = function () {
    let raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { U.toast('LocalStorage ist nicht verfügbar. Änderungen gehen beim Schließen verloren.', true); }
    let st = null;
    if (raw) {
      try { st = sanitize(JSON.parse(raw)); } catch (e) { st = null; }
      if (!st) {
        try { localStorage.setItem(KEY + '.corrupt', raw); } catch (e) {}
        U.toast('Gespeicherte Daten waren ungültig. Eine Kopie wurde gesichert, die App startet neu.', true);
      }
    }
    HM.state = st || fresh();
    HM.cloudLoaded = false;
    if (!st) HM.saveLocalOnly();
  };
  HM.reset = function () { HM.state = fresh(); return HM.save(); };

  function download(name, text, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  HM.exportJSON = () => { download('hausaufgaben-' + U.today() + '.json', JSON.stringify(HM.state, null, 2), 'application/json'); U.toast('Sicherung exportiert'); };
  HM.exportCSV = () => {
    const cell = (v) => { v = String(v == null ? '' : v); if (/^[=+\-@\t\r]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; };
    const rows = [['Fach', 'Titel', 'Typ', 'Lehrer', 'Aufgabedatum', 'Fällig', 'Priorität', 'Status', 'Beschreibung', 'Notizen', 'Link']];
    HM.state.homework.forEach((h) => rows.push([HM.Homework.subjectName(h), h.title, h.type, HM.Homework.teacherName(h), h.assigned, h.due, h.priority, h.done ? 'erledigt' : 'offen', h.description, h.notes, h.link]));
    download('hausaufgaben-' + U.today() + '.csv', '\ufeff' + rows.map((r) => r.map(cell).join(';')).join('\r\n'), 'text/csv;charset=utf-8');
    U.toast('CSV exportiert');
  };
})();
