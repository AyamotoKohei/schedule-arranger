'use strict';
const {sequelize, DataTypes} = require('./sequelize-loader');

/**
 * ユーザーのデータモデルの定義
 */
const User = sequelize.define(
    'users',
    {
        userId: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            allowNull: false // NULLを許可しない
        },
        username: {
            type: DataTypes.STRING,
            allowNull: false // NULLを許可しない
        }
    },
    {
        freezeTableName: true, // テーブル名とモデル名を一致させる
        timestamps: false // テーブルにタイムスタンプを表す列を作成しない
    }
);

module.exports = User;