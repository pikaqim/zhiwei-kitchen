/* app.js — 路由、视图与交互 */
(function () {
  'use strict';

  var S = STORE.load();

  /* ---------- 常量 ---------- */
  var SHOTS_TPL = [
    { d: 7, act: '蛋液入锅，边缘滋滋起泡、慢慢凝固', cap: '第1步 · 打散的蛋液下锅' },
    { d: 8, act: '中火快速翻炒，蛋液刚刚凝固就盛出', cap: '第2步 · 炒至刚凝固盛出' },
    { d: 9, act: '番茄块下锅炒出红亮汤汁', cap: '第3步 · 番茄炒出汁' },
    { d: 8, act: '鸡蛋回锅翻匀，撒葱花出锅', cap: '第4步 · 回锅翻匀出锅' }
  ];
  var CG = [['#ff9a62', '#e0492c'], ['#ffd66b', '#e8962f'], ['#f2a9c4', '#d96fa0'], ['#a4d883', '#4c8f3f'], ['#93c8ea', '#4a7fb5'], ['#e9cba2', '#b07a3f']];
  var E_COVER = ['🍅', '🍳', '🥘', '🥗'];
  var E_STEP = ['🥚', '🍳', '🍅'];
  var STMAP = { SUCCESS: ['成功', 'ok'], RUNNING: ['生成中', 'r'], QUEUED: ['排队中', 'q'], STITCH: ['拼接字幕', 's'], FAILED: ['失败', 'bad'] };
  var HEATS = ['无需', '小火', '中火', '大火'];

  /* 编辑器内的临时状态（不持久化） */
  var ui = { imgTgt: 'cover', imgStyle: 'photo', imgRatio: '34', imgCount: 4, imgBusy: false, cands: null, shots: null, vidBusy: false, editorTab: 'img', homeSrc: 'all', homeCat: 'all', homeQ: '', detailTab: 'steps', videoTab: 'ai', uploadBusy: false, parseBusy: false };

  /* ---------- 小工具 ---------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }
  function rby(id) { for (var i = 0; i < S.recipes.length; i++) if (S.recipes[i].id === id) return S.recipes[i]; return null; }
  function fmtT(sec) { var m = Math.floor(sec / 60), x = Math.round(sec % 60); return m + ':' + (x < 10 ? '0' : '') + x; }
  function fmtMs(ms) { return ms == null ? '—' : (ms >= 60000 ? (ms / 60000).toFixed(1) + ' 分' : (ms / 1000).toFixed(1) + ' s'); }
  function persist() { STORE.save(S); }
  function toast(msg, kind) {
    var t = document.createElement('div');
    t.className = 'toast' + (kind ? ' ' + kind : '');
    t.textContent = msg;
    $('#toast-root').appendChild(t);
    setTimeout(function () { t.remove(); }, 2600);
  }
  function updateQuotaChips() {
    $('#q-img').textContent = S.quotas.img;
    $('#q-vid').textContent = S.quotas.vid;
    $('#q-parse').textContent = S.quotas.parse;
  }
  function hasVideo(r) { return !!(r.videos.ai || r.videos.user); }
  function badgeHtml(src) {
    return src === 'ai' ? '<span class="badge ai">AI 生成</span>' : '<span class="badge user">用户实拍</span>';
  }
  function tileHtml(r, big) {
    return '<span class="' + (big ? 'ctile' : 'rtile') + '" style="background:' + r.g + '">' +
      '<span class="remoji">' + r.emoji + '</span>' + badgeHtml(r.src) +
      (hasVideo(r) ? '<span class="vdot">▶ 视频</span>' : '') + '</span>';
  }
  function icon(name) { return '<i data-lucide="' + name + '" aria-hidden="true"></i>'; }
  function icons() {
    if (window.lucide && lucide.createIcons) { try { lucide.createIcons({ attrs: { width: 16, height: 16 } }); } catch (e) { } }
  }

  /* 刷新中断的视频任务：页面重载后未完成任务标记失败并返还配额（演示失败处理路径） */
  (function resumeInterrupted() {
    if (!S.video) { S.video = null; return; }
    if (S.video.phase === 'SUCCESS') return;
    for (var i = 0; i < S.tasks.length; i++) {
      var t = S.tasks[i];
      if (t.type === '生视频' && t.st !== 'SUCCESS' && t.st !== 'FAILED') { t.st = 'FAILED'; break; }
    }
    SVC.refund(S, 'vid', 1);
    S.video = null;
    persist();
    setTimeout(function () { toast('检测到未完成的视频任务，已标记失败并返还 1 次视频配额'); }, 400);
  })();
  if (S.upload && S.upload.phase !== 'idle' && S.upload.phase !== 'READY') { S.upload = { phase: 'idle', pct: 0 }; persist(); }

  /* ---------- 路由 ---------- */
  function parseHash() {
    var h = location.hash.replace(/^#\/?/, '');
    var q = {};
    var qi = h.indexOf('?');
    if (qi >= 0) {
      h.slice(qi + 1).split('&').forEach(function (kv) {
        var p = kv.split('='); q[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || '');
      });
      h = h.slice(0, qi);
    }
    var parts = h.split('/').filter(Boolean);
    return { view: parts[0] || 'home', param: parts[1] || null, q: q };
  }
  function go(hash) { location.hash = hash; }
  window.addEventListener('hashchange', render);

  /* ---------- 渲染入口 ---------- */
  function render() {
    var r = parseHash();
    updateQuotaChips();
    $$('.nav-btn[data-view],.bn-item[data-view]').forEach(function (b) {
      var on = b.dataset.view === r.view || (r.view === 'recipe' && b.dataset.view === 'home') || (r.view === 'editor' && b.dataset.view === 'home');
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    var app = $('#app');
    if (r.view === 'home') { document.title = '知味厨房 · 智能电子菜谱'; renderHome(app); }
    else if (r.view === 'recipe' && rby(r.param)) { renderRecipe(app, rby(r.param)); }
    else if (r.view === 'editor' && rby(r.param)) { renderEditor(app, rby(r.param), r.q); }
    else if (r.view === 'upload') { renderUpload(app); }
    else if (r.view === 'tasks') { renderTasks(app); }
    else { location.hash = '#/home'; return; }
    icons();
    window.scrollTo(0, 0);
  }

  /* ================= 首页 ================= */
  function renderHome(app) {
    app.innerHTML =
      '<section class="view on" id="view-home">' +
      '  <div class="searchrow">' +
      '    <input id="search-input" type="search" placeholder="搜索菜名或食材，如：番茄" aria-label="搜索菜谱" value="' + esc(ui.homeQ) + '">' +
      '    <a class="pb" href="#/editor/r1">' + icon('plus') + '新建菜谱</a>' +
      '  </div>' +
      '  <div class="fchips" role="group" aria-label="按来源筛选">' +
      '    <button class="fchip" data-src="all">全部</button>' +
      '    <button class="fchip" data-src="ai">AI 生成</button>' +
      '    <button class="fchip" data-src="user">用户实拍</button>' +
      '  </div>' +
      '  <div class="fchips" role="group" aria-label="按菜系筛选">' +
      '    <button class="fchip" data-cat="all">全部菜系</button>' +
      '    <button class="fchip" data-cat="家常菜">家常菜</button>' +
      '    <button class="fchip" data-cat="汤羹">汤羹</button>' +
      '    <button class="fchip" data-cat="烘焙">烘焙</button>' +
      '    <button class="fchip" data-cat="西餐">西餐</button>' +
      '  </div>' +
      '  <div class="grid" id="home-cards"></div>' +
      '</section>';
    $$('.fchip[data-src]').forEach(function (c) { c.setAttribute('aria-pressed', c.dataset.src === ui.homeSrc ? 'true' : 'false'); });
    $$('.fchip[data-cat]').forEach(function (c) { c.setAttribute('aria-pressed', c.dataset.cat === ui.homeCat ? 'true' : 'false'); });
    renderHomeCards();
    $('#search-input').addEventListener('input', function () { ui.homeQ = this.value.trim(); renderHomeCards(); });
    $$('.fchip[data-src]').forEach(function (c) { c.addEventListener('click', function () { ui.homeSrc = c.dataset.src; renderHome(app); }); });
    $$('.fchip[data-cat]').forEach(function (c) { c.addEventListener('click', function () { ui.homeCat = c.dataset.cat; renderHome(app); }); });
  }
  function renderHomeCards() {
    var list = S.recipes.filter(function (r) {
      if (ui.homeSrc !== 'all' && r.src !== ui.homeSrc) return false;
      if (ui.homeCat !== 'all' && r.cat !== ui.homeCat) return false;
      if (ui.homeQ && r.title.indexOf(ui.homeQ) < 0 && !r.ing.some(function (x) { return x[0].indexOf(ui.homeQ) >= 0; })) return false;
      return true;
    });
    $('#home-cards').innerHTML = list.length ? list.map(function (r) {
      return '<a class="rcard" href="#/recipe/' + r.id + '">' + tileHtml(r) +
        '<span class="rtitle">' + esc(r.title) + '</span>' +
        '<span class="rmeta">难度' + r.diff + ' · ' + r.mins + ' 分钟 · ' + esc(r.cat) + '</span></a>';
    }).join('') : '<div class="empty">没有符合条件的菜谱</div>';
  }

  /* ================= 菜谱详情 ================= */
  function renderRecipe(app, r) {
    document.title = r.title + ' · 知味厨房';
    if ((ui.detailTab === 'video') && !hasVideo(r)) ui.detailTab = 'steps';
    app.innerHTML =
      '<section class="view on" id="view-detail">' +
      '  <div class="backrow"><a class="backbtn" href="#/home">' + icon('arrow-left') + '返回首页</a></div>' +
      '  <div class="hero">' +
      '    <div class="ctile-wrap">' + tileHtml(r, true) + '</div>' +
      '    <div class="hinfo">' +
      '      <h2>' + esc(r.title) + '</h2>' +
      '      <div class="badges" id="d-badges"></div>' +
      '      <div class="mchips"><span class="mchip">难度 ' + '★'.repeat(r.diff) + '</span><span class="mchip">⏱ ' + r.mins + ' 分钟</span><span class="mchip">' + r.serv + ' 人份</span><span class="mchip">' + esc(r.cat) + '</span></div>' +
      '      <p class="muted">' + esc(r.intro) + '</p>' +
      '      <div class="hact">' +
      '        <button class="sb" id="btn-fav">' + icon('heart') + (r.fav ? '已收藏' : '收藏') + '</button>' +
      '        <a class="pb" href="#/editor/' + r.id + '">' + icon('pencil') + '编辑此菜谱</a>' +
      '        <a class="sb" href="#/editor/' + r.id + '?tab=video">' + icon('clapperboard') + 'AI 生成视频</a>' +
      '      </div>' +
      '    </div>' +
      '  </div>' +
      '  <div class="tabsrow" role="tablist" aria-label="菜谱内容">' +
      '    <button class="tabbtn" id="dt-steps" role="tab" aria-controls="dtp-steps" aria-selected="' + (ui.detailTab === 'steps') + '">图文步骤</button>' +
      '    <button class="tabbtn" id="dt-video" role="tab" aria-controls="dtp-video" aria-selected="' + (ui.detailTab === 'video') + '">视频</button>' +
      '  </div>' +
      '  <div id="dtp-steps" role="tabpanel" aria-labelledby="dt-steps" ' + (ui.detailTab === 'steps' ? '' : 'hidden') + '>' +
      '    <ol class="steps" id="d-steps"></ol>' +
      '    <div class="tipbox"><b style="font-weight:500">💡 小贴士：</b>' + esc(r.tip) + '</div>' +
      '    <p class="disclaim">※ AI 生成内容仅供参考演示，实际烹饪请遵循食品安全常识。</p>' +
      '  </div>' +
      '  <div id="dtp-video" role="tabpanel" aria-labelledby="dt-video" ' + (ui.detailTab === 'video' ? '' : 'hidden') + '>' +
      '    <div class="subpills" role="group" aria-label="视频来源">' +
      '      <button class="spillb" id="vt-ai" aria-pressed="' + (ui.videoTab === 'ai') + '">AI 演示</button>' +
      '      <button class="spillb" id="vt-user" aria-pressed="' + (ui.videoTab === 'user') + '">用户实拍</button>' +
      '    </div>' +
      '    <div id="video-area" aria-live="polite"></div>' +
      '  </div>' +
      '</section>';
    var b = r.src === 'ai'
      ? '<span class="binline ai">' + icon('sparkles') + 'AI 生成菜谱</span>'
      : '<span class="binline user">' + icon('badge-check') + '用户实拍菜谱</span>';
    if (r.videos.ai) b += '<span class="binline ai">' + icon('clapperboard') + 'AI 演示视频 ' + r.videos.ai.dur + '</span>';
    if (r.videos.user) b += '<span class="binline user">' + icon('video') + '实拍视频 ' + r.videos.user.dur + '</span>';
    $('#d-badges').innerHTML = b;
    renderDetailSteps(r);
    renderVideoArea(r);
    $('#dt-steps').addEventListener('click', function () { ui.detailTab = 'steps'; renderRecipe(app, r); });
    $('#dt-video').addEventListener('click', function () { ui.detailTab = 'video'; renderRecipe(app, r); });
    $('#vt-ai').addEventListener('click', function () { ui.videoTab = 'ai'; renderRecipe(app, r); });
    $('#vt-user').addEventListener('click', function () { ui.videoTab = 'user'; renderRecipe(app, r); });
    $('#btn-fav').addEventListener('click', function () {
      r.fav = !r.fav; persist();
      this.innerHTML = icon('heart') + (r.fav ? '已收藏' : '收藏');
      toast(r.fav ? '已加入收藏' : '已取消收藏'); icons();
    });
  }
  function stepImgHtml(img, stepIdx) {
    if (img) {
      var g = img.b === 'ai' ? 'linear-gradient(135deg,#f2a9c4,#d96fa0)' : 'linear-gradient(135deg,#e9cba2,#b07a3f)';
      return '<span class="stile" style="background:' + g + '">' + img.e +
        '<span class="badge ' + (img.b === 'ai' ? 'ai' : 'user') + '">' + (img.b === 'ai' ? 'AI' : '实拍') + '</span></span>';
    }
    return '<a class="simg-empty" href="#/editor/' + S.currentDetailId + '?tab=img&target=steps" data-tooltip="去编辑器整批生成步骤图">＋<br>生成配图</a>';
  }
  function renderDetailSteps(r) {
    S.currentDetailId = r.id;
    $('#d-steps').innerHTML = r.steps.map(function (s, i) {
      return '<li><span class="sno">' + (i + 1) + '</span>' + stepImgHtml(s.img, i) +
        '<div class="sbody">' + esc(s.t) + '<br><span class="heat">火候 · ' + s.h + '</span></div></li>';
    }).join('');
  }
  function renderVideoArea(r) {
    stopPlay();
    var box = $('#video-area');
    if (!box) return;
    var v = ui.videoTab === 'ai' ? r.videos.ai : r.videos.user;
    if (!v) {
      box.innerHTML = '<div class="vempty"><div style="font-size:36px;margin-bottom:8px">' + (ui.videoTab === 'ai' ? '🎬' : '📹') + '</div>还没有' + (ui.videoTab === 'ai' ? 'AI 演示视频' : '实拍视频') +
        '<div style="margin-top:14px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap">' +
        (ui.videoTab === 'ai'
          ? '<a class="pb" href="#/editor/' + r.id + '?tab=video">' + icon('sparkles') + '去生成 AI 视频</a>'
          : '<a class="pb" href="#/upload">' + icon('upload') + '去上传实拍视频</a>') +
        '</div></div>';
      icons();
      return;
    }
    var isAI = ui.videoTab === 'ai';
    var totalSec = isAI ? 32 : 72;
    var caps = isAI ? (ui.shots || SHOTS_TPL).map(function (s) { return s.cap; })
      : ['实拍 · 起锅烧油', '实拍 · 下料翻炒', '实拍 · 出锅装盘'];
    var g = isAI ? 'linear-gradient(135deg,#2b2440,#4a3a6b)' : 'linear-gradient(135deg,#3f3a2e,#6b5a3a)';
    box.innerHTML = '<div class="player" id="player" data-total="' + totalSec + '">' +
      '<div class="pv" style="background:' + g + '">' +
      '  <span class="pemoji">' + (isAI ? '🎬' : '📹') + '</span>' +
      '  <span class="badge wm">' + (isAI ? 'AI 生成' : '用户实拍') + '</span>' +
      '  <button class="pbtn" id="btn-play" aria-label="播放/暂停">' + icon('play') + '</button>' +
      '  <div class="pcap" id="pcap">' + esc(caps[0]) + '</div>' +
      '  <div class="pbar"><div class="pfill" id="pfill"></div></div>' +
      '  <span class="ptime tnum" id="ptime">0:00 / ' + fmtT(totalSec) + '</span>' +
      '</div>' +
      '<p class="small muted" style="margin-top:8px">' + (isAI ? '由菜谱步骤自动生成的演示视频，非实拍。' : '上传者：我 · 已通过机审') + '</p></div>';
    player.caps = caps;
    $('#btn-play').addEventListener('click', togglePlay);
    icons();
  }
  var player = { timer: null, t: 0, caps: [] };
  function togglePlay() {
    var pl = $('#player');
    if (!pl) return;
    if (player.timer) { stopPlay(); return; }
    var total = +pl.dataset.total;
    player.t = 0; player.caps = player.caps || [];
    player.timer = setInterval(function () {
      player.t += total / 100;
      if (player.t >= total) { stopPlay(); return; }
      var fill = $('#pfill'), tm = $('#ptime'), cap = $('#pcap');
      if (!fill) { stopPlay(); return; }
      fill.style.width = (player.t / total * 100) + '%';
      tm.textContent = fmtT(player.t) + ' / ' + fmtT(total);
      var ci = Math.min(player.caps.length - 1, Math.floor(player.t / total * player.caps.length));
      cap.textContent = player.caps[ci];
    }, 100);
    $('#btn-play').innerHTML = icon('pause'); icons();
  }
  function stopPlay() {
    if (player.timer) { clearInterval(player.timer); player.timer = null; }
    var fill = $('#pfill');
    if (fill) {
      fill.style.width = '0%';
      $('#ptime').textContent = '0:00 / ' + fmtT(+$('#player').dataset.total);
      $('#btn-play').innerHTML = icon('play'); icons();
    }
  }

  /* ================= 编辑器 ================= */
  function renderEditor(app, r, q) {
    document.title = '编辑 · ' + r.title + ' · 知味厨房';
    if (q.tab === 'video') ui.editorTab = 'vid'; else if (q.tab === 'img') ui.editorTab = 'img';
    if (q.target === 'steps') ui.imgTgt = 'steps';
    app.innerHTML =
      '<section class="view on" id="view-editor">' +
      '  <div class="backrow"><a class="backbtn" href="#/recipe/' + r.id + '">' + icon('arrow-left') + '返回菜谱</a></div>' +
      '  <div class="egrid">' +
      '    <div class="panel">' +
      '      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">' +
      '        <h3>菜谱编辑器</h3>' +
      '        <button class="sb" id="btn-parse-open" style="margin-left:auto">' + icon('sparkles') + '智能解析文本</button>' +
      '      </div>' +
      '      <div class="frow">' +
      '        <div style="grid-column:1/-1"><label class="flab" for="f-title">菜名</label><input class="fullw" id="f-title" value="' + esc(r.title) + '"></div>' +
      '        <div style="grid-column:1/-1"><label class="flab" for="f-intro">简介</label><input class="fullw" id="f-intro" value="' + esc(r.intro) + '"></div>' +
      '        <div><label class="flab" for="f-diff">难度 (1-5)</label><input id="f-diff" type="number" min="1" max="5" value="' + r.diff + '"></div>' +
      '        <div><label class="flab" for="f-mins">时长 (分钟)</label><input id="f-mins" type="number" min="1" value="' + r.mins + '"></div>' +
      '        <div><label class="flab" for="f-serv">份量 (人份)</label><input id="f-serv" type="number" min="1" value="' + r.serv + '"></div>' +
      '        <div><label class="flab" for="f-cuisine">菜系</label><select id="f-cuisine">' + ['家常菜', '汤羹', '烘焙', '西餐', '其他'].map(function (c) { return '<option' + (r.cat === c ? ' selected' : '') + '>' + c + '</option>'; }).join('') + '</select></div>' +
      '      </div>' +
      '      <div class="secgap"><h3>食材</h3><div id="ing-list"></div><button class="addrow" id="btn-add-ing">' + icon('plus') + '添加食材</button></div>' +
      '      <div class="secgap"><h3>步骤</h3><div id="step-list"></div><button class="addrow" id="btn-add-step">' + icon('plus') + '添加步骤</button></div>' +
      '      <div class="secgap"><label class="flab" for="f-tip">小贴士</label><input class="fullw" id="f-tip" value="' + esc(r.tip) + '"></div>' +
      '      <div class="edact">' +
      '        <button class="sb" id="btn-save">保存草稿</button>' +
      '        <button class="pb" id="btn-publish">发布菜谱</button>' +
      '        <span class="small muted" style="align-self:center">修改即时保存到本地</span>' +
      '      </div>' +
      '    </div>' +
      '    <aside class="panel">' +
      '      <h3>AI 生成 <span class="proto-tag" style="margin-left:6px">模拟服务</span></h3>' +
      '      <div class="gptabs" role="tablist" aria-label="生成类型">' +
      '        <button class="gpill" id="gt-img" role="tab" aria-selected="' + (ui.editorTab === 'img') + '" aria-controls="gp-img">菜谱图</button>' +
      '        <button class="gpill" id="gt-vid" role="tab" aria-selected="' + (ui.editorTab === 'vid') + '" aria-controls="gp-vid">烹饪视频</button>' +
      '      </div>' +
      '      <div id="gp-img" role="tabpanel" aria-labelledby="gt-img" ' + (ui.editorTab === 'img' ? '' : 'hidden') + '>' +
      '        <span class="flab">生成对象</span>' +
      '        <div class="pillset" role="group" aria-label="生成对象">' +
      '          <button class="spill" data-tgt="cover" aria-pressed="' + (ui.imgTgt === 'cover') + '">封面图</button>' +
      '          <button class="spill" data-tgt="steps" aria-pressed="' + (ui.imgTgt === 'steps') + '">步骤图（整批）</button>' +
      '        </div>' +
      '        <span class="flab">风格</span>' +
      '        <div class="pillset" role="group" aria-label="生成风格">' +
      '          <button class="spill" data-style="photo" aria-pressed="' + (ui.imgStyle === 'photo') + '">真实摄影</button>' +
      '          <button class="spill" data-style="illu" aria-pressed="' + (ui.imgStyle === 'illu') + '">插画</button>' +
      '          <button class="spill" data-style="sketch" aria-pressed="' + (ui.imgStyle === 'sketch') + '">简笔画</button>' +
      '        </div>' +
      '        <div id="cover-opts" ' + (ui.imgTgt === 'cover' ? '' : 'hidden') + '>' +
      '          <span class="flab">画幅与数量</span>' +
      '          <div class="pillset" role="group" aria-label="画幅">' +
      '            <button class="spill" data-ratio="34" aria-pressed="' + (ui.imgRatio === '34') + '">3:4</button>' +
      '            <button class="spill" data-ratio="11" aria-pressed="' + (ui.imgRatio === '11') + '">1:1</button>' +
      '          </div>' +
      '          <select id="img-count" aria-label="生成张数">' +
      '            <option value="4"' + (ui.imgCount === 4 ? ' selected' : '') + '>一次 4 张候选</option>' +
      '            <option value="2"' + (ui.imgCount === 2 ? ' selected' : '') + '>一次 2 张候选</option>' +
      '            <option value="1"' + (ui.imgCount === 1 ? ' selected' : '') + '>一次 1 张</option>' +
      '          </select>' +
      '        </div>' +
      '        <div class="costhint">' + icon('coins') + '<span id="img-cost-hint"></span></div>' +
      '        <button class="pb" id="btn-gen-img" style="width:100%;justify-content:center">' + icon('sparkles') + '生成</button>' +
      '        <div class="cands" id="cand-area" aria-live="polite"></div>' +
      '        <button class="sb" id="btn-adopt-all" style="display:none;width:100%;justify-content:center;margin-top:10px">全部采用到对应步骤</button>' +
      '      </div>' +
      '      <div id="gp-vid" role="tabpanel" aria-labelledby="gt-vid" ' + (ui.editorTab === 'vid' ? '' : 'hidden') + '>' +
      '        <div id="script-empty" ' + ((ui.shots || S.video) ? 'hidden' : '') + '>' +
      '          <p class="muted small" style="margin-bottom:10px">先用大模型把步骤改写为分镜脚本（可编辑），确认后提交生成 30–60 秒演示视频。</p>' +
      '          <button class="pb" id="btn-gen-script" style="width:100%;justify-content:center">' + icon('sparkles') + '生成分镜脚本</button>' +
      '        </div>' +
      '        <div id="script-box" ' + ((ui.shots && !S.video) ? '' : 'hidden') + '>' +
      '          <div id="shots-list"></div>' +
      '          <div class="costhint">' + icon('coins') + '<span>总时长 <b class="tnum" id="shots-total"></b>s（要求 30–60s）· 预计成本约 4.2 元 · 消耗 1 次视频配额</span></div>' +
      '          <button class="pb" id="btn-submit-video" style="width:100%;justify-content:center">' + icon('clapperboard') + '确认脚本，提交生成</button>' +
      '        </div>' +
      '        <div class="vprog" id="vid-progress" ' + (S.video ? '' : 'hidden') + '>' +
      '          <div style="display:flex;justify-content:space-between;align-items:center"><b style="font-weight:500" id="vp-text"></b><span class="small muted tnum">预计 2–5 分钟</span></div>' +
      '          <div class="vbar"><div class="vfill" id="vp-bar"></div></div>' +
      '          <div style="display:flex;gap:6px;flex-wrap:wrap" id="vp-shots"></div>' +
      '          <p class="small muted" id="vp-note" style="margin-top:8px"></p>' +
      '          <a class="sb" id="btn-see-video" hidden style="width:100%;justify-content:center;margin-top:10px;display:none">' + icon('play') + '去详情页看视频</a>' +
      '          <button class="sb" id="btn-vid-reset" hidden style="width:100%;justify-content:center;margin-top:8px;display:none">重新生成</button>' +
      '        </div>' +
      '      </div>' +
      '    </aside>' +
      '  </div>' +
      '</section>';
    S.currentEditorId = r.id;
    renderIngList(r); renderStepList(r);
    updateImgCostHint();
    if (ui.shots) renderShots();
    if (S.video) renderVideoProgress(r);
    /* 绑定 */
    $('#btn-parse-open').addEventListener('click', openParseModal.bind(null, r));
    $('#gt-img').addEventListener('click', function () { ui.editorTab = 'img'; renderEditor(app, r, {}); });
    $('#gt-vid').addEventListener('click', function () { ui.editorTab = 'vid'; renderEditor(app, r, {}); });
    $$('#gp-img .spill[data-tgt]').forEach(function (b) { b.addEventListener('click', function () { ui.imgTgt = b.dataset.tgt; renderEditor(app, r, {}); }); });
    $$('#gp-img .spill[data-style]').forEach(function (b) { b.addEventListener('click', function () { ui.imgStyle = b.dataset.style; renderEditor(app, r, {}); }); });
    $$('#gp-img .spill[data-ratio]').forEach(function (b) { b.addEventListener('click', function () { ui.imgRatio = b.dataset.ratio; renderEditor(app, r, {}); }); });
    $('#img-count').addEventListener('change', function () { ui.imgCount = +this.value; updateImgCostHint(); });
    $('#btn-gen-img').addEventListener('click', function () { genImages(r); });
    $('#btn-adopt-all').addEventListener('click', function () { adoptAllSteps(r); });
    $('#cand-area').addEventListener('click', function (e) {
      var b = e.target.closest('[data-do]');
      if (b) { candAction(r, b.dataset.do, +e.target.closest('.cand').dataset.i); }
    });
    $('#btn-gen-script').addEventListener('click', function () {
      var btn = this; btn.disabled = true; btn.innerHTML = '<span class="spin"></span> 生成分镜脚本…';
      SVC.parsePipeline(S, '分镜脚本：' + r.title).then(function () {
        ui.shots = JSON.parse(JSON.stringify(SHOTS_TPL));
        SVC.recordTask(S, '分镜', r.title + ' · 视频脚本', 0.02, 1340);
        $('#script-empty').hidden = true;
        $('#script-box').hidden = false;
        renderShots();
        btn.disabled = false; btn.innerHTML = icon('sparkles') + '重新生成分镜'; icons();
        toast('分镜脚本已生成，可编辑后提交');
      });
    });
    $('#btn-submit-video').addEventListener('click', function () { submitVideo(r); });
    $('#btn-vid-reset').addEventListener('click', function () { S.video = null; persist(); renderEditor(app, r, {}); });
    $('#btn-save').addEventListener('click', function () { collectForm(r); toast('草稿已保存到本地'); });
    $('#btn-publish').addEventListener('click', function () {
      collectForm(r);
      if (!r.title.trim()) { toast('请填写菜名', 'warn'); return; }
      r.published = true; persist(); renderHomeCards && null;
      toast('《' + r.title + '》已发布');
      go('#/recipe/' + r.id);
    });
    $('#ing-list').addEventListener('input', function (e) {
      var row = e.target.closest('.listrow'); if (!row) return;
      var i = +row.dataset.i;
      if (e.target.classList.contains('in-name')) r.ing[i][0] = e.target.value; else r.ing[i][1] = e.target.value;
      persist();
    });
    $('#step-list').addEventListener('input', function (e) {
      var row = e.target.closest('.listrow'); if (!row) return;
      r.steps[+row.dataset.i].t = e.target.value; persist();
    });
    $('#step-list').addEventListener('change', function (e) {
      var row = e.target.closest('.listrow'); if (!row) return;
      r.steps[+row.dataset.i].h = e.target.value; persist();
    });
    $('#btn-add-ing').addEventListener('click', function () { r.ing.push(['', '适量']); persist(); renderIngList(r); });
    $('#btn-add-step').addEventListener('click', function () { r.steps.push({ t: '', h: '无需', img: null }); persist(); renderStepList(r); });
    $('#ing-list').addEventListener('click', function (e) { removeRow(e, r, 'ing'); });
    $('#step-list').addEventListener('click', function (e) { removeRow(e, r, 'step'); });
    ['f-title', 'f-intro', 'f-diff', 'f-mins', 'f-serv', 'f-cuisine', 'f-tip'].forEach(function (id) {
      $('#' + id).addEventListener('input', function () { collectForm(r); });
      $('#' + id).addEventListener('change', function () { collectForm(r); });
    });
    icons();
  }
  function removeRow(e, r, kind) {
    var rm = e.target.closest('[data-rm]');
    if (!rm) return;
    var i = +rm.closest('.listrow').dataset.i;
    if (kind === 'ing') { if (r.ing.length <= 1) { toast('至少保留 1 种食材', 'warn'); return; } r.ing.splice(i, 1); renderIngList(r); }
    else { if (r.steps.length <= 1) { toast('至少保留 1 个步骤', 'warn'); return; } r.steps.splice(i, 1); renderStepList(r); }
    persist();
  }
  function collectForm(r) {
    r.title = $('#f-title').value;
    r.intro = $('#f-intro').value;
    r.diff = Math.min(5, Math.max(1, +$('#f-diff').value || 2));
    r.mins = Math.max(1, +$('#f-mins').value || 15);
    r.serv = Math.max(1, +$('#f-serv').value || 2);
    r.cat = $('#f-cuisine').value;
    r.tip = $('#f-tip').value;
    persist();
  }
  function renderIngList(r) {
    $('#ing-list').innerHTML = r.ing.map(function (x, i) {
      return '<div class="listrow" data-i="' + i + '">' +
        '<input class="in-name" value="' + esc(x[0]) + '" placeholder="名称" aria-label="食材名称">' +
        '<input class="in-qty" value="' + esc(x[1]) + '" placeholder="用量" aria-label="用量">' +
        '<button class="rm" data-rm="1" aria-label="删除食材">' + icon('trash-2') + '</button></div>';
    }).join('');
    icons();
  }
  function renderStepList(r) {
    $('#step-list').innerHTML = r.steps.map(function (s, i) {
      var img;
      if (s.img) {
        var g = s.img.b === 'ai' ? 'linear-gradient(135deg,#f2a9c4,#d96fa0)' : 'linear-gradient(135deg,#e9cba2,#b07a3f)';
        img = '<span class="imgslot" style="background:' + g + '">' + s.img.e +
          '<span class="badge ' + (s.img.b === 'ai' ? 'ai' : 'user') + '">' + (s.img.b === 'ai' ? 'AI' : '实拍') + '</span></span>';
      } else {
        img = '<span class="imgslot" data-tooltip="在右侧可整批生成步骤图">＋</span>';
      }
      return '<div class="listrow" data-i="' + i + '"><span class="snum">' + (i + 1) + '</span>' + img +
        '<input class="st-text" value="' + esc(s.t) + '" aria-label="步骤内容">' +
        '<select class="st-heat" aria-label="火候">' + HEATS.map(function (h) { return '<option' + (s.h === h ? ' selected' : '') + '>' + h + '</option>'; }).join('') + '</select>' +
        '<button class="rm" data-rm="1" aria-label="删除步骤">' + icon('trash-2') + '</button></div>';
    }).join('');
    icons();
  }

  /* ---------- 智能解析 ---------- */
  function openParseModal(r) {
    $('#modal-parse').classList.add('on');
    $('#btn-parse-run').onclick = function () {
      var btn = this;
      if (ui.parseBusy) return;
      if (!SVC.spend(S, 'parse', 1)) { toast('今日解析配额不足，明天再来', 'warn'); closeModal(); render(); return; }
      ui.parseBusy = true;
      btn.disabled = true; btn.innerHTML = '<span class="spin"></span> 解析中…';
      SVC.parsePipeline(S, $('#parse-text').value).then(function (res) {
        ui.parseBusy = false;
        btn.disabled = false; btn.innerHTML = '开始解析';
        r.title = res.title; r.cat = '家常菜';
        r.ing = res.ingredients;
        r.steps = res.steps.map(function (s) { return { t: s.text, h: s.heat, img: null }; });
        persist();
        closeModal();
        SVC.recordTask(S, '解析', res.title + ' · 自由文本解析', 0.03, res.elapsed);
        toast('解析完成：菜名 + ' + res.ingredients.length + ' 种食材 + ' + res.steps.length + ' 步骤 · 置信度 ' + res.confidence.toFixed(2) + '，已填入表单');
        updateQuotaChips();
        render();
      });
    };
  }
  function closeModal() { $('#modal-parse').classList.remove('on'); }
  $('#btn-parse-cancel').addEventListener('click', closeModal);
  $('#modal-parse').addEventListener('click', function (e) { if (e.target === this) closeModal(); });

  /* ---------- 生图 ---------- */
  function updateImgCostHint() {
    var el = $('#img-cost-hint');
    if (!el) return;
    el.textContent = ui.imgTgt === 'cover'
      ? '预计消耗 ' + ui.imgCount + ' 张图片配额 · 成本约 ' + (0.12 * ui.imgCount).toFixed(2) + ' 元'
      : '整批生成 ' + rby(S.currentEditorId).steps.length + ' 张步骤图 · 消耗 ' + rby(S.currentEditorId).steps.length + ' 张配额 · 成本约 ' + (0.12 * rby(S.currentEditorId).steps.length).toFixed(2) + ' 元';
  }
  function genImages(r) {
    if (ui.imgBusy) return;
    var cover = ui.imgTgt === 'cover';
    var n = cover ? ui.imgCount : r.steps.length;
    if (!SVC.spend(S, 'img', n)) { toast('今日图片配额不足，明天再来', 'warn'); updateQuotaChips(); return; }
    updateQuotaChips();
    ui.imgBusy = true;
    var btn = $('#btn-gen-img');
    btn.disabled = true; btn.innerHTML = '<span class="spin"></span> 生成中…';
    var area = $('#cand-area');
    var cls = (ui.imgRatio === '11' ? ' r11' : '') + (ui.imgStyle === 'sketch' ? ' sketchmode' : '');
    var sk = '';
    for (var i = 0; i < n; i++) sk += '<div class="cand sk' + cls + '"></div>';
    area.innerHTML = sk;
    $('#btn-adopt-all').style.display = 'none';
    SVC.imagePipeline(S, { count: n }).then(function (res) {
      ui.imgBusy = false;
      btn.disabled = false; btn.innerHTML = icon('sparkles') + '生成';
      ui.cands = [];
      var flt = ui.imgStyle === 'illu' ? ' st-illu' : (ui.imgStyle === 'sketch' ? ' st-sketch' : '');
      var html = '';
      for (var j = 0; j < n; j++) {
        var em = cover ? E_COVER[j % E_COVER.length] : E_STEP[j % E_STEP.length];
        var ci = j % CG.length;
        var gc = CG[ci];
        ui.cands.push({ e: em, g: 'linear-gradient(135deg,' + gc[0] + ',' + gc[1] + ')', ci: ci });
        html += '<div class="cand' + cls + flt + '" style="background:' + ui.cands[j].g + '" data-i="' + j + '" data-em="' + em + '">' +
          '<span class="remoji">' + em + '</span><span class="badge ai">AI 生成</span>' +
          '<span class="cado"><button data-do="adopt">' + (cover ? '采用为封面' : '采用为第' + (j + 1) + '步') + '</button><button data-do="redraw">重绘</button></span></div>';
      }
      area.innerHTML = html;
      SVC.recordTask(S, '生图', (cover ? r.title + ' · 封面图' : r.title + ' · 步骤图') + ' ×' + n + '（' + ({ photo: '摄影', illu: '插画', sketch: '简笔画' })[ui.imgStyle] + '）', res.cost, res.ms);
      if (!cover) $('#btn-adopt-all').style.display = 'inline-flex';
      toast('生成完成，挑选喜欢的并「采用」');
      icons();
    });
  }
  function candAction(r, doWhat, i) {
    var cand = ui.cands && ui.cands[i];
    if (!cand) return;
    var card = $('#cand-area .cand[data-i="' + i + '"]');
    if (doWhat === 'adopt') {
      if (ui.imgTgt === 'cover') { r.emoji = cand.e; persist(); toast('封面已更新为候选 ' + (i + 1)); }
      else { if (r.steps[i]) { r.steps[i].img = { e: cand.e, b: 'ai' }; persist(); renderStepList(r); toast('已采用为第 ' + (i + 1) + ' 步配图'); } }
    } else {
      if (!SVC.spend(S, 'img', 1)) { toast('今日图片配额不足', 'warn'); updateQuotaChips(); return; }
      updateQuotaChips();
      card.classList.add('sk');
      setTimeout(function () {
        card.classList.remove('sk');
        var j = Math.floor(Math.random() * (CG.length - 1));
        if (j >= cand.ci) j += 1; // 重绘必换配色
        cand.ci = j;
        cand.g = 'linear-gradient(135deg,' + CG[j][0] + ',' + CG[j][1] + ')';
        card.style.background = cand.g;
        var pool = ui.imgTgt === 'cover' ? E_COVER : E_STEP;
        var others = pool.filter(function (x) { return x !== cand.e; });
        cand.e = others[Math.floor(Math.random() * others.length)]; // 重绘必换图案
        card.dataset.em = cand.e;
        card.querySelector('.remoji').textContent = cand.e;
        SVC.recordTask(S, '生图', '重绘 · 候选 ' + (i + 1), 0.12, 7600);
      }, 1100);
    }
  }
  function adoptAllSteps(r) {
    if (!ui.cands) return;
    ui.cands.forEach(function (c, i) { if (r.steps[i]) r.steps[i].img = { e: c.e, b: 'ai' }; });
    persist(); renderStepList(r);
    toast('已整批采用 ' + ui.cands.length + ' 张步骤图');
  }

  /* ---------- 生视频 ---------- */
  function renderShots() {
    var total = 0;
    $('#shots-list').innerHTML = ui.shots.map(function (s, i) {
      total += s.d;
      return '<div class="shotrow" data-i="' + i + '"><span class="n">镜 ' + (i + 1) + '</span>' +
        '<input class="sh-cap" value="' + esc(s.cap) + '" aria-label="字幕">' +
        '<select class="sh-d" aria-label="时长">' + [5, 6, 7, 8, 9, 10].map(function (d) { return '<option value="' + d + '"' + (s.d === d ? ' selected' : '') + '>' + d + 's</option>'; }).join('') + '</select></div>' +
        '<div class="small muted" style="margin:-4px 0 8px 52px">' + esc(s.act) + '</div>';
    }).join('');
    $('#shots-total').textContent = total;
    $('#shots-list').oninput = function (e) {
      var row = e.target.closest('.shotrow'); if (!row) return;
      ui.shots[+row.dataset.i].cap = e.target.value;
    };
    $('#shots-list').onchange = function (e) {
      var row = e.target.closest('.shotrow'); if (!row) return;
      ui.shots[+row.dataset.i].d = +e.target.value;
      renderShots();
    };
  }
  function submitVideo(r) {
    if (ui.vidBusy) { toast('视频任务进行中，请稍候'); return; }
    if (!ui.shots) { toast('请先生成分镜脚本', 'warn'); return; }
    if (!SVC.spend(S, 'vid', 1)) { toast('今日视频配额不足，明天再来', 'warn'); updateQuotaChips(); return; }
    updateQuotaChips();
    ui.vidBusy = true;
    S.video = { recipeId: r.id, phase: 'QUEUED', total: ui.shots.length, done: 0, note: '', durSeconds: ui.shots.reduce(function (a, s) { return a + s.d; }, 0) };
    persist();
    $('#script-box').hidden = true;
    $('#vid-progress').hidden = false;
    renderVideoProgress(r);
    SVC.videoPipeline(S, ui.shots, function (ph) {
      S.video.phase = ph.phase;
      S.video.done = ph.done;
      S.video.note = ph.note || '';
      if (ph.phase === 'SUCCESS') { S.video.ms = ph.ms; }
      persist();
      renderVideoProgress(r);
      if (ph.phase === 'SUCCESS') {
        ui.vidBusy = false;
        r.videos.ai = { dur: fmtT(ph.durSeconds) };
        persist();
        toast('视频生成成功！已挂到《' + r.title + '》');
      }
    });
  }
  function renderVideoProgress(r) {
    var box = $('#vid-progress');
    if (!box || !S.video) return;
    var v = S.video;
    box.hidden = false;
    $('#script-box').hidden = true;
    $('#script-empty').hidden = true;
    var textMap = { QUEUED: '排队中…', RUNNING: '生成中…', STITCH: '拼接与字幕烧录…', SUCCESS: '✓ 生成成功' };
    $('#vp-text').textContent = textMap[v.phase] || v.phase;
    var pct = v.phase === 'QUEUED' ? 3 : v.phase === 'STITCH' ? 86 : v.phase === 'SUCCESS' ? 100 : 8 + 70 * (v.done / v.total);
    $('#vp-bar').style.width = pct + '%';
    var chips = '';
    if (v.phase === 'SUCCESS') {
      chips = '<span class="stepchip done">共 ' + v.total + ' 镜 · ' + v.durSeconds + 's</span><span class="stepchip done">字幕已烧录</span><span class="stepchip done">AI 水印已叠加</span>';
    } else {
      for (var i = 0; i < v.total; i++) {
        var cls = 'stepchip';
        if (i < v.done) cls += ' done';
        else if (v.phase === 'RUNNING' && i === v.done) cls += ' run';
        chips += '<span class="' + cls + '">镜 ' + (i + 1) + '</span>';
      }
    }
    $('#vp-shots').innerHTML = chips;
    $('#vp-note').textContent = v.note || (v.phase === 'SUCCESS' ? '端到端耗时约 ' + ((v.ms || 0) / 1000).toFixed(1) + ' 秒（真实场景约 2–5 分钟）' : '');
    var see = $('#btn-see-video'), reset = $('#btn-vid-reset');
    if (v.phase === 'SUCCESS') {
      see.hidden = false; see.style.display = 'inline-flex'; see.href = '#/recipe/' + r.id;
      reset.hidden = false; reset.style.display = 'inline-flex';
    } else {
      see.hidden = true; see.style.display = 'none';
      reset.hidden = true; reset.style.display = 'none';
    }
  }

  /* ================= 上传中心 ================= */
  function renderUpload(app) {
    document.title = '上传中心 · 知味厨房';
    app.innerHTML =
      '<section class="view on" id="view-upload">' +
      '  <h2 style="margin-bottom:14px">上传中心</h2>' +
      '  <div class="upgrid">' +
      '    <div class="panel">' +
      '      <h3>上传烹饪视频</h3>' +
      '      <label class="checkline" style="margin-top:12px">' +
      '        <input type="checkbox" id="cb-copy">' +
      '        <span>我承诺对该视频拥有合法权利，不侵犯他人版权，并同意平台对上传内容进行审核（mp4/mov，≤500MB，≤10 分钟）。</span>' +
      '      </label>' +
      '      <div class="drop">' +
      '        <div class="big">📹</div>' +
      '        <p class="muted small" style="margin:6px 0 12px">拖拽视频到此处，或分片直传（5MB/片 · 断点续传）</p>' +
      '        <button class="pb" id="btn-simfile">' + icon('upload') + '模拟选择视频文件</button>' +
      '        <div class="upstat" id="up-status" hidden>' +
      '          <div style="display:flex;justify-content:space-between" class="small"><span id="up-text">准备上传…</span><span class="tnum" id="up-pct">0%</span></div>' +
      '          <div class="vbar"><div class="vfill" id="up-bar"></div></div>' +
      '        </div>' +
      '        <div id="up-result" hidden></div>' +
      '      </div>' +
      '    </div>' +
      '    <div class="panel">' +
      '      <h3>导入菜谱文档</h3>' +
      '      <p class="muted small" style="margin:10px 0 14px">上传 txt / markdown 菜谱文本（≤1MB，单次 ≤10 道），自动解析为结构化菜谱。</p>' +
      '      <button class="sb" id="btn-simdoc" style="width:100%;justify-content:center">' + icon('file-text') + '模拟选择 家常快手菜.txt</button>' +
      '      <p class="small muted" style="margin-top:12px">图片 OCR 导入、批量导入为二期能力（P1）。</p>' +
      '    </div>' +
      '  </div>' +
      '</section>';
    $('#btn-simfile').addEventListener('click', startUpload);
    $('#btn-simdoc').addEventListener('click', importDoc);
    if (S.upload.phase === 'READY') renderUploadResult();
    icons();
  }
  function startUpload() {
    if (ui.uploadBusy) return;
    if (!$('#cb-copy').checked) { toast('请先勾选版权承诺，才能上传', 'warn'); return; }
    ui.uploadBusy = true;
    S.upload = { phase: 'UPLOADING', pct: 0 }; persist();
    $('#up-result').hidden = true;
    $('#up-status').hidden = false;
    SVC.uploadPipeline(S, function (ph) {
      S.upload.phase = ph.phase; S.upload.pct = ph.pct || 0; persist();
      var st = $('#up-status');
      if (!st) return;
      if (ph.phase === 'UPLOADING') {
        $('#up-text').textContent = ph.note;
        $('#up-pct').textContent = ph.pct + '%';
        $('#up-bar').style.width = ph.pct + '%';
      } else if (ph.phase === 'TRANSCODE' || ph.phase === 'AUDIT') {
        $('#up-text').textContent = ph.note;
        $('#up-pct').textContent = '100%';
        $('#up-bar').style.width = '100%';
      } else if (ph.phase === 'READY') {
        st.hidden = true;
        ui.uploadBusy = false;
        S.upload.phase = 'READY'; persist();
        SVC.recordTask(S, '上传', '红烧肉出锅实录.mp4 · 386MB（转码+机审）', 0, 6600);
        renderUploadResult();
        toast('上传完成，视频已就绪');
      }
    });
  }
  function renderUploadResult() {
    var box = $('#up-result');
    if (!box) return;
    box.hidden = false;
    box.innerHTML = '<div class="rescard">' +
      '<span class="restile" style="background:linear-gradient(135deg,#b07a4f,#6f3f2a)"><span style="font-size:38px">🍖</span><span class="badge user">用户实拍</span></span>' +
      '<div class="resmeta"><b style="font-weight:500">红烧肉出锅实录.mp4</b>' +
      '<div class="kv"><b>大小</b><span class="tnum">386 MB · 1 分 12 秒</span></div>' +
      '<div class="kv"><b>状态</b><span class="stt ok">已就绪（转码 + 机审通过）</span></div>' +
      '<div class="kv"><b>挂载</b><span><select id="mount-select" aria-label="选择要挂载的菜谱"></select></span></div>' +
      '<div style="margin-top:8px"><button class="pb" id="btn-mount">' + icon('link') + '挂载到菜谱</button></div></div></div>';
    var sel = $('#mount-select');
    sel.innerHTML = S.recipes.map(function (r) {
      return '<option value="' + r.id + '">' + esc(r.title) + (r.videos.user ? '（已有实拍）' : '') + '</option>';
    }).join('');
    $('#btn-mount').addEventListener('click', function () {
      var r = rby(sel.value);
      if (!r) return;
      r.videos.user = { dur: '1:12' };
      persist();
      this.disabled = true; this.innerHTML = '✓ 已挂载';
      SVC.recordTask(S, '上传', '挂载 ' + r.title + ' · 红烧肉出锅实录.mp4', 0, 900);
      toast('实拍视频已挂载到《' + r.title + '》');
      icons();
    });
    icons();
  }
  function importDoc() {
    var btn = $('#btn-simdoc');
    if (!btn || btn.disabled) return;
    btn.disabled = true; btn.innerHTML = '<span class="spin"></span> 解析导入中…';
    SVC.importPipeline(S).then(function () {
      btn.disabled = false; btn.innerHTML = icon('file-text') + '模拟选择 家常快手菜.txt';
      if (S.imported) { toast('演示中仅支持导入一次，可到首页查看新菜谱'); return; }
      S.imported = true;
      var r = STORE.addRecipeFromImport(S);
      persist();
      SVC.recordTask(S, '导入', '家常快手菜.txt → ' + r.title, 0.03, 1180);
      toast('导入成功：解析出 1 道新菜谱《' + r.title + '》');
      icons();
    });
  }

  /* ================= 任务中心 ================= */
  function renderTasks(app) {
    document.title = '任务中心 · 知味厨房';
    app.innerHTML =
      '<section class="view on" id="view-tasks">' +
      '  <h2 style="margin-bottom:14px">任务中心</h2>' +
      '  <div class="panel" style="padding:6px 10px">' +
      '    <div class="table-responsive"><table>' +
      '      <thead><tr><th>编号</th><th>类型</th><th>对象</th><th>状态</th><th>成本</th><th>耗时</th><th>提交时间</th></tr></thead>' +
      '      <tbody id="tasks-body"></tbody>' +
      '    </table></div>' +
      '  </div>' +
      '  <p class="small muted" style="margin-top:10px">失败任务自动返还配额；视频任务支持镜级重试（每镜上限 2 次）。</p>' +
      '</section>';
    $('#tasks-body').innerHTML = S.tasks.map(function (t) {
      var st = STMAP[t.st] || [t.st, 'q'];
      return '<tr><td class="tnum">#' + t.id + '</td><td><span class="ttype">' + t.type + '</span></td><td>' + esc(t.obj) + '</td>' +
        '<td><span class="stt ' + st[1] + '">' + st[0] + '</span></td>' +
        '<td class="tnum">' + (t.cost ? '¥' + t.cost.toFixed(2) : '—') + '</td>' +
        '<td class="tnum">' + fmtMs(t.ms) + '</td><td class="muted">' + t.when + '</td></tr>';
    }).join('');
  }

  /* ---------- 全局 ---------- */
  $('#btn-reset').addEventListener('click', function () {
    S = STORE.reset();
    ui.shots = null; ui.cands = null; ui.imgBusy = false; ui.vidBusy = false; ui.uploadBusy = false;
    ui.homeSrc = 'all'; ui.homeCat = 'all'; ui.homeQ = ''; ui.detailTab = 'steps';
    toast('演示数据已重置');
    go('#/home');
    render();
  });

  /* ---------- PWA ---------- */
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    navigator.serviceWorker.register('./sw.js').catch(function () { });
  }

  render();
})();
