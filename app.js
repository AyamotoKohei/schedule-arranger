var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var helmet = require('helmet');
var session = require('express-session');
var passport = require('passport');

// モデルの読み込み
var User = require('./models/user');
var Schedule = require('./models/schedule');
var Availability = require('./models/availability');
var Candidate = require('./models/candidate');
var Comment = require('./models/comment');

// データベースのテーブルを作成する関数を呼び出す
User.sync().then(() => { // テーブル作成後に実行したい処理を記述
  // 予定がユーザーの従属エンティティであることを定義し、テーブルを作成
  Schedule.belongsTo(User, {foreignKey: 'createdBy'}); // createdBy が User の外部キーとなるとことを設定
  Schedule.sync(); // 対応するテーブルを作成

  // コメントがユーザーの従属エンティティであることを定義し、テーブルを作成
  Comment.belongsTo(User, {foreignKey: 'userId'}); // userId が User の外部キーとなるとことを設定
  Comment.sync(); // 対応するテーブルを作成

  // 出欠がユーザーの従属エンティティであることを定義し、テーブルを作成
  Availability.belongsTo(User, {foreignKey: 'userId'}); // userId が User の外部キーとなるとことを設定

  // 候補日程に対応するテーブルを作成
  Candidate.sync().then(() => { // テーブル作成後に実行したい処理を記述
    // 出欠が候補日程の従属エンティティであることを定義し、テーブルを作成
    Availability.belongsTo(Candidate, {foreignKey: 'candidateId'}); // candidateId が Candidate の外部キーとなるとことを設定
    Availability.sync(); // 対応するテーブルを作成
  });
});

var GitHubStrategy = require('passport-github2').Strategy;
var GITHUB_CLIENT_ID = '4949a4686f1efba4b21f';
var GITHUB_CLIENT_SECRET = '6beeed5dc5adf02357e6193f096ea65bee6c1ff9';

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
    // GitHub 認証が実行された際に呼び出される処理
    process.nextTick(function () {
      // 取得されたユーザーIDとユーザー名を User のテーブルに保存
      User.upsert({ // INSERT または UPDATE を行う
        userId: profile.id,
        username: profile.username
      }).then(() => {
        done(null, profile);
      });
    });
  }
));

var indexRouter = require('./routes/index');
var loginRouter = require('./routes/login');
var logoutRouter = require('./routes/logout');
var schedulesRouter = require('./routes/schedules');
var availabiliesRouter = require('./routes/availabilities');

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
app.use('/login', loginRouter);
app.use('/logout', logoutRouter);
app.use('/schedules', schedulesRouter);
app.use('/schedules', availabiliesRouter);

// パスに対するHTTPリクエストのハンドラの登録
app.get('/auth/github',
  // GitHubへの認証を行うための処理
  passport.authenticate('github', { scope: ['user:email'] }), // スコープをuser:emailとして、認証を行う
  function (req, res) {} // リクエストが行われた際の処理
);

// GitHubが利用者の許可に対する問い合わせの結果を送るパスのハンドラを登録
app.get('/auth/github/callback',
  // 認証が失敗した際には、再度ログインを促す
  passport.authenticate('github', { failureRedirect: '/login' }),
  function (req, res) { res.redirect('/'); }
);

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
