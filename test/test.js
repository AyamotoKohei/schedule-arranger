'use strict';

// supertest, passport-stubの読み込みと、テスト対象の読み込み
const request = require('supertest');
const assert = require('assert');
const app = require('../app');
const passportStub = require('passport-stub');
const User = require('../models/user');
const Schedule = require('../models/schedule');
const Candidate = require('../models/candidate');
const Availability = require('../models/availability');
const Comment = require('../models/comment');

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
                        .expect(/テスト予定1/)
                        .expect(/テストメモ1/)
                        .expect(/テストメモ2/)
                        .expect(/テスト候補1/)
                        .expect(/テスト候補2/)
                        .expect(/テスト候補3/)
                        .expect(200)
                        .end((err, res) => { deleteScheduleAggregate(createdSchedulePath.split('/schedules/')[1], done, err); });
                });
        });
    });
});

// 出欠が更新できるかをテストする
describe('/schedules/:scheduleId/users/:userId/candidates/:candidateId', () => {
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

    // /schedules に POST を行い予定と候補を作成
    test('出欠が更新できる', (done) => {
        User.upsert({ userId: 0, username: 'testuser' }).then(() => {
            request(app)
                .post('/schedules')
                .send({ scheduleName: 'テスト出欠更新予定1', memo: 'テスト出欠更新メモ1', candidates: 'テスト出欠更新候補1' })
                // テストで作成した予定と、そこに紐づく情報を削除するメソッドを呼び出す
                .end((err, res) => {
                    const createdSchedulePath = res.headers.location;
                    const scheduleId = createdSchedulePath.split('/schedules/')[1];
                    // 予定に関連する候補を取得し、その候補に対してPOSTでWebAPIに対して欠席を出席に更新する
                    Candidate.findOne({
                        where: { scheduleId: scheduleId }
                    }).then((candidate) => {
                        // 更新されることをテスト
                        const userId = 0;
                        request(app)
                            .post(`/schedules/${scheduleId}/users/${userId}/candidates/${candidate.candidateId}`)
                            .send({ availability: 2 }) // 出席に更新
                            .expect('{"status":"OK","availability":2}') // 含まれているかどうかをテスト
                            .end((err, res) => {
                                Availability.findAll({
                                    where: { scheduleId: scheduleId }
                                }).then((availabilities) => {
                                    assert.strictEqual(availabilities.length, 1);
                                    assert.strictEqual(availabilities[0].availability, 2);
                                    deleteScheduleAggregate(scheduleId, done, err);
                                });
                            });
                    });
                });
        });
    });
});

// コメントをWebAPIを利用して予定のコメントを更新し、更新したコメントを取得できることと、
// データベースに実際に保存されていることをテストする
describe('/schedules/:scheduleId/users/:userId/comments', () => {
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

    test('コメントが更新できる', (done) => {
        User.upsert({ userId: 0, username: 'testuser' }).then(() => {
            request(app)
                .post('/schedules')
                .send({
                    scheduleName: 'テストコメント更新予定',
                    memo: 'テストコメント更新メモ1',
                    candidates: 'テストコメント更新候補1'
                })
                .end((err, res) => {
                    const createdSchedulePath = res.headers.location;
                    const scheduleId = createdSchedulePath.split('/schedules/')[1];
                    // 更新がされることをテスト
                    const userId = 0;
                    request(app)
                        .post(`/schedules/${scheduleId}/users/${userId}/comments`)
                        .send({ comment: 'testcomment' })
                        .expect('{"status":"OK","comment":"testcomment"}')
                        .end((err, res) => {
                            Comment.findAll({
                                where: { scheduleId: scheduleId }
                            }).then((comments) => {
                                assert.strictEqual(comments.length, 1);
                                assert.strictEqual(comments[0].comment, 'testcomment');
                                deleteScheduleAggregate(scheduleId, done, err);
                            });
                        });
                });
        });
    });
});

/**
 * 予定、そこに紐づく出欠・候補を削除する関数
 * @param {Number} scheduleId スケジュールID
 * @param {Object} done done
 * @param {Object} err エラー
 */
function deleteScheduleAggregate(scheduleId, done, err) {
    // 予定に関連するコメントの削除処理
    const promiseCommentDestroy = Comment.findAll({
        where: { scheduleId: scheduleId }
    }).then(comments => {
        return Promise.all(
            comments.map(c => { return c.destroy(); })
        );
    });

    Availability.findAll({
        // 全ての出欠情報を取得
        where: { scheduleId: scheduleId }
    })
        .then((availabilities) => {
            // 全ての出欠情報を削除し、その結果の配列を取得
            const promises = availabilities.map(a => {
                return a.destroy();
            });
            return Promise.all(promises);
        })
        .then(() => {
            return Candidate.findAll({
                // 全ての候補情報を取得
                where: { scheduleId: scheduleId }
            });
        })
        .then(candidates => {
            // 全ての候補情報を削除し、その結果の配列を取得
            const promises = candidates.map(c => {
                return c.destroy();
            });
            promises.push(promiseCommentDestroy);
            return Promise.all(promises);
        })
        .then(() => {
            // 全ての予定情報を取得
            return Schedule.findByPk(scheduleId).then(s => {
                return s.destroy();
            });
        })
        .then(() => {
            // 全ての予定情報を削除し、その結果の配列を取得
            if (err) return done(err);
            done();
        });
}
