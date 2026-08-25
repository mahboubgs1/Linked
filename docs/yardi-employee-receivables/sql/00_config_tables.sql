/* =====================================================================
   EMPRCV — Employee Receivables Reporting Package
   File   : 00_config_tables.sql
   Purpose: Configuration + logging tables (custom schema only).
   Target : SQL Server 2016+
   Rules  : No changes to any standard Yardi object. Idempotent.
   NOTE   : Reference implementation for the design package. Must be
            reviewed against the client Voyager schema (see README §4)
            before being deployed to any environment.
   ===================================================================== */

IF SCHEMA_ID('emprcv') IS NULL EXEC('CREATE SCHEMA emprcv');
GO

/* ---------------------------------------------------------------------
   1. Schema map — logical name  <->  physical Yardi name
      Filled during the mandatory schema-validation gate (M0).
      The source views in 10_source_views.sql are written by hand from
      this table (deliberately NOT dynamic SQL).
   --------------------------------------------------------------------- */
IF OBJECT_ID('emprcv.EMPRCV_SchemaMap') IS NULL
CREATE TABLE emprcv.EMPRCV_SchemaMap (
    LogicalObject   varchar(50)   NOT NULL,
    LogicalColumn   varchar(50)   NOT NULL,
    PhysicalTable   varchar(128)  NULL,
    PhysicalColumn  varchar(128)  NULL,
    DataTypeNote    varchar(200)  NULL,
    Verified        bit           NOT NULL CONSTRAINT DF_SchemaMap_Ver DEFAULT(0),
    VerifiedBy      varchar(100)  NULL,
    VerifiedOn      datetime2(0)  NULL,
    Notes           nvarchar(500) NULL,
    CONSTRAINT PK_EMPRCV_SchemaMap PRIMARY KEY (LogicalObject, LogicalColumn)
);
GO

/* ---------------------------------------------------------------------
   2. Account scope — which GL accounts are "employee receivable"
      ScopeType: LIST | RANGE | TREE
      EntityId NULL = applies to all entities.
      EffFrom/EffTo keep historical reports stable when the CoA changes.
   --------------------------------------------------------------------- */
IF OBJECT_ID('emprcv.EMPRCV_AccountScope') IS NULL
CREATE TABLE emprcv.EMPRCV_AccountScope (
    ScopeId         int IDENTITY(1,1) NOT NULL,
    EntityId        int           NULL,
    ScopeType       varchar(10)   NOT NULL,
    AccountId       int           NULL,          -- LIST
    AccountCodeFrom varchar(50)   NULL,          -- RANGE
    AccountCodeTo   varchar(50)   NULL,          -- RANGE
    TreeNodeId      int           NULL,          -- TREE
    CategoryCode    varchar(20)   NOT NULL,
    ExpectedSign    char(1)       NOT NULL CONSTRAINT DF_Scope_Sign DEFAULT('D'), -- D=Debit
    EffFrom         date          NOT NULL CONSTRAINT DF_Scope_From DEFAULT('1900-01-01'),
    EffTo           date          NOT NULL CONSTRAINT DF_Scope_To   DEFAULT('9999-12-31'),
    IsEnabled       bit           NOT NULL CONSTRAINT DF_Scope_En   DEFAULT(1),
    CreatedBy       varchar(100)  NULL,
    CreatedOn       datetime2(0)  NOT NULL CONSTRAINT DF_Scope_On   DEFAULT(SYSUTCDATETIME()),
    CONSTRAINT PK_EMPRCV_AccountScope PRIMARY KEY (ScopeId),
    CONSTRAINT CK_Scope_Type CHECK (ScopeType IN ('LIST','RANGE','TREE')),
    CONSTRAINT CK_Scope_Dates CHECK (EffTo >= EffFrom)
);
GO

/* ---------------------------------------------------------------------
   3. Categories (bilingual labels, display order)
   --------------------------------------------------------------------- */
