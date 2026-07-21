/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';

export default function App() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const fetchVideoInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      // الاتصال بالـ API الخاص بنا (المرحلة الأولى)
      const res = await fetch('/api/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || 'تعذر جلب بيانات الفيديو. تأكد من صحة الرابط.');
      }

      setResult(data.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-neutral-50 p-4 md:p-8 flex flex-col items-center font-sans" dir="rtl">
      {/* الحاوية الرئيسية - متجاوبة */}
      <div className="w-full max-w-2xl mt-10 bg-white rounded-2xl shadow-xl p-6 md:p-10 border border-neutral-100">
        
        {/* عنوان الموقع */}
        <h1 className="text-2xl md:text-4xl font-bold text-center text-neutral-800 mb-2">
          محمل الفيديوهات الشامل
        </h1>
        <p className="text-center text-neutral-500 mb-8 text-sm md:text-base">
          حمل من يوتيوب، فيسبوك، تيك توك، انستجرام وتويتر بضغطة واحدة
        </p>

        {/* نموذج الإدخال */}
        <form onSubmit={fetchVideoInfo} className="flex flex-col gap-4">
          <input
            type="url"
            placeholder="ضع رابط الفيديو هنا..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
            dir="ltr"
            className="w-full px-4 py-4 rounded-xl border-2 border-neutral-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-left"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl transition-all disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center"
          >
            {loading ? (
              <span className="animate-pulse">جاري سحب الروابط المباشرة...</span>
            ) : (
              'بحث وتحميل'
            )}
          </button>
        </form>

        {/* رسائل الخطأ */}
        {error && (
          <div className="mt-6 p-4 bg-red-50 text-red-600 rounded-xl border border-red-100 text-sm">
            {error}
          </div>
        )}

        {/* عرض النتائج */}
        {result && (
          <div className="mt-8 flex flex-col gap-6 animate-in fade-in duration-500">
            {/* تفاصيل الفيديو (صورة وعنوان) */}
            <div className="flex flex-col md:flex-row gap-4 items-center bg-neutral-50 p-4 rounded-xl">
              {result.thumbnail && (
                <img 
                  src={result.thumbnail} 
                  alt={result.title} 
                  className="w-full md:w-48 h-auto rounded-lg object-cover shadow-sm"
                />
              )}
              <h2 className="text-lg font-semibold text-neutral-800 text-center md:text-right line-clamp-2">
                {result.title}
              </h2>
            </div>

            {/* قسم تحميل الفيديو */}
            {result.videos && result.videos.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-bold text-neutral-700 flex items-center gap-2">
                  🎥 تحميل كـ فيديو:
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {result.videos.map((format: any, index: number) => (
                    <a
                      key={`vid-${index}`}
                      href={format.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex justify-between items-center px-4 py-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl text-blue-700 font-medium transition-colors"
                    >
                      <span>{format.quality}</span>
                      <span className="text-xs bg-blue-200 px-2 py-1 rounded-md text-blue-800">
                        {format.ext.toUpperCase()}
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* قسم تحميل الصوت */}
            {result.audios && result.audios.length > 0 && (
              <div className="space-y-3 pt-4 border-t border-neutral-100">
                <h3 className="font-bold text-neutral-700 flex items-center gap-2">
                  🎵 تحميل كـ صوت فقط:
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {result.audios.map((format: any, index: number) => (
                    <a
                      key={`aud-${index}`}
                      href={format.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex justify-between items-center px-4 py-3 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl text-purple-700 font-medium transition-colors"
                    >
                      <span>{format.quality}</span>
                      <span className="text-xs bg-purple-200 px-2 py-1 rounded-md text-purple-800">
                        {format.ext.toUpperCase()}
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
