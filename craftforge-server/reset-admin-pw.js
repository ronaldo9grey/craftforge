// 紧急工具：直接重置 admin 密码到指定值
// 用法：node reset-admin-pw.js <新密码>
// 例：node reset-admin-pw.js "ADMIN0632#"

const path = require('path');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const newPw = process.argv[2];
if (!newPw) {
  console.error('用法: node reset-admin-pw.js "你的新密码"');
  process.exit(1);
}

const dbPath = path.resolve(__dirname, 'data', 'craftforge.db');
console.log('打开数据库:', dbPath);
const db = new Database(dbPath);

const admin = db.prepare("SELECT id, username, role, must_change_pw FROM users WHERE username = 'admin'").get();
if (!admin) {
  console.error('❌ 数据库中找不到 admin 账号');
  process.exit(2);
}
console.log('当前 admin 行:', admin);

const hash = bcrypt.hashSync(newPw, 10);
const result = db
  .prepare("UPDATE users SET password_hash = ?, must_change_pw = 0 WHERE username = 'admin'")
  .run(hash);

console.log('✅ 已重置 admin 密码，影响行数:', result.changes);
console.log('   新密码:', newPw);
console.log('   must_change_pw = 0（不会再被强制改密）');

// 顺手清空 token 黑名单，防止历史 token 异常
db.prepare('DELETE FROM session_blacklist').run();
console.log('已清空 session_blacklist');

db.close();