IF OBJECT_ID('emprcv.EMPRCV_Category') IS NULL
CREATE TABLE emprcv.EMPRCV_Category (
    CategoryCode  varchar(20)   NOT NULL,
    NameAr        nvarchar(100) NOT NULL,
    NameEn        nvarchar(100) NOT NULL,
    SortOrder     int           NOT NULL CONSTRAINT DF_Cat_Sort DEFAULT(100),
    IsEnabled     bit           NOT NULL CONSTRAINT DF_Cat_En   DEFAULT(1),
    CONSTRAINT PK_EMPRCV_Category PRIMARY KEY (CategoryCode)
);
GO

IF NOT EXISTS (SELECT 1 FROM emprcv.EMPRCV_Category)
INSERT INTO emprcv.EMPRCV_Category (CategoryCode, NameAr, NameEn, SortOrder) VALUES
    ('ADVANCE', N'سلفة',        N'Salary Advance',   10),
    ('LOAN',    N'قرض',         N'Employee Loan',    20),
    ('CUSTODY', N'عهدة',        N'Custody / Imprest',30),
    ('TRAVEL',  N'مصاريف سفر',  N'Travel Expense',   40),
    ('PENALTY', N'غرامة/خصم',   N'Penalty / Deduction', 50),
    ('OTHER',   N'أخرى',        N'Other',            90);
GO

/* ---------------------------------------------------------------------
   4. Employee source resolution order
      SourceType: MANUAL | VENDOR | SEGMENT | SUBACCT | REF
   --------------------------------------------------------------------- */
IF OBJECT_ID('emprcv.EMPRCV_EmployeeSource') IS NULL
CREATE TABLE emprcv.EMPRCV_EmployeeSource (
    SourceType   varchar(20)   NOT NULL,
    Priority     int           NOT NULL,
    IsEnabled    bit           NOT NULL CONSTRAINT DF_EmpSrc_En DEFAULT(0),
    MatchPattern nvarchar(200) NULL,   -- REF only, e.g. 'EMP-[0-9][0-9][0-9][0-9][0-9]'
    SegmentNo    tinyint       NULL,   -- SEGMENT only
    Notes        nvarchar(500) NULL,
    CONSTRAINT PK_EMPRCV_EmployeeSource PRIMARY KEY (SourceType),
    CONSTRAINT CK_EmpSrc_Type CHECK (SourceType IN ('MANUAL','VENDOR','SEGMENT','SUBACCT','REF'))
);
GO

IF NOT EXISTS (SELECT 1 FROM emprcv.EMPRCV_EmployeeSource)
INSERT INTO emprcv.EMPRCV_EmployeeSource (SourceType, Priority, IsEnabled, Notes) VALUES
    ('MANUAL', 1, 1, N'Manual overrides always win'),
    ('VENDOR', 2, 1, N'Employee set up as a vendor - most common'),
    ('SEGMENT',3, 0, N'Enable only if an employee segment exists'),
    ('SUBACCT',4, 0, N'Enable only if one GL sub-account per employee'),
    ('REF',    5, 0, N'Last resort - requires a strict reference pattern');
GO

/* ---------------------------------------------------------------------
   5. Manual mapping / overrides for individual transactions
   --------------------------------------------------------------------- */
IF OBJECT_ID('emprcv.EMPRCV_ManualMap') IS NULL
CREATE TABLE emprcv.EMPRCV_ManualMap (
    HeaderId     int           NOT NULL,
    TransId      int           NOT NULL,
    EmployeeCode varchar(50)   NOT NULL,
    Reason       nvarchar(300) NULL,
    CreatedBy    varchar(100)  NOT NULL,
    CreatedOn    datetime2(0)  NOT NULL CONSTRAINT DF_MMap_On DEFAULT(SYSUTCDATETIME()),
    CONSTRAINT PK_EMPRCV_ManualMap PRIMARY KEY (HeaderId, TransId)
);
GO

/* ---------------------------------------------------------------------
   6. Segment definition (up to 6 segments; 5-6 hidden by default)
      SourceMode: POSITION | DELIMITER | TABLE
   --------------------------------------------------------------------- */
