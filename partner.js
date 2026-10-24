(() => {
  const form = document.getElementById('partnerForm');
  if (!form) return;
  const status = document.getElementById('partnerStatus');
  const submit = form.querySelector('button[type="submit"]');
  const previewMode = location.protocol === 'file:';
  const STORE = 'elrohi_partner_submissions_v1';

  function setStatus(message, type='') {
    status.textContent = message;
    status.className = `form-status ${type}`.trim();
  }
  function localSave(record) {
    const current = JSON.parse(localStorage.getItem(STORE) || '[]');
    current.unshift(record);
    localStorage.setItem(STORE, JSON.stringify(current));
  }
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    submit.disabled = true;
    setStatus('Submitting…');
    const data = Object.fromEntries(new FormData(form).entries());
    data.consent = true;
    data.submitted_at = new Date().toISOString();
    try {
      if (previewMode) {
        localSave({id: Date.now(), ...data});
        setStatus('Thank you. Your partnership interest has been recorded in this browser preview.', 'success');
      } else {
        const response = await fetch('/api/partners', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data)});
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || 'Unable to submit the form right now.');
        setStatus('Thank you. Your partnership interest has been received. Our team will contact you.', 'success');
      }
      form.reset();
    } catch (error) {
      setStatus(error.message || 'Unable to submit the form right now. Please try again.', 'error');
    } finally {
      submit.disabled = false;
    }
  });
})();
