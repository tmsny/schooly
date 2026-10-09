# Hausaufgaben-Manager

Minimalistische Schwarz-Weiß-Web-App für Hausaufgaben, Prüfungen, Referate und Klassen. Kein Backend und keine externen Abhängigkeiten.

## Starten
`index.html` im Browser öffnen. Ein Server ist nicht nötig. Für Hosting reicht jeder statische Webspace.

## Funktionen
- Dashboard mit Statistiken, „Als Nächstes fällig“ und „Zuletzt hinzugefügt“
- Hausaufgaben: erstellen, bearbeiten, löschen, erledigen, suchen, filtern, sortieren, Listen- und Kartenansicht
- Fächer und Lehrer verwalten. Beim Löschen bleiben die Namen in bestehenden Aufgaben erhalten
- Kalender mit Monatsansicht und „Nächste 7 Tage“
- Einstellungen: Wochenbeginn, Standardansicht, Standardfächer, JSON-Sicherung (Export/Import), CSV-Export, Demo-Modus, Zurücksetzen
- Klassen-Prototyp: lokales Testkonto, übersichtliche Klassenräume mit sichtbaren Admin/Lehrer/Schüler-Rollen, Einladungscode, Klassenaufgaben verwalten sowie Klasse verlassen/löschen
- Stundenplan: eigener Tab mit persönlichem und Klassen-Stundenplan. Beim Beitritt lässt sich der Klassenplan übernehmen; persönliche Stunden können ohne Änderung am Klassenplan gelöscht werden
- Aufgaben: getrennte Gruppen für persönliche Aufgaben und Aufgaben jeder Klasse. Beim Anlegen können Admins/Lehrer zwischen „Nur für mich“ und einer Klasse wählen; Klassenaufgaben erscheinen außerdem im Kalender und haben einen persönlichen Erledigt-Status

## Speicherung
Aufgaben und App-Einstellungen liegen im LocalStorage (Schlüssel `hm.v1`), Klassen-Prototypdaten separat unter `hm.classsystem.v1`. Die Daten sind nur in diesem Browser auf diesem Gerät verfügbar. Exportiere regelmäßig eine JSON-Sicherung. Ungültige Aufgabendaten werden unter `hm.v1.corrupt` gesichert und die App startet neu.

## Klassen und Anmeldung (Prototyp)
Die Anmeldung ist ein lokaler Debug-Prototyp, kein sicherer Kontodienst. Es gibt keine Firebase-Verbindung; Google-Anmeldung ist deshalb deaktiviert. Lokale Konten speichern einen SHA-256-Passwort-Hash im Browser und dürfen nicht mit echten Zugangsdaten verwendet werden. Der erste Login erfolgt über „Lokales Konto erstellen“.

Klassen, Rollen, Stundenpläne, Hausaufgaben und Einladungscodes werden ebenfalls ausschließlich lokal gespeichert. Ein Einladungscode kann daher aktuell nur im selben Browser verwendet werden; für echte Einladungen und geräteübergreifende Zusammenarbeit müssen Firebase Authentication und eine gemeinsame Datenbank angebunden werden. Klassenaufgaben werden als eigener Aufgabenbereich angezeigt und nicht in persönliche Aufgaben kopiert. Beim Beitritt kann der Klassen-Stundenplan in den persönlichen Plan übernommen werden; dadurch werden keine vorhandenen Stunden ersetzt. Eine persönliche Kopie lässt sich unabhängig vom Klassenplan löschen.

## Struktur
| Datei | Aufgabe |
|---|---|
| `js/storage.js` | Datenmodell, Validierung, Speichern/Laden, Export, Datums- und Icon-Helfer |
| `js/subjects.js`, `js/teachers.js` | Verwaltung von Fächern und Lehrern |
| `js/homework.js` | Aufgaben, Filter, Formular, Detailansicht |
| `js/calendar.js` | Monats- und 7-Tage-Ansicht |
| `js/settings.js` | Einstellungen, Import/Export, Demo, Reset |
| `js/schedule.js` | Persönlicher Stundenplan und Ansichten der Klassenpläne |
| `js/classsystem.js` | Lokale Debug-Anmeldung, Klassen, Rollen, Einladungen und Sync-Prototyp |
| `js/app.js` | Router, Dashboard, Dialoge, zentrale Event-Delegation |

Datumswerte sind lokale `YYYY-MM-DD`-Strings, daher gibt es keine Zeitzonenfehler. Alle Benutzereingaben werden vor dem Einfügen escaped. Events werden einmalig am `document` registriert, es entstehen keine doppelten Listener.
