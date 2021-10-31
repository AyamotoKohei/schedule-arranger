var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var helmet = require('helmet');
var session = require('express-session');
var passport = require('passport');

var GitHubStrategy = require('passport-github2');
var GITHUB_CLIENT_ID = '5919177f06dbbce8a82e';
var GITHUB_CLIENT_SECRET = 'ed49b06b9f92a442b1d75fa30ac41b922733a6f0';

// 認証されたユーザー情報の保存
passport.serializeUser(function (user, done) {
  done(null, user);
});

// 保存されたデータをユーザーの情報として読み出す
passport.deserializeUser(function (obj, done) {
  done(null, obj);
});

// GitHubを利用した認証の戦略オブジェクトの設定
passport.use(new GitHubStrategy({
  clientID: GITHUB_CLIENT_ID,
  clientSecret: GITHUB_CLIENT_SECRET,
  callbackURL: 'http://localhost:8000/auth/github/callback'
},
  function (accessToken, refreshToken, profile, done) {
    process.nextTick(function () {
      return done(null, profile)
    });
  }
));

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');

var app = express();
app.use(helmet());

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// express-sessionとpassportでセッションを利用する
app.use(session({ 
  secret: '6da9f1fd989d92cd', // 秘密鍵の文字列
  resave: false, // セッションを必ずストアに保存しない
  saveUninitialized: false // セッションが初期化されていなくても保存しない
}));
app.use(passport.initialize());
app.use(passport.session());

app.use('/', indexRouter);
app.use('/users', usersRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