IF OBJECT_ID('emprcv.EMPRCV_SegmentDef') IS NULL
CREATE TABLE emprcv.EMPRCV_SegmentDef (
    SegNo        tinyint       NOT NULL,
    LabelAr      nvarchar(50)  NOT NULL,
    LabelEn      nvarchar(50)  NOT NULL,
    SourceMode   varchar(10)   NOT NULL,
    StartPos     int           NULL,     -- POSITION
    SegLength    int           NULL,     -- POSITION
    Delimiter    varchar(5)    NULL,     -- DELIMITER
    OrdinalPos   int           NULL,     -- DELIMITER
    ValueTable   varchar(128)  NULL,     -- TABLE
    IsFilter     bit           NOT NULL CONSTRAINT DF_Seg_Filt DEFAULT(1),
    IsDisplayed  bit           NOT NULL CONSTRAINT DF_Seg_Disp DEFAULT(1),
    IsEmployeeSeg bit          NOT NULL CONSTRAINT DF_Seg_Emp  DEFAULT(0),
    IsDeptSeg    bit           NOT NULL CONSTRAINT DF_Seg_Dept DEFAULT(0),
    IsEnabled    bit           NOT NULL CONSTRAINT DF_Seg_En   DEFAULT(1),
    CONSTRAINT PK_EMPRCV_SegmentDef PRIMARY KEY (SegNo),
    CONSTRAINT CK_Seg_Mode CHECK (SourceMode IN ('POSITION','DELIMITER','TABLE')),
    CONSTRAINT CK_Seg_No   CHECK (SegNo BETWEEN 1 AND 6)
);
GO

/* ---------------------------------------------------------------------
   7. Aging buckets (data-driven; changing them needs no redeploy)
   --------------------------------------------------------------------- */
IF OBJECT_ID('emprcv.EMPRCV_AgingBucket') IS NULL
CREATE TABLE emprcv.EMPRCV_AgingBucket (
    BucketNo  tinyint      NOT NULL,
    DayFrom   int          NOT NULL,
    DayTo     int          NOT NULL,   -- 99999 = open ended
    LabelAr   nvarchar(30) NOT NULL,
    LabelEn   nvarchar(30) NOT NULL,
    CONSTRAINT PK_EMPRCV_AgingBucket PRIMARY KEY (BucketNo),
    CONSTRAINT CK_Bucket_Range CHECK (DayTo >= DayFrom)
);
GO

IF NOT EXISTS (SELECT 1 FROM emprcv.EMPRCV_AgingBucket)
INSERT INTO emprcv.EMPRCV_AgingBucket (BucketNo, DayFrom, DayTo, LabelAr, LabelEn) VALUES
    (1,   0,    30, N'0-30',    '0-30'),
    (2,  31,    60, N'31-60',   '31-60'),
    (3,  61,    90, N'61-90',   '61-90'),
    (4,  91,   180, N'91-180',  '91-180'),
    (5, 181, 99999, N'أكثر من 180', 'Over 180');
GO

/* ---------------------------------------------------------------------
   8. Declaration text for the confirmation form (R3)
      Legal wording is owned by the client's legal team, not by IT.
   --------------------------------------------------------------------- */
IF OBJECT_ID('emprcv.EMPRCV_DeclarationText') IS NULL
CREATE TABLE emprcv.EMPRCV_DeclarationText (
    LangCode    char(2)        NOT NULL,
    Version     varchar(10)    NOT NULL,
    BodyText    nvarchar(max)  NOT NULL,
    ObjectionText nvarchar(max) NULL,
    ApprovedBy  varchar(100)   NULL,
    ApprovedOn  date           NULL,
    IsActive    bit            NOT NULL CONSTRAINT DF_Decl_Act DEFAULT(0),
    CONSTRAINT PK_EMPRCV_DeclarationText PRIMARY KEY (LangCode, Version)
);
GO

