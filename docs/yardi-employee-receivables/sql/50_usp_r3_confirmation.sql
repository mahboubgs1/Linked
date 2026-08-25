/* =====================================================================
   EMPRCV — File: 50_usp_r3_confirmation.sql
   Report : EMPRCV-R3   Year-End Balance Confirmation Form
            EMPRCV-R3L  Confirmation Control Log
   Design : R3 always reads a FROZEN snapshot (BR12). Freezing is a
            separate, deliberate finance action — not a side effect of
            running a report.
   ===================================================================== */

/* ---------------------------------------------------------------------
   1. Freeze the year-end snapshot
   --------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE emprcv.usp_Snapshot_Freeze
      @EntityIds varchar(max)
    , @AsOfDate  date
    , @UserId    int
    , @UserName  varchar(100)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @Entities TABLE (EntityId int PRIMARY KEY);
    INSERT INTO @Entities (EntityId)
    SELECT s.EntityId
    FROM emprcv.fn_UserEntityScope(@UserId) AS s
    WHERE s.EntityId IN (SELECT TRY_CAST(value AS int) FROM STRING_SPLIT(@EntityIds, ','));

    IF NOT EXISTS (SELECT 1 FROM @Entities)
    BEGIN
        RAISERROR(N'No entity in scope for this user.', 16, 1);
        RETURN;
    END

    DECLARE @SnapshotId int =
        ISNULL((SELECT MAX(SnapshotId) FROM emprcv.EMPRCV_BalanceSnapshot), 0) + 1;

    DECLARE @YearStart date = DATEFROMPARTS(YEAR(@AsOfDate), 1, 1);

    BEGIN TRAN;

    ;WITH l AS (
        SELECT x.*
        FROM emprcv.vw_EmployeeLedger AS x
        JOIN @Entities AS e ON e.EntityId = x.EntityId
        WHERE x.PostDate <= @AsOfDate
    ),
    bal AS (
        SELECT EntityId, EmployeeKey
             , SUM(CASE WHEN PostDate <  @YearStart THEN Amount ELSE 0 END) AS OpeningBalance
             , SUM(CASE WHEN PostDate >= @YearStart THEN DebitAmt  ELSE 0 END) AS PeriodDebit
             , SUM(CASE WHEN PostDate >= @YearStart THEN CreditAmt ELSE 0 END) AS PeriodCredit
             , SUM(Amount)     AS ClosingBalance
             , SUM(CreditAmt)  AS TotalCredit
             , COUNT(*)        AS SourceRowCount
             , SUM(CAST(CHECKSUM(HeaderId, RowSeq, Amount) AS bigint)) AS SourceChecksum
        FROM l
        GROUP BY EntityId, EmployeeKey
    ),
    fifo AS (   /* same FIFO allocation as R1 — one definition, one result */
        SELECT d.EntityId, d.EmployeeKey
             , DATEDIFF(day, d.PostDate, @AsOfDate) AS AgeDays
             , CASE WHEN d.CumDebit - b.TotalCredit <= 0 THEN 0
                    WHEN d.CumDebit - b.TotalCredit >= d.DebitAmt THEN d.DebitAmt
                    ELSE d.CumDebit - b.TotalCredit END AS UnpaidAmt
        FROM (
            SELECT EntityId, EmployeeKey, PostDate, DebitAmt,
                   SUM(DebitAmt) OVER (PARTITION BY EntityId, EmployeeKey
                                       ORDER BY PostDate, HeaderId, RowSeq
                                       ROWS UNBOUNDED PRECEDING) AS CumDebit
            FROM l WHERE DebitAmt > 0
        ) AS d
        JOIN bal AS b ON b.EntityId = d.EntityId AND b.EmployeeKey = d.EmployeeKey
    )
    INSERT INTO emprcv.EMPRCV_BalanceSnapshot
        (SnapshotId, EntityId, EmployeeKey, AsOfDate, Currency,
         OpeningBalance, PeriodDebit, PeriodCredit, ClosingBalance,
         Bucket1, Bucket2, Bucket3, Bucket4, Bucket5, UnappliedCredit,
         CategoryJson, SourceRowCount, SourceChecksum, FrozenBy)
    SELECT
          @SnapshotId, b.EntityId, b.EmployeeKey, @AsOfDate, en.Currency
        , b.OpeningBalance, b.PeriodDebit, b.PeriodCredit, b.ClosingBalance
        , ISNULL(SUM(CASE WHEN g.BucketNo = 1 THEN f.UnpaidAmt END), 0)
        , ISNULL(SUM(CASE WHEN g.BucketNo = 2 THEN f.UnpaidAmt END), 0)
        , ISNULL(SUM(CASE WHEN g.BucketNo = 3 THEN f.UnpaidAmt END), 0)
        , ISNULL(SUM(CASE WHEN g.BucketNo = 4 THEN f.UnpaidAmt END), 0)
        , ISNULL(SUM(CASE WHEN g.BucketNo = 5 THEN f.UnpaidAmt END), 0)
        , CASE WHEN b.ClosingBalance < 0 THEN -b.ClosingBalance ELSE 0 END
        , (SELECT c.CategoryCode, SUM(c.Amount) AS Balance
           FROM l AS c
           WHERE c.EntityId = b.EntityId AND c.EmployeeKey = b.EmployeeKey
           GROUP BY c.CategoryCode
           FOR JSON PATH)
        , b.SourceRowCount, b.SourceChecksum, @UserName
    FROM bal AS b
    JOIN      emprcv.vw_Src_Entity AS en ON en.EntityId = b.EntityId
    LEFT JOIN fifo AS f ON f.EntityId = b.EntityId AND f.EmployeeKey = b.EmployeeKey
    LEFT JOIN emprcv.EMPRCV_AgingBucket AS g ON f.AgeDays BETWEEN g.DayFrom AND g.DayTo
    GROUP BY b.EntityId, b.EmployeeKey, en.Currency, b.OpeningBalance, b.PeriodDebit,
             b.PeriodCredit, b.ClosingBalance, b.SourceRowCount, b.SourceChecksum;

    COMMIT TRAN;

    SELECT @SnapshotId AS SnapshotId,
           (SELECT COUNT(*) FROM emprcv.EMPRCV_BalanceSnapshot WHERE SnapshotId = @SnapshotId) AS RowsFrozen;
