# Schooly

Schooly ist eine Web-App, die Hausaufgaben, Prüfungen, Termine und gemeinsame Klassen organisiert. Die App verwendet Firebase Authentication für Konten und Firestore für private Daten und Klassenzugänge.

## Firebase einrichten
Folge **[FIREBASE_SETUP.md](FIREBASE_SETUP.md)**. Ohne deine Firebase-Web-App-Konfiguration in `js/firebase-config.js` bleiben Anmeldung und Cloud-Funktionen deaktiviert. Die öffentliche Startseite funktioniert auch ohne Firebase-Konfiguration.

## Starten
Schooly auf einem HTTPS-fähigen statischen Host bereitstellen. `index.html` ist die öffentliche Startseite, `login.html` enthält Login/Registrierung, und `app.html` ist die geschützte App. Firebase autorisierte Domains müssen passend konfiguriert sein.

## Funktionen
- Dashboard mit Statistiken, „Als Nächstes fällig“ und „Zuletzt hinzugefügt“
- Hausaufgaben: erstellen, bearbeiten, löschen, erledigen, suchen, filtern, sortieren, Listen- und Kartenansicht
- Fächer und Lehrer verwalten. Beim Löschen bleiben die Namen in bestehenden Aufgaben erhalten
- Kalender mit Monatsansicht und „Nächste 7 Tage“
- Einstellungen: Wochenbeginn, Standardansicht, Standardfächer, JSON-Sicherung (Export/Import), CSV-Export, Demo-Modus, Zurücksetzen

## Speicherung
Aufgaben und Einstellungen werden weiterhin lokal unter `hm.v1` zwischengespeichert und nach erfolgreicher Firebase-Anmeldung in den privaten Firestore-Bereich des Kontos synchronisiert. Beim ersten Login wird der vorhandene lokale Bestand übernommen, falls es noch keine Cloud-Sicherung gibt. Exportiere trotzdem regelmäßig eine JSON-Sicherung. Ungültige Daten werden unter `hm.v1.corrupt` gesichert und die App startet neu.

## Struktur
| Datei | Aufgabe |
|---|---|
| `js/storage.js` | Datenmodell, Validierung, Speichern/Laden, Export, Datums- und Icon-Helfer |
| `js/subjects.js`, `js/teachers.js` | Verwaltung von Fächern und Lehrern |
| `js/homework.js` | Aufgaben, Filter, Formular, Detailansicht |
| `js/calendar.js` | Monats- und 7-Tage-Ansicht |
| `js/settings.js` | Einstellungen, Import/Export, Demo, Reset |
| `js/app.js` | Router, Dashboard, Dialoge, zentrale Event-Delegation |

Datumswerte sind lokale `YYYY-MM-DD`-Strings, daher gibt es keine Zeitzonenfehler. Alle Benutzereingaben werden vor dem Einfügen escaped. Events werden einmalig am `document` registriert, es entstehen keine doppelten Listener.
