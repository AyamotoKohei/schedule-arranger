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
const csrf = require('csurf');
const csrfProtection = csrf({ cookie: true });

router.get('/new', authenticationEnsurer, csrfProtection, (req, res, next) => {
    res.render('new', { user: req.user, csrfToken: req.csrfToken() });
});

router.post('/', authenticationEnsurer, csrfProtection, (req, res, next) => {
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
        createCandidatesAndRedirect(parseCandidateNames(req), scheduleId, res);
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

router.get('/:scheduleId/edit', authenticationEnsurer, csrfProtection, (req, res, next) => {
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
                    candidates: candidates,
                    csrfToken: req.csrfToken()
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

router.post('/:scheduleId', authenticationEnsurer, csrfProtection, (req, res, next) => {
    // 予定IDで予定を取得
    Schedule.findOne({
        where: {
            scheduleId: req.params.scheduleId
        }
    }).then((schedule) => {
        // リクエストの送信者が作成者であるかどうかを確認
        if (schedule && isMine(req, schedule)) {
            // edit=1 のクエリがある時のみ更新を行う
            if (parseInt(req.query.edit) === 1) {
                const updatedAt = new Date();
                // 更新処理
                schedule.update({
                    scheduleId: schedule.scheduleId,
                    scheduleName: req.body.scheduleName.slice(0, 255) || '（名称未設定）',
                    memo: req.body.memo,
                    createdBy: req.user.id,
                    updatedAt: updatedAt
                }).then((schedule) => {
                    // 追加されているかチェック
                    const candidateNames = parseCandidateNames(req);
                    if (candidateNames) {
                        // 候補を追加してリダイレクト
                        createCandidatesAndRedirect(candidateNames, schedule.scheduleId, res);
                    } else {
                        // 何もせずリダイレクト
                        res.redirect('/schedules/' + schedule.scheduleId);
                    }
                });
            } else if (parseInt(req.query.delete) === 1) {
                deleteScheduleAggregate(req.params.scheduleId, () => {
                    // 削除処理実行後、'/'にリダイレクト
                    res.redirect('/');
                });
            } else { // edit=1 以外のクエリが渡された際
                const err = new Error('不正なリクエストです');
                err.status = 400;
                next(err);
            }
        } else { // 予定が見つからない場合や自分自身の予定ではない場合の処理
            const err = new Error('指定された予定がない、または、編集する権限がありません');
            err.status = 404;
            next(err);
        }
    })
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
        return Promise.all(comments.map(c => { return c.destroy(); }));
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

// 公開関数として設定
router.deleteScheduleAggregate = deleteScheduleAggregate;

/**
 * 候補の作成とリダイレクトを行う関数
 * @param {Object} candidateNames 候補日程の配列
 * @param {Object} scheduleId 予定ID
 * @param {Object} res レスポンス
 */
function createCandidatesAndRedirect(candidateNames, scheduleId, res) {
    // 保存すべき候補のオブジェクトの作成
    const candidates = candidateNames.map((c) => {
        return {
            candidateName: c,
            scheduleId: scheduleId
        };
    });
    // sequelize の複数のオブジェクトを保存する関数を利用して保存する
    Candidate.bulkCreate(candidates).then(() => {
        // /schedules/:scheduleId にリダイレクトされる処理
        res.redirect('/schedules/' + scheduleId);
    });
}

/**
 * 予定名の配列をパースする処理を行う関数
 * @param {Object} req リクエスト
 * @returns 予定名の配列
 */
function parseCandidateNames(req) {
    return req.body.candidates.trim().split('\n').map((s) => s.trim()).filter((s) => s !== "");
}

module.exports = router;
