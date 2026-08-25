/* =====================================================================
   EMPRCV — File: 30_usp_r1_summary.sql
   Report : EMPRCV-R1  Employee Receivables Summary
   Notes  : @UserId is passed from the Voyager session as a hidden,
            non-editable parameter. Entity access is ALWAYS intersected
            with emprcv.fn_UserEntityScope — never bypassed.
   ===================================================================== */

CREATE OR ALTER PROCEDURE emprcv.usp_R1_Summary
      @EntityIds       varchar(max)  = NULL      -- CSV; NULL = all allowed
    , @AsOfDate        date
    , @Seg1            varchar(max)  = NULL
    , @Seg2            varchar(max)  = NULL
    , @Seg3            varchar(max)  = NULL
    , @Seg4            varchar(max)  = NULL
    , @Seg5            varchar(max)  = NULL
    , @Categories      varchar(max)  = NULL
    , @AccountIds      varchar(max)  = NULL
    , @Departments     varchar(max)  = NULL
    , @EmpStatus       varchar(10)   = 'ALL'     -- ALL | ACTIVE | TERM
    , @ShowZero        bit           = 0
    , @MinBalance      decimal(19,4) = 0
    , @AgingBasis      varchar(10)   = 'FIFO'    -- FIFO | TRANDATE
    , @UserId          int
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @t0 datetime2(3) = SYSUTCDATETIME();

    /* ---- 1. Security: resolve the effective entity list -------------- */
    DECLARE @Entities TABLE (EntityId int PRIMARY KEY);

    INSERT INTO @Entities (EntityId)
    SELECT s.EntityId
    FROM emprcv.fn_UserEntityScope(@UserId) AS s
    WHERE @EntityIds IS NULL
       OR s.EntityId IN (SELECT TRY_CAST(value AS int) FROM STRING_SPLIT(@EntityIds, ','));

    IF NOT EXISTS (SELECT 1 FROM @Entities)
    BEGIN
        /* Fail closed: empty result, no hint about data that exists */
        SELECT TOP (0) CAST(NULL AS int) AS EntityId;
        RETURN;
    END

    /* ---- 2. Multi-select filters into indexed temp tables (P6) ------- */
    CREATE TABLE #Cat  (CategoryCode varchar(20) PRIMARY KEY);
    CREATE TABLE #Acct (AccountId int PRIMARY KEY);
    CREATE TABLE #Dept (Department varchar(50) PRIMARY KEY);

    IF @Categories  IS NOT NULL INSERT INTO #Cat  SELECT DISTINCT LTRIM(RTRIM(value)) FROM STRING_SPLIT(@Categories, ',');
    IF @AccountIds  IS NOT NULL INSERT INTO #Acct SELECT DISTINCT TRY_CAST(value AS int) FROM STRING_SPLIT(@AccountIds, ',') WHERE TRY_CAST(value AS int) IS NOT NULL;
    IF @Departments IS NOT NULL INSERT INTO #Dept SELECT DISTINCT LTRIM(RTRIM(value)) FROM STRING_SPLIT(@Departments, ',');

    /* ---- 3. Ledger slice up to @AsOfDate ----------------------------- */
    CREATE TABLE #L (
          EntityId    int
        , EmployeeKey int
        , PostDate    date
        , DebitAmt    decimal(19,4)
        , CreditAmt   decimal(19,4)
        , Amount      decimal(19,4)
        , CategoryCode varchar(20)
        , HeaderId    int
        , RowSeq      int
    );

    INSERT INTO #L (EntityId, EmployeeKey, PostDate, DebitAmt, CreditAmt, Amount, CategoryCode, HeaderId, RowSeq)
    SELECT l.EntityId, l.EmployeeKey, l.PostDate, l.DebitAmt, l.CreditAmt, l.Amount,
           l.CategoryCode, l.HeaderId, l.RowSeq
    FROM emprcv.vw_EmployeeLedger AS l
    JOIN @Entities AS e ON e.EntityId = l.EntityId
    LEFT JOIN emprcv.vw_Employee AS emp ON emp.EmployeeKey = l.EmployeeKey
    WHERE l.PostDate <= @AsOfDate                                   -- SARGable (P8)
      AND (@Categories  IS NULL OR l.CategoryCode IN (SELECT CategoryCode FROM #Cat))
      AND (@AccountIds  IS NULL OR l.AccountId    IN (SELECT AccountId    FROM #Acct))
      AND (@Departments IS NULL OR emp.Department IN (SELECT Department   FROM #Dept))
      AND (@Seg1 IS NULL OR l.Seg1Code IN (SELECT LTRIM(RTRIM(value)) FROM STRING_SPLIT(@Seg1, ',')))
      AND (@Seg2 IS NULL OR l.Seg2Code IN (SELECT LTRIM(RTRIM(value)) FROM STRING_SPLIT(@Seg2, ',')))
      AND (@Seg3 IS NULL OR l.Seg3Code IN (SELECT LTRIM(RTRIM(value)) FROM STRING_SPLIT(@Seg3, ',')))
      AND (@Seg4 IS NULL OR l.Seg4Code IN (SELECT LTRIM(RTRIM(value)) FROM STRING_SPLIT(@Seg4, ',')))
      AND (@Seg5 IS NULL OR l.Seg5Code IN (SELECT LTRIM(RTRIM(value)) FROM STRING_SPLIT(@Seg5, ',')))
      AND (@EmpStatus = 'ALL'
           OR (@EmpStatus = 'ACTIVE' AND ISNULL(emp.EmpStatus,'UNKNOWN') = 'ACTIVE')
           OR (@EmpStatus = 'TERM'   AND ISNULL(emp.EmpStatus,'UNKNOWN') = 'TERM'));

    CREATE CLUSTERED INDEX IX_L ON #L (EntityId, EmployeeKey, PostDate, HeaderId, RowSeq);

    /* ---- 4. Balances ------------------------------------------------- */
    DECLARE @YearStart date = DATEFROMPARTS(YEAR(@AsOfDate), 1, 1);

    CREATE TABLE #Bal (
          EntityId       int
        , EmployeeKey    int
        , OpeningBalance decimal(19,4)
        , PeriodDebit    decimal(19,4)
        , PeriodCredit   decimal(19,4)
        , Balance        decimal(19,4)
        , TotalDebit     decimal(19,4)
        , TotalCredit    decimal(19,4)
        , LastPostDate   date
        , PRIMARY KEY (EntityId, EmployeeKey)
    );

    INSERT INTO #Bal
    SELECT
          EntityId
        , EmployeeKey
        , SUM(CASE WHEN PostDate <  @YearStart THEN Amount ELSE 0 END)
        , SUM(CASE WHEN PostDate >= @YearStart THEN DebitAmt  ELSE 0 END)
        , SUM(CASE WHEN PostDate >= @YearStart THEN CreditAmt ELSE 0 END)
        , SUM(Amount)
        , SUM(DebitAmt)
        , SUM(CreditAmt)
        , MAX(PostDate)
    FROM #L
    GROUP BY EntityId, EmployeeKey;

    /* ---- 5. Aging ---------------------------------------------------- */
    /* FIFO: oldest debits are settled first by the total credits.
       Unpaid_i = MIN(Debit_i, MAX(0, CumDebit_i - TotalCredit))
       Guarantees SUM(buckets) = Balance whenever Balance > 0 (AT3).      */
    CREATE TABLE #Aged (
          EntityId    int
        , EmployeeKey int
        , AgeDays     int
        , UnpaidAmt   decimal(19,4)
    );

    IF @AgingBasis = 'FIFO'
    BEGIN
        WITH d AS (
            SELECT l.EntityId, l.EmployeeKey, l.PostDate, l.DebitAmt,
                   SUM(l.DebitAmt) OVER (PARTITION BY l.EntityId, l.EmployeeKey
                                         ORDER BY l.PostDate, l.HeaderId, l.RowSeq
                                         ROWS UNBOUNDED PRECEDING) AS CumDebit
            FROM #L AS l
            WHERE l.DebitAmt > 0
        )
        INSERT INTO #Aged (EntityId, EmployeeKey, AgeDays, UnpaidAmt)
        SELECT d.EntityId, d.EmployeeKey,
               DATEDIFF(day, d.PostDate, @AsOfDate),
               CASE WHEN d.CumDebit - b.TotalCredit <= 0 THEN 0
                    WHEN d.CumDebit - b.TotalCredit >= d.DebitAmt THEN d.DebitAmt
                    ELSE d.CumDebit - b.TotalCredit END
        FROM d
        JOIN #Bal AS b ON b.EntityId = d.EntityId AND b.EmployeeKey = d.EmployeeKey;
    END
    ELSE   /* TRANDATE: every movement aged on its own post date */
    BEGIN
        INSERT INTO #Aged (EntityId, EmployeeKey, AgeDays, UnpaidAmt)
        SELECT EntityId, EmployeeKey, DATEDIFF(day, PostDate, @AsOfDate), Amount
        FROM #L;
    END

    /* ---- 6. Result set 1: one row per (entity, employee) -------------- */
    SELECT
          b.EntityId
        , en.EntityCode
        , en.EntityName
        , en.Currency
        , b.EmployeeKey
        , ISNULL(emp.EmployeeCode, '#UNMAPPED')   AS EmployeeCode
        , ISNULL(emp.EmployeeNameAr, N'غير منسوب') AS EmployeeNameAr
        , ISNULL(emp.EmployeeNameEn, 'Unmapped')  AS EmployeeNameEn
        , emp.Department
        , ISNULL(emp.EmpStatus, 'UNKNOWN')        AS EmpStatus
        , emp.HireDate
        , emp.TermDate
        , b.OpeningBalance
        , b.PeriodDebit
        , b.PeriodCredit
        , b.Balance
        , SUM(CASE WHEN g.BucketNo = 1 THEN a.UnpaidAmt ELSE 0 END) AS Bucket1
        , SUM(CASE WHEN g.BucketNo = 2 THEN a.UnpaidAmt ELSE 0 END) AS Bucket2
        , SUM(CASE WHEN g.BucketNo = 3 THEN a.UnpaidAmt ELSE 0 END) AS Bucket3
        , SUM(CASE WHEN g.BucketNo = 4 THEN a.UnpaidAmt ELSE 0 END) AS Bucket4
        , SUM(CASE WHEN g.BucketNo = 5 THEN a.UnpaidAmt ELSE 0 END) AS Bucket5
        , CASE WHEN b.Balance < 0 THEN -b.Balance ELSE 0 END        AS UnappliedCredit
        , MIN(CASE WHEN a.UnpaidAmt > 0
                   THEN DATEADD(day, -a.AgeDays, @AsOfDate) END)    AS OldestOpenDate
        , SUM(CASE WHEN a.UnpaidAmt > 0 THEN 1 ELSE 0 END)          AS OpenItemCount
        , b.LastPostDate
        , cl.ReturnStatus                                            AS ConfirmationStatus
    FROM #Bal AS b
    JOIN      emprcv.vw_Src_Entity AS en  ON en.EntityId = b.EntityId
    LEFT JOIN emprcv.vw_Employee   AS emp ON emp.EmployeeKey = b.EmployeeKey
    LEFT JOIN #Aged AS a ON a.EntityId = b.EntityId AND a.EmployeeKey = b.EmployeeKey
    LEFT JOIN emprcv.EMPRCV_AgingBucket AS g ON a.AgeDays BETWEEN g.DayFrom AND g.DayTo
    OUTER APPLY (
        SELECT TOP (1) c.ReturnStatus
        FROM emprcv.EMPRCV_ConfirmationLog AS c
        WHERE c.EntityId = b.EntityId AND c.EmployeeKey = b.EmployeeKey
          AND c.FiscalYear = YEAR(@AsOfDate) AND c.IssueMode = 'FINAL'
        ORDER BY c.IssuedOn DESC
    ) AS cl
    WHERE (@ShowZero = 1 OR b.Balance <> 0)
      AND (b.Balance >= @MinBalance OR b.Balance < 0)   -- credits always shown
    GROUP BY b.EntityId, en.EntityCode, en.EntityName, en.Currency, b.EmployeeKey,
             emp.EmployeeCode, emp.EmployeeNameAr, emp.EmployeeNameEn, emp.Department,
             emp.EmpStatus, emp.HireDate, emp.TermDate, b.OpeningBalance, b.PeriodDebit,
             b.PeriodCredit, b.Balance, b.LastPostDate, cl.ReturnStatus
    ORDER BY en.EntityCode, EmployeeCode
    OPTION (RECOMPILE);   -- P7: highly variable parameters

    /* ---- 7. Result set 2: trial-balance reconciliation (AC1/RC1) ------
       Compares the report total against the raw GL balance of the scope
       accounts, read straight from the source layer. This is the control
       that proves no transaction was lost by the employee resolution or
       by any join in the core view. Variance must be 0.00.             */
    SELECT
          (SELECT ISNULL(SUM(l.Amount), 0) FROM #L AS l)  AS ReportTotal
        , gl.ScopeGLTotal
        , (SELECT ISNULL(SUM(l.Amount), 0) FROM #L AS l) - gl.ScopeGLTotal AS Variance
    FROM (
        SELECT ISNULL(SUM(g.Amount), 0) AS ScopeGLTotal
        FROM emprcv.vw_Src_GLTrans  AS g
        JOIN @Entities              AS e  ON e.EntityId = g.EntityId
        JOIN emprcv.vw_AccountScope AS sc ON sc.AccountId = g.AccountId
                                         AND (sc.EntityId = g.EntityId OR sc.EntityId IS NULL)
                                         AND g.PostDate BETWEEN sc.EffFrom AND sc.EffTo
        JOIN emprcv.vw_Src_Header   AS h  ON h.HeaderId = g.HeaderId
        WHERE g.PostDate <= @AsOfDate
          AND h.StatusRaw = 'Posted'                    -- VERIFY: posted value
          AND (@Categories IS NULL OR sc.CategoryCode IN (SELECT CategoryCode FROM #Cat))
          AND (@AccountIds IS NULL OR g.AccountId     IN (SELECT AccountId    FROM #Acct))
    ) AS gl;

    /* ---- 8. Run log (AC5) -------------------------------------------- */
    INSERT INTO emprcv.EMPRCV_RunLog (ReportCode, UserId, ParamsJson, RowCountOut, DurationMs)
    SELECT 'EMPRCV-R1', @UserId,
           (SELECT @EntityIds AS EntityIds, @AsOfDate AS AsOfDate, @AgingBasis AS AgingBasis
            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
           (SELECT COUNT(*) FROM #Bal),
           DATEDIFF(millisecond, @t0, SYSUTCDATETIME());
END
GO
