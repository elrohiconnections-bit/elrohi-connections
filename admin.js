(() => {
  const previewMode = location.protocol === 'file:';
  const PARTNER_STORE = 'elrohi_partner_submissions_v1';
  const RESOURCE_STORE = 'elrohi_resources_v1';
  const MAX_UPLOAD_SIZE = 25 * 1024 * 1024;

  const login = document.getElementById('adminLogin');
  const dashboard = document.getElementById('adminDashboard');
  const loginForm = document.getElementById('adminLoginForm');
  const keyInput = document.getElementById('adminKey');
  const loginStatus = document.getElementById('adminLoginStatus');
  const previewNote = document.getElementById('previewAdminNote');
  const tableWrap = document.getElementById('partnerTableWrap');
  const count = document.getElementById('partnerCount');
  const latest = document.getElementById('latestSubmission');
  const resetConfirm = document.getElementById('resetConfirm');
  const resetButton = document.getElementById('resetPartners');
  const resetStatus = document.getElementById('resetStatus');
  const pageTitle = document.getElementById('adminPageTitle');

  const resourceForm = document.getElementById('resourceForm');
  const resourceId = document.getElementById('resourceId');
  const resourceCategory = document.getElementById('resourceCategory');
  const resourceSection = document.getElementById('resourceSection');
  const resourceKind = document.getElementById('resourceKind');
  const resourceTitle = document.getElementById('resourceTitle');
  const resourceDescription = document.getElementById('resourceDescription');
  const resourceUrl = document.getElementById('resourceUrl');
  const resourceButtonLabel = document.getElementById('resourceButtonLabel');
  const resourceSortOrder = document.getElementById('resourceSortOrder');
  const resourcePublished = document.getElementById('resourcePublished');
  const resourceFormTitle = document.getElementById('resourceFormTitle');
  const resourceFormStatus = document.getElementById('resourceFormStatus');
  const cancelResourceEdit = document.getElementById('cancelResourceEdit');
  const resourceList = document.getElementById('resourceList');
  const resourceListTitle = document.getElementById('resourceListTitle');
  const resourceCount = document.getElementById('resourceCount');
  const resourceModeTabs = document.getElementById('resourceModeTabs');
  const resourceManageView = document.getElementById('resourceManageView');
  const resourceUploadView = document.getElementById('resourceUploadView');

  const resourceUploadForm = document.getElementById('resourceUploadForm');
  const uploadFile = document.getElementById('uploadFile');
  const uploadFileSummary = document.getElementById('uploadFileSummary');
  const uploadCategory = document.getElementById('uploadCategory');
  const uploadSection = document.getElementById('uploadSection');
  const uploadTitle = document.getElementById('uploadTitle');
  const uploadDescription = document.getElementById('uploadDescription');
  const uploadButtonLabel = document.getElementById('uploadButtonLabel');
  const uploadSortOrder = document.getElementById('uploadSortOrder');
  const uploadPublished = document.getElementById('uploadPublished');
  const uploadStatus = document.getElementById('uploadStatus');
  const uploadResourceButton = document.getElementById('uploadResource');

  const CATEGORY_NAMES = {
    'mentorship-guide': 'Mentorship Guide',
    'family-support': 'Family Support',
    'leadership-stem': 'Leadership & STEM'
  };
  const SECTION_NAMES = {
    'mentorship-guide': ['Guides & Workbooks', 'Videos & Teaching', 'Recommended Links'],
    'family-support': ['Family Guides', 'Talks & Workshops', 'Support Links'],
    'leadership-stem': ['STEM Learning', 'Leadership Tools', 'Projects & Links']
  };
  const KIND_NAMES = { document: 'Document', video: 'Video', link: 'Link' };

  let adminKey = sessionStorage.getItem('elrohi_admin_key') || '';
  let records = [];
  let resources = [];
  let activeResourceCategory = 'mentorship-guide';
  let activeResourceMode = 'manage';

  if (previewMode) previewNote.hidden = false;
  const escapeHTML = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const prettyDate = value => value ? new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(new Date(value)) : '—';
  const formatBytes = value => {
    const bytes = Number(value || 0);
    if (!bytes) return '0 KB';
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
  };
  function readLocal(key){ return JSON.parse(localStorage.getItem(key) || '[]'); }
  function writeLocal(key, value){ localStorage.setItem(key, JSON.stringify(value)); }
  function showStatus(el, message, type=''){ el.textContent=message; el.className=`form-status ${type}`.trim(); }

  async function getRecords(){
    if (previewMode) return readLocal(PARTNER_STORE);
    const response = await fetch('/api/partners',{headers:{'X-Admin-Key':adminKey}});
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Unable to load partner submissions.');
    return result.items || [];
  }

  async function getResources(){
    if (previewMode) return readLocal(RESOURCE_STORE);
    const response = await fetch('/api/resources?admin=1',{headers:{'X-Admin-Key':adminKey}});
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Unable to load resources.');
    return result.items || [];
  }

  function renderPartners(){
    count.textContent = records.length;
    latest.textContent = records.length ? prettyDate(records[0].submitted_at || records[0].created_at) : '—';
    if (!records.length) { tableWrap.innerHTML='<div class="admin-empty">No partnership submissions yet.</div>'; return; }
    tableWrap.innerHTML = `<table class="partner-table"><thead><tr><th>Date</th><th>Name</th><th>Contact</th><th>Organisation</th><th>Location</th><th>Partnership Interest</th><th>Message</th></tr></thead><tbody>${records.map(r=>`<tr><td>${escapeHTML(prettyDate(r.submitted_at || r.created_at))}</td><td><strong>${escapeHTML(r.full_name)}</strong></td><td><a href="mailto:${escapeHTML(r.email)}">${escapeHTML(r.email)}</a>${r.phone?`<small>${escapeHTML(r.phone)}</small>`:''}</td><td>${escapeHTML(r.organization || '—')}</td><td>${escapeHTML([r.city,r.country].filter(Boolean).join(', ') || '—')}</td><td><span class="interest-chip">${escapeHTML(r.interest || '—')}</span></td><td class="message-cell">${escapeHTML(r.message || '—')}</td></tr>`).join('')}</tbody></table>`;
  }

  function sectionOptions(category, selected = 1){
    const names = SECTION_NAMES[category] || SECTION_NAMES['mentorship-guide'];
    return names.map((name,index)=>`<option value="${index+1}" ${Number(selected)===index+1?'selected':''}>${index+1}. ${escapeHTML(name)}</option>`).join('');
  }

  function fillSectionOptions(category, selected = 1){
    resourceSection.innerHTML = sectionOptions(category, selected);
    resourceSection.value = String(selected || 1);
  }

  function fillUploadSectionOptions(category, selected = 1){
    uploadSection.innerHTML = sectionOptions(category, selected);
    uploadSection.value = String(selected || 1);
  }

  function renderResources(){
    const filtered = resources.filter(r => r.category === activeResourceCategory);
    resourceListTitle.textContent = CATEGORY_NAMES[activeResourceCategory];
    resourceCount.textContent = filtered.length;
    document.querySelectorAll('#resourceCategoryTabs button').forEach(btn=>btn.classList.toggle('active',btn.dataset.category===activeResourceCategory));
    if (!filtered.length) { resourceList.innerHTML='<div class="admin-empty">No resources have been added to this section yet.</div>'; return; }
    resourceList.innerHTML = filtered.map(r => {
      const sectionName = (SECTION_NAMES[r.category] || [])[Number(r.section_no)-1] || `Section ${r.section_no}`;
      const fileLine = r.original_name ? `<div class="resource-file-line"><span>Uploaded file</span><strong>${escapeHTML(r.original_name)}</strong><small>${escapeHTML(formatBytes(r.file_size))}</small></div>` : '';
      return `<article class="resource-admin-item ${r.published ? '' : 'is-draft'}">
        <div class="resource-admin-item-top"><div><span class="resource-admin-chip">${escapeHTML(sectionName)}</span><span class="resource-admin-kind">${escapeHTML(KIND_NAMES[r.resource_kind] || r.resource_kind)}</span>${r.original_name?'<span class="resource-uploaded-chip">Uploaded</span>':''}</div><span class="resource-status ${r.published?'published':'draft'}">${r.published?'Published':'Draft'}</span></div>
        <h4>${escapeHTML(r.title)}</h4>
        <p>${escapeHTML(r.description || 'No description')}</p>
        ${fileLine}
        <a href="${escapeHTML(r.url)}" target="_blank" rel="noopener">${escapeHTML(r.url)}</a>
        <div class="resource-admin-actions"><button data-action="edit" data-id="${r.id}" class="admin-secondary">Edit</button><button data-action="toggle" data-id="${r.id}" class="admin-secondary">${r.published?'Unpublish':'Publish'}</button><button data-action="delete" data-id="${r.id}" class="resource-delete-button">Delete</button></div>
      </article>`;
    }).join('');
  }

  async function loadAll(){
    const [partnerData, resourceData] = await Promise.all([getRecords(), getResources()]);
    records = partnerData;
    resources = resourceData;
    renderPartners();
    renderResources();
  }

  async function openDashboard(){
    try {
      if (previewMode && adminKey !== 'preview') throw new Error('For this local preview, use the access key “preview”.');
      await loadAll();
      sessionStorage.setItem('elrohi_admin_key', adminKey);
      login.hidden = true; dashboard.hidden = false; showStatus(loginStatus,'');
    } catch (error) {
      sessionStorage.removeItem('elrohi_admin_key');
      showStatus(loginStatus,error.message,'error');
    }
  }

  function switchTab(tab){
    document.querySelectorAll('.admin-tab').forEach(x=>x.classList.toggle('active',x.dataset.tab===tab));
    document.querySelectorAll('.admin-panel').forEach(p=>p.classList.remove('active-panel'));
    const panel = document.getElementById(`${tab}Panel`);
    if(panel) panel.classList.add('active-panel');
    pageTitle.textContent = tab === 'partners' ? 'Partner submissions' : tab === 'resources' ? 'Resource management' : 'Reset partner list';
  }

  function switchResourceMode(mode){
    activeResourceMode = mode === 'upload' ? 'upload' : 'manage';
    resourceModeTabs.querySelectorAll('button[data-mode]').forEach(btn=>btn.classList.toggle('active',btn.dataset.mode===activeResourceMode));
    resourceManageView.hidden = activeResourceMode !== 'manage';
    resourceUploadView.hidden = activeResourceMode !== 'upload';
  }

  function resetResourceForm(){
    resourceForm.reset();
    resourceId.value='';
    resourceCategory.value=activeResourceCategory;
    fillSectionOptions(activeResourceCategory,1);
    resourceKind.value='document';
    resourcePublished.checked=true;
    resourceSortOrder.value='0';
    resourceFormTitle.textContent='Add resource by link';
    cancelResourceEdit.hidden=true;
    showStatus(resourceFormStatus,'');
  }

  function resetUploadForm(preserveStatus = false){
    resourceUploadForm.reset();
    uploadCategory.value = activeResourceCategory;
    fillUploadSectionOptions(activeResourceCategory,1);
    uploadButtonLabel.value = 'Open document';
    uploadSortOrder.value = '0';
    uploadPublished.checked = true;
    uploadFileSummary.textContent = 'No document selected.';
    if (!preserveStatus) showStatus(uploadStatus,'');
  }

  function editResource(id){
    const r = resources.find(x=>Number(x.id)===Number(id));
    if(!r) return;
    activeResourceCategory=r.category;
    resourceCategory.value=r.category;
    fillSectionOptions(r.category,r.section_no);
    resourceId.value=r.id;
    resourceKind.value=r.resource_kind;
    resourceTitle.value=r.title || '';
    resourceDescription.value=r.description || '';
    resourceUrl.value=r.url || '';
    resourceButtonLabel.value=r.button_label || '';
    resourceSortOrder.value=r.sort_order ?? 0;
    resourcePublished.checked=Boolean(r.published);
    resourceFormTitle.textContent='Edit resource';
    cancelResourceEdit.hidden=false;
    renderResources();
    switchResourceMode('manage');
    resourceForm.scrollIntoView({behavior:'smooth',block:'start'});
  }

  function resourcePayload(overrides={}){
    return {
      id: resourceId.value ? Number(resourceId.value) : undefined,
      category: resourceCategory.value,
      section_no: Number(resourceSection.value),
      resource_kind: resourceKind.value,
      title: resourceTitle.value.trim(),
      description: resourceDescription.value.trim(),
      url: resourceUrl.value.trim(),
      button_label: resourceButtonLabel.value.trim(),
      sort_order: Number(resourceSortOrder.value || 0),
      published: resourcePublished.checked,
      ...overrides
    };
  }

  async function saveResourcePayload(payload, method){
    if(previewMode){
      let list=readLocal(RESOURCE_STORE);
      if(method==='POST') list.push({...payload,id:Date.now(),created_at:new Date().toISOString(),updated_at:new Date().toISOString()});
      else list=list.map(x=>Number(x.id)===Number(payload.id)?{...x,...payload,updated_at:new Date().toISOString()}:x);
      writeLocal(RESOURCE_STORE,list); return;
    }
    const response=await fetch('/api/resources',{method,headers:{'Content-Type':'application/json','X-Admin-Key':adminKey},body:JSON.stringify(payload)});
    const result=await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(result.error || 'Unable to save resource.');
  }

  loginForm.addEventListener('submit', e=>{ e.preventDefault(); adminKey=keyInput.value.trim(); openDashboard(); });
  document.getElementById('refreshAdmin').addEventListener('click', async()=>{ try{ await loadAll(); }catch(e){ alert(e.message); } });
  document.getElementById('adminLogout').addEventListener('click',()=>{ sessionStorage.removeItem('elrohi_admin_key'); adminKey=''; dashboard.hidden=true; login.hidden=false; keyInput.value=''; });
  document.querySelectorAll('.admin-tab').forEach(btn=>btn.addEventListener('click',()=>switchTab(btn.dataset.tab)));

  resourceModeTabs.addEventListener('click',e=>{
    const btn=e.target.closest('button[data-mode]');
    if(!btn) return;
    switchResourceMode(btn.dataset.mode);
  });

  document.getElementById('resourceCategoryTabs').addEventListener('click',e=>{
    const btn=e.target.closest('button[data-category]'); if(!btn) return;
    activeResourceCategory=btn.dataset.category;
    resourceCategory.value=activeResourceCategory;
    uploadCategory.value=activeResourceCategory;
    fillSectionOptions(activeResourceCategory,1);
    fillUploadSectionOptions(activeResourceCategory,1);
    renderResources();
  });
  resourceCategory.addEventListener('change',()=>{
    activeResourceCategory=resourceCategory.value;
    uploadCategory.value=activeResourceCategory;
    fillSectionOptions(activeResourceCategory,1);
    fillUploadSectionOptions(activeResourceCategory,1);
    renderResources();
  });
  uploadCategory.addEventListener('change',()=>fillUploadSectionOptions(uploadCategory.value,1));
  cancelResourceEdit.addEventListener('click',resetResourceForm);

  resourceForm.addEventListener('submit',async e=>{
    e.preventDefault();
    const payload=resourcePayload();
    const method=payload.id?'PUT':'POST';
    showStatus(resourceFormStatus,'Saving resource…');
    try{
      await saveResourcePayload(payload,method);
      resources=await getResources();
      activeResourceCategory=payload.category;
      renderResources();
      resetResourceForm();
      showStatus(resourceFormStatus,'Resource saved successfully.','success');
    }catch(err){ showStatus(resourceFormStatus,err.message,'error'); }
  });

  uploadFile.addEventListener('change',()=>{
    const file=uploadFile.files?.[0];
    if(!file){ uploadFileSummary.textContent='No document selected.'; return; }
    uploadFileSummary.textContent=`${file.name} · ${formatBytes(file.size)}`;
    if(!uploadTitle.value.trim()) uploadTitle.value=file.name.replace(/\.[^.]+$/,'').replace(/[-_]+/g,' ').trim();
    if(file.size>MAX_UPLOAD_SIZE) showStatus(uploadStatus,'This document is larger than 25 MB. Please choose a smaller file.','error');
    else showStatus(uploadStatus,'');
  });

  resourceUploadForm.addEventListener('submit',async e=>{
    e.preventDefault();
    if(previewMode){ showStatus(uploadStatus,'Document upload is available on the deployed website, not local preview mode.','error'); return; }
    const file=uploadFile.files?.[0];
    if(!file){ showStatus(uploadStatus,'Please choose a document to upload.','error'); return; }
    if(file.size>MAX_UPLOAD_SIZE){ showStatus(uploadStatus,'Document is too large. Maximum upload size is 25 MB.','error'); return; }

    const formData=new FormData();
    formData.append('file',file,file.name);
    formData.append('category',uploadCategory.value);
    formData.append('section_no',uploadSection.value);
    formData.append('title',uploadTitle.value.trim());
    formData.append('description',uploadDescription.value.trim());
    formData.append('button_label',uploadButtonLabel.value.trim());
    formData.append('sort_order',uploadSortOrder.value || '0');
    formData.append('published',uploadPublished.checked?'1':'0');

    uploadResourceButton.disabled=true;
    uploadResourceButton.textContent='Uploading…';
    showStatus(uploadStatus,`Uploading ${file.name}…`);
    try{
      const response=await fetch('/api/resource-upload',{method:'POST',headers:{'X-Admin-Key':adminKey},body:formData});
      const result=await response.json().catch(()=>({}));
      if(!response.ok) throw new Error(result.error || 'Unable to upload document.');
      activeResourceCategory=uploadCategory.value;
      resources=await getResources();
      renderResources();
      resetUploadForm(true);
      showStatus(uploadStatus,`Document uploaded successfully${result.file_name?`: ${result.file_name}`:''}.`,'success');
    }catch(err){
      showStatus(uploadStatus,err.message,'error');
    }finally{
      uploadResourceButton.disabled=false;
      uploadResourceButton.textContent='Upload & Save Resource';
    }
  });

  resourceList.addEventListener('click',async e=>{
    const button=e.target.closest('button[data-action]'); if(!button) return;
    const id=Number(button.dataset.id); const action=button.dataset.action;
    const current=resources.find(x=>Number(x.id)===id); if(!current) return;
    if(action==='edit'){ editResource(id); return; }
    if(action==='toggle'){
      try{
        await saveResourcePayload({...current,published:!Boolean(current.published)},'PUT');
        resources=await getResources(); renderResources();
      }catch(err){ alert(err.message); }
      return;
    }
    if(action==='delete'){
      const extra=current.original_name?' The uploaded document will also be removed from storage.':'';
      if(!confirm(`Delete “${current.title}”?${extra}`)) return;
      try{
        if(previewMode){ writeLocal(RESOURCE_STORE,readLocal(RESOURCE_STORE).filter(x=>Number(x.id)!==id)); }
        else {
          const response=await fetch(`/api/resources?id=${id}`,{method:'DELETE',headers:{'X-Admin-Key':adminKey}});
          const result=await response.json().catch(()=>({})); if(!response.ok) throw new Error(result.error || 'Unable to delete resource.');
        }
        resources=await getResources(); renderResources(); resetResourceForm();
      }catch(err){ alert(err.message); }
    }
  });

  resetConfirm.addEventListener('input',()=>resetButton.disabled = resetConfirm.value.trim() !== 'RESET');
  resetButton.addEventListener('click',async()=>{
    if (resetConfirm.value.trim() !== 'RESET') return;
    if (!confirm('Clear every partnership submission? This cannot be undone.')) return;
    resetButton.disabled=true; showStatus(resetStatus,'Clearing list…');
    try{
      if(previewMode){ localStorage.removeItem(PARTNER_STORE); }
      else {
        const response=await fetch('/api/partners',{method:'DELETE',headers:{'X-Admin-Key':adminKey}});
        const result=await response.json().catch(()=>({}));
        if(!response.ok) throw new Error(result.error || 'Unable to reset the partner list.');
      }
      records=[]; renderPartners(); resetConfirm.value=''; showStatus(resetStatus,'Partner list cleared successfully.','success');
    }catch(e){ showStatus(resetStatus,e.message,'error'); }
    finally{ resetButton.disabled = resetConfirm.value.trim() !== 'RESET'; }
  });

  document.getElementById('exportPartners').addEventListener('click',()=>{
    if(!records.length) return alert('There are no submissions to export.');
    const fields=['submitted_at','full_name','email','phone','organization','city','country','interest','message'];
    const csv=[fields.join(','),...records.map(r=>fields.map(f=>`"${String(r[f]??'').replace(/"/g,'""')}"`).join(','))].join('\n');
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`elrohi-partners-${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url);
  });

  fillSectionOptions(activeResourceCategory,1);
  fillUploadSectionOptions(activeResourceCategory,1);
  switchResourceMode('manage');
  if(adminKey) openDashboard();
})();
