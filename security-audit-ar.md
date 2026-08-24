# تقرير تدقيق أمني — `sami23irt/najah-v4`

## الملخص التنفيذي

أُجري هذا التدقيق على شجرة العمل الحالية من منظور **defensive security review**، مع التركيز على المصادقة والتفويض، الأسرار، RLS و`SECURITY DEFINER`، مسارات API، الحقن، تسريب البيانات، وrate limiting. تم لاحقاً تطبيق الإصلاحات البرمجية وmigration الموثقة هنا، ولم يُنشأ commit أو يُنفّذ push بعد.

أقوى finding هو أن `quiz_sessions.questions` يخزن مفتاح الإجابات داخل صف يستطيع صاحبه قراءته مباشرة عبر Supabase، ما يسمح بكشف `correctIndex` قبل التسليم والتلاعب بنزاهة النتائج. كما توجد دوال `SECURITY DEFINER` مكشوفة أكثر من اللازم، وقراءة عامة مباشرة لجدول leaderboard تعرض `user_id` وبيانات أخرى، إضافة إلى rate limiting محلي قابل للتجاوز ومسارات غرف مباشرة من المتصفح بلا حدود تطبيقية.

> لم أجد secrets فعلية committed في الشجرة الحالية أو في آخر 50 commit المفحوصة بالأنماط المعروفة، كما لم يجد `npm audit --omit=dev` أي vulnerability حالية ضمن الاعتماديات الإنتاجية.

## مصفوفة الخطورة

| الترتيب | الخطورة | finding | الأثر الأساسي | الحالة |
|---:|---|---|---|---|
| 1 | **High** | كشف answer key في `quiz_sessions` عبر RLS | الغش وتزوير نتائج الاختبارات والـ leaderboard | مؤكد من الكود والسياسة |
| 2 | **High** | `refresh_all_leaderboards()` دالة `SECURITY DEFINER` قابلة للاستدعاء افتراضياً | إعادة تشغيل مكلفة لكل leaderboard وDoS/تلاعب في freshness | مؤكد من migration؛ يلزم تأكيد grants على قاعدة الإنتاج |
| 3 | **Medium-High** | `leaderboard_snapshots` قابل للقراءة العامة بكل الأعمدة | كشف `user_id` والمنطقة والمادة والدرجات | مؤكد من RLS/schema |
| 4 | **Medium-High** | `write_audit_log()` يسمح لكل authenticated بكتابة أحداث تدقيق اعتباطية | إفساد سجل التدقيق وإخفاء أو تزوير دلالته | مؤكد من migration |
| 5 | **Medium** | دوال membership تقبل `p_user_id` اعتباطياً | membership/role oracle للأعضاء والمشرفين | مؤكد من signature وgrant |
| 6 | **Medium** | rate limiting في `Map` داخل الذاكرة ومسارات الغرف تتجاوزه | bypass عبر instances أو حسابات/IPs، spam وتكاليف غير منضبطة | مؤكد من الكود |
| 7 | **Medium** | عدم وجود timeout وسقف متين لمسارات AI وYouTube/PDF | استنزاف موارد وGemini quota وworker exhaustion | مؤكد من الكود |
| 8 | **Medium-Low** | وضع Gemini API key في query string | احتمال تسرب المفتاح إلى URL/proxy/APM logs | مؤكد من الكود |
| 9 | **Low-Medium** | بث `error.message` من streaming إلى العميل | كشف تفاصيل upstream أو runtime غير المقصودة | مؤكد من الكود |
| 10 | **Low** | existence oracle للغرف الخاصة في page gate | تمييز room IDs الموجودة عن غير الموجودة | مؤكد، أثره محدود |

## 1. كشف answer key في جلسات الاختبارات — High

### الدليل

تعرّف `supabase/migrations/0007_compliance_quizzes_whiteboard.sql:58-73` جدول `quiz_sessions`، وتضع الإجابات داخل عمود `questions`، ثم تنشئ سياسة:

```sql
create policy "own quiz sessions read"
on public.quiz_sessions
for select to authenticated
using (auth.uid() = user_id);
```

كما يثبت `drizzle/schema.ts:178-194` أن `questions` هو `jsonb` داخل الصف نفسه. في المقابل، يقوم `app/api/quizzes/generate/route.ts:72-76` بإخفاء `correctIndex` فقط في JSON الذي يرجعه endpoint، بينما لا يمنع المستخدم من تنفيذ استعلام Supabase مباشر على صفه.

