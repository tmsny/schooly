# Schooly Firebase Setup

1. Erstelle ein Projekt unter https://console.firebase.google.com/ und füge eine Web-App hinzu.
2. Kopiere die Web-Konfiguration nach `js/firebase-config.js` und ersetze alle `DEINE_...`-Platzhalter. Keine Service-Account-/Admin-Schlüssel in den Browsercode legen.
3. Authentication → Sign-in method: E-Mail/Passwort und Google aktivieren.
4. Authentication → Settings → Authorized domains: deine Hosting-Domain hinzufügen.
5. Firestore Database erstellen und die Regeln aus `firestore.rules` veröffentlichen.
6. Lade die Dateien auf einen HTTPS-fähigen statischen Host. `index.html` ist die Startseite, `login.html` der Login, `app.html` die App.

Enthalten: Google-Popup-Login, E-Mail-Registrierung/Login, Passwort-zurücksetzen, persönliche Daten in Firestore sowie Klassen mit 8-stelligem Code. Beim ersten Login werden lokale Daten nur dann in die Cloud übernommen, wenn für dieses Konto noch keine Cloud-Daten existieren. Firebase-Platzhalter müssen ersetzt sein, sonst funktionieren Auth und Synchronisierung nicht. Prüfe Datenschutz/Nutzungsbedingungen und erwäge Firebase App Check vor öffentlichem Start.