const fs = require('fs');
const express = require('express');
const router = express.Router();
const request = require('request');
const wechat = require('wechat');
const API = require('wechat-api');
const chineseConv = require('chinese-conv');
const iconv = require('iconv-lite');
const date = require('date-and-time');
const moment = require('moment-timezone');

const log = console.log;
const config = require('../config.js');

// 心知天气
const seniverse = require('../sub_apps/weather/lib/api.js');

// 获取 access_token
const api = new API(config.appid, '7e25c6811a2ae3bf9a66afba5dc16402');
api.getLatestToken((err, token) => {
    if (err == null) {
        log(token);
    } else {
        log(err);
    }
});

// 设置自定义菜单（没有权限欸）
// const wechat_menu = require('../wechat_menu.json');
// const menu = JSON.stringify(wechat_menu);
// api.createMenu(menu, function (err, result) {
//     console.log(result);
// });

// 获取微信服务器IP地址
const group_ips = [];
api.getIp((err, result) => {
    if (err == null) {
        const ip_array = result.ip_list;
        ip_array.map((ip) => {
            const fields = ip.split('.');
            const group_ip = `${fields[0]}.${fields[1]}.${fields[2]}.*`;
            if (!group_ips.includes(group_ip)) {
                group_ips.push(group_ip);
            }
        })
        // log(group_ips);
    } else {
        log(err);
    } 
});

let welcome_msg = '哈喽！杰克船长在此，欢迎打开我的宝箱。如果你想探索更多内容，请访问我的个人网站 https://nichenjie.com/。此公众号为个人订阅号，后端使用 NodeJS 编写，我的初衷是练习 JavaScript 语言并通过调用 API 来实现一些有趣的功能:) enjoy!\n\n';
welcome_msg += '请回复数字选择以下列表中的服务：(回复 q 返回一级菜单，回复 h 调取菜单)\n';
let menu = '彩蛋：试试发一段语音或视频给我呗~\n';
menu += '1 - 获取所有微信服务器 IPv4 地址段\n';
menu += '2 - 城市天气查询\n';
menu += '3 - IP 查询\n';
menu += '4 - 简体中文 → 繁体中文\n';
menu += '5 - 繁体中文 → 简体中文\n';
menu += '6 - 手机号查询\n';
menu += '7 - 设置家的位置\n';
menu += '8 - 查询周围杰克船长喜欢的奶茶铺\n';
menu += '9 - 当地时间查询';


let user_state = {};
let user_home = {};
const WECHAT_SERVER_IP = 1;
const WEATHER_FORECAST = 2;
const IP_LOOKUP = 3;
const S_TO_T = 4;
const T_TO_S = 5;
const TEL_INFO_LOOKUP = 6;
const SET_HOME = 7;
const SEARCH_MILK_TEA = 8;
const LOCAL_TIME_LOOKUP = 9;


