# 02 — وثيقة التصميم التقني (Technical Design Document)

**المنصة:** Yardi Voyager (7S/8) على SQL Server 2016+ · **طبقة العرض:** SSRS (Reporting Services)
**النمط المعماري:** طبقة عزل عن سكيما Yardi + نواة بيانات موحّدة + تقارير رفيعة

---

## 1. المعمارية العامة

```
┌──────────────────────────────────────────────────────────────────────┐
│  طبقة العرض (Presentation)                                            │
│  Voyager Custom Reports Menu ─► SSRS RDL                             │
│  EMPRCV_R1.rdl   EMPRCV_R2.rdl   EMPRCV_R3.rdl   EMPRCV_R3L.rdl      │
│  (تصدير: XLSX / PDF / CSV — من محرّك SSRS مباشرة)                     │
└───────────────▲──────────────────────────────────────────────────────┘
                │ Stored Procedures (عقد ثابت: مدخلات/مخرجات)
┌───────────────┴──────────────────────────────────────────────────────┐
│  طبقة التقارير (Report Layer) — schema: emprcv                       │
│  usp_R1_Summary · usp_R2_Statement · usp_R3_Confirmation             │
│  usp_R3L_ControlLog · usp_Recon_TrialBalance                         │
└───────────────▲──────────────────────────────────────────────────────┘
                │
┌───────────────┴──────────────────────────────────────────────────────┐
│  نواة البيانات (Data Core)                                            │
│  vw_EmployeeLedger  ← الحقيقة الواحدة لكل الحركات المنسوبة لموظف       │
│  vw_Employee · vw_AccountScope · vw_Segment · fn_UserEntityScope      │
│  tbl_BalanceSnapshot (لقطات نهاية السنة) · tbl_LedgerCache (اختياري)  │
└───────────────▲──────────────────────────────────────────────────────┘
                │
┌───────────────┴──────────────────────────────────────────────────────┐
│  طبقة العزل (Anti-Corruption Layer) — الملف الوحيد الذي يلمس Yardi    │
│  vw_Src_GLTrans · vw_Src_Header · vw_Src_Account · vw_Src_Entity      │
│  vw_Src_Vendor · vw_Src_Book · vw_Src_UserSecurity                   │
└───────────────▲──────────────────────────────────────────────────────┘
                │  (قراءة فقط — لا تعديل على أي كائن قياسي)
┌───────────────┴──────────────────────────────────────────────────────┐
│  Yardi Voyager Database (standard objects)                            │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│  طبقة الإعداد (Configuration)                                         │
│  EMPRCV_SchemaMap · EMPRCV_AccountScope · EMPRCV_EmployeeSource       │
│  EMPRCV_Category · EMPRCV_SegmentDef · EMPRCV_AgingBucket             │
│  EMPRCV_DeclarationText · EMPRCV_DrillUrl · EMPRCV_ManualMap          │
└──────────────────────────────────────────────────────────────────────┘
```

**لماذا هذا التقسيم؟**

| القرار | السبب |
| ------ | ----- |
| طبقة عزل مستقلة | فرق السكيما بين إصدارات Voyager يُعالَج في ملف واحد بدل 5 تقارير |
| نواة بيانات واحدة | ضمان أن R1 و R2 و R3 تعطي نفس الرصيد دائماً (مصدر حقيقة واحد) |
| إجراءات مخزّنة لا استعلامات داخل RDL | خطة تنفيذ قابلة للضبط، اختبار مستقل عن SSRS، وإعادة استخدام |
| إعداد في جداول لا في كود | إضافة حساب/فئة/شريحة جديدة = إدخال بيانات، لا إعادة نشر |

---

## 2. اصطلاحات التسمية والتوافق مع الترقية

