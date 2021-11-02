'use strict';

const express = require('express');
const router = express.Router();
const authenticationEnsurer = require('./authentication-ensurer');
const uuid = require('uuid');
const Schedule = require('../models/schedule'); // 保存する予定のモデル
const Candidate = require('../models/candidate'); // 候補のモデル
const User = require('../models/user'); // ユーザーのモデル
const Availability = require('../models/availability'); // 出欠のモデル

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
            res.redirect('/schedules/' + schedule.scheduleId);
        });
    });
});

router.get('/:scheduleId', authenticationEnsurer, (req, res, next) => {
    // sequelize を利用してテーブルを結合してユーザーを取得
    Schedule.findOne({ // データモデルに対応するデータを一行だけ取得
        include: [
            {
                model: User,
                attributes: ['userId', 'username']
            }
        ],
        where: {
            scheduleId: req.params.scheduleId
        },
        order: [['updatedAt', 'DESC']] // 予定の更新日時の降順
    }).then((schedule) => { 
        // 予定が見つかった場合に、その候補一覧を取得
        if (schedule) {
            Candidate.findAll({
                where: { scheduleId: schedule.scheduleId },
                order: [['candidateId', 'ASC']] // 候補IDの昇順（作られた順）
            }).then((candidates) => {
                // データベースからその予定の全ての出欠を取得
                Availability.findAll({
                    include: [
                        {
                            // ユーザー名をテーブルを結合して取得
                            model: User,
                            attributes: ['userId', 'username']
                        }
                    ],
                    where: { scheduleId: schedule.scheduleId }, 
                    order: [[User, 'username', 'ASC'], ['candidateId', 'ASC']] // ユーザー名の昇順、候補IDの昇順
                }).then((availabilies) => {
                    // 出欠 MapMap(キー:ユーザー ID, 値:出欠Map(キー:候補 ID, 値:出欠))を作成
                    const availabilityMapMap = new Map(); // key: userId, value: Map(key: candidateId, availability)
                    const map = availabilityMapMap.get(a.user.userId) || new Map();
                    map.set(a.candidateId, a.availability);
                    availabilityMapMap.set(a.user.userId, map);
                });

                console.log(availabilityMapMap);

                // テンプレートに必要な変数を設定して、テンプレートを描画
                res.render('schedule', {
                    user: req.user,
                    schedule: schedule,
                    candidates: candidates,
                    users: [req.user],
                    availabilityMapMap: availabilityMapMap
                });
            });
        } else {
            // 予定が見つからなかった場合、404 Not Found を表示
            const err = new Error('指定された予定は見つかりません');
            err.status = 404;
            next(err);
        }
    });
});

module.exports = router;
