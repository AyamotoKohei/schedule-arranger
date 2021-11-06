'use strict';

const express = require('express');
const router = express.Router();
const authenticationEnsurer = require('./authentication-ensurer');
const uuid = require('uuid');
const Schedule = require('../models/schedule'); // 保存する予定のモデル
const Candidate = require('../models/candidate'); // 候補のモデル
const User = require('../models/user'); // ユーザーのモデル
const Availability = require('../models/availability'); // 出欠のモデル
const Comment = require('../models/comment'); // コメントのモデル

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
        const candidates = candidateNames.map((c) => {
            return {
                candidateName: c,
                scheduleId: schedule.scheduleId
            };
        });

        // sequelize の複数のオブジェクトを保存する関数を利用して保存する
        Candidate.bulkCreate(candidates).then(() => {
            // /schedules/:scheduleId にリダイレクトされる処理
            res.redirect('/schedules/' + schedule.scheduleId);
        });
    });
});

router.get('/:scheduleId', authenticationEnsurer, (req, res, next) => {
    let storedSchedule = null;
    let storedCandidates = null;
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
    })
        .then(schedule => {
            // 予定が見つかった場合に、その候補一覧を取得
            if (schedule) {
                storedSchedule = schedule;
                return Candidate.findAll({
                    where: { scheduleId: schedule.scheduleId },
                    order: [['candidateId', 'ASC']] // 候補IDの昇順（作られた順）
                });
            } else {
                // 予定が見つからなかった場合、404 Not Found を表示
                const err = new Error('指定された予定は見つかりません');
                err.status = 404;
                next(err);
            }
        })
        .then(candidates => {
            // データベースからその予定の全ての出欠を取得
            storedCandidates = candidates;
            return Availability.findAll({
                include: [
                    {
                        // ユーザー名をテーブルを結合して取得
                        model: User,
                        attributes: ['userId', 'username']
                    }
                ],
                where: { scheduleId: storedSchedule.scheduleId },
                order: [
                    // ユーザー名の昇順、候補IDの昇順
                    [User, 'username', 'ASC'],
                    ['candidateId', 'ASC']
                ]
            });
        })
        .then(availabilities => {
            // 出欠 MapMap(キー:ユーザー ID, 値:出欠Map(キー:候補 ID, 値:出欠))を作成
            const availabilityMapMap = new Map(); // key: userId, value: Map(key: candidateId, availability)
            availabilities.forEach(a => {
                const map = availabilityMapMap.get(a.user.userId) || new Map();
                map.set(a.candidateId, a.availability);
                availabilityMapMap.set(a.user.userId, map);
            });

            // 閲覧ユーザーと出欠に紐づくユーザーからユーザー Map（キー:ユーザーID, 値:ユーザー）を作る 
            const userMap = new Map(); // key: userId, value: User
            userMap.set(parseInt(req.user.id), {
                isSelf: true, // 閲覧ユーザーであるか
                userId: parseInt(req.user.id),
                username: req.user.username
            });
            availabilities.forEach(a => { // 出欠のデータを1つでも持っていたユーザーをユーザーMapに含める
                userMap.set(a.user.userId, {
                    isSelf: parseInt(req.user.id) === a.user.userId, // 閲覧ユーザー自身であるかを含める
                    userId: a.user.userId,
                    username: a.user.username
                });
            });

            // 全ユーザー、全候補で二重ループしてそれぞれの出欠の値がない場合には、「欠席」を設定する
            const users = Array.from(userMap).map((keyValue) => keyValue[1]);
            users.forEach(u => {
                storedCandidates.forEach(c => {
                    const map = availabilityMapMap.get(u.userId) || new Map();
                    const a = map.get(c.candidateId) || 0; // デフォルト値は 0 を利用
                    map.set(c.candidateId, a);
                    availabilityMapMap.set(u.userId, map);
                });
            });

            // コメント取得
            Comment.findAll({
                where: { scheduleId: storedSchedule.scheduleId }
            }).then((comments) => {
                const commentMap = new Map() // key: userId, value: comment
                comments.forEach(comment => {
                    commentMap.set(comment.userId, comment.comment);
                });
                res.render('schedule', { // テンプレートに必要な変数を設定して、テンプレートを描画
                    user: req.user,
                    schedule: storedSchedule,
                    candidates: storedCandidates,
                    users: users,
                    availabilityMapMap: availabilityMapMap,
                    commentMap: commentMap
                });
            });
        });
});

router.get('/:scheduleId/edit', authenticationEnsurer, (req, res, next) => {
    // 指定された予定IDの予定を取得
    Schedule.findOne({
        where: {
            scheduleId: req.params.scheduleId
        }
    }).then((schedule) => {
        // 自身の予定であるかどうかを判定
        if (isMine(req, schedule)) { // 作成者のみが編集フォームを開ける
            // 候補を取得し、テンプレートを描画
            Candidate.findAll({
                where: { scheduleId: schedule.scheduleId },
                order: [['candidateId', 'ASC']] // 予定IDの昇順で並び替え
            }).then((candidates) => {
                res.render('edit', {
                    user: req.user,
                    schedule: schedule,
                    candidates: candidates
                });
            });
        } else {
            // 予定が自身で作ったものでなかったり、存在しなかったとき
            const err = new Error('指定された予定がない、または、予定する権限がありません');
            err.status = 404;
            next(err);
        }
    });
});

/**
 * リクエストと予定のオブジェクトを受け取り、
 * その予定が自分のものであるかどうかの真偽値を返す関数
 * @param {Object} req リクエスト
 * @param {Object} schedule 予定
 * @returns 真偽値
 */
function isMine(req, schedule) {
    return schedule && parseInt(schedule.createdBy) === parseInt(req.user.id)
}

module.exports = router;
