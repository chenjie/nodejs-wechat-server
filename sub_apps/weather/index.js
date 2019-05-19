
const UID = "U4F9843B0C"; // 测试用 用户ID，请更换成您自己的用户ID
const KEY = "ffgq5vtwtbrzclwk"; // 测试用 key，请更换成您自己的 Key
const LOCATION = "上海"; // 除拼音外，还可以使用 v3 id、汉语等形式

const API = require('./lib/api.js')
const argv = require('optimist').default('l', LOCATION).argv;

const seniverse_api = new API(UID, KEY);
api.getWeatherNow(argv.l).then(function(data) {
  console.log(JSON.stringify(data, null, 4));
}).catch(function(err) {
  console.log(err.error.status);
});

module.exports = seniverse_api;