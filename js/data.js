/* data.js — 种子数据与全局状态（localStorage 持久化） */
(function () {
  'use strict';

  var SEED_RECIPES = [
    {
      id: 'r1', title: '番茄炒蛋', src: 'ai', cat: '家常菜', emoji: '🍅',
      g: 'linear-gradient(135deg,#ff9a62,#e0492c)', diff: 1, mins: 15, serv: 2,
      intro: '国民家常菜，酸甜开胃，十分钟上桌。',
      ing: [['番茄', '2个'], ['鸡蛋', '3个'], ['小葱', '2根'], ['盐', '适量'], ['糖', '少许']],
      steps: [
        { t: '鸡蛋加少许盐打散；番茄去皮切块。', h: '无需', img: { e: '🥚', b: 'ai' } },
        { t: '热锅下油，倒入蛋液炒至刚凝固盛出。', h: '中火', img: null },
        { t: '余油下番茄炒出汁，倒回鸡蛋翻匀，加盐和糖调味，撒葱花出锅。', h: '大火', img: null }
      ],
      tip: '蛋液加几滴水更嫩；喜欢汤汁多可加小半勺番茄酱。',
      videos: { ai: null, user: null }, fav: false, published: true
    },
    {
      id: 'r2', title: '红烧肉', src: 'user', cat: '家常菜', emoji: '🍖',
      g: 'linear-gradient(135deg,#b07a4f,#6f3f2a)', diff: 3, mins: 90, serv: 4,
      intro: '肥而不腻，入口即化的经典硬菜。',
      ing: [['五花肉', '500g'], ['冰糖', '20g'], ['生抽', '2勺'], ['老抽', '1勺'], ['姜片', '3片']],
      steps: [
        { t: '五花肉焯水后切块。', h: '无需', img: { e: '🥩', b: 'user' } },
        { t: '冰糖小火炒糖色，下肉块上色。', h: '小火', img: { e: '🍬', b: 'user' } },
        { t: '加料酒生抽老抽与热水，小火炖 60 分钟，大火收汁。', h: '大火', img: { e: '🍲', b: 'user' } }
      ],
      tip: '炒糖色是关键，小火慢炒到琥珀色。',
      videos: { ai: null, user: { dur: '1:12' } }, fav: false, published: true
    },
    {
      id: 'r3', title: '清蒸鲈鱼', src: 'user', cat: '家常菜', emoji: '🐟',
      g: 'linear-gradient(135deg,#8fd0ba,#2f8f7a)', diff: 2, mins: 25, serv: 3,
      intro: '鲜嫩清淡，宴客首选。',
      ing: [['鲈鱼', '1条'], ['蒸鱼豉油', '2勺'], ['葱丝', '适量'], ['姜丝', '适量']],
      steps: [
        { t: '鱼身划刀，塞姜丝，水开后蒸 8 分钟。', h: '大火', img: { e: '🐡', b: 'user' } },
        { t: '倒掉蒸出的汁水，铺葱丝，淋热油。', h: '无需', img: { e: '🔥', b: 'user' } },
        { t: '淋蒸鱼豉油即可。', h: '无需', img: { e: '🥢', b: 'user' } }
      ],
      tip: '蒸鱼豉油别过早放，出锅前淋最鲜。',
      videos: { ai: null, user: { dur: '0:48' } }, fav: false, published: true
    },
    {
      id: 'r4', title: '戚风蛋糕', src: 'ai', cat: '烘焙', emoji: '🍰',
      g: 'linear-gradient(135deg,#f7b8d4,#d96fa0)', diff: 3, mins: 60, serv: 6,
      intro: '松软不塌陷的基础戚风。',
      ing: [['鸡蛋', '5个'], ['低筋面粉', '85g'], ['牛奶', '40g'], ['细砂糖', '60g'], ['玉米油', '40g']],
      steps: [
        { t: '蛋黄糊：蛋黄+牛奶+油+过筛面粉拌匀。', h: '无需', img: null },
        { t: '蛋白分三次加糖打至硬性发泡。', h: '无需', img: null },
        { t: '翻拌入模，150°C 烤 50 分钟，倒扣放凉。', h: '无需', img: null }
      ],
      tip: '蛋白打发是成败关键，盆里保证无水无油。',
      videos: { ai: null, user: null }, fav: false, published: true
    },
    {
      id: 'r5', title: '玉米排骨汤', src: 'user', cat: '汤羹', emoji: '🌽',
      g: 'linear-gradient(135deg,#ffd66b,#e8962f)', diff: 1, mins: 60, serv: 3,
      intro: '清甜暖胃的一锅汤。',
      ing: [['排骨', '400g'], ['甜玉米', '2根'], ['胡萝卜', '1根'], ['姜', '2片']],
      steps: [
        { t: '排骨焯水洗净。', h: '大火', img: { e: '🦴', b: 'user' } },
        { t: '全部食材入锅，加水小火炖 50 分钟。', h: '小火', img: { e: '🌽', b: 'user' } },
        { t: '加盐调味出锅。', h: '无需', img: { e: '🥣', b: 'user' } }
      ],
      tip: '甜玉米后放 10 分钟更清甜。',
      videos: { ai: null, user: { dur: '0:55' } }, fav: false, published: true
    },
    {
      id: 'r6', title: '黑椒意面', src: 'ai', cat: '西餐', emoji: '🍝',
      g: 'linear-gradient(135deg,#e9cba2,#b07a3f)', diff: 2, mins: 20, serv: 1,
      intro: '十分钟搞定的西餐主食。',
      ing: [['意面', '100g'], ['牛里脊', '80g'], ['黑椒酱', '1.5勺'], ['洋葱', '1/4个']],
      steps: [
        { t: '意面煮 8 分钟捞出拌油。', h: '大火', img: null },
        { t: '牛肉粒滑炒变色，下洋葱丝。', h: '大火', img: null },
        { t: '倒入意面和黑椒酱翻匀出锅。', h: '中火', img: null }
      ],
      tip: '煮面水加盐，面更筋道。',
      videos: { ai: null, user: null }, fav: false, published: true
    }
  ];

  var SEED_TASKS = [
    { id: 8977, type: '解析', obj: '红烧肉 · 自由文本解析', st: 'SUCCESS', cost: 0.03, ms: 6540, when: '2 小时前' },
    { id: 9001, type: '生图', obj: '番茄炒蛋 · 第 1 步配图', st: 'SUCCESS', cost: 0.12, ms: 8210, when: '1 小时前' },
    { id: 9003, type: '上传', obj: '红烧肉出锅实录.mp4 · 386MB', st: 'SUCCESS', cost: 0, ms: 6380, when: '40 分钟前' }
  ];

  var IMPORT_RECIPE = {
    id: 'r-imported', title: '蒜蓉西兰花', src: 'user', cat: '家常菜', emoji: '🥦',
    g: 'linear-gradient(135deg,#a4d883,#4c8f3f)', diff: 1, mins: 10, serv: 2,
    intro: '由「家常快手菜.txt」导入并解析生成。',
    ing: [['西兰花', '1颗'], ['蒜', '5瓣'], ['盐', '适量']],
    steps: [
      { t: '西兰花切小朵焯水 1 分钟。', h: '大火', img: null },
      { t: '热油爆香蒜末，下西兰花翻炒，加盐出锅。', h: '大火', img: null }
    ],
    tip: '焯水加几滴油颜色更绿。', videos: { ai: null, user: null }, fav: false, published: true
  };

  var KEY = 'zhiwei-kitchen-v1';

  function defaults() {
    return {
      v: 1,
      quotas: { img: 10, vid: 1, parse: 20 },
      recipes: JSON.parse(JSON.stringify(SEED_RECIPES)),
      tasks: JSON.parse(JSON.stringify(SEED_TASKS)),
      tid: 9003,
      video: null,   // 进行中的视频任务 {recipeId, phase, total, done, note, dur, shots}
      upload: { phase: 'idle', pct: 0 },
      imported: false
    };
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return defaults();
      var s = JSON.parse(raw);
      if (!s || s.v !== 1) return defaults();
      return s;
    } catch (e) { return defaults(); }
  }

  function save(state) {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* 隐私模式等场景忽略 */ }
  }

  function reset() {
    try { localStorage.removeItem(KEY); } catch (e) { }
    return defaults();
  }

  function addRecipeFromImport(state) {
    var r = JSON.parse(JSON.stringify(IMPORT_RECIPE));
    r.id = 'r-imported-' + Date.now();
    state.recipes.push(r);
    return r;
  }

  window.STORE = {
    SEED_RECIPES: SEED_RECIPES,
    SEED_TASKS: SEED_TASKS,
    IMPORT_RECIPE: IMPORT_RECIPE,
    defaults: defaults,
    load: load,
    save: save,
    reset: reset,
    addRecipeFromImport: addRecipeFromImport
  };
})();
