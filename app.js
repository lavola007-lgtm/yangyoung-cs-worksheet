(() => {
'use strict';
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

/* ---------- state (memory only) ---------- */
const S = { who:{}, p1:{signals:[]}, p2:{obs:[{}]}, p3:{rounds:[{role:'t',scene:'homework'}], r:0, left:''}, p4:{}, rx:{}, ho:{}, cal:{}, ab:{} };
const get = (path) => path.split('.').reduce((o,k)=>o==null?undefined:o[k], S);
const set = (path, v) => { const ks = path.split('.'); let o = S; ks.slice(0,-1).forEach(k=>{ if(o[k]==null) o[k]={}; o=o[k]; }); o[ks.at(-1)] = v; };

/* ---------- toast ---------- */
let tt;
const toast = (m) => { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(tt); tt = setTimeout(()=>t.classList.remove('show'), 2200); };

/* ---------- navigation ---------- */
function go(id){
  $$('.page').forEach(p=>p.classList.toggle('on', p.id===id));
  $$('.tabs button').forEach(b=>b.classList.toggle('on', b.dataset.go===id));
  const tab = $(`.tabs button[data-go="${id}"]`); if (tab) tab.scrollIntoView({inline:'center', block:'nearest'});
  window.scrollTo({top:0});
  if (id==='record') renderAll();
}
document.addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b){ e.preventDefault(); go(b.dataset.go); } });

/* ---------- simple bound fields ---------- */
document.addEventListener('input', e => {
  const k = e.target.dataset.k; if (!k) return;
  set(k, e.target.value);
  refreshOutputs();
});
document.addEventListener('change', e => { const k = e.target.dataset.k; if (k){ set(k, e.target.value); refreshOutputs(); } });

/* chips: single / multi */
document.addEventListener('click', e => {
  const b = e.target.closest('[data-single] > button, [data-multi] > button'); if (!b) return;
  const box = b.parentElement;
  if (box.dataset.single){
    const k = box.dataset.single; const was = b.classList.contains('on');
    $$('button', box).forEach(x=>{x.classList.remove('on'); x.setAttribute('aria-pressed','false');});
    if (!was){ b.classList.add('on'); b.setAttribute('aria-pressed','true'); set(k, b.dataset.v); } else set(k, '');
  } else {
    const k = box.dataset.multi; b.classList.toggle('on'); b.setAttribute('aria-pressed', b.classList.contains('on'));
    set(k, $$('button.on', box).map(x=>x.dataset.v));
  }
  if (box.dataset.single === 'p4.pick') $('#five').hidden = get('p4.pick') !== '내 반에서 이름을 부를 다섯 명을 정합니다';
  refreshOutputs();
});
$$('[data-single] > button, [data-multi] > button').forEach(b=>b.setAttribute('aria-pressed','false'));

/* ---------- timers ---------- */
$$('.timer').forEach(el => {
  const total = (+el.dataset.min) * 60; let left = total, id = null;
  el.innerHTML = `<span class="tt" aria-live="off"></span><button type="button" data-a="go">시작</button><button type="button" data-a="re">처음으로</button>`;
  const tEl = $('.tt', el), goB = $('[data-a=go]', el);
  const draw = () => { const m = Math.floor(left/60), s = left%60; tEl.textContent = `${m}:${String(s).padStart(2,'0')}`; };
  const stop = () => { clearInterval(id); id = null; goB.textContent = left===total ? '시작' : '이어서'; };
  goB.onclick = () => {
    if (id){ stop(); return; }
    if (left===0) left = total;
    el.classList.remove('done'); goB.textContent = '멈춤';
    id = setInterval(() => { left--; draw(); if (left<=0){ left=0; draw(); stop(); goB.textContent='시작'; el.classList.add('done'); toast('시간이 끝났습니다. 쓰던 문장만 마무리합니다'); } }, 1000);
  };
  $('[data-a=re]', el).onclick = () => { stop(); left = total; el.classList.remove('done'); goB.textContent='시작'; draw(); };
  draw();
});

