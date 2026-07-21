/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Clipboard, X, Trash2, History, Heart, Download, ExternalLink, Play, Film, Music } from 'lucide-react';

interface HistoryItem {
  id: string;
  url: string;
  title: string;
  thumbnail?: string;
  data: any;
  timestamp: number;
}

export default function App() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // load history from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('video_downloader_history');
      if (saved) {
        setHistory(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Failed to load history from localStorage:', e);
    }
  }, []);

  // save history item
  const saveToHistory = (videoUrl: string, videoData: any) => {
    try {
      const newItem: HistoryItem = {
        id: Date.now().toString(),
        url: videoUrl,
        title: videoData.title || 'فيديو بدون عنوان',
        thumbnail: videoData.thumbnail,
        data: videoData,
        timestamp: Date.now(),
      };

      setHistory((prev) => {
        // Remove duplicate if same url exists
        const filtered = prev.filter((item) => item.url !== videoUrl);
        const updated = [newItem, ...filtered].slice(0, 30); // keep last 30
        localStorage.setItem('video_downloader_history', JSON.stringify(updated));
        return updated;
      });
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
    }
  };

  // delete item from history
  const deleteFromHistory = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setHistory((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      localStorage.setItem('video_downloader_history', JSON.stringify(updated));
      return updated;
    });
  };

  // clear entire history
  const clearHistory = () => {
    if (window.confirm('هل أنت تأكد من مسح جميع السجلات؟')) {
      setHistory([]);
      localStorage.removeItem('video_downloader_history');
    }
  };

  // paste from clipboard with graceful iframe fallback
  const handlePaste = async () => {
    try {
      if (navigator.clipboard && typeof navigator.clipboard.readText === 'function') {
        const text = await navigator.clipboard.readText();
        if (text) {
          setUrl(text.trim());
          return;
        }
      }
    } catch {
      // Ignore clipboard permission errors silently when running inside an iframe
    }

    if (inputRef.current) {
      inputRef.current.focus();
    }

    try {
      const text = window.prompt('ضع رابط الفيديو هنا:');
      if (text) {
        setUrl(text.trim());
      }
    } catch {
      // Ignore prompt errors if blocked in iframe
    }
  };

  // clear input field
  const handleClearInput = () => {
    setUrl('');
  };

  const fetchVideoInfo = async (e?: React.FormEvent, targetUrl?: string) => {
    if (e) e.preventDefault();
    const queryUrl = targetUrl || url;
    if (!queryUrl) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch('/api/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: queryUrl }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || 'تعذر جلب بيانات الفيديو. تأكد من صحة الرابط.');
      }

      setResult(data.data);
      saveToHistory(queryUrl, data.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // reload from history
  const handleReloadFromHistory = (item: HistoryItem) => {
    setUrl(item.url);
    if (item.data) {
      setResult(item.data);
      setError('');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      fetchVideoInfo(undefined, item.url);
    }
  };

  const getPlatformBadge = (videoUrl: string) => {
    const lower = videoUrl.toLowerCase();
    if (lower.includes('youtube.com') || lower.includes('youtu.be')) {
      return { name: 'يوتيوب', color: 'bg-red-100 text-red-700' };
    }
    if (lower.includes('tiktok.com')) {
      return { name: 'تيك توك', color: 'bg-neutral-800 text-white' };
    }
    if (lower.includes('instagram.com')) {
      return { name: 'إنستجرام', color: 'bg-pink-100 text-pink-700' };
    }
    if (lower.includes('facebook.com') || lower.includes('fb.watch')) {
      return { name: 'فيسبوك', color: 'bg-blue-100 text-blue-700' };
    }
    if (lower.includes('twitter.com') || lower.includes('x.com')) {
      return { name: 'تويتر / X', color: 'bg-sky-100 text-sky-700' };
    }
    return { name: 'فيديو', color: 'bg-gray-100 text-gray-700' };
  };

  return (
    <main className="min-h-screen bg-neutral-50 p-4 md:p-8 flex flex-col items-center justify-between font-sans" dir="rtl">
      {/* الحاوية الرئيسية */}
      <div className="w-full max-w-2xl my-6 bg-white rounded-2xl shadow-xl p-6 md:p-10 border border-neutral-100">
        
        {/* عنوان الموقع */}
        <h1 className="text-2xl md:text-4xl font-bold text-center text-neutral-800 mb-2">
          محمل الفيديوهات الشامل
        </h1>
        <p className="text-center text-neutral-500 mb-8 text-sm md:text-base">
          حمل من يوتيوب، فيسبوك، تيك توك، انستجرام وتويتر بضغطة واحدة
        </p>

        {/* نموذج الإدخال مع زر اللصق والمسح */}
        <form onSubmit={(e) => fetchVideoInfo(e)} className="flex flex-col gap-4">
          <div className="relative flex items-center">
            <input
              ref={inputRef}
              type="url"
              placeholder="ضع رابط الفيديو هنا..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              dir="ltr"
              className="w-full pl-24 pr-10 py-4 rounded-xl border-2 border-neutral-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-left text-sm md:text-base"
            />
            
            {/* زر المسح X داخل الإدخال */}
            {url && (
              <button
                type="button"
                onClick={handleClearInput}
                title="مسح الرابط"
                className="absolute right-3 p-1.5 text-neutral-400 hover:text-red-500 transition-colors rounded-lg hover:bg-neutral-100"
              >
                <X className="w-5 h-5" />
              </button>
            )}

            {/* زر اللصق داخل الإدخال */}
            <button
              type="button"
              onClick={handlePaste}
              title="لصق من الحافظة"
              className="absolute left-2 flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 px-3 py-2 rounded-lg text-xs font-semibold transition-colors border border-blue-200"
            >
              <Clipboard className="w-4 h-4" />
              <span>لصق</span>
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl transition-all disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center text-base md:text-lg shadow-md hover:shadow-lg active:scale-[0.99]"
          >
            {loading ? (
              <span className="animate-pulse flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                جاري سحب الروابط المباشرة...
              </span>
            ) : (
              'بحث وتحميل'
            )}
          </button>
        </form>

        {/* رسائل الخطأ */}
        {error && (
          <div className="mt-6 p-4 bg-red-50 text-red-600 rounded-xl border border-red-100 text-sm flex items-start gap-2">
            <X className="w-5 h-5 shrink-0 mt-0.5 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        {/* عرض النتائج */}
        {result && (
          <div className="mt-8 flex flex-col gap-6 animate-in fade-in duration-500 border-t pt-6 border-neutral-100">
            {/* تفاصيل الفيديو (صورة وعنوان) */}
            <div className="flex flex-col md:flex-row gap-4 items-center bg-neutral-50 p-4 rounded-xl border border-neutral-200/60">
              {result.thumbnail ? (
                <img 
                  src={result.thumbnail} 
                  alt={result.title} 
                  className="w-full md:w-48 h-32 rounded-lg object-cover shadow-sm shrink-0"
                />
              ) : (
                <div className="w-full md:w-48 h-32 rounded-lg bg-neutral-200 flex items-center justify-center text-neutral-400">
                  <Film className="w-10 h-10" />
                </div>
              )}
              <div className="flex flex-col gap-2 w-full text-center md:text-right">
                <h2 className="text-base md:text-lg font-semibold text-neutral-800 line-clamp-2 leading-relaxed">
                  {result.title}
                </h2>
                {result.duration && (
                  <span className="text-xs text-neutral-500 bg-neutral-200/70 w-fit px-2.5 py-1 rounded-md self-center md:self-start">
                    المدة: {result.duration}
                  </span>
                )}
              </div>
            </div>

            {/* قسم تحميل الفيديو */}
            {result.videos && result.videos.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-bold text-neutral-700 flex items-center gap-2 text-sm md:text-base">
                  <Film className="w-5 h-5 text-blue-600" />
                  <span>تحميل كـ فيديو:</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {result.videos.map((format: any, index: number) => (
                    <a
                      key={`vid-${index}`}
                      href={format.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex justify-between items-center px-4 py-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl text-blue-700 font-medium transition-colors group"
                    >
                      <span className="text-sm font-semibold flex items-center gap-1.5">
                        <Download className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />
                        {format.quality}
                      </span>
                      <span className="text-xs bg-blue-200/80 px-2.5 py-1 rounded-md text-blue-900 uppercase font-mono">
                        {format.ext}
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* قسم تحميل الصوت */}
            {result.audios && result.audios.length > 0 && (
              <div className="space-y-3 pt-4 border-t border-neutral-100">
                <h3 className="font-bold text-neutral-700 flex items-center gap-2 text-sm md:text-base">
                  <Music className="w-5 h-5 text-purple-600" />
                  <span>تحميل كـ صوت فقط:</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {result.audios.map((format: any, index: number) => (
                    <a
                      key={`aud-${index}`}
                      href={format.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex justify-between items-center px-4 py-3 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl text-purple-700 font-medium transition-colors group"
                    >
                      <span className="text-sm font-semibold flex items-center gap-1.5">
                        <Download className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />
                        {format.quality}
                      </span>
                      <span className="text-xs bg-purple-200/80 px-2.5 py-1 rounded-md text-purple-900 uppercase font-mono">
                        {format.ext}
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* سجل الروابط المحفوظة محلياً على الهاتف/الجهاز */}
        {history.length > 0 && (
          <div className="mt-10 pt-8 border-t border-neutral-200/80">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-neutral-800 text-base md:text-lg">
                  سجل التحميلات السابقة
                </h3>
                <span className="text-xs bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full font-mono">
                  {history.length}
                </span>
              </div>
              <button
                type="button"
                onClick={clearHistory}
                className="text-xs text-red-500 hover:text-red-700 hover:underline flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>مسح السجل</span>
              </button>
            </div>

            <p className="text-xs text-neutral-400 mb-4">
              * جميع الروابط محفوظة على جهازك محلياً ويمكنك الضغط على أي عنصر لإعادة تحميله.
            </p>

            <div className="flex flex-col gap-3 max-h-96 overflow-y-auto pr-1">
              {history.map((item) => {
                const badge = getPlatformBadge(item.url);
                return (
                  <div
                    key={item.id}
                    onClick={() => handleReloadFromHistory(item)}
                    className="flex items-center justify-between gap-3 p-3 bg-neutral-50 hover:bg-blue-50/60 border border-neutral-200/80 rounded-xl transition-all cursor-pointer group hover:border-blue-300"
                  >
                    {/* الصورة والعنوان */}
                    <div className="flex items-center gap-3 overflow-hidden">
                      {item.thumbnail ? (
                        <img
                          src={item.thumbnail}
                          alt={item.title}
                          className="w-14 h-14 rounded-lg object-cover shrink-0 border border-neutral-200"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-lg bg-neutral-200 flex items-center justify-center shrink-0 text-neutral-400">
                          <Play className="w-6 h-6" />
                        </div>
                      )}
                      <div className="flex flex-col gap-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] px-2 py-0.5 rounded-md font-medium shrink-0 ${badge.color}`}>
                            {badge.name}
                          </span>
                        </div>
                        <h4 className="text-xs md:text-sm font-medium text-neutral-800 group-hover:text-blue-700 truncate">
                          {item.title}
                        </h4>
                        <span className="text-[11px] text-neutral-400 truncate dir-ltr text-right">
                          {item.url}
                        </span>
                      </div>
                    </div>

                    {/* زر حذف العنصر من السجل X */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => deleteFromHistory(item.id, e)}
                        title="حذف من السجل"
                        className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>

      {/* حقوق وتوقيع المطور بالأسفل */}
      <footer className="mt-6 mb-4 text-center text-neutral-600 text-sm flex flex-col items-center gap-1.5">
        <p className="flex items-center gap-1.5 font-medium text-neutral-700">
          <span>مع تحيات المطور Amir Lamay</span>
          <Heart className="w-4 h-4 text-red-500 fill-red-500 animate-pulse" />
        </p>
        <p className="text-xs font-semibold text-neutral-400 tracking-wider">
          Made In Egypt
        </p>
      </footer>
    </main>
  );
}
