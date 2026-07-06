var allImages = [], imgCats = {}, mapInst = null, mapMarker = null, mapInitialised = false;
var CAT_KEYS = ['exterior','interior','amenities','floor_plan','skip'];
var CAT_LABELS = {exterior:'Exterior',interior:'Interior',amenities:'Amenities',floor_plan:'Floor Plan',skip:'Skip'};

function ge(id){ return document.getElementById(id); }
function gv(id){ var e=ge(id); return e?e.value:''; }
function sv(id,val){
  var e=ge(id); if(!e) return;
  if(val===null||val===undefined) return;
  var s=String(val); if(s==='null'||s==='undefined') return;
  e.value=s;
}
function setSel(id,val){
  var e=ge(id); if(!e||!val) return;
  for(var j=0;j<e.options.length;j++){
    if(e.options[j].value===String(val)||e.options[j].text===String(val)){
      e.options[j].selected=true; return;
    }
  }
}
function esc(s){
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function si(v){
  if(v===null||v===undefined||v==='') return null;
  var n=parseInt(v); return isNaN(n)?null:n;
}
function charCount(el,cid,max){
  if(!el) return;
  var n=el.value.length, out=ge(cid); if(!out) return;
  out.textContent=n+' / '+max;
  out.style.color=n>max?'#e05252':n>max*0.88?'#ff9800':'var(--muted)';
}

// TAB SWITCH — defined before DOMContentLoaded so onclick= never fails
function switchTab(n){
  document.querySelectorAll('.tab-btn').forEach(function(b,i){ b.classList.toggle('active',i===n); });
  document.querySelectorAll('.tab-panel').forEach(function(p,i){ p.classList.toggle('active',i===n); });
  if(n===7){
    try{
      if(!mapInitialised){ initMap(); mapInitialised=true; }
      else if(mapInst){ setTimeout(function(){ mapInst.invalidateSize(); },80); }
    }catch(e){
      console.warn('Map init failed:',e.message);
      var m=ge('map');
      if(m) m.innerHTML='<p style="padding:20px;color:#e05252">Map unavailable. Lat/Lng fields still work.</p>';
    }
  }
}

document.addEventListener('DOMContentLoaded',function(){ loadData(); });

async function loadData(attempt){
  attempt=attempt||1;
  console.log('[loadData] attempt '+attempt);
  try{
    var res=await fetch('/api/data');
    if(!res.ok) throw new Error('HTTP '+res.status);
    var payload=await res.json();
    var d=payload.structured, images=payload.images||[];
    if(!d||!d.name) throw new Error('no data');
    console.log('[loadData] OK: '+d.name);

    ge('project-badge').textContent=d.name||'Unknown';
    ge('header-slug').textContent=d.slug||'';

    sv('f-name',d.name); sv('f-developer',d.developer);
    sv('f-area',d.area); setSel('f-emirate',d.emirate);
    sv('f-tagline',d.tagline);
    sv('f-desc-short',d.description_short);
    sv('f-desc-long',d.description_long);
    setSel('f-status',d.status);
    sv('f-units',d.total_units);
    sv('f-completion',d.completion_pct!=null?d.completion_pct:0);
    sv('f-permit',d.permit_number);
    sv('f-property-types',(d.property_types||[]).join(', '));

    sv('f-price-from',d.price_from); sv('f-price-to',d.price_to);
    sv('f-size-min',d.size_sqft_min); sv('f-size-max',d.size_sqft_max);
    sv('f-bed-min',d.bedroom_min); sv('f-bed-max',d.bedroom_max);
    sv('f-handover',d.handover); sv('f-payment',d.payment_plan_summary);
    buildPaymentTable(d.payment_plan_detail||[]);

    allImages=images; imgCats={};
    images.forEach(function(img){ imgCats[img.filename]=img.category||'exterior'; });
    buildImageGrid();
    buildFPAITable(d.floor_plans||[]);

    sv('f-amenities',(d.amenities||[]).join('\n'));
    sv('f-investment',(d.investment_potential||[]).join('\n'));
    sv('f-lifestyle',(d.lifestyle_tags||[]).join(', '));
    buildFAQTable(d.faqs||[]);

    sv('f-seo-title',d.seo_title);
    charCount(ge('f-seo-title'),'cc-seo-title',60);
    sv('f-seo-desc',d.seo_description);
    charCount(ge('f-seo-desc'),'cc-seo-desc',160);
    sv('f-seo-keywords',(d.seo_keywords||[]).join(', '));
    sv('f-geo-region',d.geo_region);
    sv('f-geo-placename',d.geo_placename);
    sv('f-aeo-snippet',d.aeo_snippet);

    sv('f-lat',d.lat!=null?d.lat:25.2048);
    sv('f-lng',d.lng!=null?d.lng:55.2708);
    sv('f-address',d.address||((d.area||'')+(d.emirate?', '+d.emirate:'')));

    ge('project-badge').style.background='#7fe2e3';
    console.log('[loadData] done.');
  }catch(e){
    console.error('[loadData] error attempt '+attempt+': '+e.message);
    if(attempt<8){ setTimeout(function(){ loadData(attempt+1); },1500); }
    else{ ge('project-badge').textContent='Load failed'; ge('project-badge').style.background='#e05252'; }
  }
}

function buildPaymentTable(stages){
  ge('payment-tbody').innerHTML='';
  var rows=stages.length?stages:[
    {stage:'On Booking',percentage:10},
    {stage:'During Construction',percentage:50},
    {stage:'On Handover',percentage:40}
  ];
  rows.forEach(function(r){ addPaymentRow(r.stage,r.percentage); });
}
function addPaymentRow(stage,pct){
  stage=stage||''; pct=pct||'';
  var tr=document.createElement('tr');
  var td1=document.createElement('td'), td2=document.createElement('td'), td3=document.createElement('td');
  var i1=document.createElement('input'); i1.type='text'; i1.className='pp-stage'; i1.value=stage; i1.placeholder='e.g. On Handover';
  var i2=document.createElement('input'); i2.type='number'; i2.className='pp-pct'; i2.value=String(pct); i2.min=0; i2.max=100; i2.placeholder='%';
  var b=document.createElement('button'); b.className='del-btn'; b.textContent='\u2715';
  b.addEventListener('click',function(){ b.closest('tr').remove(); });
  td1.appendChild(i1); td2.appendChild(i2); td3.appendChild(b);
  tr.appendChild(td1); tr.appendChild(td2); tr.appendChild(td3);
  ge('payment-tbody').appendChild(tr);
}

function buildImageGrid(){
  var grid=ge('img-grid'); grid.innerHTML='';
  allImages.forEach(function(img,i){
    var cat=imgCats[img.filename]||'exterior';
    var div=document.createElement('div');
    div.className='img-card'; div.id='card-'+i;

    var imgEl=document.createElement('img');
    imgEl.src='/temp_images/'+img.filename;
    imgEl.loading='lazy';
    (function(fn){ imgEl.addEventListener('click',function(){ openModal('/temp_images/'+fn); }); })(img.filename);

    var info=document.createElement('div'); info.className='img-info';
    var strong=document.createElement('strong'); strong.title=img.filename; strong.textContent=img.filename;
    info.appendChild(strong);
    info.appendChild(document.createTextNode(img.size_mb+'MB \u00b7 '+img.width+'\u00d7'+img.height));

    var catDiv=document.createElement('div'); catDiv.className='cat-btns'; catDiv.id='catbtns-'+i;
    CAT_KEYS.forEach(function(c){
      var btn=document.createElement('button');
      btn.className='cb'+(cat===c?' act-'+c:'');
      btn.textContent=CAT_LABELS[c];
      (function(idx,key){ btn.addEventListener('click',function(){ setCat(idx,key); }); })(i,c);
      catDiv.appendChild(btn);
    });

    div.appendChild(imgEl); div.appendChild(info); div.appendChild(catDiv);
    grid.appendChild(div);
  });
  updateCounts();
}

function setCat(idx,cat){
  imgCats[allImages[idx].filename]=cat;
  var btns=ge('catbtns-'+idx);
  btns.querySelectorAll('.cb').forEach(function(b,i){
    b.className='cb'+(CAT_KEYS[i]===cat?' act-'+cat:'');
  });
  updateCounts(); rebuildFPImages();
}

function updateCounts(){
  var cnt={exterior:0,interior:0,amenities:0,floor_plan:0,skip:0};
  Object.values(imgCats).forEach(function(c){ if(c in cnt) cnt[c]++; });
  CAT_KEYS.forEach(function(c){ var el=ge('cnt-'+c); if(el) el.textContent=cnt[c]; });
  var active=Object.values(imgCats).filter(function(c){ return c!=='skip'; }).length;
  ge('bar-info').textContent=active+' images to upload \u00b7 review all tabs then approve';
}

function rebuildFPImages(){
  var con=ge('fp-img-container'); con.innerHTML='';
  var fps=allImages.filter(function(img){ return imgCats[img.filename]==='floor_plan'; });
  if(!fps.length){
    var p=document.createElement('p'); p.className='empty-note';
    p.textContent='No floor plan images tagged yet \u2014 go to Tab 3 and tag some.';
    con.appendChild(p); return;
  }
  fps.forEach(function(img,i){
    var row=document.createElement('div'); row.className='fp-row'; row.id='fprow-'+i;
    var hidden=document.createElement('input'); hidden.type='hidden'; hidden.className='fp-filepath'; hidden.value=img.filepath;
    var thumb=document.createElement('img'); thumb.src='/temp_images/'+img.filename; thumb.className='fp-thumb';
    (function(fn){ thumb.addEventListener('click',function(){ openModal('/temp_images/'+fn); }); })(img.filename);
    var fields=document.createElement('div'); fields.className='fp-fields';
    var name=document.createElement('div'); name.className='fp-name'; name.textContent=img.filename;
    var fpgrid=document.createElement('div'); fpgrid.className='fp-grid';
    function mkIn(lbl,cls,ph,isNum){
      var d=document.createElement('div');
      var l=document.createElement('label'); l.textContent=lbl;
      var inp=document.createElement('input'); inp.type=isNum?'number':'text'; inp.className=cls;
      if(ph) inp.placeholder=ph;
      if(isNum){ inp.min=0; if(cls==='fp-beds'||cls==='fp-baths') inp.max=20; }
      d.appendChild(l); d.appendChild(inp); return d;
    }
    fpgrid.appendChild(mkIn('Type','fp-type','2BR / Studio',false));
    fpgrid.appendChild(mkIn('Beds','fp-beds','',true));
    fpgrid.appendChild(mkIn('Baths','fp-baths','',true));
    fpgrid.appendChild(mkIn('Sqft Min','fp-sqmin','',true));
    fpgrid.appendChild(mkIn('Sqft Max','fp-sqmax','',true));
    fields.appendChild(name); fields.appendChild(fpgrid);
    row.appendChild(hidden); row.appendChild(thumb); row.appendChild(fields);
    con.appendChild(row);
  });
}

function buildFPAITable(fps){
  ge('fp-ai-tbody').innerHTML='';
  fps.forEach(function(fp){ addFPRow(fp.type,fp.beds,fp.baths,fp.sqft_min,fp.sqft_max); });
}
function addFPRow(type,beds,baths,sqMin,sqMax){
  var tr=document.createElement('tr');
  function mkTd(cls,val,isNum){
    var td=document.createElement('td');
    var inp=document.createElement('input'); inp.type=isNum?'number':'text'; inp.className=cls;
    if(val!==null&&val!==undefined) inp.value=String(val);
    if(cls==='fpa-type') inp.placeholder='e.g. 2BR';
    if(isNum){ inp.min=0; if(cls==='fpa-beds'||cls==='fpa-baths') inp.max=20; }
    td.appendChild(inp); return td;
  }
  tr.appendChild(mkTd('fpa-type',type||'',false));
  tr.appendChild(mkTd('fpa-beds',beds||'',true));
  tr.appendChild(mkTd('fpa-baths',baths||'',true));
  tr.appendChild(mkTd('fpa-sqmin',sqMin||'',true));
  tr.appendChild(mkTd('fpa-sqmax',sqMax||'',true));
  var tdBtn=document.createElement('td');
  var btn=document.createElement('button'); btn.className='del-btn'; btn.textContent='\u2715';
  btn.addEventListener('click',function(){ btn.closest('tr').remove(); });
  tdBtn.appendChild(btn); tr.appendChild(tdBtn);
  ge('fp-ai-tbody').appendChild(tr);
}
function getAIFPs(){
  return Array.from(document.querySelectorAll('#fp-ai-tbody tr')).map(function(tr){
    return {
      type:tr.querySelector('.fpa-type')?tr.querySelector('.fpa-type').value:'',
      beds:si(tr.querySelector('.fpa-beds')?tr.querySelector('.fpa-beds').value:null),
      baths:si(tr.querySelector('.fpa-baths')?tr.querySelector('.fpa-baths').value:null),
      sqft_min:si(tr.querySelector('.fpa-sqmin')?tr.querySelector('.fpa-sqmin').value:null),
      sqft_max:si(tr.querySelector('.fpa-sqmax')?tr.querySelector('.fpa-sqmax').value:null),
    };
  }).filter(function(r){ return r.type; });
}

function buildFAQTable(faqs){
  ge('faq-container').innerHTML='';
  faqs.forEach(function(f,i){ addFAQRow(i+1,f.question,f.answer); });
}
function addFAQRow(num,q,a){
  num=num||(ge('faq-container').children.length+1); q=q||''; a=a||'';
  var div=document.createElement('div'); div.className='faq-row';
  var numDiv=document.createElement('div'); numDiv.className='faq-num'; numDiv.textContent=num;
  var fields=document.createElement('div'); fields.className='faq-fields';
  var inp=document.createElement('input'); inp.type='text'; inp.className='faq-q'; inp.value=q; inp.placeholder='Question';
  var ta=document.createElement('textarea'); ta.className='faq-a'; ta.rows=2; ta.placeholder='Answer'; ta.textContent=a;
  fields.appendChild(inp); fields.appendChild(ta);
  var btn=document.createElement('button'); btn.className='del-btn'; btn.textContent='\u2715'; btn.style.marginTop='1px';
  btn.addEventListener('click',function(){ div.remove(); });
  div.appendChild(numDiv); div.appendChild(fields); div.appendChild(btn);
  ge('faq-container').appendChild(div);
}
function getFAQs(){
  return Array.from(document.querySelectorAll('#faq-container .faq-row')).map(function(row){
    return {
      question:row.querySelector('.faq-q')?row.querySelector('.faq-q').value:'',
      answer:row.querySelector('.faq-a')?row.querySelector('.faq-a').value:'',
    };
  }).filter(function(f){ return f.question; });
}

function initMap(){
  if(typeof L==='undefined') throw new Error('Leaflet not loaded');
  var lat=parseFloat(ge('f-lat').value)||25.2048;
  var lng=parseFloat(ge('f-lng').value)||55.2708;
  mapInst=L.map('map').setView([lat,lng],13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
    attribution:'&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>',maxZoom:19
  }).addTo(mapInst);
  mapMarker=L.marker([lat,lng],{draggable:true}).addTo(mapInst);
  mapMarker.on('dragend',function(e){
    var p=e.target.getLatLng();
    sv('f-lat',p.lat.toFixed(6)); sv('f-lng',p.lng.toFixed(6));
  });
}
function syncMap(){
  if(!mapInst||!mapMarker) return;
  var lat=parseFloat(ge('f-lat').value), lng=parseFloat(ge('f-lng').value);
  if(!isNaN(lat)&&!isNaN(lng)){ mapMarker.setLatLng([lat,lng]); mapInst.setView([lat,lng]); }
}
async function geocodeAddress(){
  var addr=ge('f-address').value.trim(); if(!addr) return;
  try{
    var r=await fetch('https://nominatim.openstreetmap.org/search?q='+encodeURIComponent(addr)+'&format=json&limit=1');
    var data=await r.json();
    if(data.length){ sv('f-lat',parseFloat(data[0].lat).toFixed(6)); sv('f-lng',parseFloat(data[0].lon).toFixed(6)); syncMap(); }
    else alert('Address not found.');
  }catch(e){ alert('Geocoding failed: '+e.message); }
}