// 自动消息回复
router.use('/', wechat(config, wechat.event((message, req, res, next) => {
    log(message);
    if (message.Event === 'subscribe') {
        res.reply(welcome_msg + menu);
    } else {
        res.reply('船长检测到事件 ' + JSON.stringify(message));
    }
}).text((message, req, res, next) => {
	log(message);
    const user = message.FromUserName;
    if (message.Content === 'q' | message.Content === 'Q') {
        delete user_state[user];
        return res.reply('已返回一级菜单\n' + menu);
    }
    if (user in user_state) {
        // 天气预报查询
        if (user_state[user] === WEATHER_FORECAST) {
            if (message.Content === 'ex') {
                const aval_city = ['上海', '北京', '哈尔滨', '烟台'];
                res.reply(aval_city.join('\n'));
            } else {
                const loc = message.Content;
                seniverse.getWeatherNow(loc).then(function(data) {
                    const update_date = new Date(data.results[0].last_update);
                    const date_str = date.format(update_date, 'YYYY/MM/DD HH:mm:ss');
                    let now_str = `最近更新于 ${date_str}\n`;
                    now_str += `${data.results[0].location.name}当前${data.results[0].now.text}，温度${data.results[0].now.temperature}°C.\n`;
                    return now_str;
                }).then(function(now_str) {
                    seniverse.getSuggestion(loc).then(function(data) {
                        let suggestion_str = `天气${data.results[0].suggestion.dressing.brief}，感冒${data.results[0].suggestion.flu.brief}，紫外线强度${data.results[0].suggestion.uv.brief}，${data.results[0].suggestion.car_washing.brief}洗车，${data.results[0].suggestion.sport.brief}运动，${data.results[0].suggestion.travel.brief}旅行。\n`;
                        return now_str + suggestion_str; 
                    }).then(function(comb_str) {
                        seniverse.getWeatherForecast(loc).then(function(data) {
                            let tomorrow_str = `明天上午${data.results[0].daily[1].text_day}，下午至傍晚${data.results[0].daily[1].text_night}，最高温度${data.results[0].daily[1].high}°C，最低温度${data.results[0].daily[1].low}°C，${data.results[0].daily[1].wind_scale}级${data.results[0].daily[1].wind_direction}风，风速${data.results[0].daily[1].wind_speed}km/h.`;
                            res.reply(comb_str + tomorrow_str);
                        }).catch(function(err) {
                            return Promise.reject(err);
                        });
                    }).catch(function(err) {
                        return Promise.reject(err);
                    });
                }).catch(function(err) {
                    res.reply('抱歉，未找到有关该城市的天气信息');
                });
            }
        } 
        // IP 查询
        else if (user_state[user] === IP_LOOKUP) {
            const query_ip = message.Content;
            new Promise((resolve, reject) => {
                request(`https://api.ttt.sh/ip/qqwry/${query_ip}`, { json: true }, (err, res, body) => {
                    if (err) return reject(err);
                    console.log(body);
                    if (body.code === 0) {
                        reject(body.error);
                    } else {
                        resolve(body.address);
                    }
                });
            }).then((address) => {
                res.reply(address);
            }).catch((err) => {
                log(err);
                res.reply(err);
            })
        }
        // 简体中文 → 繁体中文
        else if (user_state[user] === S_TO_T) {
            const query_token = message.Content;
            const result = chineseConv.tify(query_token);
            res.reply(result);
        }
        // 繁体中文 → 简体中文
        else if (user_state[user] === T_TO_S) {
            const query_token = message.Content;
            const result = chineseConv.sify(query_token);
            res.reply(result);
        }
        // 手机号查询
        else if (user_state[user] === TEL_INFO_LOOKUP) {
            const query_tel = message.Content;
            new Promise((resolve, reject) => {
                request({url: `https://tcc.taobao.com/cc/json/mobile_tel_segment.htm?tel=${query_tel}`, encoding: null}, (err, res, body) => {
                    if (err) return reject(err);
                    if (!err && res.statusCode == 200) {
                        body = iconv.decode(body, 'GBK');
                    }
                    const length = body.length;
                    let s = body.substring(19, length);
                    s = s.replace(/([a-zA-Z0-9-]+):'([a-zA-Z0-9\u4E00-\u9FCC]+)'/g, "\"$1\":\"$2\"");
                    resolve(JSON.parse(s));
                });
            }).then((obj) => {
                if (Object.keys(obj).length === 0) {
                    res.reply('暂无该手机号信息');
                } else {
                    res.reply(obj.carrier);
                }
            }).catch((err) => {
                log(err);
                res.reply('查询出错');
            })
        }
        // 时间查询
        else if (user_state[user] === LOCAL_TIME_LOOKUP) {
            const cur = moment().format('YYYY/MM/DD HH:mm:ss UTCZ');
            const first_line = `当前服务器时间为：${cur}\n`;
            const loc = message.Content;
            seniverse.getCityInfo(loc).then(function(data) {
                const ret_time = moment().tz(data.results[0].timezone).format('YYYY/MM/DD HH:mm:ss');
                const second_line = `${data.results[0].name}时间为：${ret_time}`;
                res.reply(first_line + second_line);
            }).catch(function(err) {
                res.reply('抱歉，未查询到当地时间信息');
            });
        }

    } else {
        switch(message.Content) {
            case '雨婷':
                res.reply('么么哒！');
                break;
            case 'q':
                delete user_state[user];
                res.reply('已返回一级菜单\n' + menu);
                break;
            case 'Q':
                delete user_state[user];
                res.reply('已返回一级菜单\n' + menu);
                break;
            case 'h':
                res.reply(menu);
                break;
            case 'H':
                res.reply(menu);
                break;
            case 'l':
                res.reply(menu);
                break;
            case '0':
                res.reply('直接发送语音即可');
                break;
            case WECHAT_SERVER_IP.toString():
                if (group_ips.length === 0) {
                    res.reply('暂无微信服务器 IPv4 地址信息');
                } else {
                    res.reply(group_ips.join('\n'));
                }
                break;
            case WEATHER_FORECAST.toString():
                user_state[user] = WEATHER_FORECAST;
                res.reply('请输入你想查询的城市名称：（输入 ex 查看一些示例城市）');
                break;
            case IP_LOOKUP.toString():
                user_state[user] = IP_LOOKUP;
                res.reply('请输入你想查询的 IP 地址：');
                break;
            case S_TO_T.toString():
                user_state[user] = S_TO_T;
                res.reply('请输入你想转换的简体中文：');
                break;
            case T_TO_S.toString():
                user_state[user] = T_TO_S;
                res.reply('请输入你想转换的繁体中文：');
                break;
            case TEL_INFO_LOOKUP.toString():
                user_state[user] = TEL_INFO_LOOKUP;
                res.reply('请输入你想查询的手机号：');
                break;
            case SET_HOME.toString():
                user_home[user] = null;
                res.reply('请发送您家的定位：');
                break;
            case SEARCH_MILK_TEA.toString():
                if (!(user in user_home)) {
                    res.reply(`请先回复数字 ${SET_HOME} 设置家的位置`);
                } else {
                    res.reply('请发送您当前的定位：');
                }
                break;
            case LOCAL_TIME_LOOKUP.toString():
                user_state[user] = LOCAL_TIME_LOOKUP;
                res.reply('请输入你想查询的城市名称：');
                break;
            default:
                res.reply('杰克不理解你在说什么，请重新输入。' + '回复 q 返回一级菜单，回复 h 调取菜单。\n' + menu);
        }
    }
}).image((message, req, res, next) => {
	log(message);
	res.reply({
        content: JSON.stringify(message),
        type: 'text'
    });
}).voice((message, req, res, next) => {
    // 语音转文字
	log(message);
	res.reply(message.Recognition);
}).video((message, req, res, next) => {
	log(message);
	res.reply('好色情喔，杰克船长不喜欢很污的视频(⇀‸↼‶)');
}).location((message, req, res, next) => {
    // 测距并推荐附近奶茶
	log(message);
    const user = message.FromUserName;
    if (!(user in user_home)) {
        return res.reply(`请先回复数字 ${SET_HOME} 设置家的位置`);
    } else if (user_home[user] === null) {
        user_home[user] = `${message.Location_Y},${message.Location_X}`;
        return res.reply('家的位置信息已记录，我们将保护您的个人隐私。');
    }
    new Promise((resolve, reject) => {
        request(`https://restapi.amap.com/v3/distance?origins=${message.Location_Y},${message.Location_X}&destination=${user_home[user]}&type=1&key=1b37f6f0c6aef20cd211623d27ebf48d`, (err, res, body) => {
            if (err) return reject(err);
            resolve(JSON.parse(body).results[0].distance);
        });
    }).then((distance) => {
        new Promise((resolve, reject) => {
            const uri = `https://restapi.amap.com/v3/place/around?key=1b37f6f0c6aef20cd211623d27ebf48d&location=${message.Location_Y},${message.Location_X}&keywords=星巴克|1点点|快乐柠檬|CoCo都可茶饮&types=咖啡厅|冷饮店&radius=500&offset=10&page=1&extensions=base`;
            request(encodeURI(uri), (err, res, body) => {
                if (err) return reject(err);
                resolve(JSON.parse(body));
            });
        }).then((suggestions) => {
            const num_res = suggestions.pois.length;
            if (num_res === 0) {
                res.reply(`您当前位置打车回家约 ${distance} 米，距您五百米内未找到任何星巴克、1点点、快乐柠檬、CoCo都可茶饮门店。`);
            } else {
                const head_str = `您当前位置打车回家约 ${distance} 米，距您五百米内共发现 ${num_res} 家杰克船长喜欢的奶茶铺。\n`;
                let body_str = '';
                suggestions.pois.map((store, index) => {
                    body_str += `${index+1}. ${store.name}，具体地址为${store.address}，距您 ${store.distance} 米。\n`;
                });
                res.reply(head_str + body_str.trim());
            }
        }).catch((err) => {
            return Promise.reject(err);
        })
    }).catch((err) => {
        log(err);
        res.reply('距离计算出错');
    })
}).shortvideo((message, req, res, next) => {
    log(message);
    res.reply({
        content: '抱歉，杰克船长的个人订阅号暂不支持短视频内容。',
        type: 'text'
    });
}).link((message, req, res, next) => {
	log(message);
	res.reply({
        content: '抱歉，杰克船长的个人订阅号暂不支持链接内容。',
        type: 'text'
    });
}).device_text((message, req, res, next) => {
	log(message);
	res.reply({
        content: '抱歉，杰克船长的个人订阅号暂不支持设备文本消息内容。',
        type: 'text'
    });
}).device_event((message, req, res, next) => {
	log(message);
	res.reply({
        content: '抱歉，杰克船长的个人订阅号暂不支持设备事件内容。',
        type: 'text'
    });
})));

module.exports = router;
