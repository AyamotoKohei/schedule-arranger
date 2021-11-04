'use strict';
const express = require('express');
const router = express.Router();
const authenticationEnsurer = require('./authentication-ensurer');
const Availability = require('../models/availability');

router.post(
    '/:scheduleId/users/:userId/candidates/:candidateId',
    authenticationEnsurer,
    (req, res, next) => {
        // パスから予定ID、ユーザーID、候補IDを受け取る
        const scheduleId = req.params.scheduleId;
        const userId = req.params.userId;
        const candidateId = req.params.candidateId;

        // availabilityプロパティを受け取る
        let availability = req.body.availability;
        availability = availability ? parseInt(availability) : 0;
        
        // データベースを更新する
        Availability.upsert({
            scheduleId: scheduleId,
            userId: userId,
            candidateId: candidateId,
            availability: availability
        }).then(() => {
            res.json({ status: 'OK', availability: availability });
        });
    }
);