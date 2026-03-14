require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 2001;
const SALT_ROUNDS = 10;

function parseDatabaseUrl(url) {
  if (!url || !url.startsWith('mysql://')) throw new Error('Invalid DATABASE_URL');
  const match = url.match(/^mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/);
  if (!match) throw new Error('DATABASE_URL format: mysql://user:pass@host:port/db');
  return {
    user: match[1],
    password: match[2],
    host: match[3],
    port: parseInt(match[4], 10),
    database: match[5],
  };
}

let pool;
async function getPool() {
  if (pool) return pool;
  const config = parseDatabaseUrl(process.env.DATABASE_URL);
  pool = mysql.createPool({
    ...config,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });
  await initTable(pool);
  return pool;
}

async function initTable(p) {
  await p.execute(`
    CREATE TABLE IF NOT EXISTS projects (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      version VARCHAR(64) DEFAULT '',
      description VARCHAR(512) DEFAULT '',
      tech VARCHAR(255) DEFAULT '',
      url VARCHAR(512) DEFAULT '',
      login_id VARCHAR(255) DEFAULT '',
      login_pw VARCHAR(255) DEFAULT '',
      status TINYINT(1) DEFAULT 1,
      build TINYINT(1) DEFAULT 1,
      category_id INT NULL,
      group_id INT NULL,
      owner_email VARCHAR(255) DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  try {
    const [cols] = await p.execute(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'projects' AND COLUMN_NAME = 'category_id'"
    );
    if (cols.length === 0) {
      await p.execute('ALTER TABLE projects ADD COLUMN category_id INT NULL');
      await p.execute('ALTER TABLE projects ADD COLUMN group_id INT NULL');
    }
    const [ownerCol] = await p.execute(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'projects' AND COLUMN_NAME = 'owner_email'"
    );
    if (ownerCol.length === 0) {
      await p.execute('ALTER TABLE projects ADD COLUMN owner_email VARCHAR(255) DEFAULT NULL');
      await p.execute("UPDATE projects SET owner_email = 'admin' WHERE owner_email IS NULL");
    }
    const [githubCol] = await p.execute(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'projects' AND COLUMN_NAME = 'github_url'"
    );
    if (githubCol.length === 0) {
      await p.execute('ALTER TABLE projects ADD COLUMN github_url VARCHAR(512) DEFAULT NULL');
    }
    const [etcCol] = await p.execute(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'projects' AND COLUMN_NAME = 'etc'"
    );
    if (etcCol.length === 0) {
      await p.execute('ALTER TABLE projects ADD COLUMN etc VARCHAR(512) DEFAULT NULL');
    }
  } catch (_) {}
  try {
    await p.execute('ALTER TABLE projects ADD COLUMN etc VARCHAR(512) DEFAULT NULL');
  } catch (e) {
    if (e.code !== 'ER_DUP_FIELDNAME' && e.errno !== 1060) throw e;
  }
  const [noteCol] = await p.execute(
    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'projects' AND COLUMN_NAME = 'note'"
  );
  if (noteCol.length === 0) {
    await p.execute('ALTER TABLE projects ADD COLUMN note TEXT DEFAULT NULL');
  }
  await p.execute(`
    CREATE TABLE IF NOT EXISTS \`groups\` (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description VARCHAR(512) DEFAULT '',
      sort_order INT DEFAULT 0,
      parent_id INT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  try {
    const [gCols] = await p.execute(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'groups' AND COLUMN_NAME = 'parent_id'"
    );
    if (gCols.length === 0) await p.execute('ALTER TABLE `groups` ADD COLUMN parent_id INT NULL');
  } catch (_) {}
  await p.execute(`
    CREATE TABLE IF NOT EXISTS categories (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description VARCHAR(512) DEFAULT '',
      sort_order INT DEFAULT 0,
      owner_email VARCHAR(255) DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  try {
    const [ownerCat] = await p.execute(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'categories' AND COLUMN_NAME = 'owner_email'"
    );
    if (ownerCat.length === 0) {
      await p.execute('ALTER TABLE categories ADD COLUMN owner_email VARCHAR(255) DEFAULT NULL');
      await p.execute("UPDATE categories SET owner_email = 'admin' WHERE owner_email IS NULL");
    }
  } catch (_) {}
  const [[{ cnt }]] = await p.execute('SELECT COUNT(*) AS cnt FROM projects');
  if (cnt === 0) {
    await p.execute(
      `INSERT INTO projects (name, version, description, tech, url, login_id, login_pw, status, build) VALUES
       ('dev-list', 'v1.0', '프로젝트 관리 대시보드', 'HTML/CSS/JS', 'http://localhost:2001', 'admin', '111111', 1, 1),
       ('api-gateway', 'v2.1', 'API 게이트웨이', 'Node.js', 'http://localhost:3001', 'gateway', 'gw!456', 1, 1)`
    );
  }
  const [[{ gCnt }]] = await p.execute('SELECT COUNT(*) AS gCnt FROM `groups`');
  if (gCnt === 0) {
    await p.execute(`INSERT INTO \`groups\` (name, description, sort_order) VALUES ('기본그룹', '기본 그룹', 0)`);
  }
  const [[{ cCnt }]] = await p.execute('SELECT COUNT(*) AS cCnt FROM categories');
  if (cCnt === 0) {
    await p.execute(`INSERT INTO categories (name, description, sort_order) VALUES ('기본카테고리', '기본 카테고리', 0)`);
  }

  await p.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      name VARCHAR(255) DEFAULT '',
      reset_token VARCHAR(255) NULL,
      reset_expires DATETIME NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  const [[{ uCnt }]] = await p.execute('SELECT COUNT(*) AS uCnt FROM users');
  if (uCnt === 0) {
    const hash = await bcrypt.hash('111111', SALT_ROUNDS);
    await p.execute('INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)', ['admin', hash, '관리자']);
  }
  try {
    const [cols] = await p.execute(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'reset_token'"
    );
    if (cols.length === 0) {
      await p.execute('ALTER TABLE users ADD COLUMN reset_token VARCHAR(255) NULL');
      await p.execute('ALTER TABLE users ADD COLUMN reset_expires DATETIME NULL');
    }
  } catch (_) {}
}

function getTransporter() {
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  const pass = (process.env.SMTP_PASSWORD || '').replace(/\s/g, '');
  return nodemailer.createTransport({
    host,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: pass || process.env.SMTP_PASSWORD,
    },
  });
}

async function sendMail(to, subject, html) {
  const transport = getTransporter();
  if (!transport) {
    console.warn('SMTP not configured, mail not sent');
    return;
  }
  await transport.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    html,
  });
}

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev-list-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 },
  })
);

