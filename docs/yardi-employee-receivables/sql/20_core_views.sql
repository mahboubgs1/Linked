/* =====================================================================
   EMPRCV — File: 20_core_views.sql
   Purpose: Data core. Single source of truth shared by R1, R2 and R3.
            Reads ONLY from emprcv.vw_Src_* (never from Yardi directly).
   ===================================================================== */

/* ---------------------------------------------------------------------
   Segments — derive up to 6 segment codes from the account code.
   Driven entirely by EMPRCV_SegmentDef (POSITION / DELIMITER modes here;
   TABLE mode is wired at deployment when the client uses segment tables).
   --------------------------------------------------------------------- */
CREATE OR ALTER VIEW emprcv.vw_Segment
AS
WITH src AS (
    SELECT a.AccountId, a.AccountCode
    FROM emprcv.vw_Src_Account AS a
),
parsed AS (
    SELECT
          s.AccountId
        , d.SegNo
        , CASE d.SourceMode
             WHEN 'POSITION'  THEN LTRIM(RTRIM(SUBSTRING(s.AccountCode, d.StartPos, d.SegLength)))
             WHEN 'DELIMITER' THEN LTRIM(RTRIM(
                    (SELECT value FROM STRING_SPLIT(s.AccountCode, '-')  -- delimiter fixed at deploy
                      ORDER BY (SELECT NULL) OFFSET d.OrdinalPos - 1 ROWS FETCH NEXT 1 ROWS ONLY)))
             ELSE NULL
          END AS SegCode
    FROM src AS s
    CROSS JOIN emprcv.EMPRCV_SegmentDef AS d
    WHERE d.IsEnabled = 1
)
SELECT
      AccountId
    , MAX(CASE WHEN SegNo = 1 THEN SegCode END) AS Seg1Code
    , MAX(CASE WHEN SegNo = 2 THEN SegCode END) AS Seg2Code
    , MAX(CASE WHEN SegNo = 3 THEN SegCode END) AS Seg3Code
    , MAX(CASE WHEN SegNo = 4 THEN SegCode END) AS Seg4Code
    , MAX(CASE WHEN SegNo = 5 THEN SegCode END) AS Seg5Code
    , MAX(CASE WHEN SegNo = 6 THEN SegCode END) AS Seg6Code
FROM parsed
GROUP BY AccountId;
GO

/* ---------------------------------------------------------------------
   Account scope — expand LIST / RANGE / TREE definitions into accounts.
   Overlap precedence: LIST > RANGE > TREE, specific entity > NULL entity.
   --------------------------------------------------------------------- */
CREATE OR ALTER VIEW emprcv.vw_AccountScope
AS
WITH expanded AS (
    /* LIST */
    SELECT sc.ScopeId, sc.EntityId, a.AccountId, sc.CategoryCode,
           sc.EffFrom, sc.EffTo, 1 AS Precedence
    FROM emprcv.EMPRCV_AccountScope AS sc
    JOIN emprcv.vw_Src_Account      AS a ON a.AccountId = sc.AccountId
    WHERE sc.IsEnabled = 1 AND sc.ScopeType = 'LIST'

    UNION ALL
    /* RANGE */
    SELECT sc.ScopeId, sc.EntityId, a.AccountId, sc.CategoryCode,
           sc.EffFrom, sc.EffTo, 2
    FROM emprcv.EMPRCV_AccountScope AS sc
    JOIN emprcv.vw_Src_Account      AS a
      ON a.AccountCode >= sc.AccountCodeFrom
     AND a.AccountCode <= sc.AccountCodeTo
    WHERE sc.IsEnabled = 1 AND sc.ScopeType = 'RANGE'

    /* TREE: wired at deployment against the client's account-tree object.
       UNION ALL SELECT ... Precedence = 3                                */
),
ranked AS (
    SELECT *,
           ROW_NUMBER() OVER (
               PARTITION BY AccountId, ISNULL(EntityId, -1)
               ORDER BY Precedence,
                        CASE WHEN EntityId IS NULL THEN 1 ELSE 0 END,
                        ScopeId
           ) AS rn
    FROM expanded
)
SELECT ScopeId, EntityId, AccountId, CategoryCode, EffFrom, EffTo
FROM ranked
WHERE rn = 1;
GO

/* ---------------------------------------------------------------------
   Employee dimension — unions the enabled sources by priority.
   EmployeeKey = -1 is reserved for #UNMAPPED.
   --------------------------------------------------------------------- */
CREATE OR ALTER VIEW emprcv.vw_Employee
AS
SELECT
      CAST(-1 AS int)          AS EmployeeKey
    , '#UNMAPPED'              AS EmployeeCode
    , N'غير منسوب'             AS EmployeeNameAr
    , 'Unmapped'               AS EmployeeNameEn
    , CAST(NULL AS varchar(50)) AS Department
    , CAST(NULL AS varchar(50)) AS JobTitle
    , 'UNKNOWN'                AS EmpStatus
    , CAST(NULL AS date)       AS HireDate
    , CAST(NULL AS date)       AS TermDate
    , 'NONE'                   AS SourceType
    , CAST(NULL AS int)        AS SourceId

UNION ALL
/* VENDOR source */
SELECT
      v.VendorId                                        AS EmployeeKey
    , v.VendorCode                                      AS EmployeeCode
    , v.VendorName                                      AS EmployeeNameAr
    , v.VendorName                                      AS EmployeeNameEn
    , v.Department
    , CAST(NULL AS varchar(50))                         AS JobTitle
    , CASE WHEN v.TermDate IS NOT NULL THEN 'TERM' ELSE 'ACTIVE' END AS EmpStatus
    , v.HireDate
    , v.TermDate
    , 'VENDOR'                                          AS SourceType
    , v.VendorId                                        AS SourceId
FROM emprcv.vw_Src_Vendor AS v
WHERE v.IsEmployee = 1
  AND EXISTS (SELECT 1 FROM emprcv.EMPRCV_EmployeeSource
              WHERE SourceType = 'VENDOR' AND IsEnabled = 1);

/* SEGMENT / SUBACCT / REF sources are added here at deployment time,
   each guarded by its IsEnabled flag, keeping EmployeeKey unique across
   sources (offset ranges or a surrogate-key table).                     */
GO

/* ---------------------------------------------------------------------
   vw_EmployeeLedger — THE single source of truth.
   Contract consumed by R1 / R2 / R3. Do not change column names without
   updating the traceability matrix in 02-technical-design.md §9.
   --------------------------------------------------------------------- */
CREATE OR ALTER VIEW emprcv.vw_EmployeeLedger
AS
SELECT
      g.EntityId
    , en.EntityCode
    , en.EntityName
    , en.Currency
    , COALESCE(mm_emp.EmployeeKey, ve.EmployeeKey, -1) AS EmployeeKey
    , g.AccountId
    , ac.AccountCode
    , ac.AccountName
    , sc.CategoryCode
    , sg.Seg1Code, sg.Seg2Code, sg.Seg3Code, sg.Seg4Code, sg.Seg5Code, sg.Seg6Code
    , g.HeaderId
    , h.DocTypeRaw
    , h.DocNumber
    , h.DocDate
    , g.PostDate
    , YEAR(g.PostDate)  AS PeriodYear
    , MONTH(g.PostDate) AS PeriodMonth
    , g.Memo            AS Description
    , g.Amount                                             -- debit positive
    , CASE WHEN g.Amount > 0 THEN  g.Amount ELSE 0 END AS DebitAmt
    , CASE WHEN g.Amount < 0 THEN -g.Amount ELSE 0 END AS CreditAmt
    , g.PostedBy
    , g.PostedOn
    , ROW_NUMBER() OVER (
          PARTITION BY g.EntityId, COALESCE(mm_emp.EmployeeKey, ve.EmployeeKey, -1)
          ORDER BY g.PostDate, g.HeaderId, g.TransId      -- deterministic (BR9)
      ) AS RowSeq
FROM       emprcv.vw_Src_GLTrans  AS g
JOIN       emprcv.vw_Src_Header   AS h  ON h.HeaderId = g.HeaderId
JOIN       emprcv.vw_Src_Account  AS ac ON ac.AccountId = g.AccountId
JOIN       emprcv.vw_Src_Entity   AS en ON en.EntityId = g.EntityId
JOIN       emprcv.vw_AccountScope AS sc
        ON sc.AccountId = g.AccountId
       AND (sc.EntityId = g.EntityId OR sc.EntityId IS NULL)
       AND g.PostDate BETWEEN sc.EffFrom AND sc.EffTo
LEFT JOIN  emprcv.vw_Segment      AS sg ON sg.AccountId = g.AccountId
/* Employee resolution, in priority order */
LEFT JOIN (
        SELECT m.HeaderId, m.TransId, e.EmployeeKey
        FROM emprcv.EMPRCV_ManualMap AS m
        JOIN emprcv.vw_Employee      AS e ON e.EmployeeCode = m.EmployeeCode
     ) AS mm_emp ON mm_emp.HeaderId = g.HeaderId AND mm_emp.TransId = g.TransId
LEFT JOIN  emprcv.vw_Employee     AS ve
        ON ve.SourceType = 'VENDOR' AND ve.SourceId = h.VendorId
WHERE h.StatusRaw = 'Posted'                 -- VERIFY: posted-status value
  AND g.BookId IN (SELECT BookId FROM emprcv.vw_Src_Book
                   WHERE BookCode = 'ACCRUAL');   -- VERIFY: accrual book code
GO