/* ---------- language checks ---------- */
const EVAL = ['성실','착하','착한','열심히','게으','산만','집중력이 없','집중을 안','실수가 많','부족','똑똑','머리가','의지가','태도가','노력을 안','못하','잘해요','잘하는','잘한다','느려','덜렁'];
const SCENE = /(\d+\s?(번|분|문제|문항|쪽|회|개|점)|[월화수목금토일]요일|오늘|어제|이번 주|지난주|단원|문제|문항|숙제|질문|멈|지우|손을|말없이|서술|계산|풀이|오답)/;
const WHEN = /([월화수목금토일]요일|\d+\s?일|\d+\s?\/\s?\d+|이번 주|다음 주|내일|오늘|주말|\d+주차|수업 전|수업 후|쉬는 시간)/;
const VAGUE = /(해\s?보겠습니다|노력하겠|신경\s?쓰겠|잘\s?보겠|열심히\s?하겠|챙겨\s?보겠|지켜보겠)/;
const CONCRETE = /(\d|수업|문제|문항|단원|매\s?수업|매일|분|표시|확인하겠|쓰게|풀게)/;
const DEFENSE = /^(아니|그게 아니|원래|사실은|그건|저희는 다|다른 애들)/;
const EMPATHY = /(느끼실|그러셨|속상|걱정|기대하셨|마음|불안|충분히|당연)/;
const evalHit = (t) => EVAL.filter(w => t.includes(w));

function judgeScene(t){
  if (!t.trim()) return ['', ''];
  const hit = evalHit(t);
  if (hit.length) return ['warn', `평가 말이 들어 있습니다: "${hit.join('", "')}". 그렇게 느낀 장면을 적어 보세요.`];
  if (SCENE.test(t)) return ['ok', '장면이 보입니다. 학부모가 머릿속에 그릴 수 있습니다.'];
  return ['warn', '언제, 무엇을 하고 있었는지 한 가지를 더 넣어 보세요.'];
}
function judgeNext(t){
  if (!t.trim()) return ['', ''];
  if (VAGUE.test(t) && !CONCRETE.test(t.replace(VAGUE,''))) return ['warn', '"해 보겠습니다" 대신 무엇을 할지 적어 보세요.'];
  if (WHEN.test(t)) return ['ok', '언제 할지까지 들어 있습니다.'];
  return ['warn', '요일이나 시점(예: 목요일 수업 전 5분)을 넣으면 지켜집니다.'];
}
function judge4(key, t){
  if (!t.trim()) return ['', ''];
  if (key==='accept'){
    if (DEFENSE.test(t.trim())) return ['warn', '설명이나 반박으로 시작했습니다. 먼저 마음을 받아 주세요.'];
    if (EMPATHY.test(t)) return ['ok', '먼저 받았습니다.'];
    return ['warn', '"그렇게 느끼실 수 있습니다"처럼 학부모의 마음을 먼저 말해 보세요.'];
  }
  if (key==='sceneText') return judgeScene(t);
  if (key==='plan'){
    if (VAGUE.test(t) && !CONCRETE.test(t.replace(VAGUE,''))) return ['warn', '무엇을, 몇 번, 어떻게 할지 넣어 보세요.'];
    if (CONCRETE.test(t)) return ['ok', '무엇을 할지 보입니다.'];
    return ['warn', '수업에서 실제로 할 행동 하나를 적어 보세요.'];
  }
  if (key==='when'){
    if (WHEN.test(t)) return ['ok', '다시 연락할 시점이 있습니다.'];
    return ['warn', '"금요일에", "다음 주 화요일에"처럼 날짜나 요일을 넣어 보세요.'];
  }
  return ['',''];
}
const paint = (el, [cls, msg]) => { if (!el) return; el.className = 'fb' + (cls ? ' '+cls : ''); el.textContent = msg; };

