const showGame = (req, res) => {
  res.render('index', {
    title: 'Infra Clicker — Le clicker SysAdmin & DevOps',
    description: 'Construisez votre infrastructure, automatisez les requêtes et faites tourner Internet.'
  });
};

module.exports = { showGame };
