# مراجعة Dead Code والتكرار

## الحالة النهائية

أُجريت المراجعة على commit `75689d9`، ثم حُذفت العناصر المصنفة كـ **مرشحي حذف قويين** فقط. لم تُحذف أي ملفات أو components مستخدمة، ولم تُحذف وظيفة PostgreSQL `vector` المستخدمة في migrations؛ الذي حُذف هو dependency npm غير المستخدمة فقط. كما بقي refactor حارس المصادقة في `lib/api-auth.ts` دون تغيير.

## العناصر المحذوفة

| العنصر | الدليل على عدم الاستخدام | الحكم |
|---|---|---|
| `@tanstack/react-query` | dependency مباشرة؛ لم يظهر أي `import` أو `require` لها في المصدر، وصنّفها `knip` كـ `Unused dependency` | حُذفت من `package.json` و`package-lock.json` |
| `pgvector` | dependency npm مباشرة؛ لم يظهر أي import لحزمة npm. الاستعمال الفعلي هو PostgreSQL extension باسم `vector` داخل migration وذكره في RAG docs/comments | حُذفت حزمة npm فقط، وبقيت migrations وامتداد PostgreSQL دون تعديل |
| `sendRoomInviteEmail` | exported function؛ ظهر تعريفها الوحيد في `lib/email.ts` ولم يظهر أي caller في المستودع | حُذفت الدالة فقط، وبقيت `sendAccountDeletionEmail` وإعدادات Resend |
| `export` في `FocusModeControls` داخل `components/VideoRoom.tsx` | `knip` صنّف التصدير كغير مستخدم خارج الملف، لكن الدالة نفسها مستخدمة داخلياً في السطر 68 | لا نحذف الدالة؛ يمكن إزالة `export` فقط بعد موافقة لأنها تغيّر API الداخلي |
| `export` في `getServerPostHog` داخل `lib/posthog-server.ts` | `knip` صنّف التصدير كغير مستخدم خارج الملف، بينما تستعمل الدالة داخلياً في السطر 36 | لا نحذف الدالة؛ يمكن إزالة `export` فقط بعد الموافقة |
| `export` في `chunkText` و`embedText` داخل `lib/rag.ts` | `knip` صنّف التصدير كغير مستخدم خارج الملف، لكن الدالتين مستعملتان داخلياً في `lib/rag.ts` | لا نحذف الدالتين؛ يمكن إزالة `export` فقط بعد الموافقة |
| `README-V5.md` | ليس مستورداً من الكود ولا entrypoint تنفيذياً، لكنه ملف توثيق؛ لا يوجد دليل كافٍ لاعتباره dead code | لا يُحذف تلقائياً |

## الملفات

لم يعرض `knip` أي `Unused files`. ملفات `app` الخاصة هي Next.js entrypoints، وملفات `instrumentation` و`sentry` و`proxy` conventions، وملفات migrations/scripts تُستدعى من tooling أو تُطبق خارج runtime. لذلك لا توجد حالياً قائمة ملفات يمكن حذفها بثقة.

## متغيرات البيئة

كل المتغيرات الموثقة في `.env.example` لها استعمال أو سبب تشغيلي معروف. `DATABASE_URL` مستعمل في `drizzle.config.ts:6`، و`NEXT_PUBLIC_SENTRY_DSN` مستعمل في `sentry.server.config.ts:4` وملفات Sentry المقابلة. `NODE_ENV` متغير Node قياسي ومستعمل في إعدادات الإنتاج. لم يثبت وجود env var ميت يمكن حذفه.

## Commented-out blocks

لم يُعثر على كتل code معلّقة حقيقية. المرشحان الظاهران في `lib/rag.ts:154` و`lib/youtube-transcript.ts:3` هما تعليقات وصفية تبدأ بكلمات تشبه code، وليستا code معطلاً. التعليقات متعددة الأسطر في `lib/` و`components/` توثيق أو تحذيرات أمنية، وليست بقايا تنفيذ.

## التكرار الذي تم refactor له

تكرر نمط `requireSameOrigin` ثم إنشاء request-scoped Supabase client ثم `auth.getUser()` في مسارات API متعددة. أُنشئت الدالة `requireAuthenticatedUser` في `lib/api-auth.ts`، واستُخدمت في:

- `app/api/copilot/route.ts`
- `app/api/study/chat/route.ts`

يحافظ refactor على نفس ترتيب التنفيذ، ونفس استجابة same-origin، ونفس status `401` ونفس رسائل عدم المصادقة. لم يتغير منطق RAG أو rate limit أو ownership checks.

حلل `jscpd` المصدر فوجد 9 clones بإجمالي 73 سطراً مكرراً. أغلبها تكرار مقصود في schemas وحواجز API ومسار توليد الاختبارات، إضافة إلى حلقة قراءة SSE المتشابهة بين الخادم والعميل. لا ينبغي دمج هذه الكتل آلياً لأن اختلاف الرسائل وschemas وحقوق الوصول يجعل refactor غير الآمن يغيّر السلوك.

## التحقق بعد الحذف

نجحت الفحوص التالية بعد التعديل:

| الفحص | النتيجة |
|---|---|
| `npm run typecheck` | ناجح |
| `npm run test:stream` | ناجح: `assistant stream parser: ok` |
| `npm audit --omit=dev --audit-level=high` | ناجح؛ لم تظهر ثغرات ضمن مستوى `high` المطلوب |
| `npm run build` | ناجح؛ اكتمل Next.js production build وتوليد 28 صفحة ثابتة |
| `npm install --package-lock-only --ignore-scripts --dry-run` | ناجح؛ lockfile متسق |
| `npm ls @tanstack/react-query @trpc/react-query pgvector --all` | لا توجد الحزم المحذوفة في شجرة npm، ولم يتأثر `@trpc/react-query` |
| `git diff --check` | ناجح |

بعد الحذف، أكد `git grep` عدم وجود استعمالات للكلمات الثلاث داخل الكود. الظهور المتبقي لكلمة `pgvector` في `README.md` و`lib/rag.ts` وmigration هو توثيق لاستخدام PostgreSQL extension، وليس اعتماداً على حزمة npm المحذوفة.

لم يتم إنشاء commit أو تنفيذ push إلى GitHub.

## العناصر التي لم تُحذف

لم تُحذف `FocusModeControls` أو `getServerPostHog` أو `chunkText` أو `embedText`؛ فقد ثبت أنها مستخدمة داخلياً رغم أن `knip` أشار إلى أن exports الخاصة بها غير مستوردة من ملفات أخرى. كما لم تُحذف ملفات Next.js entrypoints أو migrations أو متغيرات البيئة، لعدم وجود دليل موثوق على أنها dead code.

## ملاحظة بشأن تحليل الخطأ

لم تُرسل رسالة الخطأ أو الكود المشار إليهما في الطلب الأصلي، لذلك لم يُكتب تحليل جذور الخطأ بعد. بعد استلامهما سيُقدَّم بالترتيب: السبب المحتمل الأول، طريقة تأكيده، السبب الثاني، طريقة تأكيده، السبب الثالث، طريقة تأكيده — من دون كتابة fix قبل التأكيد.