| العنصر | الاصطلاح | مثال |
| ------ | -------- | ---- |
| السكيما | `emprcv` (أو قاعدة تقارير منفصلة `VoyagerCustom`) | `emprcv.usp_R1_Summary` |
| الجداول | `EMPRCV_<Purpose>` | `EMPRCV_AccountScope` |
| المشاهد | `vw_<Purpose>` / `vw_Src_<YardiObject>` | `vw_Src_GLTrans` |
| الإجراءات | `usp_<Report>_<Purpose>` | `usp_R2_Statement` |
| الدوال | `fn_<Purpose>` | `fn_UserEntityScope` |
| ملفات RDL | `EMPRCV_R<n>_<Name>.rdl` | `EMPRCV_R1_Summary.rdl` |

**قواعد صارمة:**

1. لا `CREATE`/`ALTER`/`DROP` على أي كائن Yardi قياسي — ولا حتى إضافة فهرس.
2. لا `SELECT` مباشر على جداول Yardi من خارج `vw_Src_*`.
3. كل كائن مخصّص يحمل ترويسة تعليق: الغرض، المؤلف، التاريخ، رقم طلب التغيير.
4. جميع النصوص قابلة للتنفيذ المتكرر (idempotent) عبر `IF NOT EXISTS ... CREATE`.

---

## 3. طبقة العزل (Source Views)

كل مشهد مصدر يُخرج **أسماء أعمدة منطقية ثابتة** بغض النظر عن أسماء Yardi الفعلية:

| المشهد | يخرج الأعمدة المنطقية | يعتمد على |
| ------ | --------------------- | --------- |
| `vw_Src_GLTrans` | `TransId, EntityId, AccountId, HeaderId, PostDate, Amount, Memo, BookId, PostedBy, PostedOn` | جدول حركات الأستاذ |
| `vw_Src_Header` | `HeaderId, DocType, DocNumber, DocDate, PostDate, Status, VendorId, Reference, CreatedBy` | جدول رؤوس المستندات |
| `vw_Src_Account` | `AccountId, AccountCode, AccountName, AccountType, IsActive` | دليل الحسابات |
| `vw_Src_Entity` | `EntityId, EntityCode, EntityName, CompanyId, CompanyName, Currency, FiscalYearEnd` | جدول الكيانات/العقارات |
| `vw_Src_Vendor` | `VendorId, VendorCode, VendorName, IsEmployee, Department, Status, HireDate, TermDate` | جدول الموردين |
| `vw_Src_Book` | `BookId, BookCode, BookName` | جدول الدفاتر |
| `vw_Src_UserSecurity` | `UserId, EntityId` | جداول أمان Voyager |

> **بوابة إلزامية:** أسماء الأعمدة الفعلية تُملأ من نتيجة قائمة التحقق في
> [`README.md §4`](README.md) وتُسجَّل في `EMPRCV_SchemaMap` قبل نشر هذه المشاهد.
> نصوص `sql/10_source_views.sql` مكتوبة بأسماء متوقعة ومعلّمة بـ `-- VERIFY:` عند كل عمود
> يحتمل الاختلاف. لا يُعتمد أي مشهد قبل تنفيذ اختبار العدّ والمجموع مقابل تقرير Voyager قياسي.

**اختبار قبول طبقة العزل:** لكل كيان وتاريخ، `SUM(Amount)` من `vw_Src_GLTrans` لحساب معيّن
يساوي رصيد نفس الحساب في تقرير ميزان المراجعة القياسي في Voyager. بدون هذا الاختبار الحل
كله غير موثوق.

---

## 4. نواة البيانات

### 4.1 `vw_Employee` — البُعد الموحّد للموظف

يوحّد المصادر الأربعة (`VENDOR` / `SEGMENT` / `SUBACCT` / `REF`) في مفتاح واحد:

```
EmployeeKey (sk) · EmployeeCode · EmployeeNameAr · EmployeeNameEn
Department · CostCenter · JobTitle · Status · HireDate · TermDate
SourceType · SourceId · EntityId
```