END
GO

/* ---------------------------------------------------------------------
   2. The confirmation form itself
   --------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE emprcv.usp_R3_Confirmation
      @SnapshotId    int
    , @EntityIds     varchar(max) = NULL
    , @EmployeeKeys  varchar(max) = NULL
    , @MinBalance    decimal(19,4) = 0.01
    , @Language      char(2)      = 'AR'      -- AR | EN | BI (bilingual)
    , @Approvals     varchar(200) = NULL      -- CSV: MANAGER,HR,CFO,AUDIT
    , @Mode          varchar(10)  = 'DRAFT'   -- DRAFT | FINAL
    , @UserId        int
    , @UserName      varchar(100)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF NOT EXISTS (SELECT 1 FROM emprcv.EMPRCV_BalanceSnapshot WHERE SnapshotId = @SnapshotId)
    BEGIN
        RAISERROR(N'Snapshot not found. Freeze the year-end snapshot first.', 16, 1);
        RETURN;
    END

    DECLARE @Entities TABLE (EntityId int PRIMARY KEY);
    INSERT INTO @Entities (EntityId)
    SELECT s.EntityId
    FROM emprcv.fn_UserEntityScope(@UserId) AS s
    WHERE @EntityIds IS NULL
       OR s.EntityId IN (SELECT TRY_CAST(value AS int) FROM STRING_SPLIT(@EntityIds, ','));

    /* Active approved declaration text (falls back to AR when BI is asked
       for and only one language is active). */
    DECLARE @DeclLang char(2) = CASE WHEN @Language = 'BI' THEN 'AR' ELSE @Language END;

    DECLARE @DeclVer varchar(10), @DeclBody nvarchar(max), @DeclObj nvarchar(max);
    SELECT TOP (1) @DeclVer = Version, @DeclBody = BodyText, @DeclObj = ObjectionText
    FROM emprcv.EMPRCV_DeclarationText
    WHERE LangCode = @DeclLang AND IsActive = 1
    ORDER BY ApprovedOn DESC;

    IF @DeclBody IS NULL
    BEGIN
        RAISERROR(N'No active approved declaration text for the requested language.', 16, 1);
        RETURN;
    END

    /* ---- FINAL mode: register each form in the audit log (BR14) ------- */
    IF @Mode = 'FINAL'
    BEGIN
        INSERT INTO emprcv.EMPRCV_ConfirmationLog
            (ReferenceNo, SnapshotId, EntityId, EmployeeKey, FiscalYear, SeqNo,
             ConfirmedAmount, DeclarationLang, DeclarationVer, IssueMode, IssuedBy, ReturnStatus)
        SELECT
              CONCAT('EMPRCV-C-', en.EntityCode, '-', YEAR(s.AsOfDate), '-',
                     ISNULL(emp.EmployeeCode, '#UNMAPPED'), '-',
                     FORMAT(1 + ISNULL((SELECT MAX(c.SeqNo) FROM emprcv.EMPRCV_ConfirmationLog AS c
                                        WHERE c.EntityId = s.EntityId
                                          AND c.EmployeeKey = s.EmployeeKey
                                          AND c.FiscalYear = YEAR(s.AsOfDate)), 0), '00'))
            , s.SnapshotId, s.EntityId, s.EmployeeKey, YEAR(s.AsOfDate)
            , 1 + ISNULL((SELECT MAX(c.SeqNo) FROM emprcv.EMPRCV_ConfirmationLog AS c
                          WHERE c.EntityId = s.EntityId AND c.EmployeeKey = s.EmployeeKey
                            AND c.FiscalYear = YEAR(s.AsOfDate)), 0)
            , s.ClosingBalance, @DeclLang, @DeclVer, 'FINAL', @UserName, 'PENDING'
        FROM emprcv.EMPRCV_BalanceSnapshot AS s
        JOIN      @Entities            AS e   ON e.EntityId = s.EntityId
        JOIN      emprcv.vw_Src_Entity AS en  ON en.EntityId = s.EntityId
        LEFT JOIN emprcv.vw_Employee   AS emp ON emp.EmployeeKey = s.EmployeeKey
        WHERE s.SnapshotId = @SnapshotId
          AND s.ClosingBalance >= @MinBalance
          AND (@EmployeeKeys IS NULL
               OR s.EmployeeKey IN (SELECT TRY_CAST(value AS int) FROM STRING_SPLIT(@EmployeeKeys, ',')));
    END

    /* ---- Form data: one row per employee = one printed page ---------- */
    SELECT
          s.EntityId, en.EntityCode, en.EntityName, s.Currency
        , s.EmployeeKey
        , ISNULL(emp.EmployeeCode, '#UNMAPPED') AS EmployeeCode
        , emp.EmployeeNameAr, emp.EmployeeNameEn, emp.Department, emp.JobTitle
        , emp.HireDate, emp.EmpStatus
        , s.AsOfDate
        , s.OpeningBalance, s.PeriodDebit, s.PeriodCredit, s.ClosingBalance
        , s.Bucket1, s.Bucket2, s.Bucket3, s.Bucket4, s.Bucket5
        , s.CategoryJson
        , @DeclBody  AS DeclarationText
        , @DeclObj   AS ObjectionText
        , @DeclVer   AS DeclarationVersion
        , @Language  AS FormLanguage
        , @Mode      AS IssueMode
        , cl.ReferenceNo
        , @UserName  AS IssuedBy
        , SYSUTCDATETIME() AS IssuedOn
        /* optional approval blocks — SSRS shows each only when requested */
        , CASE WHEN @Approvals LIKE '%MANAGER%' THEN 1 ELSE 0 END AS ShowManagerApproval
        , CASE WHEN @Approvals LIKE '%HR%'      THEN 1 ELSE 0 END AS ShowHrApproval
        , CASE WHEN @Approvals LIKE '%CFO%'     THEN 1 ELSE 0 END AS ShowCfoApproval
        , CASE WHEN @Approvals LIKE '%AUDIT%'   THEN 1 ELSE 0 END AS ShowAuditApproval
    FROM emprcv.EMPRCV_BalanceSnapshot AS s
    JOIN      @Entities            AS e   ON e.EntityId = s.EntityId
    JOIN      emprcv.vw_Src_Entity AS en  ON en.EntityId = s.EntityId
    LEFT JOIN emprcv.vw_Employee   AS emp ON emp.EmployeeKey = s.EmployeeKey
    OUTER APPLY (
        SELECT TOP (1) c.ReferenceNo
        FROM emprcv.EMPRCV_ConfirmationLog AS c
        WHERE c.SnapshotId = s.SnapshotId AND c.EntityId = s.EntityId
          AND c.EmployeeKey = s.EmployeeKey
        ORDER BY c.IssuedOn DESC
    ) AS cl
    WHERE s.SnapshotId = @SnapshotId
      AND s.ClosingBalance >= @MinBalance
      AND (@EmployeeKeys IS NULL
           OR s.EmployeeKey IN (SELECT TRY_CAST(value AS int) FROM STRING_SPLIT(@EmployeeKeys, ',')))
    ORDER BY en.EntityCode, EmployeeCode;
