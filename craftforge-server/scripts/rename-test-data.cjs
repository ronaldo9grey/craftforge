// 数据库批量改名脚本：把现有英文测试数据替换为中文
// 用法：cd craftforge-server && node scripts/rename-test-data.cjs

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'craftforge.db');
const db = new Database(DB_PATH);

console.log('=== 当前数据 ===');
console.log('\n班级：');
const classes = db.prepare('SELECT id, name, join_code FROM classes').all();
classes.forEach(c => console.log(`  ${c.id} | ${c.name} | ${c.join_code}`));

console.log('\n用户（非 admin）：');
const users = db.prepare(`SELECT id, username, display_name, role, class_id FROM users WHERE role != 'admin' ORDER BY role DESC, created_at ASC`).all();
users.forEach(u => console.log(`  ${u.username} | ${u.display_name} | ${u.role} | class=${u.class_id || '-'}`));

// ============ 中文化映射 ============
// 班级：英文 → 中文常见车间/班组名
const classNameMap = {
  'Class A': '电解一车间 · 一班',
  'Class B': '电解一车间 · 二班',
  'Class C': '电解二车间 · 一班',
  'A班': '电解一车间 · 一班',
  'B班': '电解一车间 · 二班',
};

// 教师名（普通常见姓名）
const teacherNames = ['李建军', '王志强', '刘建华', '陈卫国', '张明伟', '杨晓东'];
// 学生名（普通常见姓名，避免张三李四）
const studentNames = [
  '林浩然', '陈思远', '刘子轩', '赵宇航', '王梓涵',
  '吴文博', '孙启明', '黄子睿', '周天翊', '徐辰昊',
  '马俊豪', '高浩瀚', '何泽楷', '梁博文', '宋睿杰',
  '罗逸飞', '彭奕辰', '郭智渊', '邓昊宇', '丁柏宇',
  '余子谦', '蒋承泽', '韩星宇', '冯子墨', '魏文昊',
  '蔡远帆', '潘思齐', '袁旭阳', '邹建辉', '田一鸣',
];

// ============ 应用更新 ============
console.log('\n=== 开始批量改名 ===\n');

// 1. 班级
const updateClass = db.prepare('UPDATE classes SET name = ? WHERE id = ?');
let classIdx = 0;
const defaultClassPool = [
  '电解一车间 · 一班', '电解一车间 · 二班', '电解二车间 · 一班',
  '电解二车间 · 二班', '阳极车间 · 一班', '铸造车间 · 一班',
];
classes.forEach(c => {
  let newName = classNameMap[c.name];
  if (!newName) {
    // 如果是英文/数字开头判定为英文测试数据，用默认池
    if (/^[A-Za-z]/.test(c.name) || /^[Cc]lass/i.test(c.name)) {
      newName = defaultClassPool[classIdx % defaultClassPool.length];
      classIdx++;
    }
  }
  if (newName && newName !== c.name) {
    updateClass.run(newName, c.id);
    console.log(`  班级: ${c.name}  →  ${newName}`);
  } else {
    console.log(`  班级: ${c.name}  (保持不变 — 已是中文)`);
  }
});

// 2. 教师
const updateUser = db.prepare('UPDATE users SET display_name = ? WHERE id = ?');
let teacherIdx = 0;
const teachers = users.filter(u => u.role === 'teacher');
teachers.forEach(u => {
  // 已是中文则跳过（除了"张三""李四""王五"等明显占位名）
  const isPlaceholder = /^(张三|李四|王五|赵六|test|demo)/i.test(u.display_name);
  const isEnglish = /^[A-Za-z]/.test(u.display_name);
  if (isEnglish || isPlaceholder) {
    const newName = teacherNames[teacherIdx % teacherNames.length];
    teacherIdx++;
    updateUser.run(newName, u.id);
    console.log(`  教师: ${u.display_name}  →  ${newName}`);
  } else {
    console.log(`  教师: ${u.display_name}  (保持不变)`);
  }
});

// 3. 学生
let studentIdx = 0;
const students = users.filter(u => u.role === 'student');
students.forEach(u => {
  const isPlaceholder = /^(张三|李四|王五|赵六|test|demo|学生\d+)/i.test(u.display_name);
  const isEnglish = /^[A-Za-z]/.test(u.display_name);
  if (isEnglish || isPlaceholder) {
    const newName = studentNames[studentIdx % studentNames.length];
    studentIdx++;
    updateUser.run(newName, u.id);
    console.log(`  学生: ${u.display_name}  →  ${newName}`);
  } else {
    console.log(`  学生: ${u.display_name}  (保持不变)`);
  }
});

console.log('\n=== 完成 ===\n');

// 打印更新后的结果
console.log('班级（更新后）：');
db.prepare('SELECT name, join_code FROM classes').all().forEach(c => console.log(`  ${c.name} | ${c.join_code}`));
console.log('\n用户（更新后）：');
db.prepare(`SELECT username, display_name, role FROM users WHERE role != 'admin' ORDER BY role DESC, created_at ASC`).all()
  .forEach(u => console.log(`  ${u.username} | ${u.display_name} | ${u.role}`));

db.close();
console.log('\n✓ 已保存到数据库');
