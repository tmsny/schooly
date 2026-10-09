(function () {
  let auth = null,
    db = null,
    currentUser = null,
    resolveReady;
  const ready = new Promise((r) => (resolveReady = r)),
    configured = !!window.SCHOOLY_FIREBASE_READY && !!window.firebase;

  const api = (window.SchoolyAuth = {
    get user() {
      return currentUser;
    },
    get db() {
      return db;
    },
    get ready() {
      return ready;
    },
    get configured() {
      return configured;
    },
    message(t, type) {
      const e = document.getElementById('auth-message');
      if (e) {
        e.textContent = t;
        e.className = 'auth-message show ' + (type || 'error');
      }
    },
    clearMessage() {
      const e = document.getElementById('auth-message');
      if (e) {
        e.textContent = '';
        e.className = 'auth-message';
      }
    },
    friendlyError(e) {
      const code = e && e.code;
      const m = {
        'auth/invalid-email': 'Bitte gib eine gültige E-Mail-Adresse ein.',
        'auth/user-not-found': 'Für diese E-Mail wurde kein Konto gefunden.',
        'auth/wrong-password': 'E-Mail-Adresse oder Passwort ist nicht korrekt.',
        'auth/invalid-credential': 'E-Mail-Adresse oder Passwort ist nicht korrekt.',
        'auth/email-already-in-use': 'Für diese E-Mail gibt es bereits ein Konto. Melde dich stattdessen an.',
        'auth/weak-password': 'Das Passwort muss mindestens 6 Zeichen haben.',
        'auth/too-many-requests': 'Zu viele Versuche. Bitte warte kurz.',
        'auth/popup-closed-by-user': 'Das Google-Anmeldefenster wurde geschlossen.',
        'auth/popup-blocked': 'Dein Browser hat das Google-Fenster blockiert. Bitte Popups erlauben oder mit E-Mail anmelden.',
        'auth/operation-not-allowed': 'Diese Anmeldemethode (E-Mail/Passwort oder Google) ist in der Firebase Console unter Authentication → Sign-in method noch nicht aktiviert.',
        'auth/unauthorized-domain': 'Diese Web-Domain ist in der Firebase Console unter Authentication → Settings → Authorized domains noch nicht freigegeben.',
        'auth/network-request-failed': 'Verbindung fehlgeschlagen. Bitte prüfe deine Internetverbindung.'
      };
      return m[code] || (e && e.message) || 'Das hat leider nicht geklappt. Bitte versuche es erneut.';
    },
    async google() {
      if (!configured) {
        return api.message('Firebase ist noch nicht eingerichtet.');
      }
      api.clearMessage();
      try {
        const p = new firebase.auth.GoogleAuthProvider();
        p.setCustomParameters({ prompt: 'select_account' });
        await auth.signInWithPopup(p);
      } catch (e) {
        api.message(api.friendlyError(e));
      }
    },
    async email(email, password, name, mode) {
      if (!configured) {
        throw Error('Firebase ist noch nicht eingerichtet.');
      }
      const c =
        mode === 'signup'
          ? await auth.createUserWithEmailAndPassword(email, password)
          : await auth.signInWithEmailAndPassword(email, password);
      if (mode === 'signup' && name && name.trim()) {
        await c.user.updateProfile({ displayName: name.trim() });
      }
      return c;
    },
    async resetPassword(email) {
      if (!configured) {
        throw Error('Firebase ist noch nicht eingerichtet.');
      }
      await auth.sendPasswordResetEmail(email);
    },
    async logout() {
      if (auth) await auth.signOut();
    },
    async loadCloudData() {
      if (!currentUser || !db || !window.HM) return;
      try {
        const ref = db
          .collection('users')
          .doc(currentUser.uid)
          .collection('private')
          .doc('main');
        const snap = await ref.get();
        if (snap.exists) {
          const cloud = window.HM.sanitize(snap.data().state);
          if (cloud) {
            window.HM.state = cloud;
            window.HM.saveLocalOnly();
          }
        } else {
          await ref.set({
            state: window.HM.state,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            schemaVersion: 1
          });
        }
        window.HM.cloudLoaded = true;
        if (window.HM.render) window.HM.render();
      } catch (e) {
        console.error('Cloud load error:', e);
        if (window.HM && window.HM.U) {
          window.HM.U.toast('Cloud-Synchronisierung fehlgeschlagen. Daten werden lokal gesichert.', true);
        }
      }
    }
  });

  if (configured) {
    try {
      if (!firebase.apps.length) {
        firebase.initializeApp(window.SCHOOLY_FIREBASE_CONFIG);
      }
      auth = firebase.auth();
      const dbId = window.SCHOOLY_FIREBASE_CONFIG && window.SCHOOLY_FIREBASE_CONFIG.firestoreDatabaseId;
      try {
        db = (dbId && dbId !== '(default)' && typeof firebase.app().firestore === 'function')
          ? firebase.app().firestore(dbId)
          : firebase.firestore();
      } catch (err) {
        console.warn('Named firestore fallback to default', err);
        db = firebase.firestore();
      }

      auth.onAuthStateChanged(async (user) => {
        currentUser = user || null;
        if (user) {
          if (location.pathname.endsWith('login.html')) {
            location.replace('app.html');
          } else if (window.HM && window.HM.load) {
            await api.loadCloudData();
          }
        } else if (location.pathname.endsWith('app.html')) {
          location.replace('login.html');
        }
        resolveReady(user || null);
      });
    } catch (e) {
      console.error('Firebase init error:', e);
      resolveReady(null);
    }
  } else {
    resolveReady(null);
    window.addEventListener('DOMContentLoaded', () => {
      const e = document.getElementById('auth-message');
      if (e) {
        e.textContent = 'Firebase ist noch nicht eingerichtet.';
        e.className = 'auth-message show error';
      }
    });
  }

  function init() {
    const form = document.getElementById('email-form');
    if (!form) return;
    let mode = new URLSearchParams(location.search).get('mode') === 'signup' ? 'signup' : 'login';
    const title = document.getElementById('auth-title');
    const sub = document.getElementById('auth-subtitle');
    const submit = document.getElementById('email-submit');
    const name = document.getElementById('name-field');
    const pass = document.getElementById('password');
    const copy = document.getElementById('switch-copy');
    const link = document.getElementById('mode-switch');

    function render() {
      const signup = mode === 'signup';
      if (title) title.textContent = signup ? 'Erstelle dein Konto' : 'Willkommen bei Schooly';
      if (sub) sub.textContent = signup ? 'Erstelle dein Konto und starte mit Schooly.' : 'Melde dich an, um weiterzumachen.';
      if (submit) submit.textContent = signup ? 'Konto erstellen' : 'Einloggen';
      if (name) name.hidden = !signup;
      if (pass) pass.autocomplete = signup ? 'new-password' : 'current-password';
      if (copy) copy.textContent = signup ? 'Du hast schon ein Konto?' : 'Noch kein Konto?';
      if (link) link.textContent = signup ? 'Jetzt einloggen' : 'Jetzt registrieren';
      const forgot = document.getElementById('forgot-password');
      if (forgot) forgot.hidden = signup;
    }

    if (link) {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        mode = mode === 'signup' ? 'login' : 'signup';
        api.clearMessage();
        render();
      });
    }

    const googleBtn = document.getElementById('google-signin');
    if (googleBtn) {
      googleBtn.addEventListener('click', () => api.google());
    }

    const forgotBtn = document.getElementById('forgot-password');
    if (forgotBtn) {
      forgotBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        const email = form.elements.email ? form.elements.email.value.trim() : '';
        if (!email) return api.message('Gib zuerst deine E-Mail-Adresse ein.');
        try {
          await api.resetPassword(email);
          api.message('Wenn ein Konto mit dieser Adresse existiert, erhältst du eine E-Mail zum Zurücksetzen.', 'success');
        } catch (err) {
          api.message(api.friendlyError(err));
        }
      });
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      api.clearMessage();
      const email = form.elements.email ? form.elements.email.value.trim() : '';
      const password = form.elements.password ? form.elements.password.value : '';
      const displayName = (form.elements.displayName && form.elements.displayName.value) || '';

      if (!email || !form.elements.email.validity.valid) {
        return api.message('Bitte gib eine gültige E-Mail-Adresse ein.');
      }
      if (password.length < 6) {
        return api.message('Das Passwort muss mindestens 6 Zeichen haben.');
      }
      if (mode === 'signup' && !displayName.trim()) {
        return api.message('Bitte gib deinen Namen ein.');
      }

      submit.disabled = true;
      form.classList.add('auth-loading');
      try {
        await api.email(email, password, displayName, mode);
        location.assign('app.html');
      } catch (err) {
        api.message(api.friendlyError(err));
      } finally {
        submit.disabled = false;
        render();
        form.classList.remove('auth-loading');
      }
    });

    render();
    if (configured) {
      api.ready.then((u) => {
        if (u) location.replace('app.html');
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