### سيناريو الاستغلال

أي مستخدم authenticated يستطيع استدعاء Data API مباشرة على `quiz_sessions` مع `select=questions` و`id` الخاص بجلسة يملكها. ستعيد السياسة الصف، وستتضمن `questions` قيمة `correctIndex`. بعدها يستطيع المستخدم إرسال الإجابات الصحيحة إلى `/api/quizzes/submit` والحصول على نتيجة مثالية، فتُحتسب في `quiz_attempts` ويُعاد تحديث leaderboard.

هذه ليست IDOR بين مستخدمين؛ إنها **تسريب لمعلومة سرية إلى صاحب الصف نفسه** بسبب تخزين public questions وanswer key في نفس العمود مع سياسة SELECT واسعة.

### الإصلاح الذي تم تطبيقه

تم فصل العرض عن مفتاح الإجابة في migration `0014_security_hardening.sql`؛ أصبحت الأسئلة العامة في `public_questions`، وأصبح مفتاح الإجابة الخادمي في `answer_key`، وأزيل العمود القديم `questions`:

```sql
-- Migration جديدة، بعد أخذ نسخة احتياطية.
alter table public.quiz_sessions
  drop column if exists questions;

alter table public.quiz_sessions
  add column public_questions jsonb not null,
  add column answer_key jsonb not null;

revoke all on table public.quiz_sessions from anon, authenticated;
-- لا تمنح client roles أي SELECT؛ endpoints الخادمية تستخدم service_role.
```

ثم عدّل generation route ليكتب `public_questions` و`answer_key` منفصلين، ويعيد `public_questions` فقط. وعدّل submit route ليقرأ `answer_key` عبر service-role. إن كان تغيير schema الكبير غير مرغوب، فالحد الأدنى العاجل هو حذف سياسة `own quiz sessions read` ومنع أي client SELECT، مع إبقاء قراءة الجلسة server-side فقط. توصي Supabase بإدارة **grants والسياسات معاً**، لأن إضافة policy لا تلغي grants الموجودة تلقائياً [1].

## 2. `refresh_all_leaderboards()` مكشوفة كـ SECURITY DEFINER — High

### الدليل وسيناريو الاستغلال

في `supabase/migrations/0002_leaderboard_cron.sql:7-37` توجد دالة:

```sql
create or replace function refresh_all_leaderboards()
returns void
language plpgsql
security definer
set search_path = public
```

الدالة تحذف snapshots للفترة الحالية في السطر 13، ثم تعيد حساب كل المستخدمين في السطر 16. لا توجد أوامر `revoke execute` أو `grant execute ... to service_role` لهذه الدالة، بخلاف دوال أخرى في المشروع. PostgreSQL يمنح `EXECUTE` افتراضياً لـ`PUBLIC` عند إنشاء function ما لم يُسحب صراحة [2]. لذلك، إذا كانت قاعدة الإنتاج تستخدم grants الافتراضية لـ Supabase، يمكن استدعاؤها عبر `/rest/v1/rpc/refresh_all_leaderboards` من anonymous/authenticated role، وتشغيل عملية global مكلفة بشكل متكرر.

### الإصلاح الدقيق

أُضيفت migration مستقلة `0014_security_hardening.sql` تتضمن:

```sql
begin;

revoke all on function public.refresh_all_leaderboards() from public, anon, authenticated;
grant execute on function public.refresh_all_leaderboards() to service_role;

alter function public.refresh_all_leaderboards()
  set search_path = public, pg_temp;

commit;
```

والأفضل إعادة تعريف الدالة مع qualification صريح مثل `public.leaderboard_snapshots` و`public.study_sessions` و`public.quiz_attempts`. توصي PostgreSQL بإبعاد schemas القابلة للكتابة من `search_path` في `SECURITY DEFINER` functions، وبسحب صلاحية التنفيذ العامة عند الحاجة [2]. يجب بعد تطبيق migration اختبار anonymous وauthenticated وservice role منفصلين.

## 3. تسريب بيانات leaderboard عبر القراءة العامة — Medium-High

### الدليل وسيناريو الاستغلال

