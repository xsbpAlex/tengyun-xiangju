// M0 接口联调测试：注册 → 登录 → me → 存读档 → 异常分支
const BASE = 'http://localhost:3001';
let pass = 0, fail = 0;
const check = (name, ok, extra = '') => {
  if (ok) pass++; else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  -> ' + extra : ''}`);
};

const name = 't' + (Date.now() % 1e9);

// 1. 注册
let r = await fetch(BASE + '/api/auth/register', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: name, password: '123456' }),
});
let d = await r.json();
check('注册新账号', r.status === 200 && !!d.token, `status=${r.status}`);
const token = d.token;

// 2. 重复注册应 409
r = await fetch(BASE + '/api/auth/register', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: name, password: '123456' }),
});
check('重复注册被拒', r.status === 409, `status=${r.status}`);

// 3. 错误密码应 401
r = await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: name, password: 'wrong-pass' }),
});
check('错误口令被拒', r.status === 401, `status=${r.status}`);

// 4. 登录
r = await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: name, password: '123456' }),
});
d = await r.json();
check('登录成功', r.status === 200 && !!d.token);
const auth = { Authorization: `Bearer ${token}` };

// 5. me
r = await fetch(BASE + '/api/auth/me', { headers: auth });
d = await r.json();
check('me 返回账号信息', r.status === 200 && d.username === name);

// 6. 初始存档应为 null
r = await fetch(BASE + '/api/save', { headers: auth });
d = await r.json();
check('初始存档为 null', r.status === 200 && d === null);

// 7. 写存档
r = await fetch(BASE + '/api/save', {
  method: 'PUT', headers: { 'Content-Type': 'application/json', ...auth },
  body: JSON.stringify({ payload: { clockIns: 1, lastClockInAt: Date.now() } }),
});
d = await r.json();
check('写入权威存档', r.status === 200 && d.ok === true);

// 8. 读存档
r = await fetch(BASE + '/api/save', { headers: auth });
d = await r.json();
check('读回存档一致', r.status === 200 && d?.payload?.clockIns === 1);

// 9. 无 token 访问应 401
r = await fetch(BASE + '/api/save');
check('未登录访问被拒', r.status === 401, `status=${r.status}`);

// 10. 注销后 token 失效
r = await fetch(BASE + '/api/auth/logout', { method: 'POST', headers: auth });
check('注销成功', r.status === 200);
r = await fetch(BASE + '/api/save', { headers: auth });
check('注销后 token 失效', r.status === 401, `status=${r.status}`);

console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
