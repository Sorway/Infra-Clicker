<div align="center">

# 🖥️ Infra Clicker

### Construisez votre infrastructure. Automatisez le trafic. Faites tourner Internet.

Un jeu incrémental inspiré de *Cookie Clicker*, entièrement consacré au monde  
du **SysAdmin**, du **Réseau**, du **Cloud** et du **DevOps**.

![Node.js](https://img.shields.io/badge/Node.js-18%2B-9ed8bd?style=for-the-badge&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-5-9ccce8?style=for-the-badge&logo=express&logoColor=white)
![EJS](https://img.shields.io/badge/EJS-3-f5c98b?style=for-the-badge&logo=ejs&logoColor=white)

</div>

---

## À propos

Dans **Infra Clicker**, chaque clic traite une requête réseau. Commencez avec un simple script Bash, déployez progressivement des serveurs, des datacenters et des clusters Kubernetes, puis construisez un cloud mondial.

Le gameplay est calculé instantanément dans le navigateur, puis la progression est synchronisée périodiquement avec le serveur via un cookie de session HttpOnly.

## Fonctionnalités

- **12 bâtiments** : Script Bash, Raspberry Pi, NAS, Datacenter, Cloud mondial…
- **29 améliorations** réparties entre Linux, Réseau, DevOps et Sécurité
- de nombreux succès à débloquer
- événements aléatoires : DDoS, panne disque, ransomware, buzz Hacker News…
- système de prestige avec **8 certifications permanentes**
- production automatique et progression hors ligne
- sauvegarde locale immédiate avec synchronisation serveur périodique
- pseudo unique et classement mondial avec drapeau du pays
- terminal Linux interactif avec commandes et bonus temporaires
- effets sonores générés avec la Web Audio API
- plusieurs thèmes pastel sur fond noir
- interface Fluent Design responsive
- compatible desktop, tablette et mobile

## Aperçu du gameplay

| Système | Description |
|---|---|
| Requêtes | Monnaie principale produite manuellement ou automatiquement |
| Bâtiments | Augmentent la production de requêtes par seconde |
| Améliorations | Multiplient la production et réduisent certains coûts |
| Événements | Bonus ou incidents temporaires |
| Succès | Récompensent les étapes importantes et les actions cachées |
| Certifications | Bonus permanents obtenus grâce au prestige |

## Installation

### Prérequis

- [Node.js](https://nodejs.org/) 18 ou supérieur
- npm

### Lancement

```bash
git clone <URL_DU_DEPOT>
cd Clicker
npm install
npm start
```

Ouvrez ensuite :

```text
http://localhost:3000
```

### Mode développement

```bash
npm run dev
```

Le serveur redémarre automatiquement après une modification.

## Commandes du terminal

Ouvrez le terminal depuis la barre supérieure avec le bouton `>_`.

```text
help
uptime
ping
ip addr
systemctl status
docker ps
kubectl get pods
top
neofetch
clear
```

Certaines commandes accordent un bonus temporaire de production.

## Structure du projet

```text
.
├── app.js
├── controllers/
│   └── gameController.js
├── routes/
│   └── index.js
├── views/
│   ├── layout.ejs
│   ├── index.ejs
│   └── partials/
├── public/
│   ├── css/
│   │   └── style.css
│   ├── img/
│   ├── js/
│   │   ├── game.js
│   │   └── modules/
│   └── sounds/
├── package.json
└── README.md
```

## Architecture JavaScript

| Module | Responsabilité |
|---|---|
| `economy.js` | Production, multiplicateurs, coûts et prestige |
| `data.js` | Bâtiments, améliorations, événements et succès |
| `ui.js` | Rendu dynamique, graphiques et notifications |
| `events.js` | Gestion des événements aléatoires |
| `achievements.js` | Conditions et déblocage des succès |
| `server/gameEngine.js` | Production hors ligne et import des synchronisations client |
| `server/gameStore.js` | Sessions signées et persistance serveur |
| `public/js/dlcs/` | Packs de contenu, registre et template navigateur |
| `server/dlcs/` | Données économiques et template serveur des DLC |

La création de packs supplémentaires est documentée dans [`DLC.md`](DLC.md).
| `save.js` | Miroir local de la progression et préférences |
| `audio.js` | Effets sonores |
| `terminal.js` | Faux terminal Linux et commandes |

## Sauvegarde

Un miroir de la progression est enregistré dans le `LocalStorage` sous la clé :

```text
infra-clicker-save-v1
```

Le thème sélectionné est conservé séparément sous la clé :

```text
infra-clicker-theme
```

La progression active est locale et MariaDB en conserve une copie périodique. Les paramètres permettent de synchroniser immédiatement ou de réinitialiser la progression.

Une session utilisateur conserve un identifiant unique. Les progressions MariaDB sont isolées
par la clé composite `(session_id, dlc_id)` : changer de DLC ne remplace donc jamais les données
d’un autre pack. Au démarrage, l’ancien schéma mono-DLC est migré automatiquement vers ce format.

## Stack technique

- Node.js
- Express.js
- EJS
- HTML5
- CSS3
- JavaScript Vanilla
- Web Audio API
- LocalStorage

Aucun framework frontend et aucune base de données.

## Configuration de confidentialité

Copiez `.env.example` vers `.env`, puis renseignez les informations réelles :

```env
SESSION_SECRET=une-cle-aleatoire-longue
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=infra_clicker
DB_PASSWORD=mot-de-passe-fort
DB_NAME=infra_clicker
PRIVACY_CONTACT=contact@example.com
HOST_NAME=Nom et coordonnées de l’hébergeur
```

La base MariaDB et son utilisateur doivent exister avant le lancement. Le schéma
relationnel est créé automatiquement et reste disponible dans `database/schema.sql` :

- `game_sessions` : identité et dates de la partie ;
- `game_progress` : monnaie et état du cycle en cours ;
- `game_stats` : compteurs historiques séparés ;
- `game_buildings` : quantités de bâtiments ;
- `game_upgrades` : améliorations acquises ;
- `game_certifications` : certifications acquises.

Les tables enfants sont reliées à `game_sessions` par des clés étrangères avec
suppression en cascade.

Pour transférer l’ancien fichier JSON vers MariaDB sans déconnecter les joueurs :

```bash
npm run migrate:sessions
```

Le jeu utilise un cookie de session strictement nécessaire, `HttpOnly` et `SameSite=Strict`. Aucun cookie publicitaire ou analytique n’est utilisé.

## Contribution

Les contributions sont les bienvenues :

1. créez un fork du projet ;
2. créez une branche : `git switch -c feature/ma-fonctionnalite` ;
3. enregistrez vos changements : `git commit -m "feat: ajoute une fonctionnalité"` ;
4. poussez la branche : `git push origin feature/ma-fonctionnalite` ;
5. ouvrez une Pull Request.

---

<div align="center">

Déployez prudemment. Surtout le vendredi.

</div>