في `supabase/migrations/0001_rag_and_rls.sql:192-196` توجد policy:

```sql
create policy "leaderboard is public"
on leaderboard_snapshots
for select using (true);
```

لكن `drizzle/schema.ts:200-216` يثبت أن الجدول يحتوي على `user_id`, `region`, `subject`, `score`, و`period_key`. الدالة العامة `get_public_leaderboard()` تعيد projection أكثر تحفظاً، لكنها لا تمنع القراءة المباشرة للجدول عبر Data API. يستطيع أي زائر قراءة UUIDs للمستخدمين ومناطقهم وموادهم ودرجاتهم، حتى لو كان المقصود عرض pseudonym اختياري فقط.

### الإصلاح الدقيق

احذف القراءة المباشرة، واجعل العرض العام يمر عبر RPC المصفّاة:

```sql
begin;
revoke all on table public.leaderboard_snapshots from anon, authenticated;
-- يظل service_role قادراً على القراءة والكتابة للتحديثات الخادمية.
commit;
```

ثم استخدم `get_public_leaderboard()` من endpoint عام يحدّد `period_key` المسموح به ولا يعيد `user_id` أو `region` أو `subject` إلا إذا كانت مطلوبة فعلاً. لا تعتمد على view غير مؤمّنة؛ views قد تتجاوز RLS افتراضياً، ويجب ضبطها بـ`security_invoker = true` أو حجبها عن client roles [1].

## 4. تزوير سجل التدقيق — Medium-High

### الدليل وسيناريو الاستغلال

تمنح `supabase/migrations/0007_compliance_quizzes_whiteboard.sql:18-36` كل مستخدم authenticated صلاحية تنفيذ:

```sql
grant execute on function public.write_audit_log(varchar,varchar,varchar,jsonb)
to authenticated;
```

الدالة تتحقق فقط من أن `auth.uid()` غير null في السطر 30، ثم تقبل `p_event_type` و`p_target_type` و`p_target_id` و`p_metadata` من caller. يستطيع أي مستخدم إنشاء أحداث تبدو كأنها عمليات مهمة تخص أهدافاً اعتباطية. صحيح أن `actor_user_id` يبقى هو المستخدم الحالي، لكن integrity الدلالية للسجل تصبح غير موثوقة.

### الإصلاح الدقيق

إذا لم تكن هناك حاجة لكتابة audit من العميل، اسحب execute من authenticated:

```sql
revoke all on function public.write_audit_log(varchar,varchar,varchar,jsonb)
  from public, anon, authenticated;
grant execute on function public.write_audit_log(varchar,varchar,varchar,jsonb)
  to service_role;
```

ثم استدعها من server routes فقط. وإن كانت هناك حاجة لبعض أحداث المستخدم، لا تسمح بـevent type حر؛ استخدم functions ضيقة مثل `record_user_preference_changed()` مع allow-list وقيود على target identifiers.

## 5. membership/role oracle عبر دوال RLS المساعدة — Medium

### الدليل وسيناريو الاستغلال

في `supabase/migrations/0001_rag_and_rls.sql:102-136` وفي النسخة المعاد تعريفها في `0006_security_hardening.sql:10-44` تقبل الدالتان:

```sql
is_room_member(p_room_id int, p_user_id uuid default auth.uid())
is_room_moderator(p_room_id int, p_user_id uuid default auth.uid())
```

وتمنحان `EXECUTE` إلى `authenticated`. هذا يسمح لمستخدم مسجل بإرسال `p_user_id` يخص مستخدماً آخر، ومعرفة هل ذلك الشخص عضو أو moderator في غرفة معروفة. لا يعيد الاستعلام بيانات الصف، لكنه يخلق oracle عن العلاقات الخاصة.

### الإصلاح الدقيق

أعد تعريف الدالتين دون user id قابل للتحكم:

```sql
create or replace function public.is_room_member(p_room_id int)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.room_members rm
    where rm.room_id = p_room_id
      and rm.user_id = auth.uid()
  );
$$;

create or replace function public.is_room_moderator(p_room_id int)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.room_members rm
    where rm.room_id = p_room_id
      and rm.user_id = auth.uid()
      and rm.role in ('host', 'moderator')
  );
$$;
```

