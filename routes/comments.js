'use strict';
const express = require('express');
const router = express.Router();
const authenticationEnsurer = require('./authentication-ensurer');
const Comment = require('../models/comment');

router.post(
    '/:scheduleId/users/:userId/comments',
    authenticationEnsurer,
    (req, res, next) => {
        // 予定ID、ユーザーID、コメントを受け取る
        const scheduleId = req.params.scheduleId;
        const userId = req.params.userId;
        const comment = req.body.comment;

        // データベースを更新
        Comment.upsert({
            scheduleId: scheduleId,
            userId: userId,
            comment: comment.slice(0, 255) // 255文字以内になるように切り取り
        }).then(() => {
            res.json({ status: 'OK', comment: comment });
        });
    }
)

module.exports = router;
