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

Le jeu fonctionne entièrement dans le navigateur. La progression est sauvegardée localement et aucune base de données n’est nécessaire.

## Fonctionnalités

- **12 bâtiments** : Script Bash, Raspberry Pi, NAS, Datacenter, Cloud mondial…
- **29 améliorations** réparties entre Linux, Réseau, DevOps et Sécurité
- **80 succès** à débloquer
- événements aléatoires : DDoS, panne disque, ransomware, buzz Hacker News…
- système de prestige avec **8 certifications permanentes**
- production automatique et progression hors ligne
- sauvegarde locale toutes les 10 secondes
- import et export des sauvegardes au format JSON
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
| `save.js` | Sauvegarde, import, export et progression hors ligne |
| `audio.js` | Effets sonores |
| `terminal.js` | Faux terminal Linux et commandes |

## Sauvegarde

La progression est enregistrée dans le `LocalStorage` du navigateur sous la clé :

```text
infra-clicker-save-v1
```

Le thème sélectionné est conservé séparément sous la clé :

```text
infra-clicker-theme
```

Utilisez le menu des paramètres pour exporter régulièrement une copie JSON de votre partie.

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
