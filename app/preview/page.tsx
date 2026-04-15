'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, CheckCircle, XCircle, RefreshCw, Database, Server, Shield, Activity } from 'lucide-react';

interface HealthCheck {
  database: boolean;
  tables: Record<string, boolean>;
  missingTables: string[];
  errors: string[];
}

export default function PreviewPage() {
  const [status, setStatus] = useState<'loading' | 'healthy' | 'unhealthy' | 'error'>('loading');
  const [checks, setChecks] = useState<HealthCheck | null>(null);
  const [error, setError] = useState<string>('');

  const checkHealth = async () => {
    setStatus('loading');
    try {
      const response = await fetch('/api/health/detailed');
      const data = await response.json();
      setChecks(data.checks);
      setStatus(data.status === 'healthy' ? 'healthy' : 'unhealthy');
    } catch (e: any) {
      setStatus('error');
      setError(e.message);
    }
  };

  const initializeDb = async () => {
    if (!confirm('هل تريد تهيئة قاعدة البيانات؟ سيتم إنشاء الجداول والبيانات التجريبية.')) {
      return;
    }
    try {
      const response = await fetch('/api/init');
      const data = await response.json();
      if (data.success) {
        alert('✅ تم تهيئة قاعدة البيانات بنجاح!');
        checkHealth();
      } else {
        alert('❌ فشلت التهيئة: ' + data.error);
      }
    } catch (e: any) {
      alert('❌ خطأ: ' + e.message);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6" dir="rtl">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">🔍 معاينة النظام</h1>
          <p className="text-slate-400">فحص شامل لحالة النظام قبل النشر</p>
        </div>

        {/* Status Card */}
        <div className={`rounded-2xl p-6 mb-6 shadow-2xl border ${
          status === 'healthy' ? 'bg-green-900/30 border-green-500/50' :
          status === 'unhealthy' ? 'bg-yellow-900/30 border-yellow-500/50' :
          status === 'error' ? 'bg-red-900/30 border-red-500/50' :
          'bg-blue-900/30 border-blue-500/50'
        }`}>
          <div className="flex items-center gap-4">
            {status === 'loading' && <RefreshCw className="w-12 h-12 text-blue-400 animate-spin" />}
            {status === 'healthy' && <CheckCircle className="w-12 h-12 text-green-400" />}
            {status === 'unhealthy' && <AlertCircle className="w-12 h-12 text-yellow-400" />}
            {status === 'error' && <XCircle className="w-12 h-12 text-red-400" />}
            <div>
              <h2 className="text-2xl font-bold text-white">
                {status === 'loading' && 'جاري الفحص...'}
                {status === 'healthy' && 'النظام يعمل بكفاءة ✅'}
                {status === 'unhealthy' && 'النظام يحتاج للتهيئة ⚠️'}
                {status === 'error' && 'خطأ في الاتصال ❌'}
              </h2>
              <p className="text-slate-300 mt-1">
                {status === 'healthy' && 'جميع الجداول موجودة وقاعدة البيانات متصلة'}
                {status === 'unhealthy' && `جداول مفقودة: ${checks?.missingTables.join(', ') || 'غير معروف'}`}
                {status === 'error' && error}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <button
            onClick={checkHealth}
            disabled={status === 'loading'}
            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-xl transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${status === 'loading' ? 'animate-spin' : ''}`} />
            إعادة الفحص
          </button>

          <button
            onClick={initializeDb}
            disabled={status === 'loading'}
            className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white p-4 rounded-xl transition-all disabled:opacity-50"
          >
            <Database className="w-5 h-5" />
            تهيئة قاعدة البيانات
          </button>

          <Link
            href="/api/init"
            target="_blank"
            className="flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white p-4 rounded-xl transition-all"
          >
            <Server className="w-5 h-5" />
            API التهيئة
          </Link>
        </div>

        {/* Tables Status */}
        {checks?.tables && (
          <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700 mb-6">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Database className="w-6 h-6 text-blue-400" />
              حالة الجداول
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {Object.entries(checks.tables).map(([table, exists]) => (
                <div
                  key={table}
                  className={`p-3 rounded-lg flex items-center gap-2 ${
                    exists ? 'bg-green-900/30 border border-green-500/30' : 'bg-red-900/30 border border-red-500/30'
                  }`}
                >
                  {exists ? <CheckCircle className="w-5 h-5 text-green-400" /> : <XCircle className="w-5 h-5 text-red-400" />}
                  <span className={`text-sm font-medium ${exists ? 'text-green-300' : 'text-red-300'}`}>
                    {table}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Links */}
        <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Activity className="w-6 h-6 text-green-400" />
            روابط سريعة للاختبار
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Link href="/login" className="p-4 bg-slate-700 hover:bg-slate-600 rounded-xl text-white transition-all">
              🔐 صفحة تسجيل الدخول
            </Link>
            <Link href="/setup" className="p-4 bg-slate-700 hover:bg-slate-600 rounded-xl text-white transition-all">
              ⚙️ صفحة الإعداد
            </Link>
            <Link href="/dashboard" className="p-4 bg-slate-700 hover:bg-slate-600 rounded-xl text-white transition-all">
              📊 لوحة التحكم
            </Link>
            <Link href="/api/health" className="p-4 bg-slate-700 hover:bg-slate-600 rounded-xl text-white transition-all">
              🩺 API الصحة
            </Link>
          </div>
        </div>

        {/* Setup Note */}
        <div className="mt-6 bg-gradient-to-r from-indigo-900/50 to-purple-900/50 rounded-2xl p-6 border border-indigo-500/30">
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Shield className="w-6 h-6 text-indigo-400" />
            ملاحظة الأمان
          </h3>
          <p className="text-slate-300">
            استخدم صفحة الإعداد لإنشاء مستخدم جديد. لا توجد بيانات دخول افتراضية للنظام.
          </p>
        </div>
      </div>
    </div>
  );
}
