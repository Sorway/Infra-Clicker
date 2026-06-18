export const BUILDINGS = [
  { id: 'bash', name: 'Script Bash', icon: '$_', description: 'Automatise une poignée de requêtes répétitives.', baseCost: 15, baseProduction: 0.2 },
  { id: 'pi', name: 'Raspberry Pi', icon: 'π', description: 'Un petit nœud ARM qui ne demande qu’à chauffer.', baseCost: 100, baseProduction: 1 },
  { id: 'mini', name: 'Mini Serveur', icon: '▣', description: 'Le premier vrai serveur de votre homelab.', baseCost: 650, baseProduction: 5 },
  { id: 'nas', name: 'NAS', icon: '▤', description: 'Stockage centralisé et services auto-hébergés.', baseCost: 3500, baseProduction: 22 },
  { id: 'switch', name: 'Switch manageable', icon: '⇄', description: 'VLAN, QoS et beaucoup trop de ports.', baseCost: 16000, baseProduction: 90 },
  { id: 'firewall', name: 'Firewall', icon: '⬡', description: 'Filtre le bruit et accélère le trafic légitime.', baseCost: 75000, baseProduction: 360 },
  { id: 'rack', name: 'Rack 42U', icon: '▥', description: 'Une armoire complète, câblée presque proprement.', baseCost: 350000, baseProduction: 1400 },
  { id: 'serverroom', name: 'Salle serveur', icon: '▦', description: 'Climatisation redondante et badge obligatoire.', baseCost: 1.8e6, baseProduction: 6200 },
  { id: 'datacenter', name: 'Datacenter', icon: '▧', description: 'Des allées froides remplies de capacité brute.', baseCost: 12e6, baseProduction: 36000 },
  { id: 'kubernetes', name: 'Cluster Kubernetes', icon: '⎈', description: 'Orchestre des pods jusqu’à la fin des temps.', baseCost: 95e6, baseProduction: 240000 },
  { id: 'privatecloud', name: 'Cloud privé', icon: '☁', description: 'Votre propre nuage, avec vos propres incidents.', baseCost: 850e6, baseProduction: 1.8e6 },
  { id: 'worldcloud', name: 'Cloud mondial', icon: '◎', description: 'Une infrastructure distribuée à l’échelle planétaire.', baseCost: 12e9, baseProduction: 28e6 }
];

