const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

function normalizeRow(r){
  const keys = Object.keys(r||{}).reduce((acc,k)=>{acc[k.trim().toLowerCase()]=r[k];return acc;},{});
  const rawQ = keys['question']||keys['questiontext']||keys['q']||keys['question_text']||keys['question text']||'';
  const rawOptions = keys['options']||keys['opts']||keys['choices']||keys['option']||keys['o']||'';
  const rawCorrect = keys['correct']||keys['answer']||keys['a']||keys['correctindex']||'';

  let opts = [];
  if (Array.isArray(rawOptions)) opts = rawOptions;
  else if (typeof rawOptions === 'string' && rawOptions.trim()!==''){
    if (rawOptions.includes('||')) opts = rawOptions.split('||').map(s=>s.trim());
    else if (rawOptions.includes(';')) opts = rawOptions.split(';').map(s=>s.trim());
    else if (rawOptions.includes('|')) opts = rawOptions.split('|').map(s=>s.trim());
    else opts = rawOptions.split(',').map(s=>s.trim()).filter(Boolean);
  }
  if (opts.length===0){
    const optionCandidates = [];
    for (const k of Object.keys(keys)){
      if (['question','questiontext','q','question_text','question text','correct','answer','a','correctindex','id','explanation'].includes(k)) continue;
      const val = keys[k]; if (val===undefined||val===null) continue; const str=String(val).trim(); if(!str) continue;
      if (/opt|choice|option/i.test(k) || /^[abcd]$/.test(k) || /\d$/.test(k) || k.length<=3) optionCandidates.push(str);
    }
    if (optionCandidates.length>=2) opts = optionCandidates;
  }

  let correctIndex = -1;
  if (rawCorrect===undefined||rawCorrect===null||rawCorrect==='') correctIndex=-1;
  else{
    const rc=String(rawCorrect).trim();
    if(/^[A-D]$/i.test(rc)) correctIndex = rc.toUpperCase().charCodeAt(0)-65;
    else if (!isNaN(Number(rc))) correctIndex = Number(rc);
    else{
      const idxMatch = opts.findIndex(o=>String(o).toLowerCase()===rc.toLowerCase());
      correctIndex = idxMatch;
    }
  }

  return { questionText: String(rawQ||'').trim(), options: opts, correctIndex };
}

function validateFile(filePath){
  return new Promise((resolve,reject)=>{
    const rows=[];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', data=>rows.push(data))
      .on('end', ()=>resolve(rows))
      .on('error', err=>reject(err));
  });
}

(async ()=>{
  const fp = process.argv[2];
  if (!fp){ console.error('Usage: node validateQuizCsv.js <file.csv>'); process.exit(1);} 
  const full = path.resolve(fp);
  console.log('Reading', full);
  try{
    const rows = await validateFile(full);
    console.log('Rows read:', rows.length);
    const results = rows.map((r,i)=>{
      const parsed = normalizeRow(r);
      const ok = parsed.questionText && Array.isArray(parsed.options) && parsed.options.length>=2 && parsed.correctIndex>=0;
      const reason = ok ? 'OK' : 'SKIP';
      return { row: i+1, parsed, reason, raw: r };
    });
    for (const r of results.slice(0,20)){
      console.log(JSON.stringify(r,null,2));
    }
    const okCount = results.filter(r=>r.reason==='OK').length;
    console.log(`Accepted ${okCount}/${results.length} rows`);
  }catch(err){ console.error(err); process.exit(1); }
})();
