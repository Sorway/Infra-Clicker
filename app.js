const path = require('path');
const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const indexRouter = require('./routes/index');

const app = express();
const port = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('layout', 'layout');

app.use(expressLayouts);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0
}));

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

app.listen(port, () => {
  console.log(`Infra Clicker écoute sur http://localhost:${port}`);
});

module.exports = app;