/* ---------------------------------------------------------------------
   9. Drill-through URL templates per document type.
      Filled at deployment time from the client's actual Voyager URLs.
      Placeholders: {HeaderId} {DocNumber} {EntityCode} {DocType}
   --------------------------------------------------------------------- */
IF OBJECT_ID('emprcv.EMPRCV_DrillUrl') IS NULL
CREATE TABLE emprcv.EMPRCV_DrillUrl (
    DocType     varchar(20)   NOT NULL,
    UrlTemplate nvarchar(500) NOT NULL,
    IsEnabled   bit           NOT NULL CONSTRAINT DF_Drill_En DEFAULT(1),
    Notes       nvarchar(300) NULL,
    CONSTRAINT PK_EMPRCV_DrillUrl PRIMARY KEY (DocType)
);
GO

/* ---------------------------------------------------------------------
   10. Row-level user scope (department / segment restriction)
   --------------------------------------------------------------------- */
IF OBJECT_ID('emprcv.EMPRCV_UserScope') IS NULL
CREATE TABLE emprcv.EMPRCV_UserScope (
    UserId      int          NOT NULL,
    ScopeKind   varchar(20)  NOT NULL,   -- DEPARTMENT | SEGMENT | ENTITY
    ScopeValue  varchar(50)  NOT NULL,
    SegNo       tinyint      NULL,
    IsEnabled   bit          NOT NULL CONSTRAINT DF_UScope_En DEFAULT(1),
    CONSTRAINT PK_EMPRCV_UserScope PRIMARY KEY (UserId, ScopeKind, ScopeValue)
);
GO

/* ---------------------------------------------------------------------
   11. Year-end frozen balance snapshot (source for R3)
   --------------------------------------------------------------------- */
IF OBJECT_ID('emprcv.EMPRCV_BalanceSnapshot') IS NULL
CREATE TABLE emprcv.EMPRCV_BalanceSnapshot (
    SnapshotId     int           NOT NULL,
    EntityId       int           NOT NULL,
    EmployeeKey    int           NOT NULL,
    AsOfDate       date          NOT NULL,
    Currency       char(3)       NULL,
    OpeningBalance decimal(19,4) NOT NULL,
    PeriodDebit    decimal(19,4) NOT NULL,
    PeriodCredit   decimal(19,4) NOT NULL,
    ClosingBalance decimal(19,4) NOT NULL,
    Bucket1        decimal(19,4) NOT NULL CONSTRAINT DF_Snap_B1 DEFAULT(0),
    Bucket2        decimal(19,4) NOT NULL CONSTRAINT DF_Snap_B2 DEFAULT(0),
    Bucket3        decimal(19,4) NOT NULL CONSTRAINT DF_Snap_B3 DEFAULT(0),
    Bucket4        decimal(19,4) NOT NULL CONSTRAINT DF_Snap_B4 DEFAULT(0),
    Bucket5        decimal(19,4) NOT NULL CONSTRAINT DF_Snap_B5 DEFAULT(0),
    UnappliedCredit decimal(19,4) NOT NULL CONSTRAINT DF_Snap_UC DEFAULT(0),
    CategoryJson   nvarchar(max) NULL,
    SourceRowCount int           NOT NULL,
    SourceChecksum bigint        NOT NULL,   -- detects post-freeze backdated entries
    FrozenBy       varchar(100)  NOT NULL,
    FrozenOn       datetime2(0)  NOT NULL CONSTRAINT DF_Snap_On DEFAULT(SYSUTCDATETIME()),
    CONSTRAINT PK_EMPRCV_BalanceSnapshot PRIMARY KEY (SnapshotId, EntityId, EmployeeKey)
);
GO

/* ---------------------------------------------------------------------
   12. Confirmation issue / return log (audit evidence for R3 + R3L)
   --------------------------------------------------------------------- */
