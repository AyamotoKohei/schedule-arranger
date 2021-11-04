'use strict';
const {sequelize, DataTypes} = require('./sequelize-loader');

/**
 * 候補日程のデータモデルの定義
 */
const Candidate = sequelize.define(
    'candidates',
    {
        candidateId: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false // NULLを許容しない
        },
        candidateName: {
            type: DataTypes.STRING,
            allowNull: false // NULLを許容しない
        },
        scheduleId: {
            type: DataTypes.UUID,
            allowNull: false // NULLを許容しない
        }
    },
    {
        freezeTableName: true,
        timestamps: false,
        indexes: [
            {
                fields: ['scheduleId'] // インデックスを貼る
            }
        ]
    }
);

module.exports = Candidate;
