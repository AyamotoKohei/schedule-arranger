'use strict';
const {sequelize, DataTypes} = require('./sequelize-loader');

/**
 * 出欠のデータモデルの定義
 */
const Availability = sequelize.define(
    'availabilites',
    {
        candidateId: { // 主キーとして設定
            type: DataTypes.INTEGER,
            primaryKey: true,
            allowNull: false // NULLを許容しない
        },
        userId: { // 主キーとして設定
            type: DataTypes.INTEGER,
            primaryKey: true,
            allowNull: false // NULLを許容しない
        },
        availability: {
            type: DataTypes.INTEGER,
            allowNull: false, // NULLを許容しない
            defaultValue: 0
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

module.exports = Availability;
