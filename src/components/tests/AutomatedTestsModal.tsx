import React, { useState } from 'react';
import { CheckCircle2, XCircle, Play, ShieldAlert, Check, RefreshCw, Cpu } from 'lucide-react';
import { runAutomatedTestSuite, TestResult } from '../../lib/testSuite';

export const AutomatedTestsModal: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const [hasRun, setHasRun] = useState(false);

  const handleRunTests = async () => {
    setIsRunning(true);
    const testResults = await runAutomatedTestSuite();
    setResults(testResults);
    setIsRunning(false);
    setHasRun(true);
  };

  const passedCount = results.filter(r => r.passed).length;
  const failedCount = results.filter(r => !r.passed).length;

  return (
    <div className="space-y-4 max-w-4xl mx-auto text-right">
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Cpu className="w-6 h-6 text-emerald-600" />
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              فحص النظام واختبارات الصحة الآلية (Automated Diagnostic Tests)
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-xl leading-relaxed">
            اختبارات حية تتحقق من صحة حسابات الإجمالي، دقة الوزن بالكسور العشرية، خصم المخزون التلقائي، حساب الدين والدفعات، استرجاع السلع، وسلة المحذوفات وطابور العمل دون اتصال.
          </p>
        </div>

        <button
          onClick={handleRunTests}
          disabled={isRunning}
          className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold px-5 py-3 rounded-xl text-xs sm:text-sm shadow active:scale-95 transition whitespace-nowrap"
        >
          {isRunning ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>جاري تشغيل الاختبارات...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" />
              <span>بدء الفحص الآلي الآن</span>
            </>
          )}
        </button>
      </div>

      {/* Summary Scorecard if run */}
      {hasRun && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white p-4 rounded-xl border border-slate-200 text-center">
            <span className="text-xs text-slate-500 font-bold">إجمالي الاختبارات:</span>
            <div className="text-2xl font-black text-slate-900 mt-1">{results.length}</div>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl text-center">
            <span className="text-xs text-emerald-800 font-bold">اختبارات ناجحة:</span>
            <div className="text-2xl font-black text-emerald-700 mt-1">{passedCount}</div>
          </div>
          <div className={`p-4 rounded-xl border text-center ${
            failedCount > 0 ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-200'
          }`}>
            <span className="text-xs font-bold text-slate-600">اختبارات فاشلة:</span>
            <div className={`text-2xl font-black mt-1 ${failedCount > 0 ? 'text-rose-700' : 'text-slate-400'}`}>
              {failedCount}
            </div>
          </div>
        </div>
      )}

      {/* Test Results Breakdown */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100">
        {!hasRun ? (
          <div className="text-center py-12 px-4 text-slate-400 text-xs">
            اضغط على «بدء الفحص الآلي الآن» لإجراء الاختبارات الشاملة لمنطق المحل والكاشير.
          </div>
        ) : (
          results.map((r) => (
            <div key={r.id} className="p-4 flex items-start gap-3 hover:bg-slate-50/70 transition">
              <div className="mt-0.5">
                {r.passed ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                ) : (
                  <XCircle className="w-5 h-5 text-rose-600" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-bold text-sm text-slate-900">{r.name}</h4>
                  <span className="text-[10px] text-slate-400 font-mono">{r.durationMs}ms</span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5">{r.description}</p>
                <div className="mt-2 text-[11px] grid grid-cols-1 sm:grid-cols-2 gap-1.5 p-2 bg-slate-50 rounded-lg border border-slate-200/70">
                  <div>
                    <span className="text-slate-400">النتيجة المتوقعة: </span>
                    <span className="font-semibold text-slate-800">{r.expected}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">النتيجة الفعلية: </span>
                    <span className={`font-bold ${r.passed ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {r.actual}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
