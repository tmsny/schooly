(function () {
  const U = window.HM.U, E = U.esc;
  let activeClassId = null;
  let activeTab = 'overview';
  let activeFolderId = null;
  let currentCalDate = new Date();

  // Helper to compress images client-side into base64 data URLs
  function compressImage(file, maxDimension = 1200, quality = 0.8) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let w = img.width, h = img.height;
          if (w > maxDimension || h > maxDimension) {
            if (w > h) {
              h = Math.round((h * maxDimension) / w);
              w = maxDimension;
            } else {
              w = Math.round((w * maxDimension) / h);
              h = maxDimension;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // Lightbox for full-size image viewing
  function openLightbox(imageUrl, title = 'Bildanzeige') {
    const existing = document.getElementById('schooly-lightbox');
    if (existing) existing.remove();

    const box = document.createElement('div');
    box.id = 'schooly-lightbox';
    box.className = 'lightbox-modal';
    box.innerHTML = `
      <div class="lightbox-content">
        <button class="lightbox-close" type="button" aria-label="Schließen">✕ Schließen</button>
        <img src="${E(imageUrl)}" alt="${E(title)}">
      </div>
    `;
    box.querySelector('.lightbox-close').addEventListener('click', () => box.remove());
    box.addEventListener('click', (e) => {
      if (e.target === box) box.remove();
    });
    document.body.appendChild(box);
  }

  const C = window.SchoolyClasses = {
    code() {
      const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      return Array.from({ length: 8 }, () => a[Math.floor(Math.random() * a.length)]).join('');
    },

    async list() {
      const u = SchoolyAuth.user, d = SchoolyAuth.db;
      if (!u || !d) return [];
      const s = await d.collection('classes').where('memberIds', 'array-contains', u.uid).get();
      return s.docs.map(x => ({ id: x.id, ...x.data() })).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'de'));
    },

    async get(classId) {
      const d = SchoolyAuth.db;
      if (!d || !classId) return null;
      const snap = await d.collection('classes').doc(classId).get();
      return snap.exists ? { id: snap.id, ...snap.data() } : null;
    },

    async create(name, description = '', customSubjects = null) {
      const u = SchoolyAuth.user, d = SchoolyAuth.db;
      name = String(name || '').trim();
      if (name.length < 2 || name.length > 70) {
        throw Error('Der Klassenname muss zwischen 2 und 70 Zeichen lang sein.');
      }
      let code, dir;
      for (let i = 0; i < 5; i++) {
        code = C.code();
        dir = d.collection('classDirectory').doc(code);
        if (!(await dir.get()).exists) break;
        code = '';
      }
      if (!code) throw Error('Kein eindeutiger Code verfügbar. Bitte erneut versuchen.');

      const defaultSubjects = customSubjects || [
        'Mathematik', 'Deutsch', 'Englisch', 'Informatik', 'Physik', 'Geschichte', 'Biologie'
      ];

      const ref = d.collection('classes').doc();
      const memberEntry = {
        uid: u.uid,
        name: u.displayName || u.email || 'Schooly-Mitglied',
        email: u.email || '',
        role: 'admin',
        joinedAt: Date.now()
      };

      const data = {
        name,
        description: String(description || '').trim(),
        code,
        ownerId: u.uid,
        ownerName: u.displayName || u.email || 'Schooly-Mitglied',
        adminIds: [u.uid],
        memberIds: [u.uid],
        members: [memberEntry],
        subjects: defaultSubjects,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      const b = d.batch();
      b.set(ref, data);
      b.set(dir, {
        classId: ref.id,
        name,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      await b.commit();
      return { id: ref.id, ...data };
    },

    async join(raw) {
      const u = SchoolyAuth.user, d = SchoolyAuth.db;
      const code = String(raw || '').trim().toUpperCase().replace(/\s+/g, '');
      if (!/^[A-HJ-NP-Z2-9]{8}$/.test(code)) {
        throw Error('Der Klassencode muss aus 8 Zeichen (Buchstaben oder Zahlen) bestehen.');
      }
      const ds = await d.collection('classDirectory').doc(code).get();
      if (!ds.exists) throw Error('Klassencode nicht gefunden. Bitte prüfe den Code.');

      const classId = ds.data().classId;
      const ref = d.collection('classes').doc(classId);

      await d.runTransaction(async (tx) => {
        const s = await tx.get(ref);
        if (!s.exists) throw Error('Diese Klasse existiert nicht mehr.');
        const cData = s.data();
        const memberIds = cData.memberIds || [];
        if (!memberIds.includes(u.uid)) {
          const newMembers = (cData.members || []).slice();
          newMembers.push({
            uid: u.uid,
            name: u.displayName || u.email || 'Schüler',
            email: u.email || '',
            role: 'student',
            joinedAt: Date.now()
          });
          tx.update(ref, {
            memberIds: firebase.firestore.FieldValue.arrayUnion(u.uid),
            members: newMembers,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        }
      });
      return ds.data().name;
    },

    async updateRole(classId, targetUid, newRole) {
      const u = SchoolyAuth.user, d = SchoolyAuth.db;
      const ref = d.collection('classes').doc(classId);

      await d.runTransaction(async (tx) => {
        const s = await tx.get(ref);
        if (!s.exists) throw Error('Klasse nicht gefunden.');
        const c = s.data();
        const isAdmin = c.ownerId === u.uid || (c.adminIds && c.adminIds.includes(u.uid));
        if (!isAdmin) throw Error('Nur Administratoren können Rollen verwalten.');
        if (targetUid === c.ownerId && newRole !== 'admin') {
          throw Error('Der Besitzer der Klasse muss Administrator bleiben.');
        }

        const members = (c.members || []).map((m) => {
          if (m.uid === targetUid) return { ...m, role: newRole };
          return m;
        });

        let adminIds = (c.adminIds || []).slice();
        if (newRole === 'admin' && !adminIds.includes(targetUid)) {
          adminIds.push(targetUid);
        } else if (newRole === 'student') {
          adminIds = adminIds.filter(id => id !== targetUid);
        }

        tx.update(ref, {
          members,
          adminIds,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      });
    },

    async leaveClass(classId) {
      const u = SchoolyAuth.user, d = SchoolyAuth.db;
      const ref = d.collection('classes').doc(classId);

      await d.runTransaction(async (tx) => {
        const s = await tx.get(ref);
        if (!s.exists) return;
        const c = s.data();
        if (c.ownerId === u.uid) {
          throw Error('Als Ersteller kannst du die Klasse nicht verlassen. Du kannst sie in den Einstellungen löschen.');
        }

        const memberIds = (c.memberIds || []).filter(id => id !== u.uid);
        const adminIds = (c.adminIds || []).filter(id => id !== u.uid);
        const members = (c.members || []).filter(m => m.uid !== u.uid);

        tx.update(ref, {
          memberIds,
          adminIds,
          members,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      });
    },

    async deleteClass(classId, code) {
      const u = SchoolyAuth.user, d = SchoolyAuth.db;
      const ref = d.collection('classes').doc(classId);
      const s = await ref.get();
      if (!s.exists) return;
      if (s.data().ownerId !== u.uid) throw Error('Nur der Besitzer kann die Klasse löschen.');

      const b = d.batch();
      b.delete(ref);
      if (code) {
        b.delete(d.collection('classDirectory').doc(code));
      }
      await b.commit();
    },

    // --- Tasks Subcollection ---
    async getTasks(classId) {
      const d = SchoolyAuth.db;
      if (!d || !classId) return [];
      const snap = await d.collection('classes').doc(classId).collection('tasks').get();
      return snap.docs
        .map(x => ({ id: x.id, ...x.data() }))
        .sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'));
    },

    async saveTask(classId, taskData, taskId = null) {
      const u = SchoolyAuth.user, d = SchoolyAuth.db;
      const col = d.collection('classes').doc(classId).collection('tasks');
      const data = {
        classId,
        title: String(taskData.title || '').trim(),
        description: String(taskData.description || '').trim(),
        subject: String(taskData.subject || '').trim() || 'Allgemein',
        dueDate: String(taskData.dueDate || '').trim(),
        priority: taskData.priority || 'normal',
        status: taskData.status || 'offen',
        assignedStudentIds: taskData.assignedStudentIds || [],
        assignedStudentNames: taskData.assignedStudentNames || [],
        images: taskData.images || [],
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      if (!taskId) {
        data.creatorId = u.uid;
        data.creatorName = u.displayName || u.email || 'Mitglied';
        data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        const ref = await col.add(data);
        return ref.id;
      } else {
        await col.doc(taskId).update(data);
        return taskId;
      }
    },

    async toggleTaskStatus(classId, taskId, currentStatus) {
      const d = SchoolyAuth.db;
      const next = currentStatus === 'erledigt' ? 'offen' : 'erledigt';
      await d.collection('classes').doc(classId).collection('tasks').doc(taskId).update({
        status: next,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    },

    async deleteTask(classId, taskId) {
      const d = SchoolyAuth.db;
      await d.collection('classes').doc(classId).collection('tasks').doc(taskId).delete();
    },

    // --- Folders & Materials Subcollection ---
    async getFolders(classId) {
      const d = SchoolyAuth.db;
      if (!d || !classId) return [];
      const snap = await d.collection('classes').doc(classId).collection('folders').get();
      return snap.docs.map(x => ({ id: x.id, ...x.data() }));
    },

    async createFolder(classId, name, subject = '', parentId = null) {
      const u = SchoolyAuth.user, d = SchoolyAuth.db;
      const col = d.collection('classes').doc(classId).collection('folders');
      const data = {
        classId,
        name: String(name || '').trim(),
        subject: String(subject || '').trim(),
        parentId: parentId || null,
        items: [],
        creatorId: u.uid,
        creatorName: u.displayName || u.email || 'Mitglied',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      const ref = await col.add(data);
      return ref.id;
    },

    async addMaterialItem(classId, folderId, item) {
      const u = SchoolyAuth.user, d = SchoolyAuth.db;
      const ref = d.collection('classes').doc(classId).collection('folders').doc(folderId);
      const snap = await ref.get();
      if (!snap.exists) throw Error('Ordner existiert nicht.');

      const items = (snap.data().items || []).slice();
      const newItem = {
        id: 'mat_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        title: String(item.title || '').trim(),
        description: String(item.description || '').trim(),
        type: item.type || 'solution',
        subject: String(item.subject || snap.data().subject || '').trim(),
        images: item.images || [],
        creatorId: u.uid,
        creatorName: u.displayName || u.email || 'Mitglied',
        createdAt: Date.now()
      };
      items.unshift(newItem);
      await ref.update({ items });
      return newItem;
    },

    async deleteMaterialItem(classId, folderId, itemId) {
      const d = SchoolyAuth.db;
      const ref = d.collection('classes').doc(classId).collection('folders').doc(folderId);
      const snap = await ref.get();
      if (!snap.exists) return;
      const items = (snap.data().items || []).filter(it => it.id !== itemId);
      await ref.update({ items });
    },

    async deleteFolder(classId, folderId) {
      const d = SchoolyAuth.db;
      await d.collection('classes').doc(classId).collection('folders').doc(folderId).delete();
    },

    // --- MAIN RENDER DISPATCHER ---
    async render() {
      const root = document.getElementById('class-view');
      if (!root) return;

      if (!activeClassId) {
        await C.renderClassList(root);
      } else {
        await C.renderClassDetail(root, activeClassId);
      }
    },

    // 1. Overview List of all user classes
    async renderClassList(root) {
      root.innerHTML = '<p class="classes-loading">Deine Klassen werden geladen …</p>';
      try {
        const cs = await C.list(), u = SchoolyAuth.user;
        if (!root.isConnected) return;

        root.innerHTML = `
          <div class="classes-actions">
            <form class="class-panel" id="join-class-form">
              <h2>Klasse beitreten</h2>
              <p>Gib den 8-stelligen Klassencode deiner Lerngruppe ein.</p>
              <label for="class-code">Klassencode</label>
              <input id="class-code" name="code" maxlength="8" placeholder="z. B. AB12CD34" required autocomplete="off">
              <button class="btn" type="submit">Klasse beitreten</button>
            </form>

            <form class="class-panel" id="create-class-form">
              <h2>Eigene Klasse erstellen</h2>
              <p>Erstelle einen gemeinsamen Bereich mit Rollen, Aufgaben und Lösungen.</p>
              <label for="class-name">Name der Klasse *</label>
              <input id="class-name" name="name" maxlength="70" placeholder="z. B. Klasse 9A Mathematik" required>
              <label for="class-desc">Beschreibung (optional)</label>
              <input id="class-desc" name="description" maxlength="140" placeholder="z. B. Hausaufgaben, Lösungen und Termine">
              <button class="btn" type="submit">Klasse erstellen</button>
            </form>
          </div>

          <div class="classes-heading">
            <div>
              <h2>Meine Klassen</h2>
              <p>Wähle eine Klasse aus, um Aufgaben, Kalender, Schüler und Lösungsordner zu öffnen.</p>
            </div>
            <span class="class-count">${cs.length} Klassen</span>
          </div>

          <div class="class-list">
            ${cs.length ? cs.map(c => {
              const isAdmin = c.ownerId === u.uid || (c.adminIds && c.adminIds.includes(u.uid));
              const myRole = isAdmin ? 'Admin' : 'Schüler';
              return `
                <article class="class-card" style="cursor: pointer;" data-open-class="${E(c.id)}">
                  <div class="class-card-mark">${E((c.name || 'K')[0].toUpperCase())}</div>
                  <div class="class-card-info">
                    <h3>${E(c.name)}</h3>
                    <p>${E(c.description || 'Gemeinsam organisiert')} · ${(c.memberIds || []).length} Mitglieder</p>
                    <div class="class-code-row">
                      <span>Klassencode</span>
                      <code>${E(c.code)}</code>
                      <button class="btn ghost sm" type="button" data-copy-code="${E(c.code)}">Code kopieren</button>
                    </div>
                  </div>
                  <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;">
                    <span class="role-badge ${isAdmin ? 'role-admin' : 'role-student'}">${myRole}</span>
                    <button class="btn sm" type="button" data-open-class="${E(c.id)}">Öffnen →</button>
                  </div>
                </article>
              `;
            }).join('') : `
              <div class="classes-empty">
                <h3>Noch keine Klasse vorhanden</h3>
                <p>Erstelle oben deine eigene Klasse oder tritt mit einem 8-stelligen Code bei.</p>
              </div>
            `}
          </div>
        `;

        // Join Handler
        root.querySelector('#join-class-form').addEventListener('submit', async (e) => {
          e.preventDefault();
          const btn = e.currentTarget.querySelector('button');
          btn.disabled = true;
          try {
            const codeVal = e.currentTarget.elements.code.value;
            const name = await C.join(codeVal);
            U.toast(`Du bist der Klasse „${name}“ beigetreten.`);
            await C.render();
          } catch (err) {
            U.toast(err.message, true);
          } finally {
            btn.disabled = false;
          }
        });

        // Create Handler
        root.querySelector('#create-class-form').addEventListener('submit', async (e) => {
          e.preventDefault();
          const btn = e.currentTarget.querySelector('button');
          btn.disabled = true;
          try {
            const form = e.currentTarget;
            const nameVal = form.elements.name.value;
            const descVal = form.elements.description.value;
            const created = await C.create(nameVal, descVal);
            U.toast(`Klasse „${created.name}“ erstellt! Code: ${created.code}`);
            activeClassId = created.id;
            activeTab = 'overview';
            await C.render();
          } catch (err) {
            U.toast(err.message, true);
          } finally {
            btn.disabled = false;
          }
        });

        // Open Class Handler
        root.querySelectorAll('[data-open-class]').forEach(el => {
          el.addEventListener('click', (e) => {
            if (e.target.closest('[data-copy-code]')) return;
            activeClassId = el.dataset.openClass;
            activeTab = 'overview';
            C.render();
          });
        });

        // Copy Code Handler
        root.querySelectorAll('[data-copy-code]').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            try {
              await navigator.clipboard.writeText(btn.dataset.copyCode);
              U.toast('Klassencode in die Zwischenablage kopiert.');
            } catch (err) {
              U.toast('Bitte den Code manuell kopieren: ' + btn.dataset.copyCode, true);
            }
          });
        });

      } catch (err) {
        console.error(err);
        root.innerHTML = '<div class="classes-empty"><h3>Klassen konnten nicht geladen werden</h3><p>Bitte prüfe die Internetverbindung und Firestore-Regeln.</p></div>';
      }
    },

    // 2. Class Detail View with Tabs
    async renderClassDetail(root, classId) {
      root.innerHTML = '<p class="classes-loading">Klassendaten werden geladen …</p>';
      try {
        const cls = await C.get(classId);
        const u = SchoolyAuth.user;
        if (!cls) {
          U.toast('Klasse nicht gefunden.', true);
          activeClassId = null;
          return C.render();
        }

        const isAdmin = cls.ownerId === u.uid || (cls.adminIds && cls.adminIds.includes(u.uid));
        const myRole = isAdmin ? 'Admin' : 'Schüler';

        // Load tasks and folders for the class
        const tasks = await C.getTasks(classId);
        const folders = await C.getFolders(classId);

        root.innerHTML = `
          <div>
            <div style="margin-bottom: 14px;">
              <button class="btn ghost sm" type="button" id="back-to-classes-btn">← Zurück zu allen Klassen</button>
            </div>

            <div class="class-header-bar">
              <div class="class-header-info">
                <h2>
                  ${E(cls.name)}
                  <span class="role-badge ${isAdmin ? 'role-admin' : 'role-student'}">${myRole}</span>
                </h2>
                <p>${E(cls.description || 'Klassenbereich')} · Erstellt von ${E(cls.ownerName || 'Schooly')}</p>
              </div>
              <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                <div class="class-code-row" style="margin-top:0;">
                  <span>Klassencode</span>
                  <code>${E(cls.code)}</code>
                  <button class="btn ghost sm" type="button" id="detail-copy-code-btn">Kopieren</button>
                </div>
              </div>
            </div>

            <!-- TAB NAVIGATION -->
            <div class="class-tabs">
              <button class="class-tab-btn ${activeTab === 'overview' ? 'active' : ''}" type="button" data-tab="overview">📊 Übersicht</button>
              <button class="class-tab-btn ${activeTab === 'tasks' ? 'active' : ''}" type="button" data-tab="tasks">📝 Aufgaben (${tasks.filter(t => t.status !== 'erledigt').length})</button>
              <button class="class-tab-btn ${activeTab === 'calendar' ? 'active' : ''}" type="button" data-tab="calendar">📅 Kalender</button>
              <button class="class-tab-btn ${activeTab === 'folders' ? 'active' : ''}" type="button" data-tab="folders">📁 Fächer &amp; Lösungen</button>
              <button class="class-tab-btn ${activeTab === 'members' ? 'active' : ''}" type="button" data-tab="members">👥 Schüler &amp; Rollen (${(cls.members || []).length})</button>
              <button class="class-tab-btn ${activeTab === 'settings' ? 'active' : ''}" type="button" data-tab="settings">⚙️ Einstellungen</button>
            </div>

            <div id="class-tab-content"></div>
          </div>
        `;

        // Back button
        root.querySelector('#back-to-classes-btn').addEventListener('click', () => {
          activeClassId = null;
          C.render();
        });

        // Copy Code button
        root.querySelector('#detail-copy-code-btn').addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(cls.code);
            U.toast('Klassencode kopiert: ' + cls.code);
          } catch (e) {
            U.toast('Code manuell kopieren: ' + cls.code, true);
          }
        });

        // Tab Switchers
        root.querySelectorAll('[data-tab]').forEach(btn => {
          btn.addEventListener('click', () => {
            activeTab = btn.dataset.tab;
            activeFolderId = null;
            C.renderClassDetail(root, classId);
          });
        });

        const tabContainer = root.querySelector('#class-tab-content');

        // Render current active tab content
        switch (activeTab) {
          case 'overview':
            C.renderTabOverview(tabContainer, cls, tasks, folders, isAdmin);
            break;
          case 'tasks':
            C.renderTabTasks(tabContainer, cls, tasks, isAdmin);
            break;
          case 'calendar':
            C.renderTabCalendar(tabContainer, cls, tasks);
            break;
          case 'folders':
            C.renderTabFolders(tabContainer, cls, folders, isAdmin);
            break;
          case 'members':
            C.renderTabMembers(tabContainer, cls, isAdmin);
            break;
          case 'settings':
            C.renderTabSettings(tabContainer, cls, isAdmin);
            break;
        }

      } catch (err) {
        console.error(err);
        root.innerHTML = '<div class="classes-empty"><h3>Fehler beim Laden der Klasse</h3><p>' + E(err.message) + '</p></div>';
      }
    },

    // TAB 1: OVERVIEW
    renderTabOverview(container, cls, tasks, folders, isAdmin) {
      const u = SchoolyAuth.user;
      const openTasks = tasks.filter(t => t.status !== 'erledigt');
      const myAssignedTasks = openTasks.filter(t => 
        !t.assignedStudentIds || t.assignedStudentIds.length === 0 || t.assignedStudentIds.includes(u.uid)
      );
      const members = cls.members || [];
      const adminCount = members.filter(m => m.role === 'admin').length;
      const studentCount = members.length - adminCount;

      container.innerHTML = `
        <div class="stack">
          <div class="grid4">
            <div class="card stat hl">
              <b>${openTasks.length}</b>
              <span class="small mute">Offene Aufgaben</span>
            </div>
            <div class="card stat">
              <b>${myAssignedTasks.length}</b>
              <span class="small mute">Für dich anstehend</span>
            </div>
            <div class="card stat">
              <b>${members.length}</b>
              <span class="small mute">${studentCount} Schüler · ${adminCount} Admins</span>
            </div>
            <div class="card stat">
              <b>${folders.length}</b>
              <span class="small mute">Material-Ordner</span>
            </div>
          </div>

          <div class="grid2">
            <section class="card">
              <div class="sec" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                <h3 style="margin:0;">Nächste Aufgaben</h3>
                <button class="btn sm ghost" type="button" id="goto-tasks-btn">Alle Aufgaben →</button>
              </div>
              ${openTasks.length ? `
                <div class="list" style="display:grid;gap:8px;">
                  ${openTasks.slice(0, 5).map(t => `
                    <div style="display:flex;justify-content:space-between;align-items:center;padding:10px;border:1px solid var(--line);border-radius:8px;">
                      <div>
                        <b>${E(t.title)}</b>
                        <div class="small mute">${E(t.subject)} · Fällig: ${t.dueDate ? E(U.fmt(t.dueDate)) : 'Kein Datum'}</div>
                      </div>
                      <span class="role-badge ${t.priority === 'hoch' ? 'role-admin' : 'role-student'}">${E(t.priority)}</span>
                    </div>
                  `).join('')}
                </div>
              ` : '<p class="mute small">Keine offenen Aufgaben. Alles erledigt!</p>'}
            </section>

            <section class="card">
              <div class="sec" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                <h3 style="margin:0;">Lösungsordner &amp; Fächer</h3>
                <button class="btn sm ghost" type="button" id="goto-folders-btn">Ordner öffnen →</button>
              </div>
              ${folders.length ? `
                <div class="folder-grid" style="grid-template-columns:1fr 1fr;">
                  ${folders.slice(0, 4).map(f => `
                    <div class="folder-item" data-folder-jump="${E(f.id)}">
                      <div class="folder-item-top">
                        <div class="folder-icon">📁</div>
                        <div class="folder-title">${E(f.name)}</div>
                      </div>
                      <div class="folder-item-meta">
                        <span>${E(f.subject || 'Allgemein')}</span>
                        <span>${(f.items || []).length} Dateien</span>
                      </div>
                    </div>
                  `).join('')}
                </div>
              ` : '<p class="mute small">Noch keine Ordner angelegt. Lege Fächer und Lösungsordner im Reiter „Fächer & Lösungen“ an.</p>'}
            </section>
          </div>
        </div>
      `;

      container.querySelector('#goto-tasks-btn').addEventListener('click', () => {
        activeTab = 'tasks';
        C.render();
      });
      container.querySelector('#goto-folders-btn').addEventListener('click', () => {
        activeTab = 'folders';
        C.render();
      });
      container.querySelectorAll('[data-folder-jump]').forEach(el => {
        el.addEventListener('click', () => {
          activeTab = 'folders';
          activeFolderId = el.dataset.folderJump;
          C.render();
        });
      });
    },

    // TAB 2: TASKS
    renderTabTasks(container, cls, tasks, isAdmin) {
      const u = SchoolyAuth.user;
      const subjects = cls.subjects || [];

      container.innerHTML = `
        <div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;flex-wrap:wrap;gap:12px;">
            <div>
              <h3 style="margin:0 0 4px;">Klassenaufgaben</h3>
              <p class="mute small" style="margin:0;">Aufgaben für Schüler mit Fälligkeit, Zuweisungen und Lösungen/Bildern.</p>
            </div>
            <button class="btn" type="button" id="new-class-task-btn">+ Neue Aufgabe erstellen</button>
          </div>

          <div style="display:grid;gap:12px;">
            ${tasks.length ? tasks.map(t => {
              const isDone = t.status === 'erledigt';
              const assignedCount = (t.assignedStudentIds || []).length;
              const hasImages = t.images && t.images.length > 0;
              const canDelete = isAdmin || t.creatorId === u.uid;

              return `
                <div class="card" style="padding:16px;display:flex;flex-direction:column;gap:12px;${isDone ? 'opacity:0.65;' : ''}">
                  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">
                    <div style="display:flex;align-items:flex-start;gap:12px;">
                      <button class="btn sm ${isDone ? 'ghost' : ''}" type="button" data-toggle-task="${E(t.id)}" data-task-status="${E(t.status)}">
                        ${isDone ? '✓ Erledigt' : '◯ Als erledigt markieren'}
                      </button>
                      <div>
                        <h4 style="margin:0 0 4px;font-size:1.05rem;${isDone ? 'text-decoration:line-through;' : ''}">${E(t.title)}</h4>
                        <div class="small mute" style="display:flex;gap:10px;flex-wrap:wrap;">
                          <span>📚 <b>${E(t.subject)}</b></span>
                          <span>📅 Fällig: <b>${t.dueDate ? E(U.fmt(t.dueDate)) : 'Offen'}</b></span>
                          <span>Priorität: <b class="role-badge ${t.priority === 'hoch' ? 'role-admin' : 'role-student'}">${E(t.priority)}</b></span>
                          <span>Erstellt von: ${E(t.creatorName || 'Mitglied')}</span>
                        </div>
                      </div>
                    </div>
                    <div style="display:flex;align-items:center;gap:8px;">
                      ${canDelete ? `<button class="btn sm ghost" type="button" data-del-task="${E(t.id)}" aria-label="Löschen">🗑️</button>` : ''}
                    </div>
                  </div>

                  ${t.description ? `<p style="font-size:0.9rem;line-height:1.6;color:#333;margin:0;">${E(t.description)}</p>` : ''}

                  <!-- Assigned students -->
                  <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                    <span class="small mute">Zugewiesene Schüler:</span>
                    <div class="assignees-pill-list">
                      ${assignedCount === 0 ? `
                        <span class="assignee-chip" style="background:#e0f2fe;color:#0369a1;">👥 Alle Schüler der Klasse</span>
                      ` : (t.assignedStudentNames || []).map(name => `
                        <span class="assignee-chip">👤 ${E(name)}</span>
                      `).join('')}
                    </div>
                  </div>

                  <!-- Images / Solutions -->
                  ${hasImages ? `
                    <div style="border-top:1px solid var(--line);padding-top:10px;margin-top:4px;">
                      <span class="small" style="font-weight:600;display:block;margin-bottom:6px;">📎 Angehängte Lösungen &amp; Bilder (${t.images.length}):</span>
                      <div class="image-thumbnails-wrap">
                        ${t.images.map((img, idx) => `
                          <div class="img-thumb-item" style="cursor:pointer;" data-view-img="${E(img)}" data-img-title="${E(t.title)} Bild ${idx+1}">
                            <img src="${E(img)}" alt="Lösungsbild">
                          </div>
                        `).join('')}
                      </div>
                    </div>
                  ` : ''}
                </div>
              `;
            }).join('') : `
              <div class="classes-empty">
                <h3>Keine Aufgaben vorhanden</h3>
                <p>Erstelle jetzt die erste Aufgabe für deine Schüler.</p>
              </div>
            `}
          </div>
        </div>
      `;

      // New Task Button
      container.querySelector('#new-class-task-btn').addEventListener('click', () => {
        C.openTaskModal(cls);
      });

      // Toggle Task Status
      container.querySelectorAll('[data-toggle-task]').forEach(btn => {
        btn.addEventListener('click', async () => {
          btn.disabled = true;
          try {
            await C.toggleTaskStatus(cls.id, btn.dataset.toggleTask, btn.dataset.taskStatus);
            C.render();
          } catch (e) {
            U.toast(e.message, true);
            btn.disabled = false;
          }
        });
      });

      // Delete Task
      container.querySelectorAll('[data-del-task]').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Möchtest du diese Aufgabe wirklich löschen?')) return;
          try {
            await C.deleteTask(cls.id, btn.dataset.delTask);
            U.toast('Aufgabe gelöscht.');
            C.render();
          } catch (e) {
            U.toast(e.message, true);
          }
        });
      });

      // Lightbox view
      container.querySelectorAll('[data-view-img]').forEach(el => {
        el.addEventListener('click', () => {
          openLightbox(el.dataset.viewImg, el.dataset.imgTitle);
        });
      });
    },

    // Modal to create/edit Task with Student Assignment & Image Upload
    openTaskModal(cls) {
      const members = cls.members || [];
      const subjects = cls.subjects || [];
      const students = members.filter(m => m.role !== 'admin');
      let uploadedImages = [];

      const bodyHtml = `
        <form id="class-task-form" class="stack" style="gap:14px;">
          <div class="fld">
            <label for="task-title">Titel der Aufgabe *</label>
            <input id="task-title" name="title" required maxlength="120" placeholder="z. B. Mathe Arbeitsblatt S. 42">
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div class="fld">
              <label for="task-subject">Fach</label>
              <select id="task-subject" name="subject">
                ${subjects.map(s => `<option value="${E(s)}">${E(s)}</option>`).join('')}
              </select>
            </div>
            <div class="fld">
              <label for="task-due">Fälligkeitsdatum</label>
              <input id="task-due" name="dueDate" type="date">
            </div>
          </div>

          <div class="fld">
            <label for="task-prio">Priorität</label>
            <select id="task-prio" name="priority">
              <option value="normal">Normal</option>
              <option value="hoch">Hoch (Wichtig/Klausur)</option>
              <option value="niedrig">Niedrig</option>
            </select>
          </div>

          <div class="fld">
            <label for="task-desc">Beschreibung &amp; Notizen</label>
            <textarea id="task-desc" name="description" rows="3" placeholder="Hinweise, Buchseiten oder Aufgabenstellungen..."></textarea>
          </div>

          <!-- Multi-Student Assignees -->
          <div class="fld">
            <label>Schüler zuweisen (Mehrfachauswahl möglich)</label>
            <p class="small mute" style="margin-bottom:6px;">Wähle einzelne Schüler aus oder lasse alle unmarkiert für die gesamte Klasse.</p>
            <div class="student-checklist">
              ${members.map(m => `
                <label class="student-check-row">
                  <input type="checkbox" name="assignees" value="${E(m.uid)}" data-name="${E(m.name)}">
                  <span>${E(m.name)} <small class="mute">(${m.role === 'admin' ? 'Admin' : 'Schüler'})</small></span>
                </label>
              `).join('')}
            </div>
          </div>

          <!-- Image Upload / Solutions -->
          <div class="fld">
            <label>Lösungen &amp; Bilder hochladen (Fotos, Arbeitsblätter, Notizen)</label>
            <div class="image-uploader-box" id="task-dropzone">
              <input type="file" id="task-file-input" accept="image/*" multiple style="display:none;">
              <span style="font-size:1.2rem;display:block;margin-bottom:4px;">📷 / 🖼️</span>
              <span style="font-weight:600;color:var(--purple);">Klicke hier zum Hochladen von Lösungsbildern</span>
              <span class="small mute" style="display:block;margin-top:4px;">Unterstützt JPEG, PNG, Fotos vom Handy/Scanner</span>
            </div>
            <div class="image-thumbnails-wrap" id="task-img-preview"></div>
          </div>

          <div class="dlg-f">
            <button class="btn ghost" type="button" data-action="dlg-close">Abbrechen</button>
            <button class="btn" type="submit" id="task-submit-btn">Aufgabe speichern</button>
          </div>
        </form>
      `;

      HM.UI.open('Neue Klassenaufgabe erstellen', bodyHtml);

      const dlg = document.getElementById('dlg');
      const dropzone = dlg.querySelector('#task-dropzone');
      const fileInput = dlg.querySelector('#task-file-input');
      const previewContainer = dlg.querySelector('#task-img-preview');
      const form = dlg.querySelector('#class-task-form');

      dropzone.addEventListener('click', () => fileInput.click());

      fileInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        for (const file of files) {
          try {
            U.toast('Bild wird optimiert …');
            const dataUrl = await compressImage(file, 1200, 0.82);
            uploadedImages.push(dataUrl);
            renderPreviews();
          } catch (err) {
            U.toast('Fehler beim Laden des Bildes: ' + err.message, true);
          }
        }
      });

      function renderPreviews() {
        previewContainer.innerHTML = uploadedImages.map((img, idx) => `
          <div class="img-thumb-item">
            <img src="${E(img)}" alt="Vorschau">
            <button type="button" class="img-thumb-del" data-del-img="${idx}">✕</button>
          </div>
        `).join('');

        previewContainer.querySelectorAll('[data-del-img]').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(btn.dataset.delImg, 10);
            uploadedImages.splice(idx, 1);
            renderPreviews();
          });
        });
      }

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = dlg.querySelector('#task-submit-btn');
        submitBtn.disabled = true;

        const checkedInputs = Array.from(form.querySelectorAll('input[name="assignees"]:checked'));
        const assignedStudentIds = checkedInputs.map(inp => inp.value);
        const assignedStudentNames = checkedInputs.map(inp => inp.dataset.name);

        const taskData = {
          title: form.elements.title.value,
          subject: form.elements.subject.value,
          dueDate: form.elements.dueDate.value,
          priority: form.elements.priority.value,
          description: form.elements.description.value,
          status: 'offen',
          assignedStudentIds,
          assignedStudentNames,
          images: uploadedImages
        };

        try {
          await C.saveTask(cls.id, taskData);
          U.toast('Aufgabe erfolgreich angelegt!');
          HM.UI.close();
          C.render();
        } catch (err) {
          U.toast('Fehler beim Speichern: ' + err.message, true);
          submitBtn.disabled = false;
        }
      });
    },

    // TAB 3: CALENDAR
    renderTabCalendar(container, cls, tasks) {
      const year = currentCalDate.getFullYear();
      const month = currentCalDate.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const monthName = firstDay.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

      // Start day of week (Monday=1, Sunday=0 -> make Monday=0)
      let startDayOfWeek = firstDay.getDay() - 1;
      if (startDayOfWeek === -1) startDayOfWeek = 6;

      const totalDays = lastDay.getDate();
      const daysArray = [];

      for (let i = 0; i < startDayOfWeek; i++) {
        daysArray.push(null);
      }
      for (let d = 1; d <= totalDays; d++) {
        daysArray.push(d);
      }

      container.innerHTML = `
        <div class="card" style="padding:20px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
            <div style="display:flex;align-items:center;gap:10px;">
              <h3 style="margin:0;font-size:1.2rem;">${E(monthName)}</h3>
              <button class="btn ghost sm" type="button" id="cal-today-btn">Heute</button>
            </div>
            <div style="display:flex;gap:6px;">
              <button class="btn ghost sm" type="button" id="cal-prev-btn">◀ Vorheriger</button>
              <button class="btn ghost sm" type="button" id="cal-next-btn">Nächster ▶</button>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;text-align:center;font-weight:700;font-size:0.8rem;color:var(--muted);margin-bottom:8px;">
            <div>Mo</div><div>Di</div><div>Mi</div><div>Do</div><div>Fr</div><div>Sa</div><div>So</div>
          </div>

          <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px;">
            ${daysArray.map(day => {
              if (day === null) {
                return '<div style="background:#f8fafc;min-height:80px;border-radius:6px;"></div>';
              }
              const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const dayTasks = tasks.filter(t => t.dueDate === iso);
              const isToday = U.today() === iso;

              return `
                <div style="border:1px solid ${isToday ? 'var(--purple)' : 'var(--line)'};background:${isToday ? '#fbfaff' : 'white'};min-height:80px;border-radius:6px;padding:6px;display:flex;flex-direction:column;gap:4px;">
                  <span style="font-weight:700;font-size:0.82rem;${isToday ? 'color:var(--purple);' : ''}">${day}</span>
                  <div style="display:flex;flex-direction:column;gap:3px;overflow:hidden;">
                    ${dayTasks.map(t => `
                      <div style="font-size:0.7rem;padding:2px 4px;border-radius:4px;background:#ede9fe;color:#5b21b6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer;" title="${E(t.title)} (${E(t.subject)})">
                        ${E(t.subject)}: ${E(t.title)}
                      </div>
                    `).join('')}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;

      container.querySelector('#cal-prev-btn').addEventListener('click', () => {
        currentCalDate.setMonth(currentCalDate.getMonth() - 1);
        C.renderTabCalendar(container, cls, tasks);
      });
      container.querySelector('#cal-next-btn').addEventListener('click', () => {
        currentCalDate.setMonth(currentCalDate.getMonth() + 1);
        C.renderTabCalendar(container, cls, tasks);
      });
      container.querySelector('#cal-today-btn').addEventListener('click', () => {
        currentCalDate = new Date();
        C.renderTabCalendar(container, cls, tasks);
      });
    },

    // TAB 4: FOLDERS & SOLUTIONS / MATERIALS
    renderTabFolders(container, cls, folders, isAdmin) {
      const u = SchoolyAuth.user;

      // Filter folders based on activeFolderId for hierarchical navigation
      const currentFolder = activeFolderId ? folders.find(f => f.id === activeFolderId) : null;
      const subfolders = folders.filter(f => (currentFolder ? f.parentId === currentFolder.id : !f.parentId));
      const materials = currentFolder ? (currentFolder.items || []) : [];

      container.innerHTML = `
        <div>
          <!-- Breadcrumb navigation -->
          <div class="folder-breadcrumb">
            <a data-open-folder="root">📁 Klassenordner</a>
            ${currentFolder ? `
              <span>▶</span>
              <span style="font-weight:700;color:var(--ink);">${E(currentFolder.name)}</span>
            ` : ''}
          </div>

          <!-- Action bar -->
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;gap:12px;flex-wrap:wrap;">
            <div>
              <h3 style="margin:0;">${currentFolder ? E(currentFolder.name) : 'Alle Fächer &amp; Ordner'}</h3>
              <p class="mute small" style="margin:0;">Lösungen, Skripte und Arbeitsblätter mit Unterkategorien organisieren.</p>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <button class="btn sm" type="button" id="create-folder-btn">+ Neuer ${currentFolder ? 'Unterordner' : 'Ordner'}</button>
              ${currentFolder ? `<button class="btn sm" type="button" id="add-material-btn" style="background:#059669;border-color:#059669;">📎 Lösung / Material hinzufügen</button>` : ''}
              ${currentFolder && (isAdmin || currentFolder.creatorId === u.uid) ? `
                <button class="btn sm ghost" type="button" id="del-folder-btn">🗑️ Ordner löschen</button>
              ` : ''}
            </div>
          </div>

          <!-- Subfolders Grid -->
          ${subfolders.length ? `
            <div style="margin-bottom:24px;">
              <div class="folder-grid">
                ${subfolders.map(f => `
                  <div class="folder-item" data-open-folder="${E(f.id)}">
                    <div class="folder-item-top">
                      <div class="folder-icon">📁</div>
                      <div>
                        <div class="folder-title">${E(f.name)}</div>
                        <div class="small mute">${E(f.subject || 'Allgemein')}</div>
                      </div>
                    </div>
                    <div class="folder-item-meta">
                      <span>${(f.items || []).length} Materialien</span>
                      <span>Öffnen ▶</span>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Materials inside current folder -->
          ${currentFolder ? `
            <div>
              <h4 style="margin:0 0 12px;font-size:1rem;">Materialien &amp; Lösungen in diesem Ordner</h4>
              ${materials.length ? `
                <div class="material-grid">
                  ${materials.map(it => {
                    const hasImgs = it.images && it.images.length > 0;
                    const canDelete = isAdmin || it.creatorId === u.uid;
                    return `
                      <article class="material-card">
                        ${hasImgs ? `
                          <div class="material-thumb" data-view-img="${E(it.images[0])}" data-img-title="${E(it.title)}">
                            <img src="${E(it.images[0])}" alt="Lösungsbild">
                          </div>
                        ` : `
                          <div class="material-thumb" style="background:#f1f5f9;color:#64748b;font-size:2rem;">
                            📄
                          </div>
                        `}
                        <div class="material-body">
                          <h5 class="material-title">${E(it.title)}</h5>
                          ${it.description ? `<p class="material-desc">${E(it.description)}</p>` : ''}
                          <div class="material-footer">
                            <span>Von ${E(it.creatorName || 'Mitglied')}</span>
                            ${canDelete ? `<button class="btn ghost sm" type="button" data-del-mat="${E(it.id)}" style="padding:2px 6px;color:#dc2626;">Löschen</button>` : ''}
                          </div>
                        </div>
                      </article>
                    `;
                  }).join('')}
                </div>
              ` : `
                <div class="classes-empty" style="padding:25px;">
                  <p>In diesem Ordner sind noch keine Lösungen oder Materialien hinterlegt.</p>
                  <button class="btn sm" type="button" id="add-material-btn-empty" style="margin-top:8px;">Jetzt Lösung / Bild hinzufügen</button>
                </div>
              `}
            </div>
          ` : (!subfolders.length ? `
            <div class="classes-empty">
              <h3>Noch keine Ordner erstellt</h3>
              <p>Erstelle z. B. Ordner für „Mathematik Lösungen“, „Englisch Vokabeln“ oder „Klausuren“.</p>
            </div>
          ` : '')}
        </div>
      `;

      // Open folder
      container.querySelectorAll('[data-open-folder]').forEach(el => {
        el.addEventListener('click', () => {
          activeFolderId = el.dataset.openFolder === 'root' ? null : el.dataset.openFolder;
          C.renderTabFolders(container, cls, folders, isAdmin);
        });
      });

      // Create folder modal
      container.querySelector('#create-folder-btn').addEventListener('click', () => {
        C.openCreateFolderModal(cls, currentFolder ? currentFolder.id : null);
      });

      // Add material modal
      const addMatBtn = container.querySelector('#add-material-btn') || container.querySelector('#add-material-btn-empty');
      if (addMatBtn) {
        addMatBtn.addEventListener('click', () => {
          C.openAddMaterialModal(cls, currentFolder.id);
        });
      }

      // Delete material
      container.querySelectorAll('[data-del-mat]').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Material wirklich löschen?')) return;
          try {
            await C.deleteMaterialItem(cls.id, currentFolder.id, btn.dataset.delMat);
            U.toast('Material gelöscht.');
            C.render();
          } catch (e) {
            U.toast(e.message, true);
          }
        });
      });

      // Delete folder
      const delFolderBtn = container.querySelector('#del-folder-btn');
      if (delFolderBtn) {
        delFolderBtn.addEventListener('click', async () => {
          if (!confirm(`Ordner „${currentFolder.name}“ wirklich löschen?`)) return;
          try {
            await C.deleteFolder(cls.id, currentFolder.id);
            U.toast('Ordner gelöscht.');
            activeFolderId = null;
            C.render();
          } catch (e) {
            U.toast(e.message, true);
          }
        });
      }

      // Lightbox view
      container.querySelectorAll('[data-view-img]').forEach(el => {
        el.addEventListener('click', () => {
          openLightbox(el.dataset.viewImg, el.dataset.imgTitle);
        });
      });
    },

    openCreateFolderModal(cls, parentId = null) {
      const subjects = cls.subjects || [];
      const bodyHtml = `
        <form id="create-folder-form" class="stack" style="gap:12px;">
          <div class="fld">
            <label for="folder-name">Name des Ordners *</label>
            <input id="folder-name" name="name" required maxlength="70" placeholder="z. B. Mathematik Lösungen">
          </div>
          <div class="fld">
            <label for="folder-sub">Zugeordnetes Fach</label>
            <select id="folder-sub" name="subject">
              <option value="">Allgemein</option>
              ${subjects.map(s => `<option value="${E(s)}">${E(s)}</option>`).join('')}
            </select>
          </div>
          <div class="dlg-f">
            <button class="btn ghost" type="button" data-action="dlg-close">Abbrechen</button>
            <button class="btn" type="submit">Ordner erstellen</button>
          </div>
        </form>
      `;
      HM.UI.open(parentId ? 'Unterordner erstellen' : 'Neuen Ordner erstellen', bodyHtml);

      const dlg = document.getElementById('dlg');
      dlg.querySelector('#create-folder-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = e.currentTarget.elements.name.value;
        const subject = e.currentTarget.elements.subject.value;
        try {
          await C.createFolder(cls.id, name, subject, parentId);
          U.toast(`Ordner „${name}“ erstellt.`);
          HM.UI.close();
          C.render();
        } catch (err) {
          U.toast(err.message, true);
        }
      });
    },

    openAddMaterialModal(cls, folderId) {
      let uploadedImages = [];
      const bodyHtml = `
        <form id="add-material-form" class="stack" style="gap:12px;">
          <div class="fld">
            <label for="mat-title">Titel / Thema *</label>
            <input id="mat-title" name="title" required maxlength="100" placeholder="z. B. Lösung Klausur Nr. 1 Aufgabe 4">
          </div>
          <div class="fld">
            <label for="mat-desc">Beschreibung / Notizen</label>
            <textarea id="mat-desc" name="description" rows="2" placeholder="Erklärung zum Lösungsweg oder Notizen..."></textarea>
          </div>

          <div class="fld">
            <label>Lösungsbild / Foto hochladen</label>
            <div class="image-uploader-box" id="mat-dropzone">
              <input type="file" id="mat-file-input" accept="image/*" multiple style="display:none;">
              <span style="font-size:1.2rem;display:block;">📸</span>
              <span style="font-weight:600;color:var(--purple);">Klicke hier, um ein Lösungsfoto auszuwählen</span>
            </div>
            <div class="image-thumbnails-wrap" id="mat-img-preview"></div>
          </div>

          <div class="dlg-f">
            <button class="btn ghost" type="button" data-action="dlg-close">Abbrechen</button>
            <button class="btn" type="submit" id="mat-save-btn">Material speichern</button>
          </div>
        </form>
      `;

      HM.UI.open('Lösung oder Material hinzufügen', bodyHtml);

      const dlg = document.getElementById('dlg');
      const dropzone = dlg.querySelector('#mat-dropzone');
      const fileInput = dlg.querySelector('#mat-file-input');
      const previewWrap = dlg.querySelector('#mat-img-preview');
      const form = dlg.querySelector('#add-material-form');

      dropzone.addEventListener('click', () => fileInput.click());

      fileInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        for (const f of files) {
          try {
            U.toast('Bild wird komprimiert …');
            const dataUrl = await compressImage(f, 1200, 0.82);
            uploadedImages.push(dataUrl);
            renderPreviews();
          } catch (err) {
            U.toast('Bildfehler: ' + err.message, true);
          }
        }
      });

      function renderPreviews() {
        previewWrap.innerHTML = uploadedImages.map((img, idx) => `
          <div class="img-thumb-item">
            <img src="${E(img)}" alt="Vorschau">
            <button type="button" class="img-thumb-del" data-del-img="${idx}">✕</button>
          </div>
        `).join('');

        previewWrap.querySelectorAll('[data-del-img]').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(btn.dataset.delImg, 10);
            uploadedImages.splice(idx, 1);
            renderPreviews();
          });
        });
      }

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const saveBtn = dlg.querySelector('#mat-save-btn');
        saveBtn.disabled = true;
        try {
          await C.addMaterialItem(cls.id, folderId, {
            title: form.elements.title.value,
            description: form.elements.description.value,
            images: uploadedImages
          });
          U.toast('Lösung/Material hinzugefügt!');
          HM.UI.close();
          C.render();
        } catch (err) {
          U.toast(err.message, true);
          saveBtn.disabled = false;
        }
      });
    },

    // TAB 5: MEMBERS & ROLES
    renderTabMembers(container, cls, isAdmin) {
      const u = SchoolyAuth.user;
      const members = cls.members || [];

      container.innerHTML = `
        <div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;gap:12px;flex-wrap:wrap;">
            <div>
              <h3 style="margin:0;">Mitglieder &amp; Rollenverwaltung</h3>
              <p class="mute small" style="margin:0;">Verwalte Schüler und ernenne weitere Klassen-Administratoren.</p>
            </div>
            <div class="class-code-row" style="margin-top:0;">
              <span>Klassencode für neue Schüler:</span>
              <code>${E(cls.code)}</code>
            </div>
          </div>

          <div class="member-list-grid">
            ${members.map(m => {
              const memberIsAdmin = m.role === 'admin';
              const isOwner = m.uid === cls.ownerId;
              const isMe = m.uid === u.uid;

              return `
                <div class="member-card">
                  <div class="member-info">
                    <div class="member-avatar">${E((m.name || 'M')[0].toUpperCase())}</div>
                    <div class="member-meta">
                      <div class="member-name">${E(m.name)} ${isMe ? '<small class="mute">(Du)</small>' : ''}</div>
                      <div class="member-sub">${E(m.email || '')}</div>
                    </div>
                  </div>
                  <div style="display:flex;align-items:center;gap:8px;">
                    <span class="role-badge ${memberIsAdmin ? 'role-admin' : 'role-student'}">
                      ${isOwner ? '👑 Besitzer' : (memberIsAdmin ? 'Admin' : 'Schüler')}
                    </span>
                    ${isAdmin && !isOwner && !isMe ? `
                      <button class="btn ghost sm" type="button" data-toggle-role="${E(m.uid)}" data-current-role="${E(m.role)}" style="font-size:0.75rem;">
                        ${memberIsAdmin ? 'Als Schüler' : 'Zum Admin'}
                      </button>
                    ` : ''}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;

      // Role toggle buttons
      container.querySelectorAll('[data-toggle-role]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const targetUid = btn.dataset.toggleRole;
          const currentRole = btn.dataset.currentRole;
          const newRole = currentRole === 'admin' ? 'student' : 'admin';
          btn.disabled = true;
          try {
            await C.updateRole(cls.id, targetUid, newRole);
            U.toast(`Rolle erfolgreich auf „${newRole === 'admin' ? 'Admin' : 'Schüler'}“ geändert.`);
            C.render();
          } catch (err) {
            U.toast(err.message, true);
            btn.disabled = false;
          }
        });
      });
    },

    // TAB 6: SETTINGS
    renderTabSettings(container, cls, isAdmin) {
      const u = SchoolyAuth.user;
      const isOwner = cls.ownerId === u.uid;
      const subjects = cls.subjects || [];

      container.innerHTML = `
        <div class="stack" style="max-width:650px;">
          <div class="card" style="padding:22px;">
            <h3 style="margin:0 0 12px;">Klasseninformationen</h3>
            ${isAdmin ? `
              <form id="edit-class-info-form" class="stack" style="gap:12px;">
                <div class="fld">
                  <label for="edit-cls-name">Klassenname</label>
                  <input id="edit-cls-name" name="name" value="${E(cls.name)}" required maxlength="70">
                </div>
                <div class="fld">
                  <label for="edit-cls-desc">Beschreibung</label>
                  <input id="edit-cls-desc" name="description" value="${E(cls.description || '')}" maxlength="140">
                </div>
                <button class="btn sm" type="submit" style="align-self:flex-start;">Änderungen speichern</button>
              </form>
            ` : `
              <p><b>Name:</b> ${E(cls.name)}</p>
              <p class="mute">${E(cls.description || 'Keine Beschreibung vorhanden.')}</p>
              <p class="small mute">Nur Administratoren können Klassendetails bearbeiten.</p>
            `}
          </div>

          <!-- Subject Management -->
          <div class="card" style="padding:22px;">
            <h3 style="margin:0 0 12px;">Fächer dieser Klasse</h3>
            <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;">
              ${subjects.map((s, idx) => `
                <span class="assignee-chip" style="font-size:0.85rem;">
                  ${E(s)}
                  ${isAdmin ? `<button type="button" class="img-thumb-del" data-del-sub="${idx}" style="position:static;width:16px;height:16px;font-size:9px;">✕</button>` : ''}
                </span>
              `).join('')}
            </div>
            ${isAdmin ? `
              <form id="add-subject-form" style="display:flex;gap:8px;">
                <input id="new-sub-input" placeholder="Neues Fach hinzufügen (z. B. Kunst)" required maxlength="40" style="flex:1;padding:8px 10px;border:1px solid var(--line);border-radius:6px;">
                <button class="btn sm" type="submit">+ Hinzufügen</button>
              </form>
            ` : ''}
          </div>

          <!-- Danger Zone -->
          <div class="card" style="padding:22px;border-color:#fca5a5;background:#fff5f5;">
            <h3 style="margin:0 0 8px;color:#b91c1c;">Gefahrenzone</h3>
            ${!isOwner ? `
              <p class="small mute" style="margin-bottom:12px;">Möchtest du diese Klasse verlassen? Du kannst ihr später mit dem Klassencode wieder beitreten.</p>
              <button class="btn sm" type="button" id="leave-class-btn" style="background:#dc2626;border-color:#dc2626;">Klasse verlassen</button>
            ` : `
              <p class="small mute" style="margin-bottom:12px;">Als Besitzer kannst du die Klasse endgültig auflösen. Alle Aufgaben, Ordner und der Klassencode werden gelöscht.</p>
              <button class="btn sm" type="button" id="delete-class-btn" style="background:#dc2626;border-color:#dc2626;">Klasse endgültig löschen</button>
            `}
          </div>
        </div>
      `;

      // Edit info
      const infoForm = container.querySelector('#edit-class-info-form');
      if (infoForm) {
        infoForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const name = infoForm.elements.name.value;
          const desc = infoForm.elements.description.value;
          try {
            await SchoolyAuth.db.collection('classes').doc(cls.id).update({
              name,
              description: desc,
              updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            U.toast('Klassenangaben aktualisiert.');
            C.render();
          } catch (err) {
            U.toast(err.message, true);
          }
        });
      }

      // Add subject
      const subForm = container.querySelector('#add-subject-form');
      if (subForm) {
        subForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const newSub = subForm.querySelector('#new-sub-input').value.trim();
          if (!newSub) return;
          try {
            const updated = (cls.subjects || []).slice();
            if (!updated.includes(newSub)) {
              updated.push(newSub);
              await SchoolyAuth.db.collection('classes').doc(cls.id).update({
                subjects: updated,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
              });
              U.toast(`Fach „${newSub}“ hinzugefügt.`);
              C.render();
            }
          } catch (err) {
            U.toast(err.message, true);
          }
        });
      }

      // Delete subject
      container.querySelectorAll('[data-del-sub]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const idx = parseInt(btn.dataset.delSub, 10);
          const updated = (cls.subjects || []).slice();
          updated.splice(idx, 1);
          try {
            await SchoolyAuth.db.collection('classes').doc(cls.id).update({
              subjects: updated,
              updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            C.render();
          } catch (err) {
            U.toast(err.message, true);
          }
        });
      });

      // Leave class
      const leaveBtn = container.querySelector('#leave-class-btn');
      if (leaveBtn) {
        leaveBtn.addEventListener('click', async () => {
          if (!confirm('Möchtest du diese Klasse wirklich verlassen?')) return;
          try {
            await C.leaveClass(cls.id);
            U.toast('Du hast die Klasse verlassen.');
            activeClassId = null;
            C.render();
          } catch (err) {
            U.toast(err.message, true);
          }
        });
      }

      // Delete class
      const deleteBtn = container.querySelector('#delete-class-btn');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
          if (!confirm(`Möchtest du die Klasse „${cls.name}“ wirklich unwiderruflich löschen?`)) return;
          try {
            await C.deleteClass(cls.id, cls.code);
            U.toast('Klasse erfolgreich gelöscht.');
            activeClassId = null;
            C.render();
          } catch (err) {
            U.toast(err.message, true);
          }
        });
      }
    }
  };
})();