- المصادر المفعّلة تُقرأ من `EMPRCV_EmployeeSource` (عمود `IsEnabled` + `Priority`).
- عند تطابق أكثر من مصدر، تُطبَّق الأولوية الأدنى رقماً.
- `EMPRCV_ManualMap` يتيح تصحيح حالات فردية دون تعديل كود.
- الموظف غير المعروف يُنسب إلى `EmployeeKey = -1` (`#UNMAPPED`).

### 4.2 `vw_AccountScope` — نطاق حسابات المديونية

يُبنى من `EMPRCV_AccountScope` الذي يدعم ثلاثة أنماط تعريف:

| النمط | الوصف |
| ----- | ----- |
| `LIST` | قائمة حسابات صريحة |
| `RANGE` | مدى من/إلى لرقم الحساب |
| `TREE` | عقدة في شجرة الحسابات (كل الأبناء) |

كل سطر يحمل: الكيان (أو `*` للكل)، الفئة (`Category`)، الاتجاه المتوقع (مدين)، تاريخ
السريان من/إلى — ما يسمح بتغيّر دليل الحسابات عبر الزمن دون كسر التقارير التاريخية.

### 4.3 `vw_Segment` — السيجمنتيشن

يدعم حتى 5 شرائح، ويعمل بأحد وضعين حسب `EMPRCV_SegmentDef.SourceMode`:

| الوضع | الآلية |
| ----- | ------ |
| `POSITION` | تفكيك رقم الحساب بالموضع والطول (`SUBSTRING`) وفق تعريف كل شريحة |
| `DELIMITER` | تفكيك رقم الحساب بفاصل (`-`) ثم أخذ الترتيب |
| `TABLE` | ربط بجدول شرائح مستقل في Voyager (إن كان مفعّلاً لدى العميل) |

المخرجات: `Seg1Code..Seg5Code` + `Seg1Name..Seg5Name` + `Seg1Label..Seg5Label`
(التسميات تظهر كعناوين أعمدة ديناميكية في التقارير — لا أسماء شرائح مضمّنة في الكود).

### 4.4 `vw_EmployeeLedger` — مصدر الحقيقة الواحد

```sql
-- منطقياً:
vw_Src_GLTrans  g
  JOIN vw_Src_Header  h  ON h.HeaderId = g.HeaderId
  JOIN vw_Src_Account a  ON a.AccountId = g.AccountId
  JOIN vw_AccountScope s ON  s.AccountId = g.AccountId
                         AND (s.EntityId = g.EntityId OR s.EntityId IS NULL)
                         AND g.PostDate BETWEEN s.EffFrom AND s.EffTo
  LEFT JOIN vw_Employee e ON <resolution by SourceType>
  LEFT JOIN vw_Segment  sg ON sg.AccountId = g.AccountId
WHERE g.BookId = <reporting book>      -- دفتر الاستحقاق
  AND h.Status = 'Posted'
```

الأعمدة المخرجة (العقد الثابت لكل التقارير):

```
EntityId, EntityCode, EntityName, Currency,
EmployeeKey, EmployeeCode, EmployeeName, Department, EmpStatus,
AccountId, AccountCode, AccountName, Category,
Seg1..Seg5 (Code/Name),
HeaderId, DocType, DocNumber, DocDate, PostDate, Period,
Description, Amount (موجب = مدين), DebitAmt, CreditAmt,
PostedBy, PostedOn, RowSeq
```

`RowSeq` = ترتيب حتمي `(PostDate, HeaderId, TransId)` — هو ما يضمن ثبات الرصيد المتحرك
في R2 عند كل إعادة تشغيل (قاعدة BR9).

---

## 5. عقود الإجراءات المخزّنة

### 5.1 `usp_R1_Summary`

