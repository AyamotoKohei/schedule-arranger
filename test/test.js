'use strict';

// supertest, passport-stubの読み込みと、テスト対象の読み込み
const request = require('supertest');
const passportStub = require('passport-stub');
const app = require('../app');

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