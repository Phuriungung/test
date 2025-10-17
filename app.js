// Quick Ward Note — core logic
(function(){
  const $$ = sel => document.querySelector(sel);

  const ioBlocks = {
    morning: { in: [], out: [] },
    afternoon: { in: [], out: [] }
  };

  function el(tag, attrs={}, ...children){
    const e = document.createElement(tag);
    Object.entries(attrs).forEach(([k,v])=>{
      if(k === 'class') e.className = v; else if(k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if(k === 'dataset') Object.entries(v).forEach(([dk,dv])=> e.dataset[dk] = dv);
      else e.setAttribute(k,v);
    });
    children.flat().forEach(c => {
      if (c == null) return;
      if (typeof c === 'string') e.appendChild(document.createTextNode(c));
      else e.appendChild(c);
    });
    return e;
  }

  function addIOLine(container, kind){
    const line = el('div', { class: 'io-line' });
    const kindInput = el('input', { class: 'kind', placeholder: kind === 'in' ? 'oral / ivf / นม / ...' : 'urine / drain / ...' });
    const amount = el('input', { class: 'amount', inputmode: 'decimal', placeholder: '0' });
    const rm = el('button', { class: 'remove', onclick: ()=>{ line.remove(); recalc(container.closest('.io-block')); save(); }}, '×');
    line.append(kindInput, amount, rm);
    container.appendChild(line);
    amount.addEventListener('input', ()=>{ recalc(container.closest('.io-block')); save(); });
    kindInput.addEventListener('input', ()=> save());
  }

  function parseAmount(v){
    if(!v) return 0;
    const m = (''+v).match(/-?\d+(?:[.,]\d+)?/);
    return m ? parseFloat(m[0].replace(',', '.')) : 0;
  }

  function sumLines(lines){
    return Array.from(lines.querySelectorAll('input.amount')).reduce((s,inp)=> s + parseAmount(inp.value), 0);
  }

  function getOverride(blockEl){
    const oi = blockEl.querySelector('.override-in');
    const oo = blockEl.querySelector('.override-out');
    return {
      in: parseAmount(oi?.value),
      out: parseAmount(oo?.value),
      hasIn: !!(oi && oi.value.trim() !== ''),
      hasOut: !!(oo && oo.value.trim() !== '')
    };
  }

  function recalc(blockEl){
    const ov = getOverride(blockEl);
    const calcIn = sumLines(blockEl.querySelector('.lines.in'));
    const calcOut = sumLines(blockEl.querySelector('.lines.out'));
    const sumIn = ov.hasIn ? ov.in : calcIn;
    const sumOut = ov.hasOut ? ov.out : calcOut;
    const net = sumIn - sumOut;
    blockEl.querySelector('.sum-in').textContent = Math.round(sumIn);
    blockEl.querySelector('.sum-out').textContent = Math.round(sumOut);
    const netSpan = blockEl.querySelector('.net');
    netSpan.textContent = (net>=0?'+':'') + Math.round(net);
    netSpan.classList.toggle('neg', net<0);
    updatePreview();
  }

  function recalcAll(){
    document.querySelectorAll('.io-block').forEach(b => recalc(b));
  }

  function gatherIO(blockEl){
    const read = cls => Array.from(blockEl.querySelectorAll(`.lines.${cls} .io-line`)).map(line=>({
      kind: line.querySelector('input.kind').value.trim(),
      amount: parseAmount(line.querySelector('input.amount').value)
    })).filter(x => x.kind || x.amount);
    const ov = getOverride(blockEl);
    return { in: read('in'), out: read('out'), override: ov };
  }

  function formatIO(label, data){
    const calcIn = data.in.reduce((s,x)=>s+x.amount,0);
    const calcOut = data.out.reduce((s,x)=>s+x.amount,0);
    const sumIn = data.override?.hasIn ? data.override.in : calcIn;
    const sumOut = data.override?.hasOut ? data.override.out : calcOut;
    const net = sumIn - sumOut;
    const hasDigits = (s) => /\d/.test(s||'');
    const fmtPairs = arr => arr.map(x=> {
      const k = x.kind || '?';
      const amt = Math.round(x.amount);
      // If kind already contains digits (e.g., "urine 600+ท1"), don't repeat the number
      return hasDigits(k) ? k : `${k} ${amt}`;
    }).join(', ');

    const lines = [];
    lines.push(`I/O ${label}:`);
    lines.push(`I: ${Math.round(sumIn)} (${fmtPairs(data.in)})`);
    lines.push(`O: ${Math.round(sumOut)} (${fmtPairs(data.out)})`);
    if(!Number.isNaN(net)){
      lines.push(`${net>=0? 'Pos': 'Neg'}${Math.round(Math.abs(net))}`);
    }
    return lines.join('\n');
  }

  function generateNote(){
    const bed = $$('#bed').value.trim();
    const name = $$('#name').value.trim();
    const hashtags = $$('#hashtags').value.trim();
  const cli = $$('#cli').value.trim();
  const mx = $$('#mx')?.value.trim();
    const vs = {
      bt: $$('#bt').value.trim(), pr: $$('#pr').value.trim(), rr: $$('#rr').value.trim(),
      bp: $$('#bp').value.trim(), o2: $$('#o2').value.trim()
    };

    const morningBlock = document.querySelector('.io-block[data-block="morning"]');
    const afternoonBlock = document.querySelector('.io-block[data-block="afternoon"]');

    const morning = gatherIO(morningBlock);
    const afternoon = gatherIO(afternoonBlock);

    const sumIn = (a)=> a.in.reduce((s,x)=>s+x.amount,0);
    const sumOut = (a)=> a.out.reduce((s,x)=>s+x.amount,0);

  const mInCalc = sumIn(morning), mOutCalc = sumOut(morning);
  const aInCalc = sumIn(afternoon), aOutCalc = sumOut(afternoon);
  const mIn = morning.override.hasIn ? morning.override.in : mInCalc;
  const mOut = morning.override.hasOut ? morning.override.out : mOutCalc;
  const aIn = afternoon.override.hasIn ? afternoon.override.in : aInCalc;
  const aOut = afternoon.override.hasOut ? afternoon.override.out : aOutCalc;

    const totalIn = mIn + aIn;
    const totalOut = mOut + aOut;
    const totalNet = totalIn - totalOut;

    const header = `${bed} ${name}`.trim();
    const lines = [];
    if(header) lines.push(header);
    if(hashtags){
      // Support multiline input; prefix each non-empty line with '#'
      const tagLines = hashtags.split(/\r?\n/)
        .map(s=> s.trim())
        .filter(Boolean)
        .map(s=> s.startsWith('#')? s : `#${s}`);
      lines.push(tagLines.join('\n'));
    }
    if(cli) lines.push(`\nCli: ${cli}`);

    const vsParts = [];
    if(vs.bt) vsParts.push(`BT ${vs.bt}`);
    if(vs.pr) vsParts.push(`PR ${vs.pr}`);
    if(vs.rr) vsParts.push(`RR ${vs.rr}`);
    if(vs.bp) vsParts.push(`BP ${vs.bp}`);
    if(vs.o2) vsParts.push(`O2sat ${vs.o2.replace(/%?$/, '%')}`);
    if(vsParts.length) lines.push(`\nV/S ${vsParts.join(' ')}`);

  lines.push('\n' + formatIO('เช้า', morning));
  lines.push('\n' + formatIO('บ่าย', afternoon));

  const totalLine = `\nI/O รวม: ${Math.round(totalIn)}/${Math.round(totalOut)} (${totalNet>=0? '+' : ''}${Math.round(totalNet)})`;
    lines.push(totalLine);

  if(mx) lines.push(`\nMx: ${mx}`);

  const note = lines.join('\n');
    return note
      .replace(/\n\n\n+/g, '\n\n')
      .trim();
  }

  function updatePreview(){
    $$('#output').textContent = generateNote();
  }

  function initIO(){
    document.querySelectorAll('.io-block').forEach(block=>{
      const linesIn = block.querySelector('.lines.in');
      const linesOut = block.querySelector('.lines.out');

      // start with one input and one output row
      addIOLine(linesIn, 'in');
      addIOLine(linesOut, 'out');

      block.querySelectorAll('button.add').forEach(btn=>{
        btn.addEventListener('click', ()=>{
          const kind = btn.dataset.kind;
          addIOLine(kind==='in'? linesIn : linesOut, kind);
          recalc(block);
          save();
        });
      });

      // quick add: parse comma/newline separated entries of "kind amount"
      block.querySelectorAll('.quick-add-row').forEach(row=>{
        const qa = row.querySelector('.quick-add');
        const isIn = row.dataset.kind === 'in';
        qa.addEventListener('keydown', (e)=>{
          if(e.key === 'Enter'){
            e.preventDefault();
            const raw = qa.value.trim();
            if(!raw) return;
            const targets = isIn ? linesIn : linesOut;
            const parts = raw.split(/[,\n]/).map(s=> s.trim()).filter(Boolean);
            parts.forEach(p=>{
              // choose the largest numeric token in the phrase as amount
              // keeps the full phrase as kind (no trimming of trailing numbers)
              // examples:
              //  - "oral 800" => kind: "oral 800" (display preserves), amount: 800
              //  - "drain 950+ท1" => amount: 950 (largest numeric), kind unchanged
              //  - "urine 600+ท1 600" => amount: 600
              let amt = 0;
              const nums = [...p.matchAll(/-?\d+(?:[.,]\d+)?/g)].map(m=> parseFloat(m[0].replace(',', '.')));
              if(nums.length){ amt = nums.reduce((a,b)=> Math.abs(b) > Math.abs(a) ? b : a, 0); }
              const kind = p;
              addIOLine(targets, isIn? 'in':'out');
              const last = targets.lastElementChild;
              last.querySelector('input.kind').value = kind;
              last.querySelector('input.amount').value = amt || '';
            });
            qa.value = '';
            recalc(block);
            save();
          }
        });
      });
    });
  }

  function save(){
    const data = {
      bed: $$('#bed').value, name: $$('#name').value, hashtags: $$('#hashtags').value,
  cli: $$('#cli').value, mx: $$('#mx')?.value, bt: $$('#bt').value, pr: $$('#pr').value, rr: $$('#rr').value, bp: $$('#bp').value, o2: $$('#o2').value,
      io: Array.from(document.querySelectorAll('.io-block')).map(block=>{
        const b = gatherIO(block);
        return b;
      })
    };
    try { localStorage.setItem('notify-data', JSON.stringify(data)); } catch {}
  }

  function load(){
    try {
      const s = localStorage.getItem('notify-data');
      if(!s) return;
      const data = JSON.parse(s);
      $$('#bed').value = data.bed||''; $$('#name').value = data.name||''; $$('#hashtags').value = data.hashtags||'';
  $$('#cli').value = data.cli||''; if($$('#mx')) $$('#mx').value = data.mx||''; $$('#bt').value = data.bt||''; $$('#pr').value = data.pr||''; $$('#rr').value = data.rr||''; $$('#bp').value = data.bp||''; $$('#o2').value = data.o2||'';

      const blocks = document.querySelectorAll('.io-block');
      ['morning','afternoon'].forEach((label, idx)=>{
        const block = blocks[idx];
        const linesIn = block.querySelector('.lines.in');
        const linesOut = block.querySelector('.lines.out');
        linesIn.innerHTML = ''; linesOut.innerHTML = '';
        (data.io?.[idx]?.in||[{kind:'', amount:0}]).forEach(x=>{
          addIOLine(linesIn, 'in');
          const last = linesIn.lastElementChild;
          last.querySelector('input.kind').value = x.kind||'';
          last.querySelector('input.amount').value = x.amount||'';
        });
        (data.io?.[idx]?.out||[{kind:'', amount:0}]).forEach(x=>{
          addIOLine(linesOut, 'out');
          const last = linesOut.lastElementChild;
          last.querySelector('input.kind').value = x.kind||'';
          last.querySelector('input.amount').value = x.amount||'';
        });
      });
      recalcAll();
    } catch {}
  }

  function bindActions(){
    $$('#gen').addEventListener('click', ()=>{ updatePreview(); save(); });
    async function copyText(text){
      // Try Clipboard API first
      try {
        if(navigator.clipboard && window.isSecureContext){
          await navigator.clipboard.writeText(text);
          return true;
        }
      } catch {}
      // Fallback: use a temporary textarea (works better on Android)
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return ok;
      } catch {}
      return false;
    }
    $$('#copy').addEventListener('click', async ()=>{
      const text = $$('#output').textContent; // copy what user sees/edited
      const ok = await copyText(text);
      $$('#copy').textContent = ok ? 'Copied' : 'Copy failed';
      setTimeout(()=> $$('#copy').textContent = 'Copy', 1400);
    });
    $$('#reset').addEventListener('click', ()=>{ localStorage.removeItem('notify-data'); location.reload(); });

    document.addEventListener('keydown', (e)=>{
      const meta = e.metaKey || (e.ctrlKey && navigator.platform.toLowerCase().includes('win'));
      if(meta && e.key === 'Enter'){ e.preventDefault(); updatePreview(); }
      if(meta && (e.key.toLowerCase() === 'c')){ e.preventDefault(); copyText($$('#output').textContent); }
    });

    // auto preview
    ['bed','name','hashtags','cli','mx','bt','pr','rr','bp','o2'].forEach(id=>{
      $$("#"+id).addEventListener('input', ()=>{ updatePreview(); save(); });
    });

    // override inputs update
    document.querySelectorAll('.override-in, .override-out').forEach(inp=>{
      inp.addEventListener('input', ()=>{ recalc(inp.closest('.io-block')); save(); });
    });

    // live toggle: if off, don't auto-update from inputs; manual Generate applies
    const live = $$('#live');
    const triggerUpdate = ()=>{ if(live?.checked !== false) updatePreview(); };
    document.querySelectorAll('input, textarea').forEach(el=>{
      if(el.id === 'live') return;
      el.addEventListener('input', triggerUpdate);
    });
    live?.addEventListener('change', ()=>{ if(live.checked) updatePreview(); });
  }

  // init
  initIO();
  load();
  bindActions();
  updatePreview();
})();
