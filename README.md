# Najah.ma — v2 (معمارية مطابقة للوثيقة)

هذا ليس تعديلاً على الكود القديم بل بداية إعادة بناء حسب الأولويات التالية،
مبنية فوق **Next.js + Supabase (Postgres/pgvector) + LiveKit + Gemini**، بدل
معمارية Manus الخاصة السابقة (Vite + tRPC + MySQL + Socket.io فقط).

## ما تم إنجازه فعليًا في هذه الدفعة (مبني ومختبر منطقيًا، غير مُشغَّل فعليًا هنا لعدم توفر إنترنت)

0. **صفحات الواجهة كاملة على Next.js App Router** (`app/*`) — الصفحة الرئيسية، الأرشيف مع الفلاتر، القارئ المزدوج، المساعد الذكي، الغرف (قائمة + غرفة فيديو)، لوحة التقدم، الملف الشخصي
   - الدردشة والمؤقت المتزامن أصبحا عبر **Supabase Realtime** (`lib/useRoomRealtime.ts`) بدل Socket.io/سيرفر منفصل — متجانس مع بقية المعمارية بلا حاجة لعملية خادم إضافية
   - رمز الدخول للغرف الخاصة يُشفَّر (`sha256`) داخل دالة SQL `create_study_room`، ولا يُخزَّن أو يُرسل كنص صريح أبدًا (`0003_room_rpcs.sql`)

1. **RAG حقيقي** (`lib/rag.ts`, `app/api/copilot/route.ts`, `supabase/migrations/0001_rag_and_rls.sql`)
   - تقسيم النص إلى مقاطع (`chunkText`)
   - تضمين المقاطع عبر Gemini `gemini-embedding-001` وتخزينها في `curriculum_chunks` (pgvector)
   - الاسترجاع عبر دالة SQL `match_curriculum_chunks` (تشابه جيبي، ivfflat index)
   - **قاعدة الجودة من الوثيقة مطبّقة فعليًا**: إذا كان التشابه أقل من 0.72، يرفض المساعد الإجابة بدل الاختلاق (`MIN_SIMILARITY`)
   - سكريبت تلقيم (`scripts/ingest-curriculum.ts`) لملء قاعدة المعرفة

2. **غرف فيديو/صوت حقيقية عبر LiveKit** (`app/api/rooms/token/route.ts`, `components/VideoRoom.tsx`)
   - توليد token من الخادم فقط بعد التحقق من العضوية (لا يمكن لأي شخص الحصول على token لغرفة لم ينضم إليها)
   - صلاحيات مشرف (كتم/إدارة) للـ host والـ moderator فقط، مطابقةً لقسم 3.5 من الوثيقة

3. **قاعدة بيانات PostgreSQL/Supabase** (`drizzle/schema.ts`)
   - ترحيل كامل من MySQL، مع RLS مفعّلة على كل جدول حساس (`0001_rag_and_rls.sql`)
   - جداول RAG الجديدة: `curriculum_documents`, `curriculum_chunks`

4. **إصلاح خطأ لوحة الشرف** (`lib/leaderboard.ts`, `app/api/dashboard/record/route.ts`, `0002_leaderboard_cron.sql`)
   - `refreshLeaderboardForUser` يُستدعى الآن فعليًا بعد كل جلسة/محاولة QCM
   - مهمة `pg_cron` ليلية كنسخة احتياطية

## ما أُضيف في النسخة الحالية

- **السبورة التفاعلية** داخل غرفة LiveKit، مع مزامنة strokes وعمليات المسح عبر DataChannel موثوق.
- **حذف الحساب** من صفحة الملف الشخصي عبر endpoint خادمي يستعمل Supabase Admin، مع الحفاظ على سجل حدث الحذف في `audit_logs`.
- **Audit logs** للأحداث الحساسة: إنشاء الغرف، تغييرات أدوار الأعضاء، تغييرات المؤقت، وحصول ملفات الامتحانات على روابط موقعة، إضافة إلى حذف الحساب.
- **مولد MCQ كامل**: استرجاع RAG → توليد JSON والتحقق منه → تخزين الإجابات الصحيحة على الخادم → تصحيح النتيجة خادميًا → حفظ `quiz_attempts`.
- **إغلاق ثغرة مهمة**: endpoint تسجيل النشاط لم يعد يقبل من العميل نتيجة Quiz مزورة؛ محاولات MCQ تُسجل فقط بعد إنهاء `quiz_session` على الخادم.


