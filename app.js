// Load environment variables from .env
const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const app = express();
const router = express.Router();
const server = app.listen(process.env.PORT || 8000);

const createError = require('http-errors');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const helmet = require('helmet');

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
app.use(logger('dev'));
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({extended: false}));
app.use(cookieParser());
app.use(express.static('public'));

const { mainRouter } = require('./routes/main');
app.use('/', mainRouter);

const { adminRouter } = require('./routes/admin');
app.use('/', adminRouter);

// Catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// Error handler
app.use(function (err, req, res, next) {
  // Set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // Render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
