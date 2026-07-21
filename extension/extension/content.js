// content.js

// دالة لإنشاء زر التحميل وحقنه في الصفحة
function injectDownloadButton(videoElement) {
  // تجنب إضافة الزر إذا كان موجوداً مسبقاً
  if (videoElement.parentElement.querySelector('.vd-extension-btn') || videoElement.dataset.vdInjected) {
    return;
  }
  
  videoElement.dataset.vdInjected = "true";

  // محاولة العثور على حاوية مناسبة للزر
  const container = videoElement.parentElement;
  if (getComputedStyle(container).position === 'static') {
    container.style.position = 'relative';
  }

  const btn = document.createElement('button');
  btn.className = 'vd-extension-btn';
  btn.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
      <polyline points="7 10 12 15 17 10"></polyline>
      <line x1="12" y1="15" x2="12" y2="3"></line>
    </svg>
    تحميل
  `;

  // تحديد مكان الزر (مثلاً أعلى يسار أو يمين الفيديو)
  btn.style.top = '10px';
  btn.style.right = '10px';

  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();

    // التقاط الرابط (من المتصفح أو من الـ iframe)
    let targetUrl = window.location.href;
    
    // إذا كنا داخل iframe، نحاول جلب الرابط الأصلي إن أمكن
    if (window !== window.top) {
      targetUrl = document.referrer || window.location.href;
    }

    // إظهار حالة التحميل
    const originalContent = btn.innerHTML;
    btn.innerHTML = \`<span class="vd-spinner"></span> جاري المعالجة...\`;
    btn.classList.add('loading');
    btn.disabled = true;

    try {
      // إرسال رسالة إلى Background Script للتعامل مع الـ API وتجنب CORS
      chrome.runtime.sendMessage({ action: 'fetchVideoInfo', url: targetUrl }, (response) => {
        btn.innerHTML = originalContent;
        btn.classList.remove('loading');
        btn.disabled = false;

        if (response && response.success) {
          const data = response.data.data || response.data;
          if (data && (data.videos?.length > 0 || data.audios?.length > 0)) {
            showDownloadModal(data);
          } else {
            alert('عذراً، لم يتم العثور على روابط تحميل مباشرة.');
          }
        } else {
          const errorMsg = response?.error || response?.data?.detail || 'مجهول';
          alert('حدث خطأ أثناء جلب الروابط: ' + errorMsg);
        }
      });
    } catch (error) {
      btn.innerHTML = originalContent;
      btn.classList.remove('loading');
      btn.disabled = false;
      alert('حدث خطأ غير متوقع.');
    }
  });

  container.appendChild(btn);
}

// دالة لإنشاء النافذة المنبثقة (Modal) لعرض خيارات التحميل
function showDownloadModal(data) {
  // إزالة النافذة القديمة إذا وجدت
  const oldModal = document.querySelector('.vd-modal-overlay');
  if (oldModal) oldModal.remove();

  const overlay = document.createElement('div');
  overlay.className = 'vd-modal-overlay';
  
  // إغلاق عند الضغط خارج النافذة
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });

  let videosHtml = '';
  if (data.videos && data.videos.length > 0) {
    videosHtml = \`
      <div class="vd-section-title">🎥 تحميل كـ فيديو:</div>
      <div class="vd-quality-grid">
        \${data.videos.map(v => \`
          <a href="\${v.url}" target="_blank" rel="noopener noreferrer" class="vd-quality-btn">
            <span>\${v.quality}</span>
            <span class="vd-quality-badge">\${v.ext.toUpperCase()}</span>
          </a>
        \`).join('')}
      </div>
    \`;
  }

  let audiosHtml = '';
  if (data.audios && data.audios.length > 0) {
    audiosHtml = \`
      <div class="vd-section-title">🎵 تحميل كـ صوت:</div>
      <div class="vd-quality-grid">
        \${data.audios.map(a => \`
          <a href="\${a.url}" target="_blank" rel="noopener noreferrer" class="vd-quality-btn vd-audio-btn">
            <span>\${a.quality}</span>
            <span class="vd-quality-badge vd-audio-badge">\${a.ext.toUpperCase()}</span>
          </a>
        \`).join('')}
      </div>
    \`;
  }

  overlay.innerHTML = \`
    <div class="vd-modal">
      <div class="vd-modal-header">
        <h3 class="vd-modal-title">نتائج التحميل</h3>
        <button class="vd-modal-close">&times;</button>
      </div>
      <div class="vd-modal-content">
        \${videosHtml}
        \${audiosHtml}
      </div>
    </div>
  \`;

  overlay.querySelector('.vd-modal-close').addEventListener('click', () => {
    overlay.remove();
  });

  document.body.appendChild(overlay);
}

// المراقبة الديناميكية للعناصر المضافة حديثاً
const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    if (mutation.addedNodes.length) {
      // البحث عن أي عنصر فيديو ضمن العقد المضافة
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === 1) { // Element node
          if (node.tagName === 'VIDEO') {
            injectDownloadButton(node);
          } else {
            const videos = node.querySelectorAll('video');
            videos.forEach(v => injectDownloadButton(v));
          }
        }
      });
    }
  }
});

// فحص الفيديوهات الموجودة أصلاً عند تحميل الصفحة
function scanExistingVideos() {
  const videos = document.querySelectorAll('video');
  videos.forEach(v => injectDownloadButton(v));
}

// بدء المراقبة عند تحميل DOM
scanExistingVideos();
observer.observe(document.body, { childList: true, subtree: true });
