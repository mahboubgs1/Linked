/* =====================================================================
   EMPRCV — File: 40_usp_r2_statement.sql
   Report : EMPRCV-R2  Employee Detailed Statement of Account
   Output : 1) opening balances  2) transactions with running balance
            3) aging + category summary  4) reconciliation vs R1
   ===================================================================== */

CREATE OR ALTER PROCEDURE emprcv.usp_R2_Statement
      @EntityIds     varchar(max) = NULL
    , @EmployeeKeys  varchar(max)                -- CSV, required
    , @FromDate      date
    , @ToDate        date
    , @Categories    varchar(max) = NULL
    , @DocTypes      varchar(max) = NULL
    , @UserId        int
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @t0 datetime2(3) = SYSUTCDATETIME();

    IF @ToDate < @FromDate
    BEGIN
        RAISERROR(N'ToDate must be on or after FromDate.', 16, 1);
        RETURN;
    END

    /* ---- Security scope --------------------------------------------- */
    DECLARE @Entities TABLE (EntityId int PRIMARY KEY);
    INSERT INTO @Entities (EntityId)
    SELECT s.EntityId
    FROM emprcv.fn_UserEntityScope(@UserId) AS s
    WHERE @EntityIds IS NULL
       OR s.EntityId IN (SELECT TRY_CAST(value AS int) FROM STRING_SPLIT(@EntityIds, ','));

    DECLARE @Emps TABLE (EmployeeKey int PRIMARY KEY);
    INSERT INTO @Emps (EmployeeKey)
    SELECT DISTINCT TRY_CAST(value AS int)
    FROM STRING_SPLIT(@EmployeeKeys, ',')
    WHERE TRY_CAST(value AS int) IS NOT NULL;

    IF NOT EXISTS (SELECT 1 FROM @Entities) OR NOT EXISTS (SELECT 1 FROM @Emps)
    BEGIN
        SELECT TOP (0) CAST(NULL AS int) AS EntityId;
        RETURN;
    END

    /* ---- 1. Opening balance (everything strictly before @FromDate) ---- */
    SELECT
          l.EntityId
        , l.EmployeeKey
        , SUM(l.Amount) AS OpeningBalance
    INTO #Open
    FROM emprcv.vw_EmployeeLedger AS l
    JOIN @Entities AS e ON e.EntityId = l.EntityId
    JOIN @Emps     AS m ON m.EmployeeKey = l.EmployeeKey
    WHERE l.PostDate < @FromDate
      AND (@Categories IS NULL OR l.CategoryCode IN (SELECT LTRIM(RTRIM(value)) FROM STRING_SPLIT(@Categories, ',')))
    GROUP BY l.EntityId, l.EmployeeKey;

    SELECT o.EntityId, en.EntityCode, en.EntityName, en.Currency,
           o.EmployeeKey, emp.EmployeeCode, emp.EmployeeNameAr, emp.EmployeeNameEn,
           emp.Department, emp.EmpStatus, o.OpeningBalance
    FROM #Open AS o
    JOIN      emprcv.vw_Src_Entity AS en  ON en.EntityId = o.EntityId
    LEFT JOIN emprcv.vw_Employee   AS emp ON emp.EmployeeKey = o.EmployeeKey;

    /* ---- 2. Transactions with running balance (BR9: deterministic) ---- */
    SELECT
          l.EntityId
        , l.EmployeeKey
        , ROW_NUMBER() OVER (PARTITION BY l.EntityId, l.EmployeeKey
                             ORDER BY l.PostDate, l.HeaderId, l.RowSeq) AS LineNo
        , l.PostDate
        , l.DocDate
        , l.PeriodYear
        , l.PeriodMonth
        , l.DocTypeRaw
        , l.DocNumber
        , l.HeaderId
        , l.AccountCode
        , l.AccountName
        , l.CategoryCode
        , l.Seg1Code, l.Seg2Code, l.Seg3Code, l.Seg4Code, l.Seg5Code
        , l.Description
        , l.DebitAmt
        , l.CreditAmt
        , ISNULL(o.OpeningBalance, 0)
          + SUM(l.Amount) OVER (PARTITION BY l.EntityId, l.EmployeeKey
                                ORDER BY l.PostDate, l.HeaderId, l.RowSeq
                                ROWS UNBOUNDED PRECEDING)               AS RunningBalance
        , DATEDIFF(day, l.PostDate, @ToDate)                            AS AgeDays
        , l.PostedBy
        , l.PostedOn
        , du.UrlTemplate                                                AS DrillUrlTemplate
    FROM emprcv.vw_EmployeeLedger AS l
    JOIN      @Entities AS e ON e.EntityId = l.EntityId
    JOIN      @Emps     AS m ON m.EmployeeKey = l.EmployeeKey
    LEFT JOIN #Open     AS o ON o.EntityId = l.EntityId AND o.EmployeeKey = l.EmployeeKey
    LEFT JOIN emprcv.EMPRCV_DrillUrl AS du
           ON du.DocType = l.DocTypeRaw AND du.IsEnabled = 1
    WHERE l.PostDate BETWEEN @FromDate AND @ToDate
      AND (@Categories IS NULL OR l.CategoryCode IN (SELECT LTRIM(RTRIM(value)) FROM STRING_SPLIT(@Categories, ',')))
      AND (@DocTypes   IS NULL OR l.DocTypeRaw   IN (SELECT LTRIM(RTRIM(value)) FROM STRING_SPLIT(@DocTypes, ',')))
    ORDER BY l.EntityId, l.EmployeeKey, l.PostDate, l.HeaderId, l.RowSeq
    OPTION (RECOMPILE);

    /* ---- 3. Category summary as at @ToDate --------------------------- */
    SELECT
          l.EntityId
        , l.EmployeeKey
        , l.CategoryCode
        , c.NameAr AS CategoryNameAr
        , c.NameEn AS CategoryNameEn
        , SUM(l.Amount) AS CategoryBalance
    FROM emprcv.vw_EmployeeLedger AS l
    JOIN      @Entities AS e ON e.EntityId = l.EntityId
    JOIN      @Emps     AS m ON m.EmployeeKey = l.EmployeeKey
    LEFT JOIN emprcv.EMPRCV_Category AS c ON c.CategoryCode = l.CategoryCode
    WHERE l.PostDate <= @ToDate
    GROUP BY l.EntityId, l.EmployeeKey, l.CategoryCode, c.NameAr, c.NameEn;

    /* ---- 4. Footer: closing balance, post-cutoff warning, R1 tie-out -- */
    SELECT
          l.EntityId
        , l.EmployeeKey
        , SUM(CASE WHEN l.PostDate <= @ToDate THEN l.Amount ELSE 0 END)        AS ClosingBalance
        , SUM(CASE WHEN l.PostDate >  @ToDate THEN 1 ELSE 0 END)               AS PostCutoffTxnCount
        , SUM(CASE WHEN l.PostDate >  @ToDate THEN l.Amount ELSE 0 END)        AS PostCutoffAmount
    FROM emprcv.vw_EmployeeLedger AS l
    JOIN @Entities AS e ON e.EntityId = l.EntityId
    JOIN @Emps     AS m ON m.EmployeeKey = l.EmployeeKey
    GROUP BY l.EntityId, l.EmployeeKey;

    INSERT INTO emprcv.EMPRCV_RunLog (ReportCode, UserId, ParamsJson, DurationMs)
    SELECT 'EMPRCV-R2', @UserId,
           (SELECT @EmployeeKeys AS EmployeeKeys, @FromDate AS FromDate, @ToDate AS ToDate
            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
           DATEDIFF(millisecond, @t0, SYSUTCDATETIME());
END
GO
