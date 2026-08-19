# Audit agrégé Orchard ↔ catalogue éditorial

Audit en lecture seule du 13 août 2026. Le rapport ne contient ni ligne brute, ni identifiant Drive, ni contact, ni URL privée.

## Résultat

| Contrôle | Résultat |
| --- | ---: |
| Lignes Orchard analysées | 8 331 |
| Lignes actives | 8 330 |
| Identifiants Spotify présents | 7 110 (85,34 %) |
| Identifiants Spotify manquants | 1 221 (14,66 %) |
| Identifiants Spotify dupliqués | 0 |
| Lignes éditoriales non vides dans A:M | 8 607 |
| Rapprochements stricts uniques | 6 458 (77,52 % des lignes Orchard) |
| Rapprochements stricts avec identifiant Spotify | 5 658 (67,92 %) |
| Rapprochements stricts sans identifiant Spotify | 800 |
| Candidats préliminaires actifs, stricts, avec identifiant Spotify et durée locale ≥ 30 s | 5 655 |

Le rapprochement strict utilise quatre dimensions obligatoires : UPC, titre de release, titre de piste et artiste. La normalisation ne change pas le sens : casse, espaces, ponctuation typographique et variante `&`/`and` sont harmonisés. Un artiste peut correspondre à un champ artiste individuel ou à la séquence ordonnée des quatre champs artistes. Une correspondance n'est retenue comme stricte que si elle pointe vers une seule ligne.

## Écarts à isoler

| File de contrôle | Orchard | Catalogue éditorial |
| --- | ---: | ---: |
| Même UPC + release + piste, artiste différent | 1 578 | 1 577 |
| Même UPC + piste + artiste, release différente | 1 | 1 |
| Même UPC + piste seulement | 25 | 25 |
| Aucun candidat | 269 | 546 |
| Correspondance stricte ambiguë | 0 | 0 |

Ces 1 604 candidats non stricts ne doivent pas être reliés automatiquement : une différence d'artiste ou de version peut désigner une collaboration, un remix, un remaster ou un autre master.

Sept clés composites Orchard sont dupliquées, pour 18 lignes concernées au total et un maximum de quatre lignes par clé. Les identifiants Spotify restent toutefois tous uniques dans l'export.

## Qualité des métadonnées et durées

- 181 lignes éditoriales n'ont pas d'UPC, 182 n'ont pas d'ISRC et 183 n'ont pas de durée exploitable.
- 8 425 lignes ont un ISRC ; 7 959 ISRC sont uniques. Il existe 464 groupes d'ISRC dupliqués, soit 930 lignes concernées et 466 occurrences excédentaires. Ces doublons peuvent être légitimes entre éditions, mais ils interdisent une jointure aveugle par ISRC seul.
- 8 424 durées sont lisibles. Quatre sont inférieures à 30 secondes, dont trois exactement à `00:00`. Elles doivent être mises en quarantaine comme anomalies ou parasites possibles.
- Parmi les 5 658 correspondances strictes avec Spotify, une durée locale manque et une est inférieure à 30 secondes.

L'export Orchard ne contient aucune durée Spotify. Il est donc impossible de calculer honnêtement l'écart entre le WAV, la durée éditoriale et Spotify avec les seules feuilles disponibles. Avant publication, il faut enrichir les 5 655 candidats préliminaires avec `duration_ms` depuis une source Spotify authentifiée, puis appliquer le contrôle suivant : écart ≤ 2 s accepté, écart de 2 à 5 s en revue, écart > 5 s ou > 2 % bloqué sauf justification de version.

## Garde-fou de publication

Les 5 655 lignes sont seulement des candidats préliminaires, pas un lot prêt à publier. La publication automatique exige encore : présence et empreinte du fichier audio, concordance de durée Spotify, absence de variante incompatible (`remix`, `instrumental`, `live`, `remaster`, `sped up`, etc.), artwork détenu ou autorisé, puis stockage audio privé.

Le script [`audit-orchard-spotify.mjs`](./audit-orchard-spotify.mjs) reproduit ces comptes à partir d'exports JSON, CSV ou TSV et ne génère qu'un JSON agrégé. Il n'émet volontairement aucune ligne de catalogue.
