// Quick Ward Note — core logic
(function(){
  const $$ = sel => document.querySelector(sel);
  let lastSegments = null; // snapshot of last generated segments used in preview merge
  const STORAGE_KEY = 'notify-profiles-v1';
  let profiles = {}; // id -> data
  let currentProfileId = null;

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
    const displayInput = el('input', { class: 'display', placeholder: 'e.g., 500+ท1' });
    const amount = el('input', { class: 'amount', inputmode: 'decimal', placeholder: '500' });
    const rm = el('button', { class: 'remove', onclick: ()=>{ line.remove(); recalc(container.closest('.io-block')); save(); }}, '×');
    line.append(kindInput, displayInput, amount, rm);
    container.appendChild(line);
    amount.addEventListener('input', ()=>{ recalc(container.closest('.io-block')); save(); });
    kindInput.addEventListener('input', ()=> save());
    displayInput.addEventListener('input', ()=> save());
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
      display: line.querySelector('input.display')?.value.trim() || '',
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
      const disp = (x.display && x.display.trim()) ? x.display.trim() : `${Math.round(x.amount)}`;
      return `${k} ${disp}`.trim();
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

  function buildSegments(){
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

    const seg = {};
    seg.header = `${bed} ${name}`.trim();
    if(hashtags){
      const tagLines = hashtags.split(/\r?\n/)
        .map(s=> s.trim())
        .filter(Boolean)
        .map(s=> s.startsWith('#')? s : `#${s}`);
      seg.hashtags = tagLines.join('\n');
    } else seg.hashtags = '';
    seg.cli = cli ? `\nCli: ${cli}` : '';

    const vsParts = [];
    if(vs.bt) vsParts.push(`BT ${vs.bt}`);
    if(vs.pr) vsParts.push(`PR ${vs.pr}`);
    if(vs.rr) vsParts.push(`RR ${vs.rr}`);
    if(vs.bp) vsParts.push(`BP ${vs.bp}`);
    if(vs.o2) vsParts.push(`O2sat ${vs.o2.replace(/%?$/, '%')}`);
    seg.vs = vsParts.length ? `\nV/S ${vsParts.join(' ')}` : '';

    seg.ioMorning = '\n' + formatIO('เช้า', morning);
    seg.ioAfternoon = '\n' + formatIO('บ่าย', afternoon);
    seg.total = `\nI/O รวม: ${Math.round(totalIn)}/${Math.round(totalOut)} (${totalNet>=0? '+' : ''}${Math.round(totalNet)})`;
    seg.mx = mx ? `\nMx: ${mx}` : '';
    return seg;
  }

  function composeFromSegments(seg){
    const parts = [];
    if(seg.header) parts.push(seg.header);
    if(seg.hashtags) parts.push(seg.hashtags);
    if(seg.cli) parts.push(seg.cli);
    if(seg.vs) parts.push(seg.vs);
    if(seg.ioMorning) parts.push(seg.ioMorning);
    if(seg.ioAfternoon) parts.push(seg.ioAfternoon);
    if(seg.total) parts.push(seg.total);
    if(seg.mx) parts.push(seg.mx);
    return parts.join('\n').replace(/\n\n\n+/g, '\n\n').trim();
  }

  function updatePreview(){
    const segNew = buildSegments();
    const out = $$('#output');
    let current = out.textContent || '';
    if(!current){
      current = composeFromSegments(segNew);
      out.textContent = current;
      lastSegments = segNew;
      save();
      return;
    }
    // Non-destructive: only replace previous segment outputs still present
    let updated = current;
    if(lastSegments){
      const keys = ['header','hashtags','cli','vs','ioMorning','ioAfternoon','total','mx'];
      for(const k of keys){
        const oldSeg = lastSegments[k] || '';
        const newSeg = segNew[k] || '';
        if(!oldSeg) continue;
        if(updated.includes(oldSeg)){
          updated = updated.replace(oldSeg, newSeg);
        }
      }
    } else {
      updated = composeFromSegments(segNew);
    }
    out.textContent = updated;
    lastSegments = segNew;
    save();
  }

  function initIO(){
    document.querySelectorAll('.io-block').forEach(block=>{
      const linesIn = block.querySelector('.lines.in');
      const linesOut = block.querySelector('.lines.out');

      // start with three input and three output rows
      for(let i=0;i<3;i++) addIOLine(linesIn, 'in');
      for(let i=0;i<3;i++) addIOLine(linesOut, 'out');

      // fixed number of rows; + add removed
    });
  }

  function save(){
    const data = {
      bed: $$('#bed').value, name: $$('#name').value, hashtags: $$('#hashtags').value,
  cli: $$('#cli').value, mx: $$('#mx')?.value, bt: $$('#bt').value, pr: $$('#pr').value, rr: $$('#rr').value, bp: $$('#bp').value, o2: $$('#o2').value,
      io: Array.from(document.querySelectorAll('.io-block')).map(block=>{
        const b = gatherIO(block);
        return b;
      }),
      preview: $$('#output')?.textContent || '',
      lastSegments
    };
    try {
      // Persist into the profiles map
      if(!currentProfileId){
        currentProfileId = `p-${Date.now()}`;
      }
      const existing = profiles[currentProfileId] || { label: 'Untitled', data: null };
      profiles[currentProfileId] = { label: existing.label || 'Untitled', data };
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ current: currentProfileId, profiles }));
      // Also keep backwards compatible single save
      localStorage.setItem('notify-data', JSON.stringify(data));
      // update selector label
      refreshProfileSelect();
    } catch {}
  }

  function load(){
    try {
      // Load profiles
      const raw = localStorage.getItem(STORAGE_KEY);
      if(raw){
        const parsed = JSON.parse(raw);
        profiles = parsed.profiles || {};
        currentProfileId = parsed.current || Object.keys(profiles)[0] || null;
      } else {
        profiles = {};
        currentProfileId = null;
      }

      // If no profile exists but legacy data exists, migrate into a new profile
      let data;
      if(!currentProfileId){
        const legacy = localStorage.getItem('notify-data');
        if(legacy){
          data = JSON.parse(legacy);
          currentProfileId = `p-${Date.now()}`;
          profiles[currentProfileId] = { label: 'Imported', data };
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ current: currentProfileId, profiles }));
        } else {
          // Create a new blank profile so first load is empty UI
          currentProfileId = `p-${Date.now()}`;
          data = { bed:'', name:'', hashtags:'', cli:'', mx:'', bt:'', pr:'', rr:'', bp:'', o2:'', io:[{in:[], out:[]},{in:[], out:[]}], preview:'', lastSegments:null };
          profiles[currentProfileId] = { label: 'Untitled', data };
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ current: currentProfileId, profiles }));
        }
      } else {
        data = profiles[currentProfileId]?.data || null;
      }
      refreshProfileSelect();
      if(!data) return;
      $$('#bed').value = data.bed||''; $$('#name').value = data.name||''; $$('#hashtags').value = data.hashtags||'';
  $$('#cli').value = data.cli||''; if($$('#mx')) $$('#mx').value = data.mx||''; $$('#bt').value = data.bt||''; $$('#pr').value = data.pr||''; $$('#rr').value = data.rr||''; $$('#bp').value = data.bp||''; $$('#o2').value = data.o2||'';

      const blocks = document.querySelectorAll('.io-block');
      ['morning','afternoon'].forEach((label, idx)=>{
        const block = blocks[idx];
        const linesIn = block.querySelector('.lines.in');
        const linesOut = block.querySelector('.lines.out');
        linesIn.innerHTML = ''; linesOut.innerHTML = '';
        const inArr = data.io?.[idx]?.in || [];
        const outArr = data.io?.[idx]?.out || [];
        const inCount = Math.max(3, inArr.length || 0);
        const outCount = Math.max(3, outArr.length || 0);
        for(let i=0;i<inCount;i++){
          addIOLine(linesIn, 'in');
          const last = linesIn.lastElementChild;
          const x = inArr[i] || {kind:'', display:'', amount: ''};
          last.querySelector('input.kind').value = x.kind||'';
          if(last.querySelector('input.display')) last.querySelector('input.display').value = x.display||'';
          last.querySelector('input.amount').value = (x.amount!==undefined && x.amount!==null && x.amount!=='') ? x.amount : '';
        }
        for(let i=0;i<outCount;i++){
          addIOLine(linesOut, 'out');
          const last = linesOut.lastElementChild;
          const x = outArr[i] || {kind:'', display:'', amount: ''};
          last.querySelector('input.kind').value = x.kind||'';
          if(last.querySelector('input.display')) last.querySelector('input.display').value = x.display||'';
          last.querySelector('input.amount').value = (x.amount!==undefined && x.amount!==null && x.amount!=='') ? x.amount : '';
        }
      });
      recalcAll();
      // restore preview and lastSegments
      if(data.preview){ $$('#output').textContent = data.preview; }
      if(data.lastSegments){ lastSegments = data.lastSegments; }
    } catch {}
  }

  function refreshProfileSelect(){
    const sel = $$('#profileSelect');
    if(!sel) return;
    sel.innerHTML = '';
    const ids = Object.keys(profiles);
    if(ids.length === 0){
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'No profiles';
      sel.appendChild(opt);
      return;
    }
    ids.forEach(id=>{
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = profiles[id]?.label || id;
      sel.appendChild(opt);
    });
    sel.value = currentProfileId || '';
  }

  function bindActions(){
  // always live update; no generate button
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

    // Mobile preview sheet logic
  const sheet = document.getElementById('mobilePreviewSheet');
  const mobileBody = document.getElementById('mobilePreviewBody');
    const toggleBtn = document.getElementById('togglePreview');
    const closeSheet = document.getElementById('closeSheet');
    const copyMobile = document.getElementById('copyMobile');

    function isMobile(){ return true; } // always use sheet
    function mountPreview(){
      let out = document.getElementById('output');
      if(!out){
        out = document.createElement('pre');
        out.id = 'output';
        out.className = 'preview';
        out.contentEditable = 'true';
        out.spellcheck = false;
      }
      if(out.parentElement !== mobileBody) mobileBody.appendChild(out);
    }
    window.addEventListener('resize', mountPreview);
    mountPreview();

    function openSheet(){ sheet.classList.add('open'); }
    function closeSheetFn(){ sheet.classList.remove('open'); }
    toggleBtn?.addEventListener('click', ()=>{
      if(sheet.classList.contains('open')) closeSheetFn(); else openSheet();
    });
    closeSheet?.addEventListener('click', ()=>{ closeSheetFn(); });
    copyMobile?.addEventListener('click', async ()=>{
      const text = $$('#output').textContent;
      const ok = await copyText(text);
      copyMobile.textContent = ok ? 'Copied' : 'Copy failed';
      setTimeout(()=> copyMobile.textContent = 'Copy', 1400);
    });

  // keep mobile sheet behavior; open/close via FAB

    // Clicking preview body toggles close unless user is selecting/editing
    const previewEl = document.getElementById('output');
    document.getElementById('mobilePreviewBody')?.addEventListener('click', (e)=>{
      // If clicking on text area itself and selection is collapsed and not focused for typing, close
      const sel = window.getSelection();
      const isEditing = document.activeElement === previewEl;
      if(!isEditing && sel && sel.isCollapsed){ closeSheetFn(); }
    });
    // Open sheet the first time we generate content so user can see it
    let openedOnce = false;
    const openOnFirstUpdate = ()=>{ if(!openedOnce){ openSheet(); openedOnce = true; } };
    const origUpdate = updatePreview;
    updatePreview = function(){ origUpdate(); openOnFirstUpdate(); };
    // Persist manual edits in preview
    previewEl.addEventListener('input', ()=>{ save(); });
    const resetBtn = $$('#resetFab');
    resetBtn?.addEventListener('click', ()=>{
      const ok = confirm('Reset current patient data?');
      if(!ok) return;
      // Clear current profile data to blank template but keep other profiles
      const blank = {
        bed:'', name:'', hashtags:'', cli:'', mx:'', bt:'', pr:'', rr:'', bp:'', o2:'',
        io: [{in:[], out:[]},{in:[], out:[]}], preview:'', lastSegments:null
      };
      if(!currentProfileId){ currentProfileId = `p-${Date.now()}`; }
      profiles[currentProfileId] = { label: 'Untitled', data: blank };
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ current: currentProfileId, profiles }));
      // Apply blank to UI
      ['bed','name','hashtags','cli','mx','bt','pr','rr','bp','o2'].forEach(id=> $$("#"+id).value = '');
      const blocks = document.querySelectorAll('.io-block');
      blocks.forEach(block=>{
        block.querySelector('.lines.in').innerHTML='';
        block.querySelector('.lines.out').innerHTML='';
        for(let i=0;i<3;i++) addIOLine(block.querySelector('.lines.in'), 'in');
        for(let i=0;i<3;i++) addIOLine(block.querySelector('.lines.out'), 'out');
        block.querySelector('.override-in').value = '';
        block.querySelector('.override-out').value = '';
      });
      $$('#output').textContent = '';
      lastSegments = null;
      recalcAll();
      refreshProfileSelect();
    });

    // Profile actions
    const profileSelect = $$('#profileSelect');
    const btnNew = $$('#profileNew');
    const btnDelete = $$('#profileDelete');
    profileSelect?.addEventListener('change', ()=>{
      const id = profileSelect.value;
      if(!id || !profiles[id]) return;
      // save current first
      save();
      currentProfileId = id;
      // load selected
      const selData = profiles[id].data;
      // apply data to form
      $$('#bed').value = selData.bed||''; $$('#name').value = selData.name||''; $$('#hashtags').value = selData.hashtags||'';
      $$('#cli').value = selData.cli||''; if($$('#mx')) $$('#mx').value = selData.mx||''; $$('#bt').value = selData.bt||''; $$('#pr').value = selData.pr||''; $$('#rr').value = selData.rr||''; $$('#bp').value = selData.bp||''; $$('#o2').value = selData.o2||'';

      const blocks = document.querySelectorAll('.io-block');
      ['morning','afternoon'].forEach((label, idx)=>{
        const block = blocks[idx];
        const linesIn = block.querySelector('.lines.in');
        const linesOut = block.querySelector('.lines.out');
        linesIn.innerHTML = ''; linesOut.innerHTML = '';
        const inArr = selData.io?.[idx]?.in || [];
        const outArr = selData.io?.[idx]?.out || [];
        const inCount = Math.max(3, inArr.length || 0);
        const outCount = Math.max(3, outArr.length || 0);
        for(let i=0;i<inCount;i++){
          addIOLine(linesIn, 'in');
          const last = linesIn.lastElementChild;
          const x = inArr[i] || {kind:'', display:'', amount: ''};
          last.querySelector('input.kind').value = x.kind||'';
          if(last.querySelector('input.display')) last.querySelector('input.display').value = x.display||'';
          last.querySelector('input.amount').value = (x.amount!==undefined && x.amount!==null && x.amount!=='') ? x.amount : '';
        }
        for(let i=0;i<outCount;i++){
          addIOLine(linesOut, 'out');
          const last = linesOut.lastElementChild;
          const x = outArr[i] || {kind:'', display:'', amount: ''};
          last.querySelector('input.kind').value = x.kind||'';
          if(last.querySelector('input.display')) last.querySelector('input.display').value = x.display||'';
          last.querySelector('input.amount').value = (x.amount!==undefined && x.amount!==null && x.amount!=='') ? x.amount : '';
        }
      });
      recalcAll();
      // restore preview and lastSegments for selected profile
      $$('#output').textContent = selData.preview || '';
      lastSegments = selData.lastSegments || null;
      refreshProfileSelect();
    });

    btnNew?.addEventListener('click', ()=>{
      const label = prompt('New profile label') || '';
      const id = `p-${Date.now()}`;
      // create a blank profile and switch to it
      const blank = { bed:'', name:'', hashtags:'', cli:'', mx:'', bt:'', pr:'', rr:'', bp:'', o2:'', io:[{in:[], out:[]},{in:[], out:[]}], preview:'', lastSegments:null };
      profiles[id] = { label: label || 'Untitled', data: blank };
      currentProfileId = id;
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ current: currentProfileId, profiles }));
      // apply blank to UI
      ['bed','name','hashtags','cli','mx','bt','pr','rr','bp','o2'].forEach(fid=> { const el = $(`#${fid}`); if(el) el.value = ''; });
      const blocks = document.querySelectorAll('.io-block');
      blocks.forEach(block=>{
        block.querySelector('.lines.in').innerHTML='';
        block.querySelector('.lines.out').innerHTML='';
        for(let i=0;i<3;i++) addIOLine(block.querySelector('.lines.in'), 'in');
        for(let i=0;i<3;i++) addIOLine(block.querySelector('.lines.out'), 'out');
        const oi = block.querySelector('.override-in'); if(oi) oi.value = '';
        const oo = block.querySelector('.override-out'); if(oo) oo.value = '';
      });
      const out = $$('#output'); if(out) out.textContent = '';
      lastSegments = null;
      recalcAll();
      refreshProfileSelect();
      const sel = $$('#profileSelect'); if(sel){ sel.value = currentProfileId; }
    });

    btnDelete?.addEventListener('click', ()=>{
      if(!currentProfileId) return;
      const ok = confirm('Delete current profile? This cannot be undone.');
      if(!ok) return;
      delete profiles[currentProfileId];
      const ids = Object.keys(profiles);
      currentProfileId = ids[0] || null;
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ current: currentProfileId, profiles }));
      // reload selected or clear form
      if(currentProfileId){
        profileSelect.value = currentProfileId;
        profileSelect.dispatchEvent(new Event('change'));
      } else {
        localStorage.removeItem('notify-data');
        location.reload();
      }
    });

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
    // trigger live updates on all inputs
    const triggerUpdate = ()=>{ updatePreview(); };
    document.querySelectorAll('input, textarea').forEach(el=>{
      el.addEventListener('input', triggerUpdate);
    });
  }

  // init
  initIO();
  load();
  bindActions();
  updatePreview();
})();
