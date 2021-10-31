'use strict';
const {sequelize, DataTypes} = require('./sequelize-loader');

const Candidate = sequelize.define(
    'candidates',
    {
        candidateId:{
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true, // インデックスを貼る
            allowNull: false // NULLを許容しない
        },
        canditateName:{
            type: DataTypes.INTEGER,
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
                fields: ['scheduleId']
            }
        ]
    }
);

module.exports = Candidate;
