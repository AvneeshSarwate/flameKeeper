// Load environment variables from .env
const dotenv = require('dotenv');
dotenv.config();

const { getLogger } = require('./logger');
const logger = getLogger("app.js");

const express = require('express');
const app = express();
const router = express.Router();
const server = app.listen(process.env.PORT || 8000);

const uuid = require(`uuid`)
const createError = require('http-errors');
const path = require('path');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const csp = require(`helmet-csp`)

const { state } = require('./state');
const { flameKeeper } = require('./flameKeeper');
flameKeeper.start();


// View engine setup
app.set('views', path.join(__dirname, '/views'));
app.set('view engine', 'pug');


// Setup sessions
const session = require('express-session');
const MemoryStore = require('memorystore')(session)
const sessionStore = new MemoryStore({
  checkPeriod: 86400000 // prune expired entries every 24h
});
exports.sessionStore = sessionStore;

// Configure express-session
const sess = {
  store: sessionStore,
  secret: process.env.EXPRESS_SESSION_SECRET,
  cookie: {maxAge: 60000},
  resave: false,
  saveUninitialized: true
};

if (app.get('env') === 'production') {
  // Use secure cookies in production (requires SSL/TLS)
  sess.cookie.secure = true;

  // Uncomment the line below if your application is behind a proxy (like on Heroku)
  // or if you're encountering the error message:
  // "Unable to verify authorization request state"
  app.set('trust proxy', 1);
}

app.use(session(sess));

// Create a nonce for CSP
app.use((req, res, next) => {
  res.locals.nonce = uuid.v4();
  next();
})

app.use(helmet({
  contentSecurityPolicy: false
}));
app.use((req, res, next) => {
  csp({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "*.amazonaws.com", `'nonce-${res.locals.nonce}'`],
      styleSrc: ["'self'", "fonts.googleapis.com", "'unsafe-inline'"], // TODO: remove 'unsafe-inline' once dat.gui is removed
      fontSrc: ["'self'", "fonts.gstatic.com"],
      connectSrc: ["'self'", "*.amazonaws.com"],
      mediaSrc: ["'self'", "*.amazonaws.com", "blob:"],
      imgSrc: ["'self'", "*.airtable.com", "data:"]
    }
  })(req, res, next);
});
app.use(express.json());
app.use(express.urlencoded({extended: false}));
app.use(cookieParser());
app.use(express.static('public'));

const { mainRouter } = require('./routes/main');
app.use('/', mainRouter);

const { adminRouter } = require('./routes/admin');
app.use('/', adminRouter);

// Redirect 404 to main page
app.use(function (req, res, next) {
  res.redirect('/');
});

// Error handler
app.use(function (err, req, res, next) {
  if (res.headersSend) return next(err);
  logger.error(`error for ${req.path}: ${err}`);

  // Set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // Render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
