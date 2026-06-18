const showGame = (req, res) => {
  res.render('index', {
    title: 'Infra Clicker — Le clicker SysAdmin & DevOps',
    description: 'Construisez votre infrastructure, automatisez les requêtes et faites tourner Internet.',
    pageScript: '/js/game.js',
    pageClass: 'game-body'
  });
};

const showStatistics = (req, res) => {
  res.render('statistics', {
    title: 'Statistiques — Infra Clicker',
    description: 'Consultez toutes les statistiques cumulées de votre infrastructure.',
    pageScript: '/js/statistics.js',
    pageClass: 'stats-body'
  });
};

const showPrivacy = (req, res) => {
  res.render('privacy', {
    title: 'Confidentialité — Infra Clicker',
    description: 'Politique de confidentialité et de stockage local d’Infra Clicker.',
    pageScript: '/js/privacy.js',
    pageClass: 'privacy-body'
  });
};

module.exports = { showGame, showStatistics, showPrivacy };