| المُعامل | النوع | ملاحظات |
| -------- | ----- | ------- |
| `@EntityIds` | `varchar(max)` (CSV) | يُفكَّك بـ `STRING_SPLIT` ثم يُقاطع مع نطاق صلاحية المستخدم |
| `@AsOfDate` | `date` | |
| `@Seg1..@Seg5` | `varchar(max)` | CSV، فارغ = الكل |
| `@Categories` | `varchar(max)` | |
| `@AccountIds` | `varchar(max)` | |
| `@Departments` | `varchar(max)` | |
| `@EmpStatus` | `varchar(10)` | `ALL/ACTIVE/TERM` |
| `@ShowZero` | `bit` | |
| `@MinBalance` | `decimal(18,2)` | |
| `@AgingBasis` | `varchar(10)` | `FIFO/TRANDATE` |
| `@PresentCurrency` | `varchar(3)` | `NULL` = عملة الكيان |
| `@UserId` | `int` | يُمرَّر من Voyager لتطبيق الأمان — **إلزامي** |

مجموعة نتائج واحدة: صف لكل (كيان، موظف) + صفوف الإجماليات محسوبة في SSRS.
مجموعة نتائج ثانية (اختيارية): سطر المطابقة مع ميزان المراجعة.

### 5.2 `usp_R2_Statement`

مدخلات: `@EntityIds, @EmployeeKeys, @FromDate, @ToDate, @Categories, @DocTypes, @ShowContra, @UserId`
مخرجات: (1) الرصيد الافتتاحي لكل موظف/كيان، (2) الحركات مع `RunningBalance`،
(3) ملخص الأعمار والفئات، (4) مؤشر المطابقة مع R1.

### 5.3 `usp_R3_Confirmation`

مدخلات: `@EntityIds, @FYEndDate, @EmployeeKeys, @MinBalance, @IncludeActivity, @Language, @Approvals, @Mode, @UserId`
مخرجات: صف لكل موظف يحوي كل بيانات النموذج + نص الإقرار من `EMPRCV_DeclarationText`
+ رقم المرجع. في وضع `FINAL` يكتب سطراً في `EMPRCV_ConfirmationLog` ويعيد الرقم التسلسلي.

> ملاحظة تقنية: الكتابة داخل إجراء يستدعيه SSRS مقبولة هنا لأنها سجل تدقيق فقط (Append-only)،
> وتُنفَّذ في معاملة قصيرة، ولا تمسّ أي بيانات Yardi. إن منعت سياسة العميل ذلك، يُنقل التسجيل
> إلى إجراء منفصل يُستدعى من زر "اعتماد الإصدار".

### 5.4 `usp_R3L_ControlLog` و `usp_Recon_TrialBalance`

الأول تقرير متابعة المصادقات، والثاني ضابط المطابقة القابل للتشغيل المستقل والمجدول.

---

## 6. تصميم تقارير SSRS

### 6.1 مبادئ عامة

| البند | القرار |
| ----- | ------ |
| مصدر البيانات | Shared Data Source واحد بصلاحية قراءة محدودة (راجع `05-...`) |
| مجموعات البيانات | Dataset لكل مجموعة نتائج + Datasets صغيرة للفلاتر المتتالية (Cascading) |
| الاتجاه | `Direction = RTL` للنسخة العربية، تقريران منفصلان أو `Language` parameter |
| الخطوط | خط يدعم العربية ومضمّن في PDF (مثل Arial/Tahoma) لتفادي مربعات الحروف |
| الترويسة/التذييل | متكرران في كل صفحة + "صفحة X من Y" + سطر الفلاتر المستخدمة |
| التنسيق الشرطي | تمييز الأرصدة السالبة، المتأخرة > 180 يوم، ومنتهي الخدمة برصيد |

### 6.2 الفلاتر المتتالية (Cascading Parameters)

```
@UserId (مخفي، من Voyager)
   └─► @EntityIds        (Dataset: الكيانات المصرّح بها فقط)
          └─► @AccountIds / @Categories / @Departments
                 └─► @Seg1..@Seg5  (تسميات وقيم ديناميكية من EMPRCV_SegmentDef)
```

