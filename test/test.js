'use strict';

// supertest, passport-stubの読み込みと、テスト対象の読み込み
const request = require('supertest');
const passportStub = require('passport-stub');
const app = require('../app');
const Candidate = require('../models/candidate');
const Schedule = require('../models/schedule');

// 以下の内容のテストを行う
// ・レスポンスヘッダの 'Content-Type' が text/html; charset=utf-8 であること
// ・<a href="/auth/github" が HTML に含まれること
// ・testuser という文字列が HTML に含まれること
// ・ステータスコードが 200 OK で返る
describe('/login', () => {
    // describe 内のテスト前に実行される関数
    beforeAll(() => {
        passportStub.install(app); // passportStub を app オブジェクトにインストール
        passportStub.login({ username: 'testuser' }); // ログイン処理
    });

    // describe 内のテスト後に実行される関数
    afterAll(() => {
        passportStub.logout(); // ログアウト処理
        passportStub.uninstall(app); // アンインストール
    });

    test('ログインのためのリンクが含まれる', () => {
        // supertestの記法
        return request(app)
            .get('/login') // /login への GET リクエストを作成
            .expect('Content-Type', 'text/html; charset=utf-8') // 文字列を引数として渡し、ヘッダにその値があるかテストする
            .expect(/<a href="\/auth\/github"/) // HTML の body 内に記述した正規表現が含まれるかテストする
            .expect(200); // テストを終了する際、期待されるステータスコードの整数を渡す
    });

    test('ログイン時はユーザー名が表示される', () => {
        return request(app)
            .get('/login') // /login への GET リクエストを作成
            .expect(/testuser/) // HTML の body 内に記述した正規表現が含まれるかテストする
            .expect(200); // テストを終了する際、期待されるステータスコードの整数を渡す
    });
});

// 以下の内容のテストを行う
// ・/logout にアクセスした際に / にリダイレクトされる
describe('/logout', () => {
    test('/ にリダイレクトされる', () => {
        return request(app)
            .get('/logout')
            .expect('Location', '/')
            .expect(302);
    });
});

// 予定が作成でき、表示されることをテストする
describe('/schedules', () => {
    // describe 内のテスト前に実行される関数
    beforeAll(() => {
        passportStub.install(app);
        passportStub.login({ id: 0, username: 'testuser' });
    });

    // describe 内のテスト後に実行される関数
    afterAll(() => {
        passportStub.logout();
        passportStub.uninstall(app);
    });
    
    test('予定が作成でき、表示される', done => {
        User.upsert({ userId: 0, username: 'testuser' }).then(() => {
            request(app)
                .post('/schedules')
                // 予定と候補を作成
                .send({
                    scheduleName: 'テスト予定1',
                    memo: 'テストメモ1\r\nテストメモ2',
                    candidates: 'テスト候補1\r\nテスト候補2\r\nテスト候補3'
                })
                .expect('Location', /schedules/)
                .expect(302)
                .end((err, res) => {
                    // リダイレクトされることを検証
                    const createdSchedulePath = res.headers.location;
                    request(app)
                        .get(createdSchedulePath)
                        // 作成された予定と候補が表示されていることをテストする
                        .expect(/テスト予定/)
                        .expect(/テストメモ1/)
                        .expect(/テストメモ2/)
                        .expect(/テスト候補1/)
                        .expect(/テスト候補2/)
                        .expect(/テスト候補3/)
                        .expect(200)
                        .end((err, res) => {
                            if (err) return done(err);
                            // テストで作成したデータを削除
                            const scheduleId = createdSchedulePath.split('/schedules/')[1];
                            Candidate.findAll({
                                where: { scheduleId: scheduleId }
                            }).then(candidates => {
                                const promises = candidates.map(c => {
                                    return c.destroy();
                                });
                                // 配列で渡された全ての Promise が終了した際に結果を返す Promise オブジェクトの作成
                                Promise.all(promises).then(() => {
                                    // モデルに対応するデータを主キーによって一行だけ取得
                                    Schedule.findByPk(scheduleId).then(s => {
                                        s.destroy().then(() => {
                                            if (err) return done(err);
                                            done();
                                        });
                                    });
                                });
                            });
                        });
                });
        });
    });
});
