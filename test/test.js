'use strict';

// supertestの読み込みと、テスト対象の読み込み
const request = require('supertest');
const app = require('../app');

// 以下の内容のテストを行う
// ・レスポンスヘッダの 'Content-Type' が text/html; charset=utf-8 であること
// ・<a href="/auth/github" が HTML に含まれること
// ・ステータスコードが 200 OK で返る
describe('/login', () => {
    test('ログインのためのリンクが含まれる', () => {
        // supertestの記法
        return request(app)
            .get('/login') // /login への GET リクエストを作成
            .expect('Content-Type', 'text/html; charset=utf-8') // 文字列を引数として渡し、ヘッダにその値があるかテストする
            .expect(/<a href="\/auth\/github"/) // HTML の body 内に記述した正規表現が含まれるかテストする
            .expect(200); // テストを終了する際、期待されるステータスコードの整数を渡す
    });
});