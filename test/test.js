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
const deleteScheduleAggregate = require('../routes/schedules').deleteScheduleAggregate;

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

// 予定が編集できることのテストを行う
describe('/schedules/:scheduleId?edit=1', () => {
    beforeAll(() => {
        passportStub.install(app);
        passportStub.login({ id: 0, username: 'testuser' });
    });

    afterAll(() => {
        passportStub.logout();
        passportStub.uninstall(app);
    });

    test('予定が更新でき、候補が追加できる', (done) => {
        // テストを行う為の予定の作成
        User.upsert({ userId: 0, username: 'testuser' }).then(() => {
            request(app)
                .post('/schedules')
                .send({ scheduleName: 'テスト更新予定1', memo: 'テスト更新メモ1', candidates: 'テスト更新候補1' })
                .end((err, res) => {
                    const createdSchedulePath = res.headers.location;
                    const scheduleId = createdSchedulePath.split('/schedules/')[1];
                    // 更新がされることをテスト
                    request(app)
                        // 更新処理
                        .post(`/schedules/${scheduleId}?edit=1`)
                        .send({ scheduleName: 'テスト更新予定2', memo: 'テスト更新メモ2', candidates: 'テスト更新候補2' })
                        .end((err, res) => {
                            // 予定が更新されたかをテスト
                            Schedule.findByPk(scheduleId).then((s) => {
                                assert.strictEqual(s.scheduleName, 'テスト更新予定2');
                                assert.strictEqual(s.memo, 'テスト更新メモ2');
                            });
                            // 候補が追加されたかをテスト
                            Candidate.findAll({
                                where: { scheduleId: scheduleId },
                                order: [['candidateId', 'ASC']]
                            }).then((candidates) => {
                                assert.strictEqual(candidates.length, 2);
                                assert.strictEqual(candidates[0].candidateName, 'テスト更新候補1');
                                assert.strictEqual(candidates[1].candidateName, 'テスト更新候補2');
                                // テストで作成された情報を削除
                                deleteScheduleAggregate(scheduleId, done, err);
                            });
                        });
                });
        });
    });
});

// 予定に関する全ての情報が削除できることをテストする
describe('/schedules/:scheduleId?delete=1', () => {
    beforeAll(() => {
        passportStub.install(app);
        passportStub.login({ id: 0, username: 'testuser' })
    });

    afterAll(() => {
        passportStub.logout();
        passportStub.uninstall(app);
    });

    test('予定に関連する全ての情報が削除できる', done => {
        User.upsert({ userId: 0, username: 'testuser' }).then(() => {
            request(app)
                .post('/schedules')
                .send({
                    scheduleName: 'テスト更新予定1',
                    memo: 'テスト更新メモ1',
                    candidates: 'テスト更新候補1'
                })
                .end((err, res) => {
                    const createdSchedulePath = res.headers.location;
                    const scheduleId = createdSchedulePath.split('/schedules/')[1];

                    // 出欠作成
                    const promiseAvailability = Candidate.findOne({
                        where: { scheduleId: scheduleId }
                    }).then(candidate => {
                        return new Promise(resolve => {
                            const userId = 0;
                            request(app)
                                .post(`/schedules/${scheduleId}/users/${userId}/candidates/${candidate.candidateId}`)
                                .send({ availability: 2 }) // 出席に更新
                                .end((err, res) => {
                                    if (err) done(err);
                                    resolve();
                                });
                        });
                    })

                    // コメント作成
                    const promiseComment = new Promise(resolve => {
                        const userId = 0;
                        request(app)
                            .post(`/schedules/${scheduleId}/users/${userId}/comments`)
                            .send({ comment: 'testcomment' })
                            .expect('{"status":"OK","comment":"testcomment"}')
                            .end((err, res) => {
                                if (err) done(err);
                                resolve();
                            });
                    });

                    // 削除
                    const promiseDeleted = Promise.all([
                        promiseAvailability,
                        promiseComment
                    ]).then(() => {
                        return new Promise(resolve => {
                            request(app)
                                .post(`/schedules/${scheduleId}?delete=1`)
                                .end((err, res) => {
                                    if (err) done(err);
                                    resolve();
                                });
                        });
                    });

                    // テスト
                    promiseDeleted.then(() => {
                        const p1 = Comment.findAll({
                            where: { scheduleId: scheduleId }
                        }).then(comments => {
                            assert.strictEqual(comments.length, 0);
                        });
                        const p2 = Availability.findAll({
                            where: { scheduleId: scheduleId }
                        }).then(availabilities => {
                            assert.strictEqual(availabilities.length, 0);
                        });
                        const p3 = Candidate.findAll({
                            where: { scheduleId: scheduleId }
                        }).then(candidates => {
                            assert.strictEqual(candidates.length, 0);
                        });
                        const p4 = Schedule.findByPk(scheduleId).then(schedule => {
                            assert.strictEqual(!schedule, true);
                        });
                        Promise.all([p1, p2, p3, p4]).then(() => {
                            if (err) return done(err);
                            done();
                        });
                    });
                });
        });
    });
})