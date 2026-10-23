# Dreamcast – Designkonzept

Seite: `/dreamcast` (Datei `site/dreamcast.html`, `dreamcast.css`, `dreamcast.js`).
Idee 01 der Ideenliste: „Dreamcast – Enter a Dreamscape“. Buchbezug: S. 34, 92, 174–175.

## Was das Buch über den Dreamcast sagt

- **S. 92:** Der erste Anblick: ein „Traumtank“, ein Sarkophag aus blauem Strukturglas mit weißer Liegefläche und
  Sauerstoffmasken, Schläuche „wie lebende Würmer“ kommen von der Decke. Der Mensch legt sich selbst hinein.
- **S. 34:** Es gibt Tanks und das Implantat („Lucie“), das den Einstieg in eine Traumrealität ohne Tank erlaubt. Teuer, selten.
- **S. 174:** Der Dreamcast ist keine gewöhnliche VR. Er zapft „die Fantasie jedes Menschen“ an und macht sie zur
  Realität. Erster Name: „The unconscious Dream Machine“, die mit **Frequenzen und geometrischen Wassermolekülen**
  den Geist stimuliert. **Discs** (Videochips) verstärken die Fantasie, später heißen sie **Dreamscapes**: ein Ort für die Träumerei.
- **S. 175:** Folge: Menschen verlassen das Haus nicht mehr, „Dreamscape-Madness“ / Holotropie, Realitätsverlust und
  Sucht, Massendepression, am Ende Verbot. Jung wird als unwissender Grundsteinleger genannt.
- Weitere Stellen für die Bildwelt: S. 408 (Tank als Zylinder, der wie ein Aquarium blau und türkis leuchtet, doppelte
  Verglasung, pulsierende Schläuche, kaltes Titan), S. 102 (langer Aufenthalt kann zu Amnesie führen).

**Haltung des Buchs:** Der Dreamcast ist Verlockung und Gefahr zugleich. Die Seite soll beides spüren lassen:
Der Einstieg ist schön, aber man kann (und soll) jederzeit aufwachen.

## Leitidee: „Das Wasser steigt“

Die Wachwelt der Seite ist eine **Tuschezeichnung auf Papier** (wie der Rest der Seite). Der Tank ist das einzige Motiv.
Beim Einstieg füllt er sich mit Wasser, und dieses Wasser **flutet die ganze Seite**. Aus Papier wird tiefes Wasser,
aus Tusche wird Licht. Die Besucherin sieht nie einen Ladebalken, sondern eine Verwandlung, die man im Buch
nachlesen kann (Tank → Wasser → Frequenz → Disc → Dreamscape).

## Ablauf (ca. 6 Sekunden)

| Zeit | Was passiert | Quelle im Buch |
| --- | --- | --- |
| 0 s | Klick auf „Einsteigen“. Der Tank leuchtet türkis auf, die Schläuche pulsieren, Statuszeilen laufen. | S. 92, 408 |
| 0–3,6 s | Wasser steigt im Tank, der Schlafende wird zur Silhouette. Statuszeilen: Neuroverbindung · Wassermoleküle ausgerichtet · Frequenz stabil · Disc eingelegt: Dreamscape · Bewusstsein wird übertragen | S. 174 |
| 1,5–4,1 s | **Verzerrung:** Die Wachwelt (Titel, Text, Tank) wird durch ein Wellenfeld (SVG-Turbulenz) gezerrt und verläuft. | „Frequenzen“ |
| 3,6–5,8 s | **Flutung:** Vom Tank aus wächst ein Kreis über die Seite, darin die Traumwelt. | |
| 5,9 s | Ankunft. Fokus auf die erste Disc, Uhr beginnt zu laufen. | |

## Die Traumwelt als Navigation

- **Hintergrund:** Tiefes Wasserblau-Schwarz, darauf ein **Hexagon-Punktgitter** („geometrische Wassermoleküle“), durch das
  Wellen laufen. Der Cursor ist eine Quelle: Wo man hinzeigt, schlägt das Wasser Wellen.
