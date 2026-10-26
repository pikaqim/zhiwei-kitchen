/* services.js — 模拟服务层（配额 / 任务账本 / AI 生成流水线 / 上传流水线）
 *
 * 所有“AI 能力”目前为本地模拟（有真实感的延迟、成本记账、镜级重试、失败返还）。
 * 接入真实后端时，仅需将本文件中的 *Pipeline 函数替换为 HTTP 调用，
 * 页面层与状态层无需改动。接口形状见各函数注释。
 */
(function () {
  'use strict';

  var QUOTA_LABEL = { img: '图片', vid: '视频', parse: '解析' };

  /* ---------- 配额 ---------- */
  function spend(state, kind, n) {
    if (state.quotas[kind] < n) return false;
    state.quotas[kind] -= n;
    STORE.save(state);
    return true;
  }
  function refund(state, kind, n) {
    state.quotas[kind] += n;
    STORE.save(state);
  }

  /* ---------- 任务账本 ---------- */
  function recordTask(state, type, obj, cost, ms, st) {
    state.tid += 1;
    var t = { id: state.tid, type: type, obj: obj, st: st || 'SUCCESS', cost: cost || 0, ms: ms || null, when: '刚刚' };
    state.tasks.unshift(t);
    if (state.tasks.length > 20) state.tasks.pop();
    STORE.save(state);
    return t;
  }
  function patchTask(state, task, patch) {
    for (var k in patch) task[k] = patch[k];
    STORE.save(state);
  }

  /* ---------- 通用延迟 ---------- */
  function sleep(ms) { return new Promise(function (res) { setTimeout(res, ms); }); }

  /* ---------- 文本智能解析（UC-01） ----------
   * 返回 Promise<结构化菜谱>。演示用启发式抽取；接入真实 LLM 时替换本函数。 */
  function parsePipeline(state, text) {
    var started = Date.now();
    return sleep(1300).then(function () {
      var clean = String(text || '').trim();
      var title = '未命名菜谱';
      var m = clean.match(/^[^：:\n]{1,30}/);
      if (m) title = m[0];
      var titlePrefix = new RegExp('^' + title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[：:]\\s*');
      // 元信息句（时长/份量/难度/贴士声明）不作为步骤
      var metaRe = /(分钟|小时|人份|小贴士|难度|贴士[:：])/;
      var sents = clean.split(/[。；;！!？?\n]+/).map(function (s) { return s.trim().replace(titlePrefix, ''); })
        .filter(function (s) { return s.length > 3 && !metaRe.test(s); });
      var steps = sents.slice(0, 5).map(function (s, i) {
        return { seq: i + 1, text: s.slice(0, 120), heat: /大火|爆炒|收汁/.test(s) ? '大火' : (/中火/.test(s) ? '中火' : (/小火|炖|焖|煮|蒸/.test(s) ? '小火' : '无需')) };
      });
      var ings = [];
      var re = /([\u4e00-\u9fa5]{1,6})\s*(\d+(?:\.\d+)?\s*(?:个|根|颗|勺|片|瓣|只|条|块|滴|g|克|千克|kg|斤|ml|毫升|L))/g;
      var mm;
      while ((mm = re.exec(clean)) && ings.length < 6) ings.push([mm[1], mm[2]]);
      // 从动作句补充调料类食材（加/放/撒/淋 X），排除量词与数词误捕获
      var condRe = /(?:加|放|撒|淋上?)([\u4e00-\u9fa5]{1,3}?)(?:和|与|及|调味|炒匀|翻炒|出锅|拌匀|即可|。|；|;|，|$)/g;
      var junk = /[一两二三四五点几少许半勺再并]/;
      while ((mm = condRe.exec(clean)) && ings.length < 8) {
        var name = mm[1];
        if (name && !junk.test(name) && ings.every(function (x) { return x[0] !== name; })) ings.push([name, '适量']);
      }
      if (!ings.length) ings = [['主料', '适量'], ['辅料', '适量']];
      return {
        title: title,
        ingredients: ings,
        steps: steps,
        confidence: 0.9 + Math.round(Math.random() * 8) / 100,
        elapsed: Date.now() - started
      };
    });
  }

  /* ---------- 文生图（UC-03） ---------- */
  function imagePipeline(state, meta) {
    var ms = 1400 + Math.floor(Math.random() * 600);
    return sleep(ms).then(function () {
      return { ok: true, ms: ms, cost: +(0.12 * meta.count).toFixed(2) };
    });
  }

  /* ---------- 视频流水线（UC-04）：DRAFT→QUEUED→GENERATING→STITCHING→SUCCESS ----------
   * onPhase({phase,total,done,note,durSeconds})；镜 3 演示一次自动镜级重试。 */
  function videoPipeline(state, shots, onPhase) {
    var total = shots.reduce(function (a, s) { return a + s.d; }, 0);
    var task = recordTask(state, '生视频', '分镜演示 ' + total + 's', 4.2, null, 'QUEUED');
    onPhase({ phase: 'QUEUED', total: shots.length, done: 0, durSeconds: total });
    var p = sleep(800).then(function () {
      onPhase({ phase: 'RUNNING', total: shots.length, done: 0, durSeconds: total });
      var chain = Promise.resolve();
      shots.forEach(function (s, i) {
        chain = chain.then(function () {
          onPhase({ phase: 'RUNNING', total: shots.length, done: i, active: i, durSeconds: total });
          var step = sleep(950).then(function () {
            if (i === 2) { // 演示镜级重试
              onPhase({ phase: 'RUNNING', total: shots.length, done: i, active: i, note: '镜 3 画面异常，自动镜级重试（1/2）…', durSeconds: total });
              return sleep(650);
            }
          });
          return step.then(function () {
            onPhase({ phase: 'RUNNING', total: shots.length, done: i + 1, durSeconds: total, retryDone: i === 2 });
          });
        });
      });
      return chain;
    });
    return p.then(function () {
      onPhase({ phase: 'STITCH', total: shots.length, done: shots.length, durSeconds: total });
      return sleep(1100);
    }).then(function () {
      var ms = 800 + shots.length * 950 + 650 + 1100;
      patchTask(state, task, { st: 'SUCCESS', ms: ms });
      onPhase({ phase: 'SUCCESS', total: shots.length, done: shots.length, durSeconds: total, ms: ms });
      return { durSeconds: total, task: task };
    });
  }

  /* ---------- 视频上传（UC-05）：分片→转码→机审→就绪 ----------
   * onPhase({phase,pct,note}) */
  function uploadPipeline(state, onPhase) {
    return new Promise(function (resolve) {
      var pct = 0;
      var iv = setInterval(function () {
        pct += 2;
        if (pct >= 100) {
          clearInterval(iv);
          onPhase({ phase: 'TRANSCODE', pct: 100, note: '转码中 · HLS 360p/720p/1080p + 抽取封面帧…' });
          sleep(1600).then(function () {
            onPhase({ phase: 'AUDIT', pct: 100, note: '机审通过 ✓' });
            return sleep(500);
          }).then(function () {
            onPhase({ phase: 'READY', pct: 100 });
            resolve({ ok: true });
          });
        } else {
          onPhase({ phase: 'UPLOADING', pct: pct, note: '分片上传中 · 第 ' + Math.ceil(pct / 5) + '/20 片 · 3.2 MB/s' });
        }
      }, 70);
    });
  }

  /* ---------- 文档导入（U-01） ---------- */
  function importPipeline(state) {
    return sleep(1300).then(function () { return { ok: true }; });
  }

  window.SVC = {
    QUOTA_LABEL: QUOTA_LABEL,
    spend: spend,
    refund: refund,
    recordTask: recordTask,
    patchTask: patchTask,
    parsePipeline: parsePipeline,
    imagePipeline: imagePipeline,
    videoPipeline: videoPipeline,
    uploadPipeline: uploadPipeline,
    importPipeline: importPipeline
  };
})();
