const client = require('cheerio-httpcli');
const database = require('./database');

const doHelp = () => {
  console.warn('Usage:');
  console.warn('    node askfm.js show [username] [limit]');
  console.warn('    node askfm.js fetch [username]');
  console.warn('    node askfm.js help');
};

const doShow = async ({username, limit}) => {
  await database.createTableIfNotExists();
  const db = database.getInstance();
  return new Promise((resolve, reject) => {
    const counter = {};
    db.serialize(() => {
      db.all(`select username, count(*) as cnt from qa group by username`,
        (err, rows) => {
          if (err) return reject(err);
          rows.forEach(row => {
            counter[ row["username"] ] = Number( row["cnt"] );
          });
          return resolve(counter);
        });
    });
  }).then((counter) => {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.all(`select id,username,question,answer from qa where username = '${username}' order by id desc limit ${limit}`,
          (err, rows) => {
            if (err) return reject(err);
            let num = counter[username] || 0;
            rows.forEach(row => {
              console.log("----");
              console.log(num);
              console.log('');
              num--;
              console.log(row['question']);
              console.log('');
              console.log(row['answer']);
              console.log('');
              const url = `http://ask.fm/${row['username']}/answer/${row['id']}`;
              console.log(url);
            });
            return resolve();
        });
      });
    });
  });
};

const doFetch = async (username) => {

  const fetchData = async ({page, item_page_next}) => {
    console.log(page, item_page_next);
    var param = {'no_prev_link':'true'};
    if (item_page_next != 0) param["older"] = item_page_next;
    const result = await client.fetch('https://ask.fm/' + username + '', param);
    const $ = result.$;
    const next_url = $("a.item-page-next").attr("href");
    console.log(next_url);
    const questionBox = $(".streamItem-answer");
    const lastAnswerTimeHere = await parseData($, questionBox);
    if (next_url != null) {
      const next = parseInt( next_url.split("older=")[1], 10 );
      await new Promise((resolve) => { setTimeout(() => { resolve(); }, 10000); });
      await fetchData({
        page: page + 1,
        item_page_next: next
      });
    }
  };

  await fetchData({
    page: 0,
    item_page_next: 0
  });
};

const parseData = async ($, questionBox) => {
  const params = [];
  questionBox.each(function(){
    var v = $(this);
    var questioner_name = v.find(".author_username").text().trim();
    var answer = "";
    v.find(".streamItem_content").each(function(i,v){ if (answer.length > 0) answer += "\n\n"; answer += $(v).html().replace(/<br *\/?>/g,"\n").trim();});
    answer = answer.replace(/<p class="streamItemContent streamItemContent-answer">\s*?<\/p>/g,"\n\n");
    answer = answer.replace(/<p class="readMore">\s*<a class="button" data-action="ReadMore" href="#">View more<\/a>\s*<\/p>/g,'');
    answer = answer.trim();
    var url         = v.find("a.counter").attr("href").trim();
    var answer_time = v.find(".streamItem_details > a").attr("title").trim();
    var username = url.split("/")[1];
    var id = url.split("/")[3];
    var $question = v.find(".streamItem_header");
    $question.find(".author").remove();
    var question = $question.text().trim();
    var param = {
      id: id,
      username: username,
      question: question,
      questioner_name: questioner_name,
      answer: answer,
      answer_time: fuckingParseDate(answer_time) / 1000
    };
    params.push(param);
  });
  await Promise.all(
    params.map((param) => { return storeData(param); })
  );
};

const storeData = async (param) => {
  console.log(param);
  await database.createTableIfNotExists();
  const db = database.getInstance();
  return new Promise((resolve, reject) => {
    db.run(`REPLACE INTO qa (id, username, question, questioner_name, answer, answer_time) VALUES
      ($id, $username, $question, $questioner_name, $answer, date($answer_time))`,
      param.id,
      param.username,
      param.question,
      param.questioner_name,
      param.answer,
      param.answer_time
      );
    return resolve();
  });
};

const getMM = function(s) {
  s = s.trim();
  if (s == '一月'   || s == '1月'  || s.startsWith('Jan')) return "01";
  if (s == '二月'   || s == '2月'  || s.startsWith('Feb')) return "02";
  if (s == '三月'   || s == '3月'  || s.startsWith('Mar')) return "03";
  if (s == '四月'   || s == '4月'  || s.startsWith('Apr')) return "04";
  if (s == '五月'   || s == '5月'  || s.startsWith('May')) return "05";
  if (s == '六月'   || s == '6月'  || s.startsWith('Jun')) return "06";
  if (s == '七月'   || s == '7月'  || s.startsWith('Jul')) return "07";
  if (s == '八月'   || s == '8月'  || s.startsWith('Aug')) return "08";
  if (s == '九月'   || s == '9月'  || s.startsWith('Sep')) return "09";
  if (s == '十月'   || s == '10月' || s.startsWith('Oct')) return "10";
  if (s == '十一月' || s == '11月' || s.startsWith('Nov')) return "11";
  if (s == '十二月' || s == '12月' || s.startsWith('Dec')) return "12";
  return null;
};

const getHHmmss = function(s) {
  var ss = s.trim().split(":");
  return ("00"+ss[0]).slice(-2)+":"+("00"+ss[1]).slice(-2)+":"+("00"+ss[2]).slice(-2);
};

const fuckingParseDate = function(s) {
  // s === "七月 9, 2015  12:34:56 GMT"
  // s === "7月 9, 2015  12:34:56 GMT"
  var tokens = s.split(/[ ,]+/);
  var MM = getMM(tokens[0]);
  var dd = ("00" + tokens[1].trim()).slice(-2);
  var yyyy = tokens[2].trim();
  var HHmmss = getHHmmss(tokens[3]);
  var tz = tokens[4];
  if (tz !== 'GMT') {
    throw new Error("failed to date parse!");
  } else {
    var ds = yyyy + "-" + MM + "-" + dd + "T" + HHmmss + "Z";
    var timestamp = Date.parse(ds);
    return timestamp;
  }
};

//=========
// utils
//=========
if (!String.prototype.startsWith) {
  String.prototype.startsWith = function(searchString, position) {
    position = position || 0;
    return this.lastIndexOf(searchString, position) === position;
  };
}

//=============
// MAIN
//=============

if (process.argv.length <= 2) {
  doHelp();
  process.exit(1);
}

const subcommand = process.argv[2];
if (subcommand === 'show') {

  const username = process.argv[3];
  if (!username || username !== 'nervnerun') {
    console.log("invalid username");
    process.exit(1);
  }
  const limit = Number(process.argv[4]) || 5;

  doShow({username, limit})
    .then(() => {
      process.exit(0);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
} else if (subcommand === 'fetch') {

  const username = process.argv[3];
  if (!username || username !== 'nervnerun') {
    console.log("invalid username");
    process.exit(1);
  }

  doFetch(username)
    .then(() => {
      process.exit(0);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
} else if (subcommand === 'help') {
  doHelp();
  process.exit(0);
} else {
  doHelp();
  process.exit(1);
}
