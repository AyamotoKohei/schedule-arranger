'use strict';
const {sequelize, DataTypes} = require('./sequelize-loader');

/**
 * コメントのデータモデルの実装
 */
const Comment = sequelize.define(
    'comments',
    {
        scheduleId: {
            type: DataTypes.UUID,
            primaryKey: true,
            allowNull: false // NULLを許容しない
        },
        userId: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            allowNull: false // NULLを許容しない
        },
        comment: {
            type: DataTypes.STRING,
            allowNull: false // NULLを許容しない
        }
    },
    {
        freezeTableName: true,
        timestamps: false // NULLを許容しない
    }
);

module.exports = Comment;