- **Discs statt Menü:** Die Werke schweben als runde „Discs“ im Wasser. Drei große Discs sind die Hauptwege
  (**Werke**, **Roman**, **Über mich**), zehn kleine sind einzelne Werke (öffnen direkt die Großansicht über `?werk=NN`).
  Beim Darüberfahren kommt das Bild in Farbe, Wellen und Glanz verstärken sich; die Bewegung hält an, damit man sie treffen kann.
- **Parallaxe:** Die Discs liegen in zwei gegenläufigen Ringen, kleine Discs bewegen sich stärker mit dem Cursor (Tiefe).
- **Flüstern:** Unten blenden sich Sätze aus dem Roman ein (nur die fünf kurzen Zitate aus dem Buchbezug, mit Seitenzahl).
- **Uhr und Warnung:** Oben läuft die Aufenthaltsdauer. Nach 75 s erscheint die Warnung aus S. 102
  („Langer Aufenthalt … kann tatsächlich zu Amnesie führen“). Das ist ein Augenzwinkern, kein Zwang.
- **Aufwachen:** Immer oben rechts sichtbar, auch mit `Esc`. Das Wasser läuft ab, die Papierwelt kommt zurück.

## Farbe, Schrift, Bewegung

- **Wachwelt:** unverändert Papier `#eeeae2` und Tusche `#23211f`, Georgia für den Titel, kleine Versalien mit Sperrung.
- **Traumwelt:** `#05161a` → `#0b2b32` (Tiefe), **ein einziger Farbton**: Türkis `#6fd8d2` (Licht, Gitter, Rand der Discs),
  Silber `#cfd9da` für Text (kaltes Titan). Die Werke sind entsättigt und dunkel, bis man sie berührt.
  Das Türkis ist die einzige Farbe der Seite und kommt aus dem Buch (blau/türkis leuchtender Tank).
- **Schrift:** wie die Seite (Georgia für Zitate und Titel, Arial für Beschriftung), Statuszeilen in Monospace.
- **Bewegung:** langsam, wie unter Wasser. Nichts blinkt, nichts springt.

## Zugänglichkeit und Technik

- **Ohne JavaScript:** Die Wachwelt bleibt lesbar, statt „Einsteigen“ gibt es den Link „Zu den Werken“, dazu die Zitate und eine `noscript`-Navigation.
- **„Bewegung reduzieren“:** keine Verzerrung, keine Flutung, keine Drehung. Der Einstieg wird zu einem kurzen Wechsel,
  das Wellenfeld steht still, die Discs liegen ruhig.
- **Tastatur:** Discs sind echte Links in sinnvoller Reihenfolge, sichtbarer Fokus, `Esc` weckt auf; die jeweils
  nicht sichtbare Welt ist `inert`, damit weder Fokus noch Screenreader dorthin geraten.
- **CSP:** nur eigene Dateien, keine Inline-Styles, keine Schriften oder Bibliotheken von außen. Kein Ton.
- **Leistung:** Canvas mit etwa 2000 Punkten, Pixeldichte auf 1,5 begrenzt, Schleife pausiert bei verdecktem Tab und nach dem Aufwachen.
- **Erreichbar unter** `/dreamcast` (nginx liefert `dreamcast.html`, `/dreamcast/` leitet um); Menüpunkt „06 Dreamcast“ auf der Startseite.

## Offene Fragen an den Autor

1. Dürfen die Statuszeilen („Wassermoleküle ausgerichtet“ usw.) so bleiben? Sie sind frei formuliert, an S. 174 angelehnt.
2. Soll die Traumwelt später **die** Hauptnavigation der Seite werden (statt des Menüs), oder bleibt sie ein Extra?
3. Ton: ein leises Rauschen („Das Rauschen des Dreamcast“, S. 524) wäre möglich, wenn gewünscht (nur nach Klick, mit Aus-Schalter).
4. Weitere Dreamscapes (je Werk ein eigener Raum, Kapitel aus dem Roman) als nächste Ausbaustufe.
