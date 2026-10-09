# Hausaufgaben-Manager

Minimalistische Schwarz-Weiß-Web-App für Hausaufgaben, Prüfungen und Referate. Kein Backend, kein Login, keine Abhängigkeiten.

## Starten
`index.html` im Browser öffnen. Ein Server ist nicht nötig. Für Hosting reicht jeder statische Webspace.

## Funktionen
- Dashboard mit Statistiken, „Als Nächstes fällig“ und „Zuletzt hinzugefügt“
- Hausaufgaben: erstellen, bearbeiten, löschen, erledigen, suchen, filtern, sortieren, Listen- und Kartenansicht
- Fächer und Lehrer verwalten. Beim Löschen bleiben die Namen in bestehenden Aufgaben erhalten
- Kalender mit Monatsansicht und „Nächste 7 Tage“
- Einstellungen: Wochenbeginn, Standardansicht, Standardfächer, JSON-Sicherung (Export/Import), CSV-Export, Demo-Modus, Zurücksetzen

## Speicherung
Alles liegt im LocalStorage (Schlüssel `hm.v1`), nur in diesem Browser auf diesem Gerät. Es gibt keine Synchronisierung. Exportiere regelmäßig eine JSON-Sicherung. Ungültige Daten werden unter `hm.v1.corrupt` gesichert und die App startet neu.

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