export const UPGRADES = [
  { id: 'ssd', category: 'Linux', name: 'SSD', icon: '▰', cost: 250, description: 'I/O plus réactives.', effect: { production: 1.12 } },
  { id: 'raid', category: 'Linux', name: 'RAID', icon: '▥', cost: 3000, description: 'Parallélise les disques.', requires: 'ssd', effect: { production: 1.18 } },
  { id: 'nvme', category: 'Linux', name: 'NVMe', icon: 'ϟ', cost: 25000, description: 'Réduit drastiquement la latence.', requires: 'raid', effect: { production: 1.25 } },
  { id: 'ceph', category: 'Linux', name: 'Ceph', icon: '◈', cost: 450000, description: 'Stockage objet résilient.', requires: 'nvme', effect: { building: 'nas', multiplier: 3 } },
  { id: 'zfs', category: 'Linux', name: 'ZFS', icon: 'Z', cost: 2.5e6, description: 'Snapshots, intégrité, sérénité.', requires: 'ceph', effect: { production: 1.35 } },
  { id: 'distributed-storage', category: 'Linux', name: 'Stockage distribué', icon: '⌘', cost: 75e6, description: 'Les données sont partout.', requires: 'zfs', effect: { production: 1.6 } },

  { id: 'cat5', category: 'Réseau', name: 'CAT5', icon: '∿', cost: 100, description: 'Un câble, un début.', effect: { click: 2 } },
  { id: 'cat6', category: 'Réseau', name: 'CAT6', icon: '≈', cost: 1400, description: 'Moins de diaphonie.', requires: 'cat5', effect: { click: 2 } },
  { id: 'fiber', category: 'Réseau', name: 'Fibre', icon: '⤳', cost: 15000, description: 'La lumière fait le travail.', requires: 'cat6', effect: { production: 1.2 } },
  { id: 'sfp', category: 'Réseau', name: 'SFP+', icon: '▱', cost: 150000, description: 'Modules optiques interchangeables.', requires: 'fiber', effect: { building: 'switch', multiplier: 3 } },
  { id: '10gb', category: 'Réseau', name: '10 Gb', icon: '10', cost: 1.5e6, description: 'Le réseau respire enfin.', requires: 'sfp', effect: { production: 1.3 } },
  { id: '40gb', category: 'Réseau', name: '40 Gb', icon: '40', cost: 18e6, description: 'Agrégation sans compromis.', requires: '10gb', effect: { production: 1.4 } },
  { id: '100gb', category: 'Réseau', name: '100 Gb', icon: '100', cost: 220e6, description: 'Les paquets deviennent flous.', requires: '40gb', effect: { production: 1.5 } },
  { id: 'backbone', category: 'Réseau', name: 'Backbone', icon: '∞', cost: 4e9, description: 'Vous êtes devenu Internet.', requires: '100gb', effect: { production: 2 } },

  { id: 'cron', category: 'DevOps', name: 'Cron', icon: '◷', cost: 500, description: 'Planifie l’automatisation.', effect: { building: 'bash', multiplier: 3 } },
  { id: 'systemd', category: 'DevOps', name: 'Systemd', icon: 'D', cost: 6500, description: 'Tout devient une unit.', requires: 'cron', effect: { production: 1.2 } },
  { id: 'docker', category: 'DevOps', name: 'Docker', icon: '▣', cost: 65000, description: 'Emballe chaque service.', requires: 'systemd', effect: { building: 'mini', multiplier: 3 } },
  { id: 'ansible', category: 'DevOps', name: 'Ansible', icon: 'A', cost: 650000, description: 'Configure sans agent.', requires: 'docker', effect: { costReduction: 0.05 } },
  { id: 'terraform', category: 'DevOps', name: 'Terraform', icon: 'T', cost: 7e6, description: 'L’infrastructure devient du code.', requires: 'ansible', effect: { costReduction: 0.08 } },
  { id: 'k8s', category: 'DevOps', name: 'Kubernetes', icon: '⎈', cost: 80e6, description: 'Déclare l’état désiré.', requires: 'terraform', effect: { building: 'kubernetes', multiplier: 4 } },
  { id: 'gitops', category: 'DevOps', name: 'GitOps', icon: '⑂', cost: 950e6, description: 'Git devient la source de vérité.', requires: 'k8s', effect: { production: 1.6 } },
  { id: 'cicd', category: 'DevOps', name: 'CI/CD', icon: '↻', cost: 15e9, description: 'Déploie en continu, même le vendredi.', requires: 'gitops', effect: { production: 2.2 } },

  { id: 'fail2ban', category: 'Sécurité', name: 'Fail2Ban', icon: '⊘', cost: 900, description: 'Bannit les brutes.', effect: { eventResistance: 0.1 } },
  { id: 'ids', category: 'Sécurité', name: 'IDS', icon: '◉', cost: 9000, description: 'Détecte les comportements suspects.', requires: 'fail2ban', effect: { eventResistance: 0.1 } },
  { id: 'ips', category: 'Sécurité', name: 'IPS', icon: '⛨', cost: 110000, description: 'Bloque avant l’incident.', requires: 'ids', effect: { eventResistance: 0.12 } },
  { id: 'mfa', category: 'Sécurité', name: 'MFA', icon: '✣', cost: 1.2e6, description: 'Quelque chose que vous avez.', requires: 'ips', effect: { production: 1.25 } },
  { id: 'zero-trust', category: 'Sécurité', name: 'Zero Trust', icon: '∅', cost: 14e6, description: 'Ne jamais faire confiance.', requires: 'mfa', effect: { eventResistance: 0.2 } },
  { id: 'soc', category: 'Sécurité', name: 'SOC', icon: '◐', cost: 180e6, description: 'Surveillance permanente.', requires: 'zero-trust', effect: { eventResistance: 0.25 } },
  { id: 'anti-ddos-ai', category: 'Sécurité', name: 'IA anti-DDoS', icon: 'AI', cost: 3e9, description: 'Anticipe et absorbe les attaques.', requires: 'soc', effect: { production: 1.8, eventResistance: 0.3 } }
];