/* ---------- 실습 2: observations ---------- */
function renderObs(){
  const box = $('#obs-list'); box.innerHTML = '';
  S.p2.obs.forEach((o, i) => {
    const d = document.createElement('div'); d.className = 'obs';
    d.innerHTML = `<div class="obs-h"><b>관찰 ${i+1}</b>${i>0?'<button type="button" data-del>지우기</button>':''}</div>
      <div class="grid3">
        <span>아이</span><div><input data-o="name" aria-label="아이 ${i+1}" placeholder="반에서 가장 먼저 떠오른 한 명 · 이니셜"></div>
        <span>장면 한 줄</span><div><textarea rows="2" data-o="scene" aria-label="장면 한 줄 ${i+1}" placeholder="화요일, 21번에서 멈춘 채 30분 앉아 있었습니다"></textarea><span class="fb" data-ofb="scene"></span></div>
        <span>다음 행동 한 줄</span><div><textarea rows="2" data-o="next" aria-label="다음 행동 한 줄 ${i+1}" placeholder="목요일 수업 전 5분, 21번만 같이 봅니다"></textarea><span class="fb" data-ofb="next"></span></div>
      </div>`;
    $$('[data-o]', d).forEach(inp => {
      inp.value = o[inp.dataset.o] || '';
      inp.addEventListener('input', () => {
        o[inp.dataset.o] = inp.value;
        if (inp.dataset.o==='scene') paint($('[data-ofb=scene]', d), judgeScene(inp.value));
        if (inp.dataset.o==='next') paint($('[data-ofb=next]', d), judgeNext(inp.value));
      });
    });
    paint($('[data-ofb=scene]', d), judgeScene(o.scene||''));
    paint($('[data-ofb=next]', d), judgeNext(o.next||''));
    const del = $('[data-del]', d); if (del) del.onclick = () => { S.p2.obs.splice(i,1); renderObs(); };
    box.appendChild(d);
  });
}
$('#obs-add').onclick = () => { if (S.p2.obs.length >= 5){ toast('오늘은 다섯 명까지면 충분합니다'); return; } S.p2.obs.push({}); renderObs(); $$('#obs-list .obs').at(-1).querySelector('input').focus(); };
renderObs();

/* ---------- 실습 3: role play ---------- */
const SCENES = {
  homework:{ t:'숙제를 안 해 온 아이', s:'숙제', main:true,
    open:'"선생님, 우리 애가 학원 숙제를 자꾸 못 해 간다면서요. 학원에서는 어떻게 하고 계세요?"',
    push:'"집에서는 한다고 하는데요… 숙제가 너무 많은 건 아닌가요?"',
    ng:'"OO가 숙제를 너무 안 해요. 집에서도 신경 써 주세요."',
    ok:'"OO가 이번 주 숙제를 두 번 못 해 왔습니다.\n어려운 문제에서 막힌 뒤 도움을 요청하지 못하는 장면이 있었습니다.\n다음 주에는 못 푼 문제를 표시해서 가져오게 하고, 제가 수업 전 5분 먼저 확인하겠습니다.\n집에서는 \'숙제 다 했어?\'보다 \'막힌 문제 표시했어?\' 한마디만 부탁드리겠습니다."', src:'장표 56쪽' },
  levelup:{ t:'레벨업 탈락', s:'CASE 02', main:true,
    open:'"이번에도 못 올라갔대요. 뭘 더 하면 올라가는 건가요?"',
    push:'"다른 애들은 올라갔다던데, 솔직히 기준을 모르겠어요."',
    ng:'"다음 달에 다시 보면 됩니다. 조금만 더 열심히 하면 올라갈 거예요."',
    ok:'"어머님, 많이 기대하셨을 텐데 속상하셨을 것 같습니다.\n이번 월말평가에서 계산은 안정적이었지만, 서술형 두 문항에서 풀이를 끝까지 쓰지 못했습니다.\n다음 4주는 서술형을 매 수업 한 문항씩 끝까지 쓰게 하겠습니다.\n다음 달 둘째 주 금요일에 진행 상황을 먼저 연락드리겠습니다."', note:'레벨업 기준 자체는 관의 정책입니다. 선생님은 "다음 근거"를 말합니다.', src:'장표 42쪽' },
  care:{ t:'"개별 케어가 안 되는 것 같아요"', s:'후기 연결', main:true,
    open:'"솔직히 말씀드리면, 개별 케어가 안 되는 것 같아요."',
    push:'"반에 아이들이 많으니까, 우리 애까지 보실 수 있나 싶어서요."',
    ng:'방어하지 않습니다. 장면과 계획으로 답합니다.',
    ok:'"어머님, 그렇게 느끼실 수 있습니다.\n제가 이번 주 OO를 보면서 확인한 건, 숙제는 했지만 질문 없이 넘어간 문제가 세 개 있었다는 점입니다.\n다음 두 수업에서 그 유형을 먼저 확인하고, 이번 주 금요일에 다시 말씀드리겠습니다."', src:'장표 57쪽' },
  score:{ t:'"점수만 문자로 왔어요"', s:'CASE 03 · 시간 남으면',
    open:'"월말평가 점수만 문자로 왔더라고요. 그래서 우리 아이는 뭐가 문제인가요?"',
    push:'"평균보다 낮던데, 반을 내려야 하나요?"',
    ng:'"이번 월말평가 72점입니다."',
    ok:'"72점, 함수 그래프 해석에서 세 문제를 놓쳤습니다.\n다음 주 수업 전 5분, 그래프 읽기를 먼저 확인하겠습니다."', note:'칭찬이 아니라 관찰입니다. 무엇을 보았는지 말하면 근거가 됩니다. 시점 칸은 직접 채워 보세요.', src:'장표 44쪽' },
  exam:{ t:'"학교 시험인데 학원 시험까지요?"', s:'CASE 04 · 시간 남으면',
    open:'"학교 시험 기간인데 학원 시험까지 보나요? 우리 학교 일정은 알고 계신 거죠?"',
    push:'"애가 둘 다 준비하느라 너무 지쳤어요."',
    ng:'공지 문자로 일정만 알리는 것',
    ok:'"○○중은 이번에 서술형 비중이 높아 이 부분을 먼저 봅니다."\n\n담당 반 학생들의 학교 시험 날짜를 시험 4주 전에 정리해 두고, 학원 평가와 겹치는 학생은 공지 전에 담임이 짧게 이유와 대안을 말합니다.', note:'실제 일정 운영은 관마다 다를 수 있습니다.', src:'장표 46쪽' },
  subject:{ t:'"영어는 그만둘게요"', s:'CASE 06 · 시간 남으면',
    open:'"수학은 계속 보낼게요. 영어만 이번 달까지 하려고요."',
    push:'"영어는 다른 데를 좀 알아봤어요."',
    ng:'"수학은 계속 다니니까 괜찮다"며 빠진 과목의 이유를 묻지 않는 것',
    ok:'빠진 과목을 먼저 묻습니다.\n한 과목 중단을 첫 신호로 기록하고, 이유 한 줄을 남은 과목 담임에게 넘깁니다.', note:'큰 학원일수록 아이는 과목과 관 사이에서 조용히 빠져나갑니다.', src:'장표 50쪽' },
  sunhaeng:{ t:'"진도 미리 나가 주세요"', s:'1부 상담 언어 · 시간 남으면',
    open:'"다음 학년 진도 미리 나가 주실 수 있죠? 다른 애들은 다 1년 앞서 있대요."',
    push:'"그럼 레벨은 어떻게 올라가요?"',
    ng:'"다음 학년 진도 미리 빼 드릴게요" · "레벨 올리려면 선행부터 하세요"',
    ok:'"지금 학년 개념을 심화까지 다지고, 학교 진도와 맞춰 갑니다."\n"막힌 단원부터 채우면 다음 반으로 갈 근거가 생깁니다."\n"이 아이에게 지금 필요한 건 이 단원입니다."', note:'내부 상담 언어 점검용 예시입니다. 실제 교습과정·광고 문구 적용은 관할 교육청 확인이 필요합니다.', src:'장표 15쪽' },
};
const KEYS4 = ['accept','sceneText','plan','when'];
const cur = () => S.p3.rounds[S.p3.r];

