# Créer un DLC

Le jeu charge un seul DLC à la fois. Chaque DLC possède ses bâtiments, améliorations,
événements, certifications, succès, niveaux et une sauvegarde locale indépendante.

## Ajouter un pack

1. Copier `public/js/dlcs/template.js` vers `public/js/dlcs/mon-dlc.js`.
2. Définir un `id` stable, sans espace, puis remplir les collections.
3. Importer le module dans `public/js/dlcs/registry.js` et l’ajouter à `DLC_REGISTRY`.
4. Copier `server/dlcs/template.js` vers `server/dlcs/mon-dlc.js`.
5. Reprendre les mêmes identifiants et valeurs économiques côté serveur.
6. Enregistrer le module dans `server/dlcs/registry.js`.
7. Lancer `node --test`.

Le registre peut contenir autant de packs que nécessaire. Le sélecteur des paramètres
est généré automatiquement à partir du registre navigateur.

## Effets d’amélioration

- `production`: multiplicateur global.
- `click`: multiplicateur de clic.
- `building` et `multiplier`: multiplicateur d’un bâtiment précis.
- `costReduction`: réduction cumulée du prix des bâtiments.
- `eventResistance`: réduction des événements négatifs.

## Événements

Un événement utilise `type: "bonus"` ou `type: "danger"` et peut définir :

- `multiplier`
- `clickMultiplier`
- `instantSeconds`
- `overclockCharge`
- `requestLossPercent`

## Succès

Types pris en charge : `requests`, `clicks`, `rps`, `building`, `buildingCount`,
`upgrade`, `upgradeCount`, `certification`, `certCount`, `prestige`, `event`,
`eventCount`, `command`, `terminal`, `night`, `muted`, `maxBuy` et `uptime`.

Le DLC `space` sert d’exemple complet en plus du DLC `infra` par défaut.
