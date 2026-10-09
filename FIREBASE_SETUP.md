# Schooly Firebase Setup

## Aktueller Status
Das Firebase-Projekt wurde über AI Studio bereitgestellt:
- **Projekt-ID**: `agile-curve-0t8c4`
- **Firestore-Datenbank**: Bereitgestellt und mit Sicherheitsregeln (`firestore.rules`) synchronisiert
- **Web-Konfiguration**: Automatisch in `js/firebase-config.js` und `firebase-applet-config.json` hinterlegt

## Was in der Firebase Console aktiviert werden muss (einmalig):
Öffne [https://console.firebase.google.com/project/agile-curve-0t8c4/authentication](https://console.firebase.google.com/project/agile-curve-0t8c4/authentication):

1. **Anmeldemethoden aktivieren (Sign-in method)**:
   - **E-Mail/Passwort**: Auf *Aktivieren* stellen und speichern.
   - **Google**: Auf *Aktivieren* stellen, Support-E-Mail wählen und speichern.
2. **Autorisierte Domains (Settings → Authorized domains)**:
   - Füge die AI Studio App-Domains hinzu (z. B. `europe-west2.run.app` bzw. die vollständige Host-Domain der App), falls noch nicht gelistet.

## Collaborator / Teammitglieder einladen
Um weitere Personen zum Firebase-Projekt einzuladen:
1. Öffne die [Firebase Console Projekteinstellungen](https://console.firebase.google.com/project/agile-curve-0t8c4/settings/iam).
2. Gehe auf den Reiter **Nutzer und Berechtigungen** (Users and permissions).
3. Klicke auf **Mitglied hinzufügen** (Add member) und gib die E-Mail-Adresse sowie die Rolle (z. B. Editor / Bearbeiter) ein.