function renderSceneGrid(){
  const g = $('#scene-grid'); g.innerHTML = '';
  Object.entries(SCENES).forEach(([k, v]) => {
    const b = document.createElement('button'); b.type='button'; b.dataset.scene = k;
    if (!v.main) b.classList.add('extra');
    b.innerHTML = `<b>${v.t}</b><small>${v.s}</small>`;
    b.classList.toggle('on', cur().scene === k);
    b.setAttribute('aria-pressed', cur().scene === k);
    b.onclick = () => { cur().scene = k; renderP3(); };
    g.appendChild(b);
  });
}
function renderP3(){
  const r = cur(), sc = SCENES[r.scene];
  renderSceneGrid();
  $$('.seg button').forEach(b => { const on = b.dataset.role === r.role; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
  $('#role-p').hidden = r.role !== 'p'; $('#role-t').hidden = r.role !== 't';
  $('#round').textContent = `${S.p3.r + 1}회차`;
  $('#p-open').textContent = sc.open; $('#p-push').textContent = sc.push; $('#t-open').textContent = sc.open;
  $$('[data-k4]').forEach(t => { t.value = r[t.dataset.k4] || ''; paint($(`[data-fb="${t.dataset.k4}"]`), judge4(t.dataset.k4, t.value)); });
  $('#script').innerHTML = `<p class="ng"><span class="tag bad">피할 말</span> ${esc(sc.ng)}</p><p class="okl">${esc(sc.ok)}</p>${sc.note?`<p class="hint">${esc(sc.note)}</p>`:''}<p class="hint">출처: 양영학원 CS 교육 ${sc.src}</p>`;
}
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
$$('[data-k4]').forEach(t => t.addEventListener('input', () => { cur()[t.dataset.k4] = t.value; paint($(`[data-fb="${t.dataset.k4}"]`), judge4(t.dataset.k4, t.value)); }));
$$('.seg button').forEach(b => b.onclick = () => { cur().role = b.dataset.role; renderP3(); });
$('#swap').onclick = () => {
  const prev = cur();
  if (S.p3.rounds.length >= 6){ toast('여섯 번이면 충분합니다'); return; }
  S.p3.rounds.push({ role: prev.role === 't' ? 'p' : 't', scene: prev.scene });
  S.p3.r = S.p3.rounds.length - 1;
  renderP3();
  toast(`${S.p3.r + 1}회차 · 지금은 ${cur().role === 't' ? '선생님' : '학부모'} 자리입니다`);
  $('#p3').scrollIntoView({behavior:'smooth'});
};
renderP3();

/* ---------- tools ---------- */
$$('.tool-tabs button').forEach(b => b.onclick = () => {
  $$('.tool-tabs button').forEach(x => x.classList.toggle('on', x === b));
  $$('.tool').forEach(t => t.classList.toggle('on', t.id === 't-' + b.dataset.tool));
});

const fmt = (d) => `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')} (${'일월화수목금토'[d.getDay()]})`;
const parseD = (s) => { if (!s) return null; const [y,m,dd] = s.split('-').map(Number); return new Date(y, m-1, dd); };
const addD = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const CAL = [
  [0,  '1일', '첫 수업 · 첫 성공', '작은 성공을 경험하게 합니다'],
  [14, '2주', '적응 피드백', '담임이 먼저 연락합니다'],
  [42, '6주', '작은 변화 발견', '태도·습관의 변화를 함께 칭찬합니다'],
  [84, '12주', '성장 이야기 전달', '성장을 정리해 가정과 공유합니다'],
];

function absentResult(){
  const a = S.ab;
  if (!a.count && !a.new && !a.exam) return null;
  const n = +(a.count || 1);
  let c;
  if (a.exam === '예' || n >= 3) c = 'red'; else if (a.new === '예' || n >= 2) c = 'yel'; else c = 'gray';
  const M = {
    gray:['회색', '#C9CDD3', '출석부에 회색 스티커. 담임에게 넘기지 않고 기록만 남깁니다. 같은 아이가 다음에도 결석하면 노랑이 됩니다.'],
    yel:['노랑', '#E2B85C', '오늘 안에 담임에게 넘깁니다. 담임은 복귀 첫 수업에서 적응을 먼저 봅니다.'],
    red:['빨강', '#B4533F', '바로 담임에게 넘깁니다. 이후 연락 방식은 관 기준을 따릅니다.'],
  }[c];
  let why = [];
  if (a.exam === '예') why.push('학교 시험 2주 전');
  if (n >= 3) why.push('3회 연속'); else if (n === 2) why.push('연속 2회');
  if (a.new === '예') why.push('신규생');
  if (!why.length) why.push(a.why === '질병·가정사' ? '질병·가정사' : '단순 결석');
  return { name:M[0], color:M[1], act:M[2], why:why.join(' · ') };
}

function refreshOutputs(){
  const rx = S.rx;
  set('_out.rx', [
    '[처방 세 줄 · 신입생 인계 카드]',
    `지금 위치: ${rx.now||''}`,
    `막힌 지점: ${rx.stuck||''}`,
    `첫 4주 계획: ${rx.plan||''}`,
    `다음 연락: ${rx.date ? fmt(parseD(rx.date)) : ''}`,
    `받는 담임: ${rx.to||''}`,
  ].join('\n'));
  const ho = S.ho;
  set('_out.ho', [
    `[인계 한 장] ${ho.who||''}`,
    `1. 시작점: ${ho.start||''}`, `2. 지금의 장면: ${ho.scene||''}`, `3. 강점: ${ho.strong||''}`,
    `4. 학부모가 걱정하는 것: ${ho.worry||''}`, `5. 우리가 한 약속: ${ho.promise||''}`, `6. 다음 담당자의 첫 주 확인: ${ho.first||''}`,
  ].join('\n'));

  // calendar
  const d0 = parseD(S.cal.date); const ol = $('#cal-out'); ol.innerHTML = '';
  const today = new Date(); today.setHours(0,0,0,0);
  const lines = [`[90일 달력] ${S.cal.who||''}`];
  if (d0){
    CAL.forEach(([n, w, t, b]) => {
      const d = addD(d0, n); const diff = (d - today) / 864e5;
      const li = document.createElement('li');
      if (diff < 0) li.classList.add('past'); else if (diff <= 6) li.classList.add('now');
      li.innerHTML = `<b>${w} · ${t}</b><span class="d">${fmt(d).slice(5)}</span><span>${b}${diff>=0&&diff<=6?' · 이번 주':''}</span>`;
      ol.appendChild(li); lines.push(`${w} ${t}: ${fmt(d)} — ${b}`);
    });
    const li = document.createElement('li'); li.innerHTML = `<b>시험 전후 · 목표와 회복</b><span class="d">학교별</span><span>결과를 점검하고 다음 목표를 세웁니다</span>`; ol.appendChild(li);
    lines.push('시험 전후 목표와 회복: 학교별 시험 일정에 맞춰 — 결과를 점검하고 다음 목표를 세웁니다');
  } else {
    ol.innerHTML = '<li><span>첫 수업일을 넣으면 2주·6주·12주 날짜가 나옵니다.</span></li>';
  }
  set('_out.cal', lines.join('\n'));

  // absent
  const ar = absentResult();
  $('#ab-sw').style.background = ar ? ar.color : '#E5E7EB';
  $('#ab-color').textContent = ar ? `${ar.name} · ${ar.why}` : '항목을 고르면 색이 나옵니다';
  $('#ab-act').textContent = ar ? ar.act : '';

  $$('[data-out]').forEach(p => { if (p.dataset.out !== 'all') p.textContent = get('_out.' + p.dataset.out) || ''; });
}

/* ---------- full record ---------- */
function buildAll(){
  const L = [];
  const w = S.who;
  L.push('양영학원 선생님 교육 · 실습지', `작성일: ${fmt(new Date())}`);
  L.push(`소속: ${w.branch||''} / 역할: ${w.role||''} / 학년군: ${(w.grade||[]).join(', ')}`, '');
  L.push('■ 실습 1 · 그 아이의 첫 신호');
  L.push(`그만둔 아이: ${S.p1.who||''}`, `그때 내가 보던 것: ${S.p1.saw||''}`, `보였던 신호: ${(S.p1.signals||[]).join(' / ')}`, `다시 온다면: ${S.p1.again||''}`, '');
  L.push('■ 실습 2 · 관찰 한 줄');
  S.p2.obs.forEach((o,i) => { if (o.name||o.scene||o.next) L.push(`${i+1}) ${o.name||''}`, `   장면: ${o.scene||''}`, `   다음 행동: ${o.next||''}`); });
  L.push('');
  L.push('■ 실습 3 · 네 칸 응대');
  S.p3.rounds.forEach((r,i) => {
    const sc = SCENES[r.scene];
    if (r.role==='t' && KEYS4.some(k=>r[k])) L.push(`${i+1}회차 (선생님 · ${sc.t})`, `   수용: ${r.accept||''}`, `   장면: ${r.sceneText||''}`, `   계획: ${r.plan||''}`, `   시점: ${r.when||''}`);
    else L.push(`${i+1}회차 (${r.role==='t'?'선생님':'학부모'} · ${sc.t})`);
  });
  L.push(`역할을 바꾼 뒤 남은 문장: ${S.p3.left||''}`, '');
  L.push('■ 실습 4 · 내일부터 한 가지 (30일)');
  L.push(`고른 것: ${S.p4.pick||''}`);
  if (S.p4.pick && S.p4.pick.startsWith('내 반에서')) L.push(`다섯 명: ${[1,2,3,4,5].map(i=>S.p4['n'+i]||'').filter(Boolean).join(', ')}`);
  L.push(`시작: ${S.p4.start||''} ${S.p4.when||''}`, `마지막 한 줄: ${S.p4.last||''}`, '');
  if (S.rx.now||S.rx.stuck||S.rx.plan) L.push(get('_out.rx'), '');
  if (S.ho.start||S.ho.scene||S.ho.promise) L.push(get('_out.ho'), '');
  if (S.cal.date) L.push(get('_out.cal'), '');
  L.push('오늘 남길 세 문장', '1. 감정에는 위로로, 판단에는 근거로 답합니다', '2. 칭찬이 아니라 관찰로 말합니다', '3. 모르는 것은 단정하지 않고, 약속한 날짜에 먼저 연락합니다');
  return L.join('\n');
}
function renderAll(){ refreshOutputs(); $('[data-out="all"]').textContent = buildAll(); }

/* ---------- copy / download ---------- */
async function copyText(txt){
  try { await navigator.clipboard.writeText(txt); return true; } catch(e) {}
  try {
    const ta = document.createElement('textarea'); ta.value = txt; ta.setAttribute('readonly',''); ta.style.position='fixed'; ta.style.opacity='0';
    document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); return ok;
  } catch(e) { return false; }
}
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-copy]'); if (!b) return;
  const key = b.dataset.copy;
  if (key === 'all') renderAll(); else refreshOutputs();
  const txt = key === 'all' ? buildAll() : get('_out.' + key);
  const ok = await copyText(txt);
  if (ok) toast('복사했습니다');
  else {
    const pre = $(`[data-out="${key}"]`); const rg = document.createRange(); rg.selectNodeContents(pre);
    const sel = getSelection(); sel.removeAllRanges(); sel.addRange(rg);
    toast('글자를 선택해 두었습니다. 길게 눌러 복사하세요');
  }
});
$('#dl').onclick = () => {
  renderAll();
  const txt = buildAll();
  try {
    const blob = new Blob(['\ufeff' + txt], {type:'text/plain;charset=utf-8'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    const nm = (S.who.branch||'실습지').replace(/[\\/:*?"<>|\s]/g,'');
    a.download = `양영_실습지_${nm}.txt`; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    $('#rec-msg').textContent = '파일 받기를 눌렀습니다. 받기가 안 되면 "전체 복사"를 눌러 메모장이나 메신저에 붙여 두세요.';
  } catch(e) {
    $('#rec-msg').textContent = '이 화면에서는 파일 받기가 막혀 있습니다. "전체 복사"를 써 주세요.';
  }
};

/* ---------- autosave to training log ---------- */
// 교육 기록 시트(Google Apps Script 웹앱) 주소. 비어 있으면 저장하지 않습니다.
const SAVE_URL = 'https://script.google.com/macros/s/AKfycby0LTRjcy9TnlvGZ20bP44TZAr-UYBx3xPO5xTWn4ykxsWqyQdf9BCsXHKdep16xlle/exec';
const SID = Date.now().toString(16) + Array.from(crypto.getRandomValues(new Uint8Array(4)), b => b.toString(16).padStart(2, '0')).join(''); // 16진수만 (Google이 sid 값을 16진수로 검사)
let lastSent = '', saveT;
function saveFields(){
  const w = S.who;
  const obs = (S.p2.obs||[]).filter(o=>o.scene||o.next).map(o=>`${o.name||''} | ${o.scene||''} → ${o.next||''}`).join('\n');
  return {
    sid: SID, branch: w.branch||'', role: w.role||'', grade: (w.grade||[]).join(', '),
    signals: (S.p1.signals||[]).join(' / '), again: S.p1.again||'', obs,
    left: S.p3.left||'', pick: S.p4.pick||'', start: `${S.p4.start||''} ${S.p4.when||''}`.trim(),
    last: S.p4.last||'', all: buildAll()
  };
}
function hasContent(f){ return [f.signals,f.again,f.obs,f.left,f.pick,f.last].some(Boolean) || S.p1.who || S.p1.saw; }
function save(beacon){
  if (!SAVE_URL) return;
  const f = saveFields(); if (!hasContent(f)) return;
  const body = new URLSearchParams(f); const key = body.toString().replace(/&all=[^&]*/, '');
  if (key === lastSent) return; lastSent = key;
  try {
    if (beacon && navigator.sendBeacon) navigator.sendBeacon(SAVE_URL, body);
    else fetch(SAVE_URL, { method:'POST', mode:'no-cors', body, keepalive:true }).catch(()=>{ lastSent=''; });
  } catch(e) { lastSent = ''; }
}
const queueSave = () => { clearTimeout(saveT); saveT = setTimeout(()=>save(false), 6000); };
document.addEventListener('input', queueSave);
document.addEventListener('click', e => { if (e.target.closest('button')) queueSave(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') save(true); });
window.addEventListener('pagehide', () => save(true));

refreshOutputs();
})();