بعدها حدّث كل policies/RPCs لتستعمل signature ذات argument واحد، واسحب صلاحية الدالتين القديمتين ذات `uuid` بعد التحقق من عدم وجود calls لها. هذا يطابق نمط Supabase الذي يوصي بأن تستخدم دالة `SECURITY DEFINER` هوية caller الحالية، لا قيمة authorization يرسلها العميل [1].

## 6. rate limiting قابل للتجاوز ومسارات غرف بلا حد تطبيقي — Medium

### الدليل وسيناريو الاستغلال

`lib/rate-limit.ts:12-48` يخزن buckets في `Map` داخل process واحد. في serverless أو مع أكثر من instance، يبدأ كل instance بعداد مستقل، ويُعاد العداد بعد restart. كما يعتمد `getClientIp()` في السطر 18 على أول قيمة من `x-forwarded-for`؛ يجب أن تكون هذه القيمة مكتوبة من proxy موثوق فقط.

الأهم أن تدفق الغرف لا يمر بهذه الطبقة أصلاً: `app/rooms/page.tsx:14` يستدعي `create_study_room` مباشرة، و`app/rooms/[id]/RoomClient.tsx:32,78-100` يستدعي `join_study_room` و`set_room_timer` ويدخل `room_messages` مباشرة من browser client. سياسات RLS تمنع بعض التجاوزات، لكنها لا تمنع مستخدماً مصادقاً من إنشاء غرف متكررة أو الانضمام/إرسال رسائل بسرعة كبيرة.

### الإصلاح الدقيق

انقل rate limits إلى مخزن مشترك مثل Redis/Upstash أو خدمة Supabase موثوقة، واجعل المفتاح مبنياً على `user.id` مع IP موثوق من طبقة edge. أضف قيوداً على مستوى database/RPC:

```sql
-- مثال مبدئي؛ يفضّل enforcement عبر خدمة rate limit مشتركة أيضاً.
create index if not exists room_messages_user_created_idx
  on public.room_messages(user_id, created_at desc);
```

ثم أضف quotas داخل RPC أو route serverية لـ`create_study_room` و`join_study_room` و`room_messages`، مع `body` بطول محدد في database، مثلاً `length(body) between 1 and 1000`. لا تعتبر `maxLength` في React حماية؛ يمكن تجاوزها باستدعاء Data API مباشرة.

## 7. استنزاف موارد AI وYouTube/PDF — Medium

### الدليل وسيناريو الاستغلال

في `app/api/study/upload/route.ts:45-55` تُقرأ كامل bytes الملف وتُستخرج النصوص ثم تُرسل embeddings وsummary. الحد 20 MB لا يحدد عدد الأحرف أو عدد chunks. `lib/rag.ts:159-170` يرسل embedding لكل chunk بلا سقف chunks صريح. في YouTube، `lib/youtube-transcript.ts:26-30,53-61` يستخدم `fetch` بلا timeout أو حد لحجم الاستجابة، ثم يحوّل transcript كاملاً إلى نص. مسارات Gemini في `lib/rag.ts:246-260` و`lib/gemini-stream.ts:40-51` لا تفرض timeout أيضاً.

المهاجم المصادق يستطيع تكرار هذه العمليات حتى حد rate limit المحلي، وقد يستنزف Gemini quota وذاكرة/وقت worker. الالتفاف أسهل في بيئة متعددة instances أو عبر حسابات متعددة.

### الإصلاح الدقيق

استخدم `AbortSignal.timeout()` أو `AbortController` بمهلة ثابتة لكل upstream، وطبّق streaming byte cap قبل `response.text()`. ارفض المستندات التي تتجاوز حد نصي واضح، وحدد `MAX_CHUNKS`، واجعل ingestion job غير متزامن في queue مع quota يومية لكل مستخدم. يجب أن تكون الحدود موجودة server-side وdatabase-side، لا في الواجهة فقط.

## 8. Gemini API key في query string — Medium-Low

### الدليل

يُرسل المفتاح في:

- `app/api/quizzes/generate/route.ts:43`
- `app/api/study/quiz/route.ts:67-69`
- `lib/rag.ts:43` و`lib/rag.ts:248`
- `lib/gemini-stream.ts:41`

استخدام query parameter يجعل المفتاح جزءاً من URL الذي قد تسجله proxies أو أدوات tracing. توثق Google حالياً إرسال المفتاح في header `x-goog-api-key` [3].

