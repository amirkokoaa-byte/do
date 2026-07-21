// background.js

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fetchVideoInfo') {
    // قم بتغيير هذا الرابط إلى رابط Vercel الخاص بك عند الرفع (مثل: https://your-vercel-app.vercel.app/api/download)
    // نستخدم الرابط المحلي حالياً لأغراض الاختبار
    const apiUrl = 'http://localhost:3000/api/download'; 
    
    fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url: request.url })
    })
    .then(response => response.json())
    .then(data => {
      sendResponse({ success: true, data: data });
    })
    .catch(error => {
      sendResponse({ success: false, error: error.toString() });
    });

    // إرجاع true يشير إلى أننا سنرسل الرد بشكل غير متزامن (Asynchronous)
    return true; 
  }
});
