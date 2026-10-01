/* =========================================================
   学习打卡追踪器 —— 逻辑层
   数据存在浏览器 localStorage 里，刷新页面不会丢。
   ========================================================= */

const STORAGE_KEY = 'study-tracker.records.v1';

/* ---------- 1. 读写本地数据 ---------- */

function loadRecords() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (err) {
    console.warn('本地数据损坏，已重置。', err);
    return [];
  }
}

function saveRecords(records) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

/* ---------- 2. 工具函数 ---------- */

// 把 Date 转成 "2026-10-01" 这种格式
function toDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function today() {
  return toDateString(new Date());
}

// 防止用户输入的内容被当成 HTML 执行
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ---------- 3. 统计 ---------- */

// 从最近一次打卡往回数，连续了多少天
function calcStreak(records) {
  const dates = [...new Set(records.map(function (r) { return r.date; }))]
    .sort()
    .reverse();

  if (dates.length === 0) return 0;

  const oneDay = 24 * 60 * 60 * 1000;
  const todayStr = today();
  const yesterdayStr = toDateString(new Date(Date.now() - oneDay));

  // 最近一次打卡既不是今天也不是昨天 → 已经断了
  if (dates[0] !== todayStr && dates[0] !== yesterdayStr) return 0;

  let streak = 1;
  let cursor = new Date(dates[0] + 'T00:00:00');

  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i] + 'T00:00:00');
    const diffDays = Math.round((cursor - prev) / oneDay);
    if (diffDays === 1) {
      streak++;
      cursor = prev;
    } else {
      break;
    }
  }
  return streak;
}

/* ---------- 4. 抓取页面元素 ---------- */

const listEl        = document.getElementById('record-list');
const emptyHintEl   = document.getElementById('empty-hint');
const countEl       = document.getElementById('record-count');
const statTotalEl   = document.getElementById('stat-total');
const statStreakEl  = document.getElementById('stat-streak');
const statMinutesEl = document.getElementById('stat-minutes');
const statTodayEl   = document.getElementById('stat-today');

const formEl         = document.getElementById('record-form');
const dateInput      = document.getElementById('input-date');
const contentInput   = document.getElementById('input-content');
const durationInput  = document.getElementById('input-duration');
const errorEl        = document.getElementById('form-error');

/* ---------- 5. 渲染 ---------- */

function render(records) {
  // 日期新的排前面；同一天里后添加的排前面
  const sorted = [...records].sort(function (a, b) {
    if (a.date === b.date) return b.createdAt - a.createdAt;
    return a.date < b.date ? 1 : -1;
  });

  listEl.innerHTML = sorted.map(function (r) {
    return `
      <li class="record-item" data-id="${r.id}">
        <div class="record-main">
          <span class="record-date">${escapeHtml(r.date)}</span>
          <span class="record-content">${escapeHtml(r.content)}</span>
        </div>
        <div class="record-side">
          <span class="record-duration">${Number(r.duration)} 分钟</span>
          <button type="button" class="btn-delete" data-action="delete"
                  aria-label="删除这条记录">删除</button>
        </div>
      </li>`;
  }).join('');

  emptyHintEl.hidden = sorted.length > 0;
  countEl.textContent = sorted.length + ' 条';

  statTotalEl.textContent   = sorted.length;
  statStreakEl.textContent  = calcStreak(records);
  statMinutesEl.textContent = records.reduce(function (sum, r) {
    return sum + Number(r.duration || 0);
  }, 0);
  statTodayEl.textContent   = records.some(function (r) {
    return r.date === today();
  }) ? '已打卡' : '未打卡';
}

/* ---------- 6. 事件 ---------- */

let records = loadRecords();

// 添加记录
formEl.addEventListener('submit', function (event) {
  event.preventDefault();

  const date     = dateInput.value;
  const content  = contentInput.value.trim();
  const duration = Number(durationInput.value);

  if (!date || !content || !duration) {
    showError('三项都要填哦。');
    return;
  }
  if (duration <= 0) {
    showError('时长要大于 0。');
    return;
  }

  records.push({
    id: String(Date.now()) + Math.random().toString(16).slice(2, 6),
    date: date,
    content: content,
    duration: duration,
    createdAt: Date.now(),
  });

  saveRecords(records);
  render(records);

  contentInput.value = '';
  durationInput.value = '';
  contentInput.focus();
  hideError();
});

// 删除记录（事件委托：一个监听器管所有删除按钮）
listEl.addEventListener('click', function (event) {
  const btn = event.target.closest('[data-action="delete"]');
  if (!btn) return;

  const item = btn.closest('.record-item');
  const id = item.dataset.id;

  records = records.filter(function (r) { return r.id !== id; });
  saveRecords(records);
  render(records);
});

function showError(msg) {
  errorEl.textContent = msg;
  errorEl.hidden = false;
}

function hideError() {
  errorEl.hidden = true;
}

/* ---------- 7. 启动 ---------- */

dateInput.value = today();
render(records);
