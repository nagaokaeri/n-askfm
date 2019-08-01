const sqlite3 = require("sqlite3");

const db = new sqlite3.Database("db/askfm.sqlite3");
const userTableName = "qa";

module.exports.getInstance = () => {
  return db;
};

module.exports.createTableIfNotExists = async () => {
  return new Promise((resolve, reject) => {
    try {
      db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS "${userTableName}" (
          "id" INTEGER NOT NULL UNIQUE,
          "username" TEXT NOT NULL,
          "question" TEXT NOT NULL,
          "questioner_name" TEXT NOT NULL DEFAULT '',
          "answer" TEXT NOT NULL,
          "answer_time" TEXT DEFAULT NULL,
          PRIMARY KEY("id")
        )`);
      });
      return resolve();
    } catch (err) {
      return reject(err);
    }
  });
};