export const EVENTS = [
  { id: 'disk', title: 'Panne disque', description: 'Un disque vient de quitter le RAID.', duration: 20, multiplier: 0.75, type: 'danger' },
  { id: 'panic', title: 'Kernel Panic', description: 'Le noyau demande un redémarrage émotionnel.', duration: 15, multiplier: 0.5, type: 'danger' },
  { id: 'ddos', title: 'DDoS', description: 'Un botnet s’intéresse à votre endpoint.', duration: 25, multiplier: 0.4, type: 'danger' },
  { id: 'cert', title: 'Certificat expiré', description: 'Le calendrier a encore gagné.', duration: 18, multiplier: 0.65, type: 'danger' },
  { id: 'switch-down', title: 'Switch en panne', description: 'Toutes les LED sont éteintes. Mauvais signe.', duration: 22, multiplier: 0.55, type: 'danger' },
  { id: 'fiber-cut', title: 'Fibre coupée', description: 'Une pelleteuse a trouvé votre backbone.', duration: 20, multiplier: 0.45, type: 'danger' },
  { id: 'ransomware', title: 'Ransomware', description: 'Les sauvegardes hors ligne sauvent la journée.', duration: 30, multiplier: 0.3, type: 'danger' },
  { id: 'traffic', title: 'Pic de trafic', description: 'Votre service devient soudainement populaire.', duration: 25, multiplier: 2.5, type: 'bonus' },
  { id: 'hackernews', title: 'Buzz Hacker News', description: 'Vous êtes en première page. Tenez bon.', duration: 30, multiplier: 4, type: 'bonus' }
];

export const CERTIFICATIONS = [
  { id: 'lpic', name: 'LPIC', cost: 1, icon: 'L', description: '+10% de production permanente.', bonus: 0.1 },
  { id: 'rhcsa', name: 'RHCSA', cost: 2, icon: 'R', description: '+20% de production permanente.', bonus: 0.2 },
  { id: 'rhce', name: 'RHCE', cost: 3, icon: 'R+', description: '+35% de production permanente.', bonus: 0.35 },
  { id: 'ccna', name: 'CCNA', cost: 2, icon: 'C', description: '+20% de production permanente.', bonus: 0.2 },
  { id: 'ccnp', name: 'CCNP', cost: 4, icon: 'C+', description: '+50% de production permanente.', bonus: 0.5 },
  { id: 'cka', name: 'CKA', cost: 5, icon: 'K', description: '+65% de production permanente.', bonus: 0.65 },
  { id: 'ckad', name: 'CKAD', cost: 5, icon: 'K+', description: '+65% de production permanente.', bonus: 0.65 },
  { id: 'cissp', name: 'CISSP', cost: 8, icon: 'S', description: 'Double la production permanente.', bonus: 1 }
];

const milestoneAchievements = [
  ['first-request', 'Hello, World!', 'Traiter votre première requête.', 'requests', 1],
  ['ping', 'Ping 8.8.8.8', 'Traiter 8 requêtes.', 'requests', 8],
  ['http-ok', 'HTTP 200 OK', 'Traiter 200 requêtes.', 'requests', 200],
  ['thousand', 'Kilorequête', 'Traiter 1 000 requêtes.', 'requests', 1e3],
  ['ten-thousand', 'Ça commence à scaler', 'Traiter 10 000 requêtes.', 'requests', 1e4],
  ['hundred-thousand', 'Charge soutenue', 'Traiter 100 000 requêtes.', 'requests', 1e5],
  ['million', '1 Million Requests', 'Traiter 1 million de requêtes.', 'requests', 1e6],
  ['billion', 'Internet est à vous', 'Traiter 1 milliard de requêtes.', 'requests', 1e9],
  ['trillion', 'Hyperscale', 'Traiter 1 billion de requêtes.', 'requests', 1e12],
  ['click-10', 'Index musclé', 'Cliquer 10 fois.', 'clicks', 10],
  ['click-100', 'ClickOps', 'Cliquer 100 fois.', 'clicks', 100],
  ['click-1000', 'Automatisation manuelle', 'Cliquer 1 000 fois.', 'clicks', 1e3],
  ['rps-10', 'Dix par seconde', 'Atteindre 10 req/s.', 'rps', 10],
  ['rps-100', 'Reverse proxy', 'Atteindre 100 req/s.', 'rps', 100],
  ['rps-1000', 'Load balancer', 'Atteindre 1 000 req/s.', 'rps', 1e3],
  ['rps-million', 'Internet Backbone', 'Atteindre 1 million req/s.', 'rps', 1e6]
];