END
GO

/* ---------------------------------------------------------------------
   3. Control log (EMPRCV-R3L) — the auditor's completeness evidence
   --------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE emprcv.usp_R3L_ControlLog
      @EntityIds  varchar(max) = NULL
    , @FiscalYear smallint
    , @Status     varchar(20)  = NULL   -- SIGNED | DISPUTED | PENDING
    , @UserId     int
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
          c.ReferenceNo
        , en.EntityCode, en.EntityName
        , ISNULL(emp.EmployeeCode, '#UNMAPPED') AS EmployeeCode
        , emp.EmployeeNameAr, emp.Department
        , c.ConfirmedAmount
        , c.IssuedOn, c.IssuedBy
        , ISNULL(c.ReturnStatus, 'PENDING') AS ReturnStatus
        , c.ReturnedOn
        , c.DisputedAmount
        , c.ConfirmedAmount - ISNULL(c.DisputedAmount, c.ConfirmedAmount) AS DisputeVariance
        , c.DisputeReason
        , DATEDIFF(day, c.IssuedOn, SYSUTCDATETIME()) AS DaysOutstanding
    FROM emprcv.EMPRCV_ConfirmationLog AS c
    JOIN      emprcv.fn_UserEntityScope(@UserId) AS sec ON sec.EntityId = c.EntityId
    JOIN      emprcv.vw_Src_Entity AS en  ON en.EntityId = c.EntityId
    LEFT JOIN emprcv.vw_Employee   AS emp ON emp.EmployeeKey = c.EmployeeKey
    WHERE c.FiscalYear = @FiscalYear
      AND c.IssueMode = 'FINAL'
      AND (@EntityIds IS NULL
           OR c.EntityId IN (SELECT TRY_CAST(value AS int) FROM STRING_SPLIT(@EntityIds, ',')))
      AND (@Status IS NULL OR ISNULL(c.ReturnStatus, 'PENDING') = @Status)
    ORDER BY en.EntityCode, EmployeeCode, c.SeqNo;

    /* Summary line for the auditor: response rate by amount and by count */
    SELECT
          COUNT(*)                                                          AS TotalIssued
        , SUM(CASE WHEN c.ReturnStatus = 'SIGNED'   THEN 1 ELSE 0 END)       AS SignedCount
        , SUM(CASE WHEN c.ReturnStatus = 'DISPUTED' THEN 1 ELSE 0 END)       AS DisputedCount
        , SUM(CASE WHEN ISNULL(c.ReturnStatus,'PENDING') = 'PENDING' THEN 1 ELSE 0 END) AS PendingCount
        , SUM(c.ConfirmedAmount)                                            AS TotalAmount
        , SUM(CASE WHEN c.ReturnStatus = 'SIGNED' THEN c.ConfirmedAmount ELSE 0 END) AS SignedAmount
    FROM emprcv.EMPRCV_ConfirmationLog AS c
    JOIN emprcv.fn_UserEntityScope(@UserId) AS sec ON sec.EntityId = c.EntityId
    WHERE c.FiscalYear = @FiscalYear AND c.IssueMode = 'FINAL'
      AND (@EntityIds IS NULL
           OR c.EntityId IN (SELECT TRY_CAST(value AS int) FROM STRING_SPLIT(@EntityIds, ',')));
END
GO
