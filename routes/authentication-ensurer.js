'use strict';

/**
 * 認証をチェックして、認証されていない場合は /login にリダイレクトする関数
 * @param {Object} req リクエスト
 * @param {Object} res レスポンス
 * @param {Object} next 
 * @returns next()
 */
function ensure(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/login');
}

module.exports = ensure;