const buildingAchievements = BUILDINGS.flatMap((building, index) => ([
  {
    id: `${building.id}-one`,
    name: index === 8 ? 'Datacenter' : `Premier ${building.name}`,
    description: `Posséder 1 ${building.name}.`,
    type: 'building',
    target: building.id,
    value: 1
  },
  {
    id: `${building.id}-ten`,
    name: `${building.name} en série`,
    description: `Posséder 10 ${building.name}.`,
    type: 'building',
    target: building.id,
    value: 10
  },
  {
    id: `${building.id}-fifty`,
    name: `${building.name} industriel`,
    description: `Posséder 50 ${building.name}.`,
    type: 'building',
    target: building.id,
    value: 50
  }
]));

const specialAchievements = [
  ['root', 'Root', 'Ouvrir le terminal.', 'terminal', 1],
  ['sudo-rm', 'sudo rm -rf /', 'Essayer une commande dangereuse.', 'command', 'sudo rm -rf /'],
  ['works-machine', 'It Works On My Machine', 'Acheter Docker.', 'upgrade', 'docker'],
  ['no-backup', 'No Backup No Pity', 'Subir une panne disque.', 'event', 'disk'],
  ['segfault', 'Segmentation Fault', 'Atteindre exactement 139 clics.', 'clicks', 139],
  ['kernel-panic', 'Kernel Panic', 'Survivre à un Kernel Panic.', 'event', 'panic'],
  ['ccna-achievement', 'CCNA', 'Obtenir la certification CCNA.', 'certification', 'ccna'],
  ['rhce-achievement', 'RHCE', 'Obtenir la certification RHCE.', 'certification', 'rhce'],
  ['yaml-engineer', 'Ingénieur YAML', 'Acheter Kubernetes.', 'upgrade', 'k8s'],
  ['friday-deploy', 'Deploy on Friday', 'Acheter CI/CD.', 'upgrade', 'cicd'],
  ['zero-trust-achievement', 'Trust No One', 'Acheter Zero Trust.', 'upgrade', 'zero-trust'],
  ['all-upgrades', 'Full Stack Ops', 'Acheter toutes les améliorations.', 'upgradeCount', UPGRADES.length],
  ['first-prestige', 'Rebuild from Source', 'Effectuer un prestige.', 'prestige', 1],
  ['three-prestige', 'Consultant senior', 'Effectuer 3 prestiges.', 'prestige', 3],
  ['all-certs', 'Alphabet Soup', 'Obtenir toutes les certifications.', 'certCount', CERTIFICATIONS.length],
  ['event-five', 'Astreinte', 'Survivre à 5 événements.', 'eventCount', 5],
  ['event-twenty', 'Post-mortem permanent', 'Survivre à 20 événements.', 'eventCount', 20],
  ['terminal-ping', 'ICMP Enjoyer', 'Lancer ping dans le terminal.', 'command', 'ping'],
  ['terminal-kubectl', 'Pod Whisperer', 'Inspecter les pods.', 'command', 'kubectl get pods'],
  ['terminal-neofetch', 'BTW I Use InfraOS', 'Lancer neofetch.', 'command', 'neofetch'],
  ['save-export', 'Disaster Recovery', 'Exporter une sauvegarde.', 'export', 1],
  ['hundred-buildings', 'CapEx', 'Posséder 100 bâtiments.', 'buildingCount', 100],
  ['five-hundred-buildings', 'Fleet Manager', 'Posséder 500 bâtiments.', 'buildingCount', 500],
  ['night-ops', 'NOC de nuit', 'Jouer pendant la nuit.', 'night', 1],
  ['sound-off', 'Mode silencieux', 'Couper le son.', 'muted', 1],
  ['max-buy', 'Procurement Department', 'Utiliser le mode MAX.', 'maxBuy', 1],
  ['uptime', '99.999%', 'Garder la partie ouverte 30 minutes.', 'uptime', 1800],
  ['one-hour', 'On-Call Hero', 'Garder la partie ouverte 1 heure.', 'uptime', 3600]
];

export const ACHIEVEMENTS = [
  ...milestoneAchievements.map(([id, name, description, type, value]) => ({ id, name, description, type, value })),
  ...buildingAchievements,
  ...specialAchievements
].slice(0, 80);

export const INFRA_LEVELS = [
  [0, 'Homelab improvisé'],
  [1e3, 'Lab domestique'],
  [1e5, 'Petite entreprise'],
  [1e7, 'Infrastructure régionale'],
  [1e9, 'Datacenter opérateur'],
  [1e12, 'Cloud continental'],
  [1e15, 'Backbone mondial']
];