IF OBJECT_ID('emprcv.EMPRCV_ConfirmationLog') IS NULL
CREATE TABLE emprcv.EMPRCV_ConfirmationLog (
    ConfirmationId  int IDENTITY(1,1) NOT NULL,
    ReferenceNo     varchar(60)   NOT NULL,
    SnapshotId      int           NOT NULL,
    EntityId        int           NOT NULL,
    EmployeeKey     int           NOT NULL,
    FiscalYear      smallint      NOT NULL,
    SeqNo           smallint      NOT NULL,
    ConfirmedAmount decimal(19,4) NOT NULL,
    DeclarationLang char(2)       NOT NULL,
    DeclarationVer  varchar(10)   NOT NULL,
    IssueMode       varchar(10)   NOT NULL,   -- DRAFT | FINAL
    IssuedBy        varchar(100)  NOT NULL,
    IssuedOn        datetime2(0)  NOT NULL CONSTRAINT DF_Conf_On DEFAULT(SYSUTCDATETIME()),
    ReturnStatus    varchar(20)   NULL,       -- SIGNED | DISPUTED | PENDING
    ReturnedOn      date          NULL,
    DisputedAmount  decimal(19,4) NULL,
    DisputeReason   nvarchar(500) NULL,
    AttachmentRef   nvarchar(300) NULL,
    UpdatedBy       varchar(100)  NULL,
    UpdatedOn       datetime2(0)  NULL,
    CONSTRAINT PK_EMPRCV_ConfirmationLog PRIMARY KEY (ConfirmationId),
    CONSTRAINT UQ_EMPRCV_ConfirmationRef UNIQUE (ReferenceNo),
    CONSTRAINT CK_Conf_Mode CHECK (IssueMode IN ('DRAFT','FINAL'))
);
GO

/* ---------------------------------------------------------------------
   13. Report run log (who ran what, with which filters, how long)
   --------------------------------------------------------------------- */
IF OBJECT_ID('emprcv.EMPRCV_RunLog') IS NULL
CREATE TABLE emprcv.EMPRCV_RunLog (
    RunId       bigint IDENTITY(1,1) NOT NULL,
    ReportCode  varchar(20)   NOT NULL,
    UserId      int           NULL,
    UserName    varchar(100)  NULL,
    ParamsJson  nvarchar(max) NULL,
    RowCountOut int           NULL,
    DurationMs  int           NULL,
    StartedOn   datetime2(0)  NOT NULL CONSTRAINT DF_Run_On DEFAULT(SYSUTCDATETIME()),
    ErrorText   nvarchar(2000) NULL,
    CONSTRAINT PK_EMPRCV_RunLog PRIMARY KEY (RunId)
);
GO

/* ---------------------------------------------------------------------
   14. Optional aggregate cache (performance strategy P2/P3)
   --------------------------------------------------------------------- */
IF OBJECT_ID('emprcv.EMPRCV_LedgerCache') IS NULL
CREATE TABLE emprcv.EMPRCV_LedgerCache (
    EntityId     int           NOT NULL,
    EmployeeKey  int           NOT NULL,
    AccountId    int           NOT NULL,
    CategoryCode varchar(20)   NOT NULL,
    PeriodYear   smallint      NOT NULL,
    PeriodMonth  tinyint       NOT NULL,
    DebitAmt     decimal(19,4) NOT NULL,
    CreditAmt    decimal(19,4) NOT NULL,
    NetAmt       decimal(19,4) NOT NULL,
    TxnCount     int           NOT NULL,
    LastPostDate date          NULL,
    RefreshedOn  datetime2(0)  NOT NULL CONSTRAINT DF_Cache_On DEFAULT(SYSUTCDATETIME()),
    CONSTRAINT PK_EMPRCV_LedgerCache
        PRIMARY KEY (EntityId, PeriodYear, PeriodMonth, EmployeeKey, AccountId)
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = 'IX_LedgerCache_Employee'
                 AND object_id = OBJECT_ID('emprcv.EMPRCV_LedgerCache'))
CREATE NONCLUSTERED INDEX IX_LedgerCache_Employee
    ON emprcv.EMPRCV_LedgerCache (EmployeeKey, EntityId)
    INCLUDE (NetAmt, DebitAmt, CreditAmt);
GO
