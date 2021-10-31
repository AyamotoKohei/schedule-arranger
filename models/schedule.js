'use strict';
const {sequelize, DataTypes} = require('./sequelize-loader');

const Schedule = sequelize.define(
    'schedules',
    {
        scheduleId: {
            type: DataTypes.UUID,
            primaryKey: true,
            allowNull: false // NULLを許容しない
        },
        scheduleName: {
            type: DataTypes.STRING,
            allowNull: false // NULLを許容しない
        },
        memo: { // 長さに制限のない文字列として設定
            type: DataTypes.TEXT,
            allowNull: false // NULLを許容しない
        },
        createdBy: {
            type: DataTypes.INTEGER,
            allowNull: false // NULLを許容しない
        },
        updatedAt: {
            type: DataTypes.DATE,
            allowNull: false // NULLを許容しない
        }
    },
    {
        freezeTableName: true,
        timestamps: false,
        indexes: [
            {
                fields: ['createdBy']
            }
        ]
    }
);

module.exports = Schedule;