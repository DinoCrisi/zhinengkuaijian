import React from 'react';
import { CheckCircle2 } from 'lucide-react';

export const StepIndicator = ({ step }: { step: number }) => (
  <div className="flex items-center justify-center gap-4 mb-8">
    {[
      { n: 1, l: "分析" },
      { n: 2, l: "设置" },
      { n: 3, l: "生成" }
    ].map((s) => (
      <React.Fragment key={s.n}>
        <div className="flex items-center gap-2">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step >= s.n ? 'bg-violet-600 text-white' : 'bg-white/10 text-gray-500'}`}>
            {step > s.n ? <CheckCircle2 size={14} /> : s.n}
          </div>
          <span className={`text-sm font-medium ${step >= s.n ? 'text-white' : 'text-gray-500'}`}>{s.l}</span>
        </div>
        {s.n < 3 && <div className={`w-12 h-[1px] ${step > s.n ? 'bg-violet-600' : 'bg-white/10'}`} />}
      </React.Fragment>
    ))}
  </div>
);

