// Load environment variables from .env
const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const app = express();
const router = express.Router();
const server = app.listen(process.env.PORT || 8000);

const passport = require('passport');
const Auth0Strategy = require('passport-auth0');

const createError = require('http-errors');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const methodOverride = require('method-override');

const util = require('util');
const url = require('url');
const querystring = require('querystring');

const { state } = require('./state');
const { flameKeeper } = require('./flameKeeper');
flameKeeper.start();


// view engine setup
app.set('views', path.join(__dirname, '/views'));
app.set('view engine', 'pug');


// Session/Login

const session = require('express-session');
const MemoryStore = require('memorystore')(session)
const sessionStore = new MemoryStore({
  checkPeriod: 86400000 // prune expired entries every 24h
});
exports.sessionStore = sessionStore;

// config express-session
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



// Configure Passport to use Auth0
const strategy = new Auth0Strategy({
    domain: process.env.AUTH0_DOMAIN,
    clientID: process.env.AUTH0_CLIENT_ID,
    clientSecret: process.env.AUTH0_CLIENT_SECRET,
    callbackURL: process.env.AUTH0_CALLBACK_URL || 'http://localhost:8000/callback'
  },
  function (accessToken, refreshToken, extraParams, profile, done) {
    // accessToken is the token to call Auth0 API (not needed in the most cases)
    // extraParams.id_token has the JSON Web Token
    // profile has all the information from the user
    return done(null, profile);
  }
);


passport.use(strategy);



app.use(session(sess));

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({extended: false}));
app.use(cookieParser());
app.use(methodOverride('_method'));
app.use(express.static('public'));

app.use(passport.initialize());
app.use(passport.session());

// You can use this section to keep a smaller payload
passport.serializeUser(function (user, done) {
  done(null, user);
});

passport.deserializeUser(function (user, done) {
  done(null, user);
});


const authRouter = require('./routes/auth');

app.use((req, res, next) => {
  res.locals.isAuthenticated = req.isAuthenticated();
  next();
});

app.use('/', authRouter);

const { adminRouter } = require('./routes/admin');
app.use('/admin', adminRouter);

const { mainRouter } = require('./routes/main');
app.use('/main', mainRouter);


// const routes = require('./routes.js');
const indexRouter = require('./routes/index');
app.use('/', indexRouter);



// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;