الشرائح غير المفعّلة تُخفى تلقائياً (`Hidden = IIF(SegCount < n, True, False)`) — لا حاجة
لتعديل التقرير عند تغيّر عدد الشرائح.

### 6.3 الدرل داون والدرل ثرو

| من | إلى | الآلية | المعاملات الممرَّرة |
| -- | --- | ------ | ------------------- |
| R1 (خلية الرصيد) | R2 | `Action = Go to report` | `EntityId, EmployeeKey, FromDate=بداية السنة, ToDate=@AsOfDate` |
| R1 (خلية عمر) | R2 مفلتر | `Go to report` | إضافة `BucketFrom/BucketTo` |
| R2 (رقم المستند) | شاشة المستند في Voyager | `Action = Go to URL` | قالب URL من `EMPRCV_DrillUrl` حسب `DocType` |
| R2 (سطر) | تفاصيل سطور المستند | `Toggle` (Row Visibility) | داخل نفس التقرير — بلا رحلة إضافية للخادم |
| R1 | R3 لموظف واحد | `Go to report` | `EntityId, EmployeeKey, FYEndDate` |

> **قوالب روابط Voyager:** لا تُكتب مضمّنة في الـ RDL. تُخزَّن في `EMPRCV_DrillUrl`
> (`DocType, UrlTemplate, IsEnabled`) وتُملأ أثناء النشر من عناوين بيئة العميل الفعلية،
> لأن مسار الشاشة يختلف باختلاف الإصدار والاستضافة. إن تعذّر الرابط المباشر، يُستبدل
> بمعروض تفاصيل داخلي (Drill-down داخل نفس التقرير) دون فقد الوظيفة.

### 6.4 اعتبارات التصدير

| المشكلة الشائعة | المعالجة في التصميم |
| --------------- | ------------------- |
| أعمدة مبعثرة في Excel | محاذاة كل العناصر على شبكة واحدة؛ عدم استخدام Rectangles متداخلة |
| ترويسة متكررة داخل ورقة Excel | `RepeatOnNewPage` للترويسة فقط في PDF (`Hidden` عند `RenderFormat.Name = "EXCELOPENXML"`) |
| أرقام كنص | تنسيق رقمي على مستوى الخلية لا كنص منسّق مسبقاً |
| فواصل صفحات في Excel | تعطيل `PageBreak` عند التصدير إلى Excel |
| R3 صفحة لكل موظف | `PageBreak = Between` على مجموعة الموظف + `KeepTogether` |
| العربية في PDF | خط مضمّن + اختبار PDF على خادم SSRS نفسه (الخطوط تُقرأ من الخادم لا من جهاز المستخدم) |
| ملفات ضخمة | حد أقصى للصفوف + رسالة "ضيّق الفلاتر" بدل مهلة انتهاء |

### 6.5 التسجيل في قائمة Voyager

كل تقرير يُسجَّل كعنصر قائمة مخصّص (Custom Report) ضمن `Financials ► Reports ► Employee Receivables`
مع تمرير `@UserId` تلقائياً من جلسة Voyager، وربطه بمجموعة صلاحيات مخصّصة (راجع `05-...` §2).

---

## 7. جداول الإعداد والسجلات

| الجدول | الغرض | مفاتيح رئيسية |
| ------ | ----- | ------------- |
| `EMPRCV_SchemaMap` | خريطة الأسماء المنطقية ↔ أسماء Yardi الفعلية | `LogicalObject, LogicalColumn` |
| `EMPRCV_AccountScope` | نطاق حسابات المديونية + الفئة + السريان | `ScopeId` |
| `EMPRCV_Category` | فئات المديونية وترتيب العرض والتسمية ثنائية اللغة | `CategoryCode` |
| `EMPRCV_EmployeeSource` | المصادر المفعّلة وأولوياتها وقواعد الاستخراج | `SourceType` |
| `EMPRCV_ManualMap` | تصحيحات يدوية لنسبة حركات محددة لموظف | `HeaderId, TransId` |
| `EMPRCV_SegmentDef` | تعريف الشرائح: العدد، الوضع، الموضع/الطول، التسميات | `SegNo` |
| `EMPRCV_AgingBucket` | حدود شرائح الأعمار (قابلة للتغيير دون كود) | `BucketNo` |
| `EMPRCV_DeclarationText` | نصوص الإقرار المعتمدة (لغة/إصدار/تاريخ اعتماد) | `LangCode, Version` |
| `EMPRCV_DrillUrl` | قوالب روابط شاشات Voyager حسب نوع المستند | `DocType` |
| `EMPRCV_BalanceSnapshot` | لقطات الأرصدة المجمّدة لنهاية السنة | `SnapshotId, EmployeeKey` |
| `EMPRCV_ConfirmationLog` | سجل إصدار واستلام نماذج الاعتماد | `ConfirmationId` |
| `EMPRCV_RunLog` | سجل تشغيل التقارير (من/متى/بأي فلاتر) | `RunId` |

التفاصيل الكاملة للأعمدة في [`sql/00_config_tables.sql`](sql/00_config_tables.sql).

---

## 8. معالجة الأخطاء والحالات الحدّية

| الحالة | السلوك المصمَّم |
| ------ | -------------- |
| لا صفوف للفلاتر المختارة | رسالة واضحة داخل التقرير + إظهار الفلاتر المستخدمة |
| حركات غير منسوبة لموظف | صف `#UNMAPPED` + تحذير في الترويسة + رابط لتقرير الاستثناءات |
| نطاق حسابات فارغ في الإعداد | إيقاف التنفيذ برسالة "لم يُعرَّف نطاق حسابات لهذا الكيان" |
| مستخدم بلا صلاحية على أي كيان | نتيجة فارغة + رسالة صلاحيات (لا تسريب لوجود بيانات) |
| اختلاف العملات داخل التجميع | منع الجمع وإظهار مجاميع منفصلة لكل عملة |
| تاريخ رصيد داخل فترة مقفلة/غير مقفلة | ملاحظة في الترويسة عند وجود فترة غير مقفلة |
| تجاوز حد الصفوف | إنهاء مهذب مع طلب تضييق الفلاتر |
| لقطة نهاية سنة غير موجودة عند طلب R3 | رسالة "يجب تجميد اللقطة أولاً" + عدم السماح بوضع `FINAL` |

---

## 9. التتبّع من المتطلب إلى التنفيذ (Traceability)

| متطلب (FDD) | الكائن المنفِّذ |
| ----------- | -------------- |
| R1 الحقول C1–C22 | `usp_R1_Summary` + `EMPRCV_R1_Summary.rdl` |
| R1 الفلاتر P1–P12 | معاملات `usp_R1_Summary` + Cascading datasets |
| R2 الرصيد المتحرك C13 | `vw_EmployeeLedger.RowSeq` + `SUM() OVER (...)` |
| R2 الدرل داون C6 | `EMPRCV_DrillUrl` + `Go to URL` action |
| R3 نص الإقرار | `EMPRCV_DeclarationText` |
| R3 الاعتمادات الاختيارية | معامل `@Approvals` + إظهار شرطي لخانات التوقيع |
| AC1 المطابقة | `usp_Recon_TrialBalance` + سطر تذييل R1 |
| AC4 اللقطة المجمّدة | `EMPRCV_BalanceSnapshot` + `usp_Snapshot_Freeze` |
| AC5 أثر التشغيل | `EMPRCV_RunLog` |
| NF5 التوافق مع الترقية | سكيما `emprcv` + منع تعديل كائنات Yardi |
