const BUILDINGS = [
  ['bash', 15, 0.2],
  ['pi', 100, 1],
  ['mini', 650, 5],
  ['nas', 3500, 22],
  ['switch', 16000, 90],
  ['firewall', 75000, 360],
  ['rack', 350000, 1400],
  ['serverroom', 1.8e6, 6200],
  ['datacenter', 12e6, 36000],
  ['kubernetes', 95e6, 240000],
  ['privatecloud', 850e6, 1.8e6],
  ['worldcloud', 12e9, 28e6]
].map(([id, baseCost, baseProduction]) => ({ id, baseCost, baseProduction }));

const UPGRADES = [
  ['ssd', 250, null, { production: 1.12 }],
  ['raid', 3000, 'ssd', { production: 1.18 }],
  ['nvme', 25000, 'raid', { production: 1.25 }],
  ['ceph', 450000, 'nvme', { building: 'nas', multiplier: 3 }],
  ['zfs', 2.5e6, 'ceph', { production: 1.35 }],
  ['distributed-storage', 75e6, 'zfs', { production: 1.6 }],
  ['cat5', 100, null, { click: 2 }],
  ['cat6', 1400, 'cat5', { click: 2 }],
  ['fiber', 15000, 'cat6', { production: 1.2 }],
  ['sfp', 150000, 'fiber', { building: 'switch', multiplier: 3 }],
  ['10gb', 1.5e6, 'sfp', { production: 1.3 }],
  ['40gb', 18e6, '10gb', { production: 1.4 }],
  ['100gb', 220e6, '40gb', { production: 1.5 }],
  ['backbone', 4e9, '100gb', { production: 2 }],
  ['cron', 500, null, { building: 'bash', multiplier: 3 }],
  ['systemd', 6500, 'cron', { production: 1.2 }],
  ['docker', 65000, 'systemd', { building: 'mini', multiplier: 3 }],
  ['ansible', 650000, 'docker', { costReduction: 0.05 }],
  ['terraform', 7e6, 'ansible', { costReduction: 0.08 }],
  ['k8s', 80e6, 'terraform', { building: 'kubernetes', multiplier: 4 }],
  ['gitops', 950e6, 'k8s', { production: 1.6 }],
  ['cicd', 15e9, 'gitops', { production: 2.2 }],
  ['fail2ban', 900, null, { eventResistance: 0.1 }],
  ['ids', 9000, 'fail2ban', { eventResistance: 0.1 }],
  ['ips', 110000, 'ids', { eventResistance: 0.12 }],
  ['mfa', 1.2e6, 'ips', { production: 1.25 }],
  ['zero-trust', 14e6, 'mfa', { eventResistance: 0.2 }],
  ['soc', 180e6, 'zero-trust', { eventResistance: 0.25 }],
  ['anti-ddos-ai', 3e9, 'soc', { production: 1.8, eventResistance: 0.3 }]
].map(([id, cost, requires, effect]) => ({ id, cost, requires, effect }));

const CERTIFICATIONS = [
  ['lpic', 1, 0.1],
  ['rhcsa', 2, 0.2],
  ['rhce', 3, 0.35],
  ['ccna', 2, 0.2],
  ['ccnp', 4, 0.5],
  ['cka', 5, 0.65],
  ['ckad', 5, 0.65],
  ['cissp', 8, 1]
].map(([id, cost, bonus]) => ({ id, cost, bonus }));

module.exports = { BUILDINGS, CERTIFICATIONS, UPGRADES };
