console.log(`[App] Chargement d’Infra Clicker — Node ${process.version}`);
console.log('[App] Variables d’environnement disponibles');
const path = require('path');
const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const indexRouter = require('./routes/index');
const gameApiRouter = require('./routes/gameApi');
const { initializeDatabase } = require('./server/gameStore');

const app = express();
const port = process.env.PORT || 3000;
const siteUrl = (process.env.SITE_URL || 'https://clicker.contoso.com').replace(/\/$/, '');

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('layout', 'layout');

app.use(expressLayouts);
app.use((req, res, next) => {
  res.locals.siteUrl = siteUrl;
  res.locals.canonicalUrl = `${siteUrl}${req.path === '/' ? '/' : req.path}`;
  res.locals.socialImageUrl = `${siteUrl}/img/social-preview.png`;
  res.locals.privacyContact = process.env.PRIVACY_CONTACT || 'Contact via le propriétaire du site';
  res.locals.hostName = process.env.HOST_NAME || 'Hébergeur du site';
  next();
});
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0
}));

app.use('/api/game', gameApiRouter);
app.use('/', indexRouter);

app.use((req, res) => {
  res.status(404).render('404', {
    title: '404 · Infra Clicker',
    description: 'Cette route ne répond pas.'
  });
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).render('500', {
    title: 'Erreur · Infra Clicker',
    description: 'Une erreur interne est survenue.'
  });
});

async function start() {
  console.log(`[App] Démarrage demandé sur le port ${port}`);
  await initializeDatabase();
  return app.listen(port, () => {
    console.log(`[App] Serveur HTTP prêt sur le port ${port}`);
  });
}

module.exports = app;
module.exports.start = start;