function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  res.status(401).json({ error: '로그인이 필요합니다.' });
}

// CORS preflight (OPTIONS) 명시 처리
app.options('/api/projects', (req, res) => res.sendStatus(204));
app.options('/api/projects/:id', (req, res) => res.sendStatus(204));

// 로그인 (이메일 + 비밀번호, users 테이블)
app.post('/api/login', async (req, res) => {
  try {
    const { id, password } = req.body || {};
    if (!id || !password) {
      return res.status(401).json({ error: '아이디와 비밀번호를 입력하세요.' });
    }
    const p = await getPool();
    const [rows] = await p.execute('SELECT id, email, password_hash FROM users WHERE email = ?', [String(id).trim()]);
    if (!rows.length) {
      return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
    }
    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
    }
    req.session.user = user.email;
    res.json({ ok: true, user: user.email });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// 로그아웃
app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

// 로그인 여부
app.get('/api/me', (req, res) => {
  if (req.session && req.session.user) {
    return res.json({ user: req.session.user });
  }
  res.status(401).json({ error: 'Not logged in' });
});

// 회원가입
app.post('/api/register', async (req, res) => {
  try {
    const { email, password, name } = req.body || {};
    const em = (email || '').trim().toLowerCase();
    const pw = password || '';
    if (!em) return res.status(400).json({ error: '이메일을 입력하세요.' });
    if (!pw || pw.length < 4) return res.status(400).json({ error: '비밀번호는 4자 이상이어야 합니다.' });
    const p = await getPool();
    const [existing] = await p.execute('SELECT id FROM users WHERE email = ?', [em]);
    if (existing.length) return res.status(400).json({ error: '이미 사용 중인 이메일입니다.' });
    const password_hash = await bcrypt.hash(pw, SALT_ROUNDS);
    await p.execute('INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)', [em, password_hash, (name || '').trim()]);
    res.status(201).json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// 비밀번호 찾기 (이메일로 재설정 링크 발송)
app.post('/api/forgot-password', async (req, res) => {
  try {
    const { email } = req.body || {};
    const em = (email || '').trim().toLowerCase();
    if (!em) {
      return res.status(400).json({ error: '이메일을 입력하세요.' });
    }
    const p = await getPool();
    const [rows] = await p.execute('SELECT id, email FROM users WHERE email = ?', [em]);
    if (rows.length) {
      const token = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 60 * 60 * 1000); // 1시간
      await p.execute('UPDATE users SET reset_token = ?, reset_expires = ? WHERE id = ?', [token, expires, rows[0].id]);
      const baseUrl = process.env.BASE_URL || (req.protocol + '://' + req.get('host'));
      const resetUrl = baseUrl + '/reset-password.html?token=' + token;
      try {
        await sendMail(
          em,
          '[프로젝트 관리] 비밀번호 재설정',
          `<p>비밀번호 재설정을 요청하셨습니다.</p><p>아래 링크를 클릭하여 새 비밀번호를 설정하세요. (1시간 유효)</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>요청하지 않으셨다면 이 메일을 무시하세요.</p>`
        );
      } catch (mailErr) {
        console.error('비밀번호 재설정 메일 발송 실패:', mailErr);
      }
    }
    res.json({ ok: true, message: '등록된 이메일이 있다면 재설정 링크를 발송했습니다.' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// 비밀번호 재설정 (토큰 + 새 비밀번호)
app.post('/api/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body || {};
    if (!token || !newPassword || newPassword.length < 4) {
      return res.status(400).json({ error: '토큰과 새 비밀번호(4자 이상)를 입력하세요.' });
    }
    const p = await getPool();
    const [rows] = await p.execute('SELECT id FROM users WHERE reset_token = ? AND reset_expires > NOW()', [token]);
    if (!rows.length) {
      return res.status(400).json({ error: '유효하지 않거나 만료된 링크입니다.' });
    }
    const password_hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await p.execute('UPDATE users SET password_hash = ?, reset_token = NULL, reset_expires = NULL WHERE id = ?', [password_hash, rows[0].id]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// 프로젝트 목록 (로그인한 사용자 본인만) ?category_id= 지원, 카테고리로만 구분
app.get('/api/projects', async (req, res) => {
  try {
    const owner = req.session && req.session.user ? req.session.user : null;
    if (!owner) {
      return res.json([]);
    }
    const p = await getPool();
    const categoryId = req.query.category_id;
    let sql = 'SELECT id, name, version, description, tech, url, github_url, etc, note, login_id, login_pw, status, build, category_id FROM projects WHERE owner_email = ?';
    const params = [owner];
    if (categoryId !== undefined && categoryId !== '') {
      sql += ' AND category_id = ?';
      params.push(categoryId);
    }
    sql += ' ORDER BY id DESC';
    const [rows] = await p.execute(sql, params);
    const list = rows.map((r) => ({
      projectId: r.id,
      name: r.name,
      version: r.version || '',
      desc: r.description || '',
      tech: r.tech || '',
      url: r.url || '-',
      github_url: r.github_url || '-',
      etc: r.etc || '-',
      note: r.note || '',
      id: r.login_id || '',
      pw: r.login_pw || '',
      status: !!r.status,
      build: !!r.build,
      category_id: r.category_id || null,
    }));
    res.json(list);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// 프로젝트 추가 (POST /api/projects 또는 /api/projects/)
app.post(['/api/projects', '/api/projects/'], requireAuth, async (req, res) => {
  try {
    const p = await getPool();
    const {
      name,
      version,
      desc,
      tech,
      url,
      github_url,
      etc,
      note,
      login_id,
      login_pw,
      status,
      build,
      category_id,
    } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: '프로젝트명을 입력하세요.' });
    }
    const owner = req.session.user;
    await p.execute(
      `INSERT INTO projects (name, version, description, tech, url, github_url, etc, note, login_id, login_pw, status, build, category_id, group_id, owner_email)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
      [
        (name || '').trim(),
        version || '',
        desc || '',
        tech || '',
        url || '',
        github_url || '',
        etc || '',
        note || null,
        login_id || '',
        login_pw || '',
        status ? 1 : 0,
        build ? 1 : 0,
        category_id || null,
        owner,
      ]
    );
    const [rows] = await p.execute('SELECT LAST_INSERT_ID() AS id');
    res.status(201).json({ ok: true, id: rows[0].id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// 프로젝트 단건 (수정용, 본인 프로젝트만)
app.get('/api/projects/:id', requireAuth, async (req, res) => {
  try {
    const p = await getPool();
    const [rows] = await p.execute('SELECT * FROM projects WHERE id = ? AND owner_email = ?', [req.params.id, req.session.user]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const r = rows[0];
    res.json({
      id: r.id,
      name: r.name,
      version: r.version || '',
      desc: r.description || '',
      tech: r.tech || '',
      url: r.url || '',
      github_url: r.github_url || '',
      etc: r.etc || '',
      note: r.note || '',
      login_id: r.login_id || '',
      login_pw: r.login_pw || '',
      status: !!r.status,
      build: !!r.build,
      category_id: r.category_id || null,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// 프로젝트 수정 (본인 프로젝트만)
app.put('/api/projects/:id', requireAuth, async (req, res) => {
  try {
    const p = await getPool();
    const {
      name,
      version,
      desc,
      tech,
      url,
      github_url,
      etc,
      note,
      login_id,
      login_pw,
      status,
      build,
      category_id,
    } = req.body;
    const [result] = await p.execute(
      `UPDATE projects SET
        name = ?, version = ?, description = ?, tech = ?, url = ?, github_url = ?, etc = ?, note = ?,
        login_id = ?, login_pw = ?, status = ?, build = ?,
        category_id = ?
      WHERE id = ? AND owner_email = ?`,
      [
        name || '',
        version || '',
        desc || '',
        tech || '',
        url || '',
        github_url || '',
        etc || '',
        note || null,
        login_id || '',
        login_pw || '',
        status ? 1 : 0,
        build ? 1 : 0,
        category_id || null,
        req.params.id,
        req.session.user,
      ]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// ---- 카테고리 API (본인이 만든 카테고리만 조회/수정/삭제) -----
app.get('/api/categories', async (req, res) => {
  try {
    const owner = req.session && req.session.user ? req.session.user : null;
    const p = await getPool();
    if (!owner) {
      return res.json([]);
    }
    const [rows] = await p.execute(
      'SELECT id, name, description, sort_order FROM categories WHERE owner_email = ? ORDER BY sort_order, id',
      [owner]
    );
    res.json(rows.map((r) => ({ id: r.id, name: r.name, description: r.description || '', sort_order: r.sort_order || 0 })));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});
app.get('/api/categories/:id', requireAuth, async (req, res) => {
  try {
    const p = await getPool();
    const [rows] = await p.execute('SELECT * FROM categories WHERE id = ? AND owner_email = ?', [req.params.id, req.session.user]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const r = rows[0];
    res.json({ id: r.id, name: r.name, description: r.description || '', sort_order: r.sort_order || 0 });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});
app.post('/api/categories', requireAuth, async (req, res) => {
  try {
    const p = await getPool();
    const { name, description, sort_order } = req.body || {};
    await p.execute('INSERT INTO categories (name, description, sort_order, owner_email) VALUES (?, ?, ?, ?)', [
      name || '',
      description || '',
      sort_order != null ? sort_order : 0,
      req.session.user,
    ]);
    res.status(201).json({ ok: true, id: (await p.execute('SELECT LAST_INSERT_ID() AS id'))[0][0].id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});
app.put('/api/categories/:id', requireAuth, async (req, res) => {
  try {
    const p = await getPool();
    const { name, description, sort_order } = req.body || {};
    const [result] = await p.execute(
      'UPDATE categories SET name = ?, description = ?, sort_order = ? WHERE id = ? AND owner_email = ?',
      [name || '', description || '', sort_order != null ? sort_order : 0, req.params.id, req.session.user]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});
app.delete('/api/categories/:id', requireAuth, async (req, res) => {
  try {
    const p = await getPool();
    const [result] = await p.execute('DELETE FROM categories WHERE id = ? AND owner_email = ?', [req.params.id, req.session.user]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// API 경로인데 매칭된 라우트 없을 때
app.use('/api', (req, res) => res.status(404).json({ error: 'API route not found', path: req.path, method: req.method }));

// SPA 라우팅: /notes 등은 index.html로 서빙
app.get('/notes', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// 정적 파일 (프론트) — jQuery, Summernote는 node_modules에서 /vendor 로 서빙
app.use('/vendor/jquery', express.static(path.join(__dirname, 'node_modules/jquery/dist')));
app.use('/vendor/summernote', express.static(path.join(__dirname, 'node_modules/summernote/dist')));
app.use(express.static(__dirname));

app.listen(PORT, () => {
  console.log(`서버 http://localhost:${PORT} 에서 실행 중 (기본 계정: admin / 111111, 회원가입 가능)`);
});
