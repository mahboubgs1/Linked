/* =====================================================================
   EMPRCV — File: 10_source_views.sql
   Purpose: ANTI-CORRUPTION LAYER. The ONLY objects allowed to reference
            standard Yardi tables. Everything else reads these views.

   ⚠  DO NOT DEPLOY BEFORE THE SCHEMA-VALIDATION GATE (README §4).
      Every line marked  -- VERIFY:  contains a physical name that must be
      confirmed against the client's Voyager version and recorded in
      emprcv.EMPRCV_SchemaMap. Names differ between Voyager 7S and 8 and
      between client configurations. Deploying these views unverified
      will produce silently wrong balances.

   Acceptance test for this file:
      For a given entity / account / date range, SUM(Amount) from
      vw_Src_GLTrans must equal the same account balance on the standard
      Voyager trial-balance report. No downstream object may be built
      until that test passes.
   ===================================================================== */

/* ---------------------------------------------------------------------
   GL transaction lines
   Logical columns: TransId, EntityId, AccountId, HeaderId, PostDate,
                    Amount (debit positive), Memo, BookId, PostedBy, PostedOn
   --------------------------------------------------------------------- */
CREATE OR ALTER VIEW emprcv.vw_Src_GLTrans
AS
SELECT
      g.hMy            AS TransId        -- VERIFY: PK column
    , g.hProp          AS EntityId       -- VERIFY: entity/property FK
    , g.hAcct          AS AccountId      -- VERIFY: account FK
    , g.hHead          AS HeaderId       -- VERIFY: header FK (hHead | hHeader)
    , CAST(g.dPost AS date) AS PostDate  -- VERIFY: post-date column
    , g.dAmount        AS Amount         -- VERIFY: amount column name AND sign
                                         --         convention (debit positive?)
    , g.sMemo          AS Memo           -- VERIFY: line description column
    , g.hBook          AS BookId         -- VERIFY: book/ledger FK
    , g.sUser          AS PostedBy       -- VERIFY: may not exist; else use header
    , g.dtStamp        AS PostedOn       -- VERIFY: audit timestamp column
FROM dbo.gltrans AS g;                   -- VERIFY: table name
GO

/* ---------------------------------------------------------------------
   Document headers
   --------------------------------------------------------------------- */
CREATE OR ALTER VIEW emprcv.vw_Src_Header
AS
SELECT
      h.hMy       AS HeaderId            -- VERIFY
    , h.sType     AS DocTypeRaw          -- VERIFY: raw type code
    , h.sRef      AS DocNumber           -- VERIFY: document number/reference
    , CAST(h.dDate AS date) AS DocDate   -- VERIFY
    , CAST(h.dPost AS date) AS PostDate  -- VERIFY
    , h.sStatus   AS StatusRaw           -- VERIFY: posted/unposted indicator
    , h.hPayee    AS VendorId            -- VERIFY: vendor/payee FK (may be NULL)
    , h.sComment  AS Reference           -- VERIFY: free-text reference
    , h.sUser     AS CreatedBy           -- VERIFY
FROM dbo.header AS h;                    -- VERIFY: table name
GO

/* ---------------------------------------------------------------------
   Chart of accounts
   --------------------------------------------------------------------- */
CREATE OR ALTER VIEW emprcv.vw_Src_Account
AS
SELECT
      a.hMy        AS AccountId          -- VERIFY
    , a.sAcctCode  AS AccountCode        -- VERIFY: displayed account code
    , a.sName      AS AccountName        -- VERIFY
    , a.sType      AS AccountType        -- VERIFY
    , CASE WHEN a.sStatus = 'Active' THEN 1 ELSE 0 END AS IsActive  -- VERIFY
FROM dbo.account AS a;                   -- VERIFY: table name
GO

/* ---------------------------------------------------------------------
   Entities / companies
   NOTE: In many Voyager configurations the accounting entity is the
         property; in others a separate entity/owner object is used.
         Confirm with the client's finance + Yardi team.
   --------------------------------------------------------------------- */
CREATE OR ALTER VIEW emprcv.vw_Src_Entity
AS
SELECT
      p.hMy      AS EntityId             -- VERIFY
    , p.sCode    AS EntityCode           -- VERIFY
    , p.sName    AS EntityName           -- VERIFY
    , p.hCompany AS CompanyId            -- VERIFY: may not exist -> use a config map
    , NULL       AS CompanyName          -- VERIFY
    , p.sCurrency AS Currency            -- VERIFY
    , p.iFYEndMonth AS FiscalYearEndMonth-- VERIFY
FROM dbo.property AS p;                  -- VERIFY: table name
GO

/* ---------------------------------------------------------------------
   Vendors (employee-as-vendor source)
   IsEmployee flag: how the client distinguishes employees from suppliers
   (vendor type, category, code prefix...) — must be confirmed.
   --------------------------------------------------------------------- */
CREATE OR ALTER VIEW emprcv.vw_Src_Vendor
AS
SELECT
      v.hMy      AS VendorId             -- VERIFY
    , v.sVendCode AS VendorCode          -- VERIFY
    , v.sName    AS VendorName           -- VERIFY
    , CASE WHEN v.sType = 'EMPLOYEE' THEN 1 ELSE 0 END AS IsEmployee -- VERIFY: rule
    , NULL       AS Department           -- VERIFY: source of department
    , v.sStatus  AS StatusRaw            -- VERIFY
    , NULL       AS HireDate             -- VERIFY: from HR module if enabled
    , NULL       AS TermDate             -- VERIFY
FROM dbo.vendor AS v;                    -- VERIFY: table name
GO

/* ---------------------------------------------------------------------
   Books / ledgers — used to restrict the report to the accrual book
   --------------------------------------------------------------------- */
CREATE OR ALTER VIEW emprcv.vw_Src_Book
AS
SELECT
      b.hMy   AS BookId                  -- VERIFY
    , b.sCode AS BookCode                -- VERIFY
    , b.sName AS BookName                -- VERIFY
FROM dbo.book AS b;                      -- VERIFY: table name
GO

/* ---------------------------------------------------------------------
   User entity security — WHICH ENTITIES A VOYAGER USER MAY SEE.
   This is the highest-variance object across Voyager versions and the
   single most security-critical one. It MUST be implemented against the
   client's actual security tables during deployment.

   FAIL-CLOSED CONTRACT: if the mapping cannot be resolved, this view
   must return NO ROWS (user sees nothing) — never all rows.
   --------------------------------------------------------------------- */
CREATE OR ALTER VIEW emprcv.vw_Src_UserSecurity
AS
SELECT
      CAST(NULL AS int) AS UserId        -- VERIFY: implement per client
    , CAST(NULL AS int) AS EntityId      -- VERIFY
WHERE 1 = 0;                             -- fail-closed placeholder
GO

/* ---------------------------------------------------------------------
   User entity scope function — intersect requested entities with allowed
   --------------------------------------------------------------------- */
CREATE OR ALTER FUNCTION emprcv.fn_UserEntityScope (@UserId int)
RETURNS TABLE
AS
RETURN
(
    SELECT DISTINCT s.EntityId
    FROM emprcv.vw_Src_UserSecurity AS s
    WHERE s.UserId = @UserId
);
GO