function openModal(src){ ge('modal-img').src=src; ge('img-modal').classList.add('open'); }
function closeModal(){ ge('img-modal').classList.remove('open'); }

async function approveAll(){
  var btn=ge('btn-approve'); btn.disabled=true;
  var fp_images=Array.from(document.querySelectorAll('#fp-img-container .fp-row')).map(function(row){
    return {
      filepath:row.querySelector('.fp-filepath')?row.querySelector('.fp-filepath').value:'',
      type:row.querySelector('.fp-type')?row.querySelector('.fp-type').value:'',
      beds:si(row.querySelector('.fp-beds')?row.querySelector('.fp-beds').value:null),
      baths:si(row.querySelector('.fp-baths')?row.querySelector('.fp-baths').value:null),
      sqft_min:si(row.querySelector('.fp-sqmin')?row.querySelector('.fp-sqmin').value:null),
      sqft_max:si(row.querySelector('.fp-sqmax')?row.querySelector('.fp-sqmax').value:null),
    };
  });
  var ai_fps=getAIFPs();
  var data={
    name:gv('f-name'), developer:gv('f-developer'), area:gv('f-area'), emirate:gv('f-emirate'),
    tagline:gv('f-tagline'), description_short:gv('f-desc-short'), description_long:gv('f-desc-long'),
    status:gv('f-status'), total_units:gv('f-units')||null, completion_pct:gv('f-completion')||0,
    property_types:gv('f-property-types'), permit_number:gv('f-permit')||null,
    price_from:gv('f-price-from')||null, price_to:gv('f-price-to')||null,
    size_sqft_min:gv('f-size-min')||null, size_sqft_max:gv('f-size-max')||null,
    bedroom_min:gv('f-bed-min')||null, bedroom_max:gv('f-bed-max')||null,
    handover:gv('f-handover'), payment_plan_summary:gv('f-payment'),
    payment_plan_detail:getPaymentRows(), floor_plans:ai_fps,
    amenities:gv('f-amenities'), investment_potential:gv('f-investment'), lifestyle_tags:gv('f-lifestyle'),
    faqs:getFAQs(), seo_title:gv('f-seo-title'), seo_description:gv('f-seo-desc'),
    seo_keywords:gv('f-seo-keywords'), geo_region:gv('f-geo-region'), geo_placename:gv('f-geo-placename'),
    aeo_snippet:gv('f-aeo-snippet'), lat:gv('f-lat')||null, lng:gv('f-lng')||null, address:gv('f-address')||null,
  };
  var images=allImages.map(function(img){ return {filepath:img.filepath,category:imgCats[img.filename]||'exterior'}; });
  var uploadCnt=images.filter(function(i){ return i.category!=='skip'; }).length;
  ge('overlay').classList.add('open');
  ge('overlay-msg').textContent='Uploading '+uploadCnt+' images to Cloudinary...';
  try{
    var res=await fetch('/api/approve',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({data:data,images:images,floor_plans:fp_images.length?fp_images:ai_fps})});
    var result=await res.json();
    if(result.success){ ge('overlay-msg').textContent='Saved! You can close this tab.'; }
    else{ ge('overlay-msg').textContent='Error: '+result.error; btn.disabled=false; }
  }catch(e){ ge('overlay-msg').textContent='Error: '+e.message; btn.disabled=false; }
}
function getPaymentRows(){
  return Array.from(document.querySelectorAll('#payment-tbody tr')).map(function(tr){
    return {
      stage:tr.querySelector('.pp-stage')?tr.querySelector('.pp-stage').value:'',
      percentage:parseInt(tr.querySelector('.pp-pct')?tr.querySelector('.pp-pct').value:0)||0,
    };
  }).filter(function(r){ return r.stage; });
}
async function cancelAll(){
  if(!confirm('Cancel and delete all temp images?')) return;
  await fetch('/api/cancel',{method:'POST'});
  ge('overlay').classList.add('open');
  ge('overlay-msg').textContent='Cancelled. Close this tab.';
}
