# Schooly

Schooly ist eine Web-App, die Hausaufgaben, Prüfungen, Termine und gemeinsame Klassen organisiert. Die Haupt-App verwendet Firebase Authentication für Konten und Firestore für private Daten und Klassenzugänge.

## Firebase einrichten
Folge **[FIREBASE_SETUP.md](FIREBASE_SETUP.md)**. Ohne deine Firebase-Web-App-Konfiguration in `js/firebase-config.js` bleiben Anmeldung und Cloud-Funktionen deaktiviert. Die öffentliche Startseite funktioniert auch ohne Firebase-Konfiguration.

## Starten
Schooly auf einem HTTPS-fähigen statischen Host bereitstellen. `index.html` ist die öffentliche Startseite, `login.html` enthält Login/Registrierung, und `app.html` ist die geschützte App. Firebase autorisierte Domains müssen passend konfiguriert sein.

## Tests
`npm test` führt Smoke-Tests für die Startseite, die App-Grundstruktur und die Anmeldung mit jsdom aus. GitHub Actions prüft diese Tests sowie die Syntax aller versionierten JavaScript-Dateien bei jedem Push und Pull Request.

## Funktionen
- Dashboard mit Statistiken, „Als Nächstes fällig“ und „Zuletzt hinzugefügt“
- Hausaufgaben: erstellen, bearbeiten, löschen, erledigen, suchen, filtern, sortieren, Listen- und Kartenansicht
- Fächer und Lehrer verwalten. Beim Löschen bleiben die Namen in bestehenden Aufgaben erhalten
- Kalender mit Monatsansicht und „Nächste 7 Tage“
- Einstellungen: Wochenbeginn, Standardansicht, Standardfächer, JSON-Sicherung (Export/Import), CSV-Export, Demo-Modus, Zurücksetzen
- Klassenverwaltung mit Rollen, Einladungen, Aufgaben und Verwaltung der Mitgliedschaft
- Stundenplan: eigener Tab mit persönlichem und Klassen-Stundenplan. Persönliche Stunden können unabhängig vom Klassenplan geändert und entfernt werden
- Aufgaben: getrennte Bereiche für persönliche und Klassenaufgaben im lokalen Prototyp

## Speicherung
Die Haupt-App speichert Aufgaben und Einstellungen lokal unter `hm.v1` zwischen und synchronisiert sie nach erfolgreicher Firebase-Anmeldung in den privaten Firestore-Bereich des Kontos. Beim ersten Login wird der vorhandene lokale Bestand übernommen, falls es noch keine Cloud-Sicherung gibt. Exportiere trotzdem regelmäßig eine JSON-Sicherung. Ungültige Daten werden unter `hm.v1.corrupt` gesichert und die App startet neu.

## Lokaler Klassen-Prototyp
`prototype.html` öffnet den lokalen Debug-Prototyp unabhängig von Firebase. Konten, Klassen, Rollen, Stundenpläne und Einladungscodes werden nur in diesem Browser gespeichert; Einladungscodes funktionieren nicht geräteübergreifend. Verwende dort keine echten Passwörter. Für echte Konten und geräteübergreifende Zusammenarbeit sind die Firebase-Anmeldung und Klassenfunktionen in `app.html` vorgesehen.

## Struktur
| Datei | Aufgabe |
|---|---|
| `js/storage.js` | Datenmodell, Validierung, Speichern/Laden, Export, Datums- und Icon-Helfer |
| `js/subjects.js`, `js/teachers.js` | Verwaltung von Fächern und Lehrern |
| `js/homework.js` | Aufgaben, Filter, Formular, Detailansicht |
| `js/calendar.js` | Monats- und 7-Tage-Ansicht |
| `js/settings.js` | Einstellungen, Import/Export, Demo, Reset |
| `js/schedule.js` | Persönlicher Stundenplan und Ansicht der Prototyp-Klassenpläne |
| `js/classsystem.js` | Lokale Debug-Anmeldung, Klassen, Rollen, Einladungen und Prototyp-Synchronisierung |
| `js/classes.js` | Firebase-Klassenverwaltung |
| `js/app.js` | Router, Dashboard, Dialoge, zentrale Event-Delegation |

Datumswerte sind lokale `YYYY-MM-DD`-Strings, daher gibt es keine Zeitzonenfehler. Alle Benutzereingaben werden vor dem Einfügen escaped. Events werden einmalig am `document` registriert, es entstehen keine doppelten Listener.
