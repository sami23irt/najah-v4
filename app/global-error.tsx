"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="ar" dir="rtl">
      <body className="flex min-h-screen items-center justify-center bg-[#f7f6f0] p-8 text-center">
        <div>
          <p className="text-lg font-bold text-slate-800">وقع خطأ غير متوقع.</p>
          <p className="mt-1 text-sm text-slate-500">تم تسجيل المشكلة تلقائياً وسنعمل على إصلاحها.</p>
          <button
            onClick={() => reset()}
            className="mt-4 rounded-xl bg-emerald-900 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-800"
          >
            إعادة المحاولة
          </button>
        </div>
      </body>
    </html>
  );
}