### الإصلاح الدقيق

غيّر كل طلب إلى:

```ts
fetch("https://generativelanguage.googleapis.com/v1beta/models/...:generateContent", {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-goog-api-key": apiKey,
  },
  // body unchanged
});
```

بعد التغيير، دوّر المفتاح إذا كان قد استُخدم في بيئة تسجل URLs، وقيّده من Google AI Studio/Cloud حسب البيئة.

## 9. تسريب رسالة الخطأ من SSE — Low-Medium

في `lib/gemini-stream.ts:101-105` يُرسل `error.message` مباشرة في SSE:

```ts
controller.enqueue(sse({
  type: "error",
  error: error instanceof Error ? error.message : "تعذر بث الإجابة."
}));
```

قد تكون الرسالة من runtime أو upstream أو transport layer. الإصلاح الدقيق هو تسجيل التفاصيل server-side مع request ID، وإرسال رسالة ثابتة:

```ts
console.error("Gemini stream failed", { requestId, error });
controller.enqueue(sse({ type: "error", error: "تعذر بث الإجابة." }));
```

ينبغي تطبيق المبدأ نفسه على أي مسار يعيد `parsed.error.flatten()` إذا كانت تفاصيل schema لا ينبغي أن تصل إلى مستخدم نهائي.

## 10. existence oracle للغرف الخاصة — Low

في `app/rooms/[id]/page.tsx:14-30` تستخدم الصفحة `createServiceClient()` لتحديد وجود `study_rooms` قبل إثبات authentication أو membership، ثم تميز بين `notFound()` وrendering. يستطيع زائر غير مصادق إجراء probing لأرقام الغرف ومعرفة أيها موجود من status/HTML timing، حتى لو لم يحصل على محتوى الغرفة.

تم حذف service-role existence gate من `app/rooms/[id]/page.tsx`، وأصبحت الصفحة تعرض shell موحداً بينما تفرض RPCs المصادقة وaccess code وmembership.

## ملاحظات أمنية إيجابية

مسارات API الأساسية تستخدم authentication وrate limit وsame-origin checks، و`app/api/rooms/token/route.ts:27-39` يعيد فحص membership قبل إصدار LiveKit token. كما أن upload يفحص MIME وmagic bytes والحجم، وملفات الامتحانات تستخدم signed URLs قصيرة بعد شرط `is_published`. دوال retrieval الخاصة بالمستندات محجوبة عن authenticated وممنوحة لـservice role فقط في `0009` و`0010`.

لم يظهر SQL string concatenation أو shell execution أو `dangerouslySetInnerHTML` في المسح الحالي. استعلامات Supabase تستخدم query builder/RPC parameters، لذلك لا يوجد SQL injection مؤكد من الكود المفحوص. كما أن مفاتيح `NEXT_PUBLIC_SUPABASE_*` وPostHog/Sentry العامة ليست secrets بحد ذاتها؛ الخطر سيكون في `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, LiveKit secrets, Resend key و`DATABASE_URL` إذا خرجت إلى client bundle أو Git، ولم أجد قيمها الفعلية committed.

## حالة الإصلاح والتنفيذ

تم تطبيق الإصلاحات البرمجية التالية: فصل answer key، تقييد grants وRLS، تقوية membership functions، إضافة PostgreSQL-backed rate limiting لمسارات API وRPCs والرسائل، إضافة JSON/text/response caps، timeouts، maxDuration، header-based Gemini authentication، رسائل streaming ثابتة، ومواءمة RoomClient مع column-level grants.

لم تُطبّق migration `0014_security_hardening.sql` على قاعدة Supabase فعلية لأن حساب Supabase السابق محذوف حالياً. يجب تطبيقها على الحساب الجديد ثم تشغيل اختبارات RLS/pgTAP؛ فسياسات RLS قد تفشل بصمت من ناحية النتائج، وتوصي Supabase بكتابة اختبارات allow/deny لكل عملية [1].

## المراجع

[1]: https://supabase.com/docs/guides/database/postgres/row-level-security "Supabase — Row Level Security"

[2]: https://www.postgresql.org/docs/current/sql-createfunction.html "PostgreSQL — CREATE FUNCTION and SECURITY DEFINER safety"

[3]: https://ai.google.dev/api "Google AI for Developers — Gemini API reference and authentication"
