'use strict';

const express = require('express');
const router = express.Router();
const authenticationEnsurer = require('./authentication-ensurer');
const uuid = require('uuid');
const Schedule = require('../models/schedule'); // 保存する予定のモデル
const Candidate = require('../models/candidate'); // 候補のモデル

router.get('/new', authenticationEnsurer, (req, res, next) => {
    res.render('new', { user: req.user });
});

router.post('/', authenticationEnsurer, (req, res, next) => {
    // 予定IDと更新日時を生成
    const scheduleId = uuid.v4();
    const updatedAt = new Date();

    // 予定をデータベース内に保存するコード
    Schedule.create({
        scheduleId: scheduleId,
        scheduleName: req.body.scheduleName.slice(0, 255) || '（名称未設定）', // 文字列を255文字以内に制限し、空文字列の場合は（名称未設定）にする
        memo: req.body.memo,
        createdBy: req.user.id,
        updatedAt: updatedAt
    }).then((schedule) => { // 予定を保存し終わったら実行される関数
        // 候補日程の配列を取得
        const candidateNames = req.body.candidates.trim().split('\n').map((s) => s.trim()).filter((s) => s !== "");
        
        // 保存すべき候補のオブジェクトの作成
        const candidates = candidateNames.map((c) => { return {
            candidateName: c,
            scheduleId: schedule.scheduleId
        }; });

        // sequelize の複数のオブジェクトを保存する関数を利用して保存する
        Candidate.bulkCreate(candidates).then(() => {
            // /schedules/:scheduleId にリダイレクトされる処理
            res.redirect(`/schedules/${schedule.scheduleId}`);
        });
    });
});

module.exports = router;