/* =====================================================================
   EMPRCV — File: 60_usp_recon_checks.sql
   Purpose: Audit controls RC1..RC6 + configuration validation.
            Run on demand and on a nightly schedule; alert on any failure.
   ===================================================================== */

/* ---------------------------------------------------------------------
   RC1 — Employee balances must equal the GL balance of the scope accounts
   RC5 — No unmapped transactions
   --------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE emprcv.usp_Recon_TrialBalance
      @AsOfDate  date
    , @EntityIds varchar(max) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    ;WITH scope_gl AS (
        SELECT g.EntityId, SUM(g.Amount) AS GLTotal
        FROM emprcv.vw_Src_GLTrans  AS g
        JOIN emprcv.vw_Src_Header   AS h  ON h.HeaderId = g.HeaderId
        JOIN emprcv.vw_AccountScope AS sc ON sc.AccountId = g.AccountId
                                         AND (sc.EntityId = g.EntityId OR sc.EntityId IS NULL)
                                         AND g.PostDate BETWEEN sc.EffFrom AND sc.EffTo
        WHERE g.PostDate <= @AsOfDate
          AND h.StatusRaw = 'Posted'          -- VERIFY: posted-status value
          AND (@EntityIds IS NULL
               OR g.EntityId IN (SELECT TRY_CAST(value AS int) FROM STRING_SPLIT(@EntityIds, ',')))
        GROUP BY g.EntityId
    ),
    emp_total AS (
        SELECT l.EntityId
             , SUM(l.Amount) AS EmpTotal
             , SUM(CASE WHEN l.EmployeeKey = -1 THEN l.Amount ELSE 0 END) AS UnmappedAmount
             , SUM(CASE WHEN l.EmployeeKey = -1 THEN 1 ELSE 0 END)        AS UnmappedCount
        FROM emprcv.vw_EmployeeLedger AS l
        WHERE l.PostDate <= @AsOfDate
          AND (@EntityIds IS NULL
               OR l.EntityId IN (SELECT TRY_CAST(value AS int) FROM STRING_SPLIT(@EntityIds, ',')))
        GROUP BY l.EntityId
    )
    SELECT
          en.EntityCode
        , en.EntityName
        , @AsOfDate                                   AS AsOfDate
        , ISNULL(g.GLTotal, 0)                        AS GLTotal
        , ISNULL(t.EmpTotal, 0)                       AS EmployeeTotal
        , ISNULL(t.EmpTotal, 0) - ISNULL(g.GLTotal, 0) AS Variance          -- RC1: must be 0
        , ISNULL(t.UnmappedCount, 0)                  AS UnmappedCount      -- RC5: must be 0
        , ISNULL(t.UnmappedAmount, 0)                 AS UnmappedAmount
        , CASE WHEN ISNULL(t.EmpTotal,0) = ISNULL(g.GLTotal,0)
                AND ISNULL(t.UnmappedCount,0) = 0
               THEN 'PASS' ELSE 'FAIL' END            AS ControlResult
    FROM      scope_gl        AS g
    FULL JOIN emp_total       AS t  ON t.EntityId = g.EntityId
    JOIN      emprcv.vw_Src_Entity AS en ON en.EntityId = ISNULL(g.EntityId, t.EntityId)
    ORDER BY en.EntityCode;
END
GO

/* ---------------------------------------------------------------------
   RC2 — Aging buckets must sum to the balance (per employee)
   --------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE emprcv.usp_Recon_Aging
      @AsOfDate  date
    , @EntityIds varchar(max) = NULL
    , @UserId    int
AS
BEGIN
    SET NOCOUNT ON;

    CREATE TABLE #R1 (
          EntityId int, EntityCode varchar(50), EntityName nvarchar(200), Currency char(3)
        , EmployeeKey int, EmployeeCode varchar(50)
        , EmployeeNameAr nvarchar(200), EmployeeNameEn nvarchar(200)
        , Department varchar(50), EmpStatus varchar(10)
        , HireDate date, TermDate date
        , OpeningBalance decimal(19,4), PeriodDebit decimal(19,4), PeriodCredit decimal(19,4)
        , Balance decimal(19,4)
        , Bucket1 decimal(19,4), Bucket2 decimal(19,4), Bucket3 decimal(19,4)
        , Bucket4 decimal(19,4), Bucket5 decimal(19,4), UnappliedCredit decimal(19,4)
        , OldestOpenDate date, OpenItemCount int, LastPostDate date
        , ConfirmationStatus varchar(20)
    );

    INSERT INTO #R1
    EXEC emprcv.usp_R1_Summary
          @EntityIds = @EntityIds
        , @AsOfDate  = @AsOfDate
        , @ShowZero  = 1
        , @UserId    = @UserId;

    SELECT EntityCode, EmployeeCode, Balance,
           Bucket1 + Bucket2 + Bucket3 + Bucket4 + Bucket5 AS BucketTotal,
           Balance - (Bucket1 + Bucket2 + Bucket3 + Bucket4 + Bucket5) AS Variance,
           CASE WHEN Balance < 0 THEN 'CREDIT-BALANCE'
                WHEN ABS(Balance - (Bucket1+Bucket2+Bucket3+Bucket4+Bucket5)) < 0.005 THEN 'PASS'
                ELSE 'FAIL' END AS ControlResult
    FROM #R1
    ORDER BY CASE WHEN ABS(Balance - (Bucket1+Bucket2+Bucket3+Bucket4+Bucket5)) < 0.005 THEN 1 ELSE 0 END,
             EntityCode, EmployeeCode;
END
GO

/* ---------------------------------------------------------------------
   RC6 — Snapshot integrity: were backdated entries posted after freezing?
   --------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE emprcv.usp_Recon_SnapshotIntegrity
      @SnapshotId int
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @AsOfDate date =
        (SELECT TOP (1) AsOfDate FROM emprcv.EMPRCV_BalanceSnapshot WHERE SnapshotId = @SnapshotId);

    ;WITH live AS (
        SELECT l.EntityId, l.EmployeeKey
             , SUM(l.Amount) AS LiveBalance
             , SUM(CAST(CHECKSUM(l.HeaderId, l.RowSeq, l.Amount) AS bigint)) AS LiveChecksum
        FROM emprcv.vw_EmployeeLedger AS l
        WHERE l.PostDate <= @AsOfDate
        GROUP BY l.EntityId, l.EmployeeKey
    )
    SELECT
          en.EntityCode
        , ISNULL(emp.EmployeeCode, '#UNMAPPED') AS EmployeeCode
        , s.ClosingBalance          AS FrozenBalance
        , ISNULL(v.LiveBalance, 0)  AS LiveBalance
        , ISNULL(v.LiveBalance, 0) - s.ClosingBalance AS Variance
        , CASE WHEN ISNULL(v.LiveChecksum, 0) = s.SourceChecksum THEN 'PASS' ELSE 'CHANGED' END AS ControlResult
        , s.FrozenOn, s.FrozenBy
    FROM emprcv.EMPRCV_BalanceSnapshot AS s
    LEFT JOIN live                 AS v   ON v.EntityId = s.EntityId AND v.EmployeeKey = s.EmployeeKey
    JOIN      emprcv.vw_Src_Entity AS en  ON en.EntityId = s.EntityId
    LEFT JOIN emprcv.vw_Employee   AS emp ON emp.EmployeeKey = s.EmployeeKey
    WHERE s.SnapshotId = @SnapshotId
      AND (ISNULL(v.LiveChecksum, 0) <> s.SourceChecksum
           OR ISNULL(v.LiveBalance, 0) <> s.ClosingBalance)
    ORDER BY en.EntityCode, EmployeeCode;
END
GO

/* ---------------------------------------------------------------------
   Configuration validation — run after every config change
   --------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE emprcv.usp_Config_Validate
AS
BEGIN
    SET NOCOUNT ON;

    /* 1. Unverified schema mappings block everything else */
    SELECT 'SCHEMA_MAP_UNVERIFIED' AS CheckCode, 'ERROR' AS Severity,
           CONCAT(LogicalObject, '.', LogicalColumn) AS Detail
    FROM emprcv.EMPRCV_SchemaMap
    WHERE Verified = 0

    UNION ALL
    /* 2. No account scope defined at all */
    SELECT 'NO_ACCOUNT_SCOPE', 'ERROR', 'EMPRCV_AccountScope is empty'
    WHERE NOT EXISTS (SELECT 1 FROM emprcv.EMPRCV_AccountScope WHERE IsEnabled = 1)

    UNION ALL
    /* 3. Scope rows pointing at a category that does not exist */
    SELECT 'SCOPE_BAD_CATEGORY', 'ERROR', CONCAT('ScopeId=', CAST(sc.ScopeId AS varchar(10)))
    FROM emprcv.EMPRCV_AccountScope AS sc
    LEFT JOIN emprcv.EMPRCV_Category AS c ON c.CategoryCode = sc.CategoryCode
    WHERE sc.IsEnabled = 1 AND c.CategoryCode IS NULL

    UNION ALL
    /* 4. Overlapping scope definitions (resolved by precedence, but flag it) */
    SELECT 'SCOPE_OVERLAP', 'WARNING', CONCAT('AccountId=', CAST(x.AccountId AS varchar(10)))
    FROM (
        SELECT AccountId, COUNT(DISTINCT ScopeId) AS n
        FROM emprcv.vw_AccountScope GROUP BY AccountId
    ) AS x WHERE x.n > 1

    UNION ALL
    /* 5. No employee source enabled */
    SELECT 'NO_EMPLOYEE_SOURCE', 'ERROR', 'No enabled row in EMPRCV_EmployeeSource'
    WHERE NOT EXISTS (SELECT 1 FROM emprcv.EMPRCV_EmployeeSource
                      WHERE IsEnabled = 1 AND SourceType <> 'MANUAL')

    UNION ALL
    /* 6. Aging buckets not contiguous starting at day 0 */
    SELECT 'AGING_GAP', 'ERROR', CONCAT('BucketNo=', CAST(b.BucketNo AS varchar(10)))
    FROM emprcv.EMPRCV_AgingBucket AS b
    LEFT JOIN emprcv.EMPRCV_AgingBucket AS p ON p.BucketNo = b.BucketNo - 1
    WHERE (b.BucketNo = 1 AND b.DayFrom <> 0)
       OR (b.BucketNo > 1 AND (p.BucketNo IS NULL OR b.DayFrom <> p.DayTo + 1))

    UNION ALL
    /* 7. No active approved declaration text */
    SELECT 'NO_DECLARATION_TEXT', 'ERROR', 'No active row in EMPRCV_DeclarationText'
    WHERE NOT EXISTS (SELECT 1 FROM emprcv.EMPRCV_DeclarationText WHERE IsActive = 1)

    UNION ALL
    /* 8. Drill-through templates missing for document types in use */
    SELECT 'NO_DRILL_URL', 'WARNING', 'EMPRCV_DrillUrl is empty - drill-through disabled'
    WHERE NOT EXISTS (SELECT 1 FROM emprcv.EMPRCV_DrillUrl WHERE IsEnabled = 1)

    UNION ALL
    /* 9. Security view left as the fail-closed placeholder */
    SELECT 'SECURITY_NOT_IMPLEMENTED', 'ERROR',
           'vw_Src_UserSecurity returns no rows - implement it before go-live'
    WHERE NOT EXISTS (SELECT 1 FROM emprcv.vw_Src_UserSecurity);
END
GO