## الإعداد

1. أنشئ مشروع Supabase، فعّل `pgvector` (يحدث تلقائيًا عبر migration 0001)
2. طبّق الترحيلات: `supabase db push` أو نفّذ ملفات `supabase/migrations/*.sql` يدويًا
3. أنشئ مشروع LiveKit Cloud (أو استضافة ذاتية) واحصل على المفاتيح
4. انسخ `.env.example` إلى `.env.local` واملأ القيم
5. `npm install && npm run dev`
6. لتلقيم المقرر: استخرج نص PDF (مثلاً بـ `pdftotext`) ثم `pnpm ingest --file ... --title ... --level 2BAC --subject الرياضيات`

## تنبيه أمني من الفحص السابق

ملف `.project-config.json` القديم كان يحتوي أسرارًا حقيقية (كلمة سر DB، JWT secret، مفاتيح API).
إذا كنت شاركته سابقًا في أي مكان، غيّر هذه الأسرار من مصدرها الآن — هذا المشروع الجديد لا يحتوي عليها.

## إصلاحات لاحقة (migrations 0006–0008)

- أعيد ترقيم `0005_security_hardening.sql` إلى `0006_security_hardening.sql` و`0006_compliance_quizzes_whiteboard.sql` إلى `0007_compliance_quizzes_whiteboard.sql` لحل تعارض وجود ملفين بنفس الرقم `0005`.
- `0008_fix_room_insert_policy.sql`: حذف سياسة RLS التي كانت تسمح بإدراج صف مباشر في `study_rooms` من العميل متجاوزة كل التحقق الموجود في `create_study_room()` (طول الاسم، إلزامية رمز مرور مشفّر للغرف الخاصة) ودون إضافة العضوية في `room_members`. الإنشاء الآن يمر حصراً عبر `create_study_room()`.

## إضافة connectors (Sentry + Resend + PostHog)

- **Sentry**: مشروع `najah-ma` تخلق تحت تنظيم `iratta`. تتبع الأخطاء مفعّل على العميل والسيرفر وEdge (`instrumentation.ts`, `sentry.*.config.ts`) مع `global-error.tsx` كحدّ أخير للأخطاء غير الملتقطة. `tracesSampleRate` مضبوط على 0.1 (10%) عمداً — الغرف تستعمل جلسات LiveKit طويلة، وتتبع 100% سيكون مكلفاً وغير مفيد. Session Replay **معطّل** لأن التطبيق يحتوي بيانات تلاميذ حساسة (نتائج، أسئلة) وتفعيله يحتاج مراجعة خصوصية منفصلة.
- **Resend**: مفتاح API بصلاحية `sending_access` تم إنشاؤه (`najah-ma-transactional`). `lib/email.ts` يرسل بريد تأكيد عند حذف الحساب (`account_deleted`) ودعوات الغرف الخاصة. **لا يوجد نطاق موثّق بعد** — الإرسال الحالي يمر عبر `onboarding@resend.dev` المشترك، الذي لا يقدر يرسل إلا لعنوان صاحب حساب Resend نفسه. قبل الإطلاق الحقيقي: وثّق نطاق (مثلاً `najah.ma`) في Resend واضبط `RESEND_FROM_EMAIL`.
- **PostHog**: مشروع "Default project" الموجود مسبقاً فمنظمة "Iratta project" (EU region). `autocapture` **معطّل** عمداً (منصة تلاميذ — بغينا أحداث محددة، ماشي كل نقرة). الأحداث المتتبَّعة حالياً: `study_session_recorded`، `quiz_submitted`، `room_created`، `account_deleted`. الربط بين أحداث العميل والسيرفر يتم عبر `posthog.identify(user.id)` بلا إرسال إيميل أو اسم (تقليل بيانات الأشخاص لمنصة يستعملها قاصرون).

## Security hardening notes

- Apply `supabase/migrations/0005_security_hardening.sql` after the existing migrations.
- Room timer writes must use `set_room_timer`; there is no broad client UPDATE policy on `study_rooms`.
- Study durations are derived server-side by `record_study_session`; clients cannot choose the stored `duration_minutes`.
- Realtime room channels are private and Presence is authorized only for authenticated room members. Keep Supabase Realtime **Allow public access** disabled in production.
- LiveKit join tokens are short-lived and restrict published media sources; only hosts/moderators receive `roomAdmin`.
