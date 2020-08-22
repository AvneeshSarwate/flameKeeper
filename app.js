const express = require('express');
const app = express();
const router = express.Router();
const server = app.listen(process.env.PORT || 8000);

const createError = require('http-errors');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const methodOverride = require('method-override');

const util = require('util');
const url = require('url');
const querystring = require('querystring');



// view engine setup
app.set('views', path.join(__dirname, '/views'));
app.set('view engine', 'pug');


// Session/Login

const session = require('express-session');
const MemoryStore = require('memorystore')(session)

// config express-session
const sess = {
  store: new MemoryStore,
  secret: 'ITS A SEEEECRET',
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

// Load environment variables from .env
const dotenv = require('dotenv');
dotenv.config();



app.use(session(sess));

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({extended: false}));
app.use(cookieParser());
app.use(methodOverride('_method'));
app.use(express.static('public'));


const authRouter = require('./routes/auth');

app.use((req, res, next) => {
  res.locals.isAuthenticated = req.isAuthenticated();
  next();
});

app.use('/', authRouter);




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