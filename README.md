# schedule-arranger

## 詳細
N予備校の「【2021年度】プログラミング入門」の4章で開発したWebサイトの『予定調整くん』です。
GitHubアカウントを知っている仲間内で予定を決定する際に用いることを想定しています。

## URL(Herokuで公開)
https://agile-brook-47504.herokuapp.com/

## 学習期間
2021年10月31日〜2021年11月7日

## バージョン
### Docker
```
$ docker -v
Docker version 20.10.8, build 3967b7d
```
### Node.js
```
$ node -v
v14.15.4
```

### yarn
```
$ yarn -v
1.22.5
```

## 開発環境の実行方法、及び終了方法
+ 実行
```
$ pwd
/Users/AyamotoKohei/schedule-arranger

$ mkdir ../schedule-arranger-data

$ docker-compose up -d

$ docker-compose exec app bash

$ yarn install

$ PORT=8000 yarn start
```

+ 実行終了
```
$ exit

$ docker-compose down
```
