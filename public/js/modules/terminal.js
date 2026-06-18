import { escapeHtml, formatNumber } from './utils.js';

export class Terminal {
  constructor(state, economy, ui, onCommand) {
    this.state = state;
    this.economy = economy;
    this.ui = ui;
    this.onCommand = onCommand;
    this.window = document.querySelector('#terminal-window');
    this.output = document.querySelector('#terminal-output');
    this.input = document.querySelector('#terminal-input');
    this.form = document.querySelector('#terminal-form');
    this.startedAt = Date.now();
    this.bind();
  }

  bind() {
    document.querySelector('#terminal-toggle').addEventListener('click', () => this.open());
    document.querySelector('#terminal-close').addEventListener('click', () => this.close());
    this.form.addEventListener('submit', event => {
      event.preventDefault();
      const command = this.input.value.trim();
      this.input.value = '';
      if (command) this.execute(command);
    });
  }

  open() {
    this.window.classList.add('open');
    this.window.setAttribute('aria-hidden', 'false');
    if (!this.state.commandsUsed.includes('terminal-open')) this.state.commandsUsed.push('terminal-open');
    setTimeout(() => this.input.focus(), 100);
    this.onCommand?.();
  }

  close() {
    this.window.classList.remove('open');
    this.window.setAttribute('aria-hidden', 'true');
  }

  print(content, className = '') {
    const line = document.createElement('p');
    line.className = className;
    line.innerHTML = content;
    this.output.appendChild(line);
    this.output.scrollTop = this.output.scrollHeight;
  }

  grantBonus(multiplier, seconds, label) {
    const current = this.state.temporaryBonus;
    if (!current || current.expiresAt < Date.now() || current.multiplier < multiplier) {
      this.state.temporaryBonus = { multiplier, expiresAt: Date.now() + seconds * 1000 };
      this.ui.toast('Bonus terminal actif', `${label} : production x${multiplier} pendant ${seconds}s.`, 'bonus');
    }
  }

  execute(rawCommand) {
    const command = rawCommand.toLowerCase().replace(/\s+/g, ' ').trim();
    this.print(`<span class="prompt">root@infra-clicker:~#</span> ${escapeHtml(rawCommand)}`);
    if (!this.state.commandsUsed.includes(command)) this.state.commandsUsed.push(command);

    const commands = {
      help: () => this.print('Commandes : <b>help</b>, uptime, ping, ip addr, systemctl status, docker ps, kubectl get pods, top, neofetch, clear'),
      uptime: () => {
        const seconds = Math.floor((Date.now() - this.startedAt) / 1000);
        this.print(`up ${Math.floor(seconds / 60)} min, load average: 0.42, 0.21, 0.08`);
      },
      ping: () => {
        this.print('64 bytes from 8.8.8.8: icmp_seq=1 ttl=117 time=12.4 ms<br>64 bytes from 8.8.8.8: icmp_seq=2 ttl=117 time=11.8 ms');
        this.grantBonus(1.15, 30, 'Route optimisée');
      },
      'ip addr': () => this.print('2: eth0: &lt;BROADCAST,MULTICAST,UP&gt;<br>&nbsp;&nbsp;&nbsp;inet 10.42.0.10/24 brd 10.42.0.255 scope global eth0'),
      'systemctl status': () => {
        this.print('● infra-clicker.service - Internet request processor<br>&nbsp;&nbsp;Active: <span class="term-green">active (running)</span>');
        this.grantBonus(1.1, 45, 'Services optimisés');
      },
      'docker ps': () => this.print('CONTAINER ID&nbsp;&nbsp;IMAGE&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;STATUS<br>a11ce42f00d&nbsp;&nbsp;infra:latest&nbsp;&nbsp;Up 42 days'),
      'kubectl get pods': () => {
        this.print('NAME&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;READY&nbsp;&nbsp;STATUS<br>api-7d4f&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;1/1&nbsp;&nbsp;&nbsp;&nbsp;Running<br>worker-c9a2&nbsp;&nbsp;&nbsp;1/1&nbsp;&nbsp;&nbsp;&nbsp;Running');
        this.grantBonus(1.25, 30, 'Pods autoscalés');
      },
      top: () => this.print(`Tasks: ${Object.values(this.state.buildings).reduce((a, b) => a + b, 0) + 1} total<br>%Cpu(s): 12.4 us, 2.1 sy, 85.5 id<br>Req/s: ${formatNumber(this.economy.getProduction())}`),
      neofetch: () => this.print('<span class="ascii">   /\\_/\\\\<br>  ( o.o )</span>&nbsp;&nbsp;OS: InfraOS x86_64<br><span class="ascii">   &gt; ^ &lt;</span>&nbsp;&nbsp;Kernel: 6.12-clicker<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Shell: bash 5.2'),
      clear: () => { this.output.innerHTML = ''; },
      'sudo rm -rf /': () => this.print('sudo: impossible de supprimer / : intervention du stagiaire bloquée', 'term-red')
    };

    if (commands[command]) commands[command]();
    else this.print(`bash: ${escapeHtml(rawCommand)}: commande introuvable`, 'term-red');
    this.onCommand?.();
  }
}
