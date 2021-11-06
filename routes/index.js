'use strict';

const express = require('express');
const router = express.Router();
const Schedule = require('../models/schedule');

const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
dayjs.extend(utc);
dayjs.extend(timezone);

/* GET home page. */
router.get('/', function(req, res, next) {
  const title = '予定調整くん';
  // 処理全体を認証済みかで振り分ける
  if (req.user) {
    // 条件が合うデータモデルに対応するレコードを全て取得する
    Schedule.findAll({
      where: {
        createdBy: req.user.id // 作成者のユーザーID
      },
      order: [['updatedAt', 'DESC']]
    }).then(schedules => {
      schedules.forEach((schedule) => {
        schedule.formattedUpdatedAt = dayjs(schedule.updatedAt).tz('Asia/Tokyo').format('YYYY/MM/DD HH:mm');
      });
      res.render('index', {
        title: title,
        user: req.user,
        schedules: schedules
      });
    });
  } else {
    res.render('index', { title: title, user: req.user });
  }
});

module.exports = router;
