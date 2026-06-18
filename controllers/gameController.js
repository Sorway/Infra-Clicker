const showGame = (req, res) => {
  res.render('index', {
    title: 'Infra Clicker · Scale the Internet',
    description: 'Déployez votre infrastructure, automatisez le trafic et construisez le backbone mondial.'
  });
};

module.exports = { showGame };
