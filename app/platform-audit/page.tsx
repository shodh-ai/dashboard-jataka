"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";
import Sidebar from "../components/Sidebar";
import { FileText, Download } from "lucide-react";

declare global {
  interface Window {
    mermaid?: {
      initialize: (config: Record<string, unknown>) => void;
      run: (options?: Record<string, unknown>) => Promise<void> | void;
    };
  }
}

// --- Mermaid graph source strings (ported verbatim from the original HTML) ---

const MERMAID_EXEC = `
flowchart LR
    subgraph CONNECT["Shodh AI Connects To"]
        G["GitHub\\nRepositories"]
        S["Salesforce\\nOrgs"]
        J["Jira\\nBoards"]
        SL["Slack\\nWorkspace"]
        IDE["IDE\\nCursor / VS Code"]
    end

    subgraph ENGINE["Shodh AI Engine"]
        E["Metadata Graph\\n+ AI Analysis\\n+ Governance Rules"]
    end

    subgraph ACTION["Automated Actions"]
        A1["PR Review Comments"]
        A2["PR Approve / Block"]
        A3["Auto-Fix Commits"]
        A4["Slack Responses"]
        A5["IDE Previews"]
        A6["Audit Reports"]
    end

    G --> E
    S --> E
    J --> E
    SL --> E
    IDE --> E
    E --> A1
    E --> A2
    E --> A3
    E --> A4
    E --> A5
    E --> A6
`;

const MERMAID_LIFECYCLE = `
flowchart TD
    A["DEVELOPER WRITES CODE\\nApex, LWC, Flows, Metadata\\nin IDE"]
    B["IDE ANALYSIS\\nBlast radius preview\\nField dependency map\\nLimit estimation"]
    C["PR CREATED ON GITHUB\\nCode pushed, PR opened"]
    D["SHODH AI PR REVIEW\\nFull automated analysis\\nacross all 5 modules"]
    E{"VIOLATIONS\\nFOUND?"}
    F["PR AUTO-APPROVED\\nAll checks pass"]
    G["PR BLOCKED\\nLine-level violation report\\nwith remediation steps"]
    H["AUTO-FIX GENERATED\\nAI creates fix commit"]
    I["DEPLOYED TO PRODUCTION"]
    J["SYNTHETIC MONITORING\\n24/7 production health checks"]

    A --> B --> C --> D --> E
    E -->|No| F --> I
    E -->|"Yes, auto-fixable"| H --> D
    E -->|"Yes, needs human"| G
    G -->|Developer fixes| C
    I --> J
    J -->|Issue detected| G
`;

const MERMAID_PR_REVIEW = `
flowchart TD
    subgraph INPUTS["STEP 1 - GATHER CONTEXT"]
        I1["PR Diff\\nChanged Apex, Flows,\\nmetadata XML"]
        I2["Full Org Metadata\\nEvery object, field,\\nflow, class, profile"]
        I3["Linked Jira Ticket\\nAcceptance criteria"]
        I4["Business Rules\\nOrg-specific policies"]
    end

    subgraph ANALYSIS["STEP 2 - ANALYZE"]
        A1["LIMIT FIREWALL\\nSOQL loops, CPU,\\nData skew, API limits"]
        A2["ARCHITECTURE\\nDuplicates, orphans,\\npatterns, best practices"]
        A3["QA ENGINE\\nSelf-healing tests,\\nvideo, verification"]
        A4["INTEGRATION\\nAPI contracts,\\nERP validation"]
    end

    subgraph OUTPUTS["STEP 3 - ACT"]
        O1["APPROVE"]
        O2["BLOCK\\nLine-level report"]
        O3["AUTO-FIX\\nAI commits"]
        O4["AUDIT LOG\\nCompliance record"]
    end

    I1 --> A1
    I1 --> A2
    I2 --> A1
    I2 --> A2
    I3 --> A3
    I4 --> A2
    I2 --> A3
    I2 --> A4
    A1 --> O1
    A1 --> O2
    A2 --> O2
    A2 --> O3
    A3 --> O4
    A4 --> O2
`;

const MERMAID_LIMIT = `
flowchart TD
    PR["PR Submitted\\nDeveloper pushes Apex/Flow changes"]
    PARSE["STEP 1: AST PARSING\\nParse Apex into Abstract Syntax Tree\\nMap every method, loop, DML, SOQL"]
    LOOP["STEP 2: LOOP DETECTION\\nFind SOQL/DML inside loops\\nIncluding indirect method calls"]
    CPU["STEP 3: CPU PROFILING\\nEstimate CPU time for complex paths\\nSync: 10,000ms / Async: 60,000ms"]
    SKEW["STEP 4: DATA SKEW\\nAnalyze DML against org data\\nFlag row-locking patterns"]
    API["STEP 5: API LIMITS\\nCount callouts per transaction\\nLimit: 100 sync / 200 async"]
    REPORT["VIOLATION REPORT\\nFile + line number\\nSeverity + fix suggestion"]
    DECIDE{"CRITICAL\\nVIOLATIONS?"}
    BLOCK["PR BLOCKED"]
    APPROVE["PR APPROVED"]

    PR --> PARSE --> LOOP --> CPU --> SKEW --> API --> REPORT --> DECIDE
    DECIDE -->|Yes| BLOCK
    DECIDE -->|No| APPROVE
`;

const MERMAID_TECHDEBT = `
flowchart TD
    CHANGE["CHANGE DETECTED\\nNew PR with metadata changes"]
    DUP["DUPLICATE SCAN\\nCompare new fields vs all\\nexisting org fields"]
    ORPHAN["ORPHAN DISCOVERY\\nDependency graph analysis\\nFind zero-reference metadata"]
    ARCH["ARCHITECTURE CHECK\\nEnforce Flows over Triggers\\nHandler patterns, naming"]
    LOGIC["BUSINESS LOGIC\\nVerify org-specific rules"]
    BEST["BEST PRACTICES\\nCRUD/FLS, sharing,\\ncoverage, patterns"]
    BULK["BULKIFICATION\\nDetect single-record code\\nAuto-refactor to bulk-safe"]
    CLEAN["CLEANUP GENERATOR\\nGenerate destructiveChanges.xml"]
    SCORE["DEBT SCORE"]
    DECIDE{"ISSUES?"}
    AUTOFIX["AUTO-FIX PR"]
    BLOCK["BLOCKED"]
    PASS["APPROVED"]

    CHANGE --> DUP
    CHANGE --> ORPHAN
    CHANGE --> ARCH
    CHANGE --> LOGIC
    CHANGE --> BEST
    CHANGE --> BULK
    DUP --> SCORE
    ORPHAN --> CLEAN --> SCORE
    ARCH --> SCORE
    LOGIC --> SCORE
    BEST --> SCORE
    BULK --> AUTOFIX
    SCORE --> DECIDE
    DECIDE -->|Auto-fixable| AUTOFIX
    DECIDE -->|"Policy violation"| BLOCK
    DECIDE -->|Clean| PASS
`;

const MERMAID_QA = `
flowchart TD
    TRIGGER["TEST TRIGGERED\\nPR merge, schedule, or on-demand"]
    SEED["SMART DATA SEEDING\\nGenerate minimal test records\\nrespecting all field constraints"]
    EXEC["UI TEST EXECUTION\\nHeadless browser runs E2E tests\\nagainst Salesforce UI"]
    HEAL{"SELECTOR\\nBROKEN?"}
    VISION["VISION AI HEALING\\nScreenshot page, find element\\nvisually, update selector"]
    RECORD["VIDEO RECORDING\\nRecord every step for\\naudit evidence"]
    VERIFY["LOGIC VERIFICATION\\nMathematically prove\\nrefactored code equivalence"]
    REPORT["QA REPORT\\nPass/fail, videos,\\ncoverage, proof status"]

    TRIGGER --> SEED --> EXEC --> HEAL
    HEAL -->|Yes| VISION --> EXEC
    HEAL -->|No| RECORD --> VERIFY --> REPORT
`;

const MERMAID_DEVXP = `
flowchart TD
    subgraph IDE_FLOW["IDE INTEGRATION"]
        DEV["Developer edits\\na field in Cursor"]
        BLAST["Shodh AI shows blast radius:\\n3 Flows, 2 Apex classes,\\n5 Reports, 1 Validation Rule"]
        WARN["Changing this field\\nbreaks Flow 'Lead Assignment'"]
        DEV --> BLAST --> WARN
    end

    subgraph SLACK_FLOW["SLACK BOT"]
        Q["'What happens when\\nan Opp stage changes\\nto Closed Won?'"]
        ANS["1. Trigger OppTrigger fires\\n2. Flow sends notification\\n3. Revenue Schedule created\\n4. Account field updated\\n5. Outbound msg to ERP"]
        Q --> ANS
    end

    subgraph JIRA_FLOW["JIRA ALIGNMENT"]
        JIRA["Jira says: Add Status__c\\nand create update Flow"]
        CHECK["Status__c field found\\nFlow found\\nFlow doesn't fire on Case close\\nMissing test coverage"]
        JIRA --> CHECK
    end
`;

const MERMAID_ENTERPRISE = `
flowchart TD
    subgraph MA["M&A ORG MERGE"]
        MA1["Connect to Org A + Org B"] --> MA2["Extract full metadata"] --> MA3["Compare & map overlap"] --> MA4["Generate Merge Report\\nwith migration plan"]
    end

    subgraph SEC["SECURITY AUDIT"]
        S1["Select sensitive field"] --> S2["Trace access:\\nProfiles, PermSets,\\nSharing Rules, OWD"] --> S3["Generate compliance report\\nUser-Field access matrix"]
    end

    subgraph API["API CONTRACT"]
        AP1["Register external consumers\\nERP, DW, Marketing"] --> AP2["PR modifies contracted field"] --> AP3["Auto-block PR\\nNotify integration owner"]
    end

    subgraph MON["SYNTHETIC MONITORING"]
        MO1["Define critical paths\\nLead, Opp, Case flows"] --> MO2["Run against PROD\\nevery 15 minutes"] --> MO3["Alert on failure\\nSlack + Jira incident"]
    end

    subgraph MIG["LEGACY MIGRATION"]
        MI1["Scan for Workflow Rules"] --> MI2["Parse conditions + actions"] --> MI3["Generate equivalent Flow"] --> MI4["Create PR with\\nFlow + tests + proof"]
    end
`;

// --- Reusable visual pieces ---

function SectionLabel({
  children,
  tone = "gray",
}: {
  children: React.ReactNode;
  tone?: "gray" | "blue" | "purple" | "green" | "orange" | "pink";
}) {
  const tones: Record<string, string> = {
    gray: "bg-slate-500/15 text-slate-300 border border-slate-500/25",
    blue: "bg-indigo-500/15 text-indigo-300 border border-indigo-500/25",
    purple: "bg-violet-500/15 text-violet-300 border border-violet-500/25",
    green: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/25",
    orange: "bg-amber-500/15 text-amber-300 border border-amber-500/25",
    pink: "bg-pink-500/15 text-pink-300 border border-pink-500/25",
  };
  return (
    <span
      className={`inline-block text-[11px] font-bold tracking-[0.12em] uppercase px-3 py-1 rounded-full mb-3 ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function Callout({
  tone,
  title,
  children,
}: {
  tone: "blue" | "red" | "green" | "yellow";
  title: string;
  children: React.ReactNode;
}) {
  const map = {
    blue: "bg-indigo-500/10 border-indigo-500/40 text-indigo-100",
    red: "bg-rose-500/10 border-rose-500/40 text-rose-100",
    green: "bg-emerald-500/10 border-emerald-500/40 text-emerald-100",
    yellow: "bg-amber-500/10 border-amber-500/40 text-amber-100",
  } as const;
  return (
    <div
      className={`rounded-lg p-5 my-6 border-l-4 ${map[tone]} border border-l-4`}
    >
      <h5 className="text-sm font-bold mb-1 text-[var(--text-primary)]">
        {title}
      </h5>
      <div className="text-sm text-[var(--text-secondary)]">{children}</div>
    </div>
  );
}

function PRComment({
  tone,
  tag,
  children,
}: {
  tone: "critical" | "warning" | "info";
  tag: string;
  children: React.ReactNode;
}) {
  const map = {
    critical: "bg-rose-500/15 text-rose-300 border border-rose-500/30",
    warning: "bg-amber-500/15 text-amber-300 border border-amber-500/30",
    info: "bg-indigo-500/15 text-indigo-300 border border-indigo-500/30",
  } as const;
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl p-5 my-5 text-sm">
      <span
        className={`inline-block text-[11px] font-bold px-2 py-1 rounded mb-2 ${map[tone]}`}
      >
        {tag}
      </span>
      <div className="text-[var(--text-secondary)] space-y-1">{children}</div>
    </div>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="bg-[var(--bg-base)] text-indigo-300 px-1.5 py-0.5 rounded font-mono text-[0.82em] border border-[var(--border-default)]">
      {children}
    </code>
  );
}

function MermaidDiagram({ chart }: { chart: string }) {
  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-6 my-6 overflow-x-auto mermaid-wrap">
      <pre className="mermaid flex justify-center text-center">{chart}</pre>
    </div>
  );
}

function TableWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="card overflow-hidden my-5">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">{children}</table>
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="bg-[var(--bg-base)] px-4 py-3 font-semibold text-[11px] uppercase tracking-wider text-[var(--text-secondary)] border-b border-[var(--border-default)]">
      {children}
    </th>
  );
}

function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td
      className={`px-4 py-3 text-sm text-[var(--text-secondary)] align-top ${className}`}
    >
      {children}
    </td>
  );
}

function Tr({ children }: { children: React.ReactNode }) {
  return (
    <tr className="border-b border-[var(--border-default)] hover:bg-[var(--bg-base)]/40 transition-colors">
      {children}
    </tr>
  );
}

// --- Page ---

export default function PlatformAuditPage() {
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    let cancelled = false;

    const tryInit = async () => {
      if (cancelled) return;
      const mermaid = window.mermaid;
      if (!mermaid) {
        setTimeout(tryInit, 120);
        return;
      }
      initializedRef.current = true;
      try {
        mermaid.initialize({
          startOnLoad: false,
          theme: "dark",
          themeVariables: {
            primaryColor: "#1e293b",
            primaryTextColor: "#f8fafc",
            primaryBorderColor: "#818cf8",
            lineColor: "#64748b",
            secondaryColor: "#334155",
            tertiaryColor: "#0f172a",
            background: "#1e293b",
            mainBkg: "#1e293b",
            nodeBorder: "#475569",
            clusterBkg: "#0f172a",
            clusterBorder: "#334155",
            titleColor: "#f8fafc",
            edgeLabelBackground: "#1e293b",
            fontFamily: "Inter, sans-serif",
            fontSize: "13px",
          },
          flowchart: { htmlLabels: true, curve: "basis", padding: 15 },
        });
        await mermaid.run();
      } catch (err) {
        console.error("mermaid init failed", err);
      }
    };

    tryInit();
    return () => {
      cancelled = true;
    };
  }, []);

  const navLinks = [
    { id: "exec", label: "Executive Summary" },
    { id: "arch", label: "Architecture" },
    { id: "m1", label: "Limit Firewall" },
    { id: "m2", label: "Tech Debt" },
    { id: "m3", label: "QA" },
    { id: "m4", label: "Dev XP" },
    { id: "m5", label: "Enterprise" },
    { id: "matrix", label: "Matrix" },
    { id: "roi", label: "ROI" },
  ];

  return (
    <div className="flex min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)]">
      <Sidebar orgName="Jataka" userRole="ARCHITECT" />

      <div className="flex-1 overflow-y-auto bg-[var(--bg-base)] platform-audit-root">
        {/* Page Header */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[var(--border-default)] bg-[var(--bg-base)] px-6 lg:px-10 h-14 audit-page-header">
          <h1 className="text-sm font-medium text-[var(--text-primary)] flex items-center gap-2">
            <FileText size={16} className="text-[var(--accent)]" />
            Shodh AI — Complete Platform Audit
          </h1>
          <button
            onClick={() => window.print()}
            className="btn-primary !py-1.5 !px-3 text-xs"
          >
            <Download size={13} />
            Export PDF
          </button>
        </header>

        {/* Secondary sticky anchor nav */}
        <div className="sticky top-14 z-20 bg-[var(--bg-surface)]/80 backdrop-blur border-b border-[var(--border-default)] px-6 lg:px-10 audit-anchor-nav">
          <div className="max-w-5xl mx-auto flex flex-wrap items-center gap-1 py-2">
            {navLinks.map((l) => (
              <a
                key={l.id}
                href={`#${l.id}`}
                className="text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] px-2.5 py-1 rounded-md transition-colors"
              >
                {l.label}
              </a>
            ))}
          </div>
        </div>

        {/* Main content */}
        <main className="max-w-5xl mx-auto px-6 lg:px-10 py-10 audit-main">
          {/* HERO */}
          <section className="text-center py-12 border-b border-[var(--border-default)]">
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-[var(--text-primary)] mb-3">
              Shodh AI — Complete Platform Audit
            </h1>
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-[var(--text-muted)] mb-5">
              <span>Product Architecture &amp; Capability Audit</span>
              <span>Internal / Client-Facing</span>
              <span>April 2026 — v1.0</span>
            </div>
            <p className="text-base md:text-lg text-[var(--text-secondary)] max-w-3xl mx-auto">
              The autonomous Salesforce governance engine. From code review to
              compliance, Shodh AI guards your org at every stage of the
              development lifecycle.
            </p>
          </section>

          {/* TOC */}
          <div className="card p-6 my-8 bg-[var(--bg-surface)]">
            <h3 className="text-base font-bold text-[var(--text-primary)] mb-3">
              Table of Contents
            </h3>
            <ol className="list-decimal pl-5 space-y-1.5 text-sm">
              <li>
                <a
                  href="#exec"
                  className="text-[var(--accent-light)] hover:underline"
                >
                  Executive Summary
                </a>
              </li>
              <li>
                <a
                  href="#arch"
                  className="text-[var(--accent-light)] hover:underline"
                >
                  Platform Architecture — How Shodh AI Works
                </a>
              </li>
              <li>
                <a
                  href="#m1"
                  className="text-[var(--accent-light)] hover:underline"
                >
                  Module 1 — The Limit Firewall
                </a>
              </li>
              <li>
                <a
                  href="#m2"
                  className="text-[var(--accent-light)] hover:underline"
                >
                  Module 2 — Tech Debt &amp; Architecture Governance
                </a>
              </li>
              <li>
                <a
                  href="#m3"
                  className="text-[var(--accent-light)] hover:underline"
                >
                  Module 3 — Autonomous QA
                </a>
              </li>
              <li>
                <a
                  href="#m4"
                  className="text-[var(--accent-light)] hover:underline"
                >
                  Module 4 — Developer Experience
                </a>
              </li>
              <li>
                <a
                  href="#m5"
                  className="text-[var(--accent-light)] hover:underline"
                >
                  Module 5 — Enterprise Use Cases
                </a>
              </li>
              <li>
                <a
                  href="#matrix"
                  className="text-[var(--accent-light)] hover:underline"
                >
                  Complete Capability Matrix
                </a>
              </li>
              <li>
                <a
                  href="#roi"
                  className="text-[var(--accent-light)] hover:underline"
                >
                  Business Impact &amp; ROI
                </a>
              </li>
            </ol>
          </div>

          {/* ===== Executive Summary ===== */}
          <section
            id="exec"
            className="py-10 border-b border-[var(--border-default)]"
          >
            <SectionLabel tone="gray">Section 01</SectionLabel>
            <h2 className="text-3xl font-extrabold tracking-tight mb-3">
              Executive Summary
            </h2>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              Shodh AI is an{" "}
              <strong className="text-[var(--text-primary)]">
                autonomous Salesforce governance platform
              </strong>{" "}
              that acts as an intelligent layer across the entire Salesforce
              development lifecycle. It connects to your GitHub repositories,
              Salesforce orgs, Jira boards, and developer tools — analyzing
              every code change, metadata modification, and configuration
              update before it reaches production.
            </p>

            <h3 className="text-xl font-bold mt-10 mb-3">The Problem</h3>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              Salesforce orgs grow uncontrollably. Every team adds fields,
              writes triggers, builds flows, and creates automation — without
              visibility into what already exists or what might break.
            </p>

            <TableWrap>
              <thead>
                <tr>
                  <Th>Problem</Th>
                  <Th>Shodh AI Solution</Th>
                  <Th>Impact</Th>
                </tr>
              </thead>
              <tbody>
                <Tr>
                  <Td>SOQL queries inside loops cause production outages</Td>
                  <Td>Limit Firewall blocks them at PR level before merge</Td>
                  <Td>
                    <strong className="text-[var(--text-primary)]">
                      Zero
                    </strong>{" "}
                    governor limit incidents
                  </Td>
                </Tr>
                <Tr>
                  <Td>Developers create duplicate fields</Td>
                  <Td>
                    Duplicate Field Prevention cross-references entire org
                  </Td>
                  <Td>
                    <strong className="text-[var(--text-primary)]">
                      30-40%
                    </strong>{" "}
                    reduction in metadata bloat
                  </Td>
                </Tr>
                <Tr>
                  <Td>UI tests break when Salesforce updates DOM</Td>
                  <Td>Vision AI self-heals broken selectors automatically</Td>
                  <Td>
                    <strong className="text-[var(--text-primary)]">90%</strong>{" "}
                    reduction in test maintenance
                  </Td>
                </Tr>
                <Tr>
                  <Td>No one knows blast radius of changing a field</Td>
                  <Td>IDE integration shows every dependency in real-time</Td>
                  <Td>
                    <strong className="text-[var(--text-primary)]">80%</strong>{" "}
                    fewer unintended side effects
                  </Td>
                </Tr>
                <Tr>
                  <Td>M&amp;A requires manual metadata comparison</Td>
                  <Td>Automated org merge mapping with overlap report</Td>
                  <Td>
                    Due diligence:{" "}
                    <strong className="text-[var(--text-primary)]">
                      months → days
                    </strong>
                  </Td>
                </Tr>
                <Tr>
                  <Td>Compliance audits require manual access tracing</Td>
                  <Td>
                    Automated security access reports across all profiles
                  </Td>
                  <Td>
                    Audit reports in{" "}
                    <strong className="text-[var(--text-primary)]">
                      minutes
                    </strong>
                  </Td>
                </Tr>
              </tbody>
            </TableWrap>

            <h3 className="text-xl font-bold mt-10 mb-3">How It Integrates</h3>
            <MermaidDiagram chart={MERMAID_EXEC} />
          </section>

          {/* ===== Architecture ===== */}
          <section
            id="arch"
            className="py-10 border-b border-[var(--border-default)]"
          >
            <SectionLabel tone="gray">Section 02</SectionLabel>
            <h2 className="text-3xl font-extrabold tracking-tight mb-3">
              Platform Architecture — How Shodh AI Works
            </h2>

            <h3 className="text-xl font-bold mt-8 mb-3">
              2.1 End-to-End Lifecycle Flow
            </h3>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              Shodh AI operates across the{" "}
              <strong className="text-[var(--text-primary)]">
                entire development lifecycle
              </strong>{" "}
              — from the moment a developer opens their IDE to production
              monitoring after deployment.
            </p>
            <MermaidDiagram chart={MERMAID_LIFECYCLE} />

            <h3 className="text-xl font-bold mt-10 mb-3">
              2.2 What Happens During PR Review — Detailed Breakdown
            </h3>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              When a PR is created, Shodh AI performs a comprehensive analysis.
              Here is exactly what gets analyzed, in what order, and what
              outputs are produced.
            </p>
            <MermaidDiagram chart={MERMAID_PR_REVIEW} />
          </section>

          {/* ===== Module 1: Limit Firewall ===== */}
          <section
            id="m1"
            className="py-10 border-b border-[var(--border-default)]"
          >
            <SectionLabel tone="blue">Module 01</SectionLabel>
            <h2 className="text-3xl font-extrabold tracking-tight mb-3">
              The Limit Firewall
            </h2>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              Prevents Salesforce governor limit violations before they reach
              production. Governor limits are hard caps enforced per
              transaction — exceeding them crashes the entire transaction. This
              is the{" "}
              <strong className="text-[var(--text-primary)]">
                #1 cause of production outages
              </strong>{" "}
              in Salesforce.
            </p>

            <h3 className="text-xl font-bold mt-8 mb-3">How It Works</h3>
            <MermaidDiagram chart={MERMAID_LIMIT} />

            <h3 className="text-xl font-bold mt-10 mb-3">Capabilities</h3>

            <h4 className="text-base font-bold mt-6 mb-2 text-[var(--text-primary)]">
              3.3.1 — Prevent SOQL &amp; DML Loops
            </h4>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              <strong className="text-[var(--text-primary)]">
                What it detects:
              </strong>{" "}
              Any SOQL query or DML operation that executes inside a loop. Also
              detects <em>indirect</em> calls — method A calls method B inside
              a loop, and method B has SOQL.
            </p>
            <p className="text-[var(--text-secondary)] leading-relaxed mt-2">
              <strong className="text-[var(--text-primary)]">
                Why it matters:
              </strong>{" "}
              Salesforce enforces 100 SOQL queries and 150 DML statements per
              transaction. A loop over 200 records with one query per iteration
              crashes at iteration 101.
            </p>

            <PRComment tone="critical" tag="CRITICAL">
              <p>
                <strong className="text-[var(--text-primary)]">
                  SOQL Query Inside Loop
                </strong>{" "}
                — <Code>AccountService.cls:47</Code>
              </p>
              <p>
                A SOQL query{" "}
                <Code>
                  [SELECT Id, Name FROM Contact WHERE AccountId = :acc.Id]
                </Code>{" "}
                is executed inside a <Code>for</Code> loop iterating over{" "}
                <Code>accounts</Code>. If <Code>accounts</Code> has more than
                100 records, this will throw{" "}
                <Code>System.LimitException</Code>.
              </p>
              <p>
                <strong className="text-[var(--text-primary)]">Fix:</strong>{" "}
                Move the query before the loop and use a Map to access results.
              </p>
            </PRComment>

            <h4 className="text-base font-bold mt-6 mb-2 text-[var(--text-primary)]">
              3.3.2 — Catch CPU Timeouts
            </h4>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              <strong className="text-[var(--text-primary)]">
                What it detects:
              </strong>{" "}
              Code paths where estimated CPU execution time approaches
              Salesforce&apos;s limit (10s sync, 60s async).
            </p>
            <p className="text-[var(--text-secondary)] leading-relaxed mt-2">
              <strong className="text-[var(--text-primary)]">How:</strong>{" "}
              Analyzes algorithmic complexity — loop nesting depth, collection
              operations, string manipulation. Flags paths estimated to consume
              &gt;70% of CPU limit.
            </p>

            <h4 className="text-base font-bold mt-6 mb-2 text-[var(--text-primary)]">
              3.3.3 — Detect Data Skew
            </h4>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              <strong className="text-[var(--text-primary)]">
                What it detects:
              </strong>{" "}
              DML patterns that cause row-locking errors — parent records with
              10K+ children, lookup skew on shared objects, ownership
              concentration.
            </p>
            <p className="text-[var(--text-secondary)] leading-relaxed mt-2">
              <strong className="text-[var(--text-primary)]">How:</strong>{" "}
              Cross-references DML operations against the org&apos;s actual
              data distribution.
            </p>

            <h4 className="text-base font-bold mt-6 mb-2 text-[var(--text-primary)]">
              3.3.4 — Enforce API Limits
            </h4>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              <strong className="text-[var(--text-primary)]">
                What it detects:
              </strong>{" "}
              Outbound HTTP callouts exceeding 100/transaction. Also checks for
              missing async patterns in batch callout scenarios.
            </p>

            <TableWrap>
              <thead>
                <tr>
                  <Th>Check</Th>
                  <Th>SF Limit</Th>
                  <Th>Detection Method</Th>
                  <Th>Severity</Th>
                </tr>
              </thead>
              <tbody>
                <Tr>
                  <Td>SOQL in loops</Td>
                  <Td>100 queries/txn</Td>
                  <Td>AST + indirect call tracing</Td>
                  <Td>
                    <span className="text-rose-400 font-semibold">
                      Critical
                    </span>
                  </Td>
                </Tr>
                <Tr>
                  <Td>DML in loops</Td>
                  <Td>150 statements/txn</Td>
                  <Td>AST + indirect call tracing</Td>
                  <Td>
                    <span className="text-rose-400 font-semibold">
                      Critical
                    </span>
                  </Td>
                </Tr>
                <Tr>
                  <Td>CPU time</Td>
                  <Td>10,000ms / 60,000ms</Td>
                  <Td>Complexity estimation</Td>
                  <Td>
                    <span className="text-rose-400 font-semibold">
                      Critical
                    </span>
                  </Td>
                </Tr>
                <Tr>
                  <Td>Data skew</Td>
                  <Td>Row lock contention</Td>
                  <Td>Org data distribution analysis</Td>
                  <Td>
                    <span className="text-amber-400 font-semibold">
                      Warning
                    </span>
                  </Td>
                </Tr>
                <Tr>
                  <Td>API callouts</Td>
                  <Td>100 sync / 200 async</Td>
                  <Td>Callout path tracing</Td>
                  <Td>
                    <span className="text-rose-400 font-semibold">
                      Critical
                    </span>
                  </Td>
                </Tr>
              </tbody>
            </TableWrap>

            <Callout tone="blue" title="Why This Matters">
              Governor limit violations are the most common cause of Salesforce
              production outages. Traditional code reviews catch ~30%. Shodh AI
              provides{" "}
              <strong className="text-[var(--text-primary)]">
                100% automated coverage
              </strong>{" "}
              across every PR — eliminating 95%+ governor limit incidents.
            </Callout>
          </section>

          {/* ===== Module 2: Tech Debt ===== */}
          <section
            id="m2"
            className="py-10 border-b border-[var(--border-default)]"
          >
            <SectionLabel tone="purple">Module 02</SectionLabel>
            <h2 className="text-3xl font-extrabold tracking-tight mb-3">
              Tech Debt &amp; Architecture Governance
            </h2>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              Prevents new technical debt from entering the org and
              autonomously remediates existing debt. Enforces architecture
              standards, blocks redundant metadata, discovers dead code, and
              auto-refactors patterns.
            </p>

            <h3 className="text-xl font-bold mt-8 mb-3">How It Works</h3>
            <MermaidDiagram chart={MERMAID_TECHDEBT} />

            <h3 className="text-xl font-bold mt-10 mb-3">Capabilities</h3>

            <h4 className="text-base font-bold mt-6 mb-2 text-[var(--text-primary)]">
              4.3.1 — Duplicate Field Prevention
            </h4>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              When a developer creates a new custom field, Shodh AI searches
              the{" "}
              <strong className="text-[var(--text-primary)]">
                entire org metadata
              </strong>{" "}
              for existing fields that serve the same purpose. Checks name
              similarity, data type, picklist values, and usage patterns. If
              &gt;85% match → PR blocked.
            </p>

            <PRComment
              tone="critical"
              tag="CRITICAL — Potential Duplicate Field"
            >
              <p>
                <strong className="text-[var(--text-primary)]">Field:</strong>{" "}
                <Code>Account.Customer_Status__c</Code>
              </p>
              <p>
                This appears to duplicate{" "}
                <Code>Account.Account_Status__c</Code>:
              </p>
              <p>
                • Name similarity: 87% &nbsp; • Both Picklist type &nbsp; • 4/5
                values identical
              </p>
              <p>
                <strong className="text-[var(--text-primary)]">
                  Existing field:
                </strong>{" "}
                Created 2023-04-15, used by 3 Flows, 2 Apex classes, 5 reports
              </p>
            </PRComment>

            <h4 className="text-base font-bold mt-6 mb-2 text-[var(--text-primary)]">
              4.3.2 — Orphan Node Discovery
            </h4>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              Builds a complete{" "}
              <strong className="text-[var(--text-primary)]">
                dependency graph
              </strong>{" "}
              of every metadata component. Identifies components with zero
              inbound references — dead fields, unused classes, abandoned
              Flows. Assigns confidence scores (80-100%).
            </p>

            <h4 className="text-base font-bold mt-6 mb-2 text-[var(--text-primary)]">
              4.3.3 — Architecture Enforcement
            </h4>
            <TableWrap>
              <thead>
                <tr>
                  <Th>Rule</Th>
                  <Th>What It Blocks</Th>
                  <Th>Why</Th>
                </tr>
              </thead>
              <tbody>
                <Tr>
                  <Td>No simple triggers</Td>
                  <Td>Inline trigger logic</Td>
                  <Td>Must use handler pattern or Flow</Td>
                </Tr>
                <Tr>
                  <Td>No hardcoded IDs</Td>
                  <Td>
                    <Code>Id profileId = &apos;00e...&apos;</Code>
                  </Td>
                  <Td>Breaks across environments</Td>
                </Tr>
                <Tr>
                  <Td>No empty test asserts</Td>
                  <Td>Tests without assertions</Td>
                  <Td>False confidence — tests nothing</Td>
                </Tr>
                <Tr>
                  <Td>Separation of concerns</Td>
                  <Td>Logic in trigger body</Td>
                  <Td>Use service/handler classes</Td>
                </Tr>
                <Tr>
                  <Td>Error handling</Td>
                  <Td>
                    Bare <Code>try/catch</Code> blocks
                  </Td>
                  <Td>Swallowed exceptions hide bugs</Td>
                </Tr>
              </tbody>
            </TableWrap>

            <h4 className="text-base font-bold mt-6 mb-2 text-[var(--text-primary)]">
              4.3.4 — Autonomous Cleanup
            </h4>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              Auto-generates <Code>destructiveChanges.xml</Code> deployment
              packages for confirmed orphan metadata. Ready to deploy — just
              review and ship.
            </p>

            <h4 className="text-base font-bold mt-6 mb-2 text-[var(--text-primary)]">
              4.3.5 — Apex Bulkification
            </h4>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              Detects single-record patterns in Apex and{" "}
              <strong className="text-[var(--text-primary)]">
                autonomously refactors
              </strong>{" "}
              into bulk-safe logic using Maps, Sets, and Lists. Pushes
              refactored code as a fix commit, verified by the{" "}
              <a
                href="#m3"
                className="text-[var(--accent-light)] hover:underline"
              >
                Verification Protocol
              </a>
              .
            </p>

            <h4 className="text-base font-bold mt-6 mb-2 text-[var(--text-primary)]">
              4.3.6 — Business Logic Enforcement
            </h4>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              Every PR checked against org-specific business rules: naming
              conventions, validation standards, approval process policies,
              state machine transitions — all machine-enforced.
            </p>

            <h4 className="text-base font-bold mt-6 mb-2 text-[var(--text-primary)]">
              4.3.7 — Best Practice Maintenance
            </h4>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              Every push verified for: <Code>with sharing</Code> usage,
              CRUD/FLS checks, test coverage thresholds, async patterns,
              collection efficiency, SOQL pagination.
            </p>

            <Callout tone="blue" title="Why This Matters">
              A typical enterprise org has{" "}
              <strong className="text-[var(--text-primary)]">
                30-40% redundant metadata
              </strong>
              . Shodh AI prevents new debt, remediates existing debt, and saves
              10+ hours per developer per month through automated refactoring.
            </Callout>
          </section>

          {/* ===== Module 3: QA ===== */}
          <section
            id="m3"
            className="py-10 border-b border-[var(--border-default)]"
          >
            <SectionLabel tone="green">Module 03</SectionLabel>
            <h2 className="text-3xl font-extrabold tracking-tight mb-3">
              Autonomous QA
            </h2>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              Self-healing tests, automated video evidence, intelligent data
              seeding, and mathematical verification of business logic
              correctness.
            </p>

            <h3 className="text-xl font-bold mt-8 mb-3">How It Works</h3>
            <MermaidDiagram chart={MERMAID_QA} />

            <h3 className="text-xl font-bold mt-10 mb-3">Capabilities</h3>

            <h4 className="text-base font-bold mt-6 mb-2 text-[var(--text-primary)]">
              5.3.1 — Self-Healing UI Tests
            </h4>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              <strong className="text-[var(--text-primary)]">
                The problem:
              </strong>{" "}
              Salesforce releases 3 major updates/year. Each can change CSS
              class names and DOM structure. Every UI test breaks — even though
              the app works fine. QA teams spend 2-4 weeks per release fixing
              selectors.
            </p>
            <p className="text-[var(--text-secondary)] leading-relaxed mt-2">
              <strong className="text-[var(--text-primary)]">
                The solution:
              </strong>{" "}
              When a selector fails, Shodh AI takes a{" "}
              <strong className="text-[var(--text-primary)]">screenshot</strong>{" "}
              and uses Vision AI to locate the element visually (by button
              text, position, appearance). The selector is auto-updated and the
              test continues.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
              <div className="stat-card border-l-4 border-emerald-500">
                <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 mb-1">
                  Test Maintenance
                </div>
                <div className="text-3xl font-extrabold text-emerald-400 tracking-tight mb-1">
                  -90%
                </div>
                <div className="text-xs text-[var(--text-muted)]">
                  Reduction in test maintenance effort
                </div>
              </div>
              <div className="stat-card border-l-4 border-indigo-500">
                <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-400 mb-1">
                  SF Release Impact
                </div>
                <div className="text-3xl font-extrabold text-indigo-400 tracking-tight mb-1">
                  0 days
                </div>
                <div className="text-xs text-[var(--text-muted)]">
                  Downtime from selector breakage
                </div>
              </div>
            </div>

            <h4 className="text-base font-bold mt-6 mb-2 text-[var(--text-primary)]">
              5.3.2 — Video Logs
            </h4>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              Every test execution auto-recorded as video. Shows every click,
              keystroke, page navigation, and data verification. Serves as{" "}
              <strong className="text-[var(--text-primary)]">
                irrefutable audit evidence
              </strong>{" "}
              for SOX, HIPAA, SOC2 compliance.
            </p>

            <h4 className="text-base font-bold mt-6 mb-2 text-[var(--text-primary)]">
              5.3.3 — Smart Data Seeding
            </h4>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              Generates the{" "}
              <strong className="text-[var(--text-primary)]">
                minimal viable dataset
              </strong>{" "}
              per test — respecting required fields, lookup relationships,
              validation rules, and picklist values. Records auto-cleaned after
              test. Zero sandbox bloat.
            </p>
            <p className="text-[var(--text-secondary)] leading-relaxed mt-2">
              <em>Example:</em> To test Opportunity closure → generates 1
              Account + 1 Contact + 1 Opportunity + 1 LineItem. Total: 4
              records. Created in 2 seconds. Auto-cleaned.
            </p>

            <h4 className="text-base font-bold mt-6 mb-2 text-[var(--text-primary)]">
              5.3.4 — Verification Protocol
            </h4>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              When Shodh AI refactors code, the protocol{" "}
              <strong className="text-[var(--text-primary)]">
                mathematically proves
              </strong>{" "}
              the refactored version produces identical output for all possible
              inputs. Zero tolerance — even one divergence rejects the
              refactoring.
            </p>

            <Callout tone="green" title="Why This Matters">
              Tests fix themselves. Data seeds itself. Code correctness is{" "}
              <strong className="text-[var(--text-primary)]">
                mathematically guaranteed
              </strong>
              . Video evidence satisfies auditors without manual documentation.
            </Callout>
          </section>

          {/* ===== Module 4: Dev XP ===== */}
          <section
            id="m4"
            className="py-10 border-b border-[var(--border-default)]"
          >
            <SectionLabel tone="orange">Module 04</SectionLabel>
            <h2 className="text-3xl font-extrabold tracking-tight mb-3">
              Developer Experience
            </h2>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              Embeds intelligence directly into the IDE, Slack, and Jira — no
              context-switching required.
            </p>

            <h3 className="text-xl font-bold mt-8 mb-3">How It Works</h3>
            <MermaidDiagram chart={MERMAID_DEVXP} />

            <h3 className="text-xl font-bold mt-10 mb-3">Capabilities</h3>

            <h4 className="text-base font-bold mt-6 mb-2 text-[var(--text-primary)]">
              6.3.1 — IDE Integration: Blast Radius Preview
            </h4>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              Inside Cursor/VSCode, see the{" "}
              <strong className="text-[var(--text-primary)]">
                complete impact
              </strong>{" "}
              of any change before saving. Modify a field? Instantly see every
              Flow, Apex class, Report, Validation Rule, Page Layout, and
              integration that references it.
            </p>

            <PRComment
              tone="warning"
              tag="BLAST RADIUS — Account.Customer_Rating__c"
            >
              <p>Renaming this field will break:</p>
              <p>
                •{" "}
                <strong className="text-[var(--text-primary)]">
                  Flow &quot;Lead Scoring&quot;
                </strong>{" "}
                — reads field at Decision Node 3
              </p>
              <p>
                •{" "}
                <strong className="text-[var(--text-primary)]">
                  Apex &quot;AccountService&quot;
                </strong>{" "}
                — queries field at line 47
              </p>
              <p>
                •{" "}
                <strong className="text-[var(--text-primary)]">
                  Report &quot;Top Accounts&quot;
                </strong>{" "}
                — filters on this field
              </p>
              <p>
                •{" "}
                <strong className="text-[var(--text-primary)]">
                  Page Layout &quot;Account Layout&quot;
                </strong>{" "}
                — displays this field
              </p>
              <p>
                <strong className="text-[var(--text-primary)]">
                  Total impact: 4 components will break
                </strong>
              </p>
            </PRComment>

            <h4 className="text-base font-bold mt-6 mb-2 text-[var(--text-primary)]">
              6.3.2 — Slack Bot
            </h4>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              Ask plain-English questions in Slack. Shodh AI responds with
              graph-backed answers:
            </p>
            <TableWrap>
              <thead>
                <tr>
                  <Th>Question</Th>
                  <Th>Response</Th>
                </tr>
              </thead>
              <tbody>
                <Tr>
                  <Td>
                    &quot;Which Flows reference Account.Status__c?&quot;
                  </Td>
                  <Td>
                    Lists all 5 Flows with names, versions, and which nodes
                    reference the field
                  </Td>
                </Tr>
                <Tr>
                  <Td>
                    &quot;What happens when a Lead is converted?&quot;
                  </Td>
                  <Td>
                    Full execution trace: triggers → flows → process builders →
                    field updates
                  </Td>
                </Tr>
                <Tr>
                  <Td>&quot;Who can see Contact.SSN__c?&quot;</Td>
                  <Td>
                    Lists profiles and permission sets with field-level read
                    access
                  </Td>
                </Tr>
                <Tr>
                  <Td>
                    &quot;What would break if I delete
                    OpportunityLineItem?&quot;
                  </Td>
                  <Td>Full dependency analysis across all metadata types</Td>
                </Tr>
              </tbody>
            </TableWrap>

            <h4 className="text-base font-bold mt-6 mb-2 text-[var(--text-primary)]">
              6.3.3 — Jira Alignment
            </h4>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              Reads Jira acceptance criteria and verifies the PR actually
              implements what was specified. Catches requirement gaps at code
              review time — not UAT.
            </p>

            <Callout tone="blue" title="Why This Matters">
              Eliminates context-switching. Developers get org intelligence{" "}
              <strong className="text-[var(--text-primary)]">
                where they already work
              </strong>{" "}
              — IDE, Slack, Jira. New team members become productive in days
              instead of weeks.
            </Callout>
          </section>

          {/* ===== Module 5: Enterprise ===== */}
          <section
            id="m5"
            className="py-10 border-b border-[var(--border-default)]"
          >
            <SectionLabel tone="pink">Module 05</SectionLabel>
            <h2 className="text-3xl font-extrabold tracking-tight mb-3">
              Enterprise Use Cases
            </h2>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              Purpose-built capabilities for M&amp;A, compliance, integration
              governance, production monitoring, and legacy modernization.
            </p>

            <h3 className="text-xl font-bold mt-8 mb-3">How It Works</h3>
            <MermaidDiagram chart={MERMAID_ENTERPRISE} />

            <h3 className="text-xl font-bold mt-10 mb-3">Capabilities</h3>

            <h4 className="text-base font-bold mt-6 mb-2 text-[var(--text-primary)]">
              7.3.1 — M&amp;A Org Merge Mapping
            </h4>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              Connects to both Salesforce orgs, extracts full metadata, and
              produces a{" "}
              <strong className="text-[var(--text-primary)]">
                complete overlap report
              </strong>
              : identical components, conflicts, unique items, and estimated
              merge effort.
            </p>

            <TableWrap>
              <thead>
                <tr>
                  <Th>Component</Th>
                  <Th>Org A</Th>
                  <Th>Org B</Th>
                  <Th>Status</Th>
                  <Th>Action</Th>
                </tr>
              </thead>
              <tbody>
                <Tr>
                  <Td>
                    <Code>Account.Revenue__c</Code>
                  </Td>
                  <Td>Currency</Td>
                  <Td>Currency</Td>
                  <Td>Identical</Td>
                  <Td>Keep one</Td>
                </Tr>
                <Tr>
                  <Td>
                    <Code>Account.Status__c</Code>
                  </Td>
                  <Td>Picklist (5)</Td>
                  <Td>Picklist (8)</Td>
                  <Td>Conflict</Td>
                  <Td>Merge values</Td>
                </Tr>
                <Tr>
                  <Td>
                    <Code>LeadScoring</Code> Flow
                  </Td>
                  <Td>Active</Td>
                  <Td>N/A</Td>
                  <Td>Unique to A</Td>
                  <Td>Migrate</Td>
                </Tr>
                <Tr>
                  <Td>
                    <Code>AccountTrigger</Code>
                  </Td>
                  <Td>Handler pattern</Td>
                  <Td>Inline</Td>
                  <Td>Conflict</Td>
                  <Td>Use Org A</Td>
                </Tr>
              </tbody>
            </TableWrap>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              <strong className="text-[var(--text-primary)]">Impact:</strong>{" "}
              M&amp;A due-diligence reduced from{" "}
              <strong className="text-[var(--text-primary)]">
                months to days
              </strong>
              .
            </p>

            <h4 className="text-base font-bold mt-6 mb-2 text-[var(--text-primary)]">
              7.3.2 — Security Audits
            </h4>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              Traces every access path from any user to any field: Profiles →
              Permission Sets → Permission Set Groups → Sharing Rules → OWD.
              Generates{" "}
              <strong className="text-[var(--text-primary)]">
                compliance-ready reports
              </strong>{" "}
              for SOX, HIPAA, GDPR, SOC2.
            </p>

            <h4 className="text-base font-bold mt-6 mb-2 text-[var(--text-primary)]">
              7.3.3 — API Contract Guardian
            </h4>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              Maintains a registry of fields consumed by external systems. Any
              PR that modifies or deletes a contracted field is{" "}
              <strong className="text-[var(--text-primary)]">
                auto-blocked
              </strong>{" "}
              with the integration owner notified.
            </p>

            <PRComment tone="critical" tag="API CONTRACT VIOLATION">
              <p>
                <Code>Account.Revenue__c</Code> is consumed by{" "}
                <strong className="text-[var(--text-primary)]">
                  SAP ERP Integration
                </strong>
                .
              </p>
              <p>
                Contact: <Code>integration-team@company.com</Code>
              </p>
              <p>
                This field cannot be modified without integration owner
                approval.
              </p>
            </PRComment>

            <h4 className="text-base font-bold mt-6 mb-2 text-[var(--text-primary)]">
              7.3.4 — Synthetic Monitoring
            </h4>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              Runs lightweight, non-destructive test scenarios against{" "}
              <strong className="text-[var(--text-primary)]">Production</strong>{" "}
              every 15 minutes. Verifies critical business processes work.
              Alerts via Slack + auto-creates Jira incident on failure.
            </p>

            <h4 className="text-base font-bold mt-6 mb-2 text-[var(--text-primary)]">
              7.3.5 — Legacy Migration (Workflow Rules → Flows)
            </h4>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              Autonomously translates retiring Workflow Rules into modern Flow
              equivalents — preserving all conditions, field updates, email
              alerts, and outbound messages. Behavioral equivalence verified by
              the Verification Protocol.
            </p>

            <Callout tone="blue" title="Why This Matters">
              M&amp;A due-diligence: months → days. Security audits: weeks →
              minutes. Integration breakages: eliminated. Legacy migration:
              automated. No consultants required.
            </Callout>
          </section>

          {/* ===== Capability Matrix ===== */}
          <section
            id="matrix"
            className="py-10 border-b border-[var(--border-default)]"
          >
            <SectionLabel tone="gray">Reference</SectionLabel>
            <h2 className="text-3xl font-extrabold tracking-tight mb-3">
              Complete Capability Matrix
            </h2>

            <TableWrap>
              <thead>
                <tr>
                  <Th>#</Th>
                  <Th>Module</Th>
                  <Th>Capability</Th>
                  <Th>What It Does</Th>
                  <Th>Primary Benefit</Th>
                </tr>
              </thead>
              <tbody>
                {[
                  [
                    "1",
                    "Limit Firewall",
                    "SOQL/DML Loop Prevention",
                    "Blocks database queries inside loops at PR level",
                    "Eliminates #1 limit breach cause",
                  ],
                  [
                    "2",
                    "Limit Firewall",
                    "CPU Timeout Detection",
                    "Profiles Apex/Flows for CPU time estimation",
                    "Prevents timeout errors",
                  ],
                  [
                    "3",
                    "Limit Firewall",
                    "Data Skew Detection",
                    "Flags row-locking patterns before deployment",
                    "Prevents lock errors at scale",
                  ],
                  [
                    "4",
                    "Limit Firewall",
                    "API Limit Enforcement",
                    "Validates outbound callout counts",
                    "Prevents integration failures",
                  ],
                  [
                    "5",
                    "Tech Debt",
                    "Duplicate Field Prevention",
                    "Blocks redundant custom field creation",
                    "30-40% less metadata bloat",
                  ],
                  [
                    "6",
                    "Tech Debt",
                    "Orphan Node Discovery",
                    "Finds dead metadata safe for deletion",
                    "Clean, performant org",
                  ],
                  [
                    "7",
                    "Tech Debt",
                    "Architecture Enforcement",
                    "Auto-reject non-compliant patterns",
                    "Consistent architecture",
                  ],
                  [
                    "8",
                    "Tech Debt",
                    "Autonomous Cleanup",
                    "Auto-generate deletion XML packages",
                    "Zero manual cleanup",
                  ],
                  [
                    "9",
                    "Tech Debt",
                    "Apex Bulkification",
                    "Auto-refactor to bulk-safe code",
                    "Scalable, limit-safe code",
                  ],
                  [
                    "10",
                    "Tech Debt",
                    "Business Logic Enforcement",
                    "Check PRs against business rules",
                    "Domain policy compliance",
                  ],
                  [
                    "11",
                    "Tech Debt",
                    "Best Practice Maintenance",
                    "Every push checked for best practices",
                    "Consistent code quality",
                  ],
                  [
                    "12",
                    "QA",
                    "Self-Healing UI Tests",
                    "Vision AI fixes broken selectors",
                    "90% less test maintenance",
                  ],
                  [
                    "13",
                    "QA",
                    "Video Logs",
                    "Auto-record every test execution",
                    "Audit-ready evidence",
                  ],
                  [
                    "14",
                    "QA",
                    "Smart Data Seeding",
                    "Generate minimal test records",
                    "50% fewer sandbox refreshes",
                  ],
                  [
                    "15",
                    "QA",
                    "Verification Protocol",
                    "Mathematically prove code equivalence",
                    "Zero regressions",
                  ],
                  [
                    "16",
                    "Dev XP",
                    "IDE Blast Radius",
                    "Show all dependencies in real-time",
                    "80% fewer side effects",
                  ],
                  [
                    "17",
                    "Dev XP",
                    "Slack Bot",
                    "Natural language org queries",
                    "Hours saved weekly",
                  ],
                  [
                    "18",
                    "Dev XP",
                    "Jira Alignment",
                    "Verify PR meets acceptance criteria",
                    "Requirement traceability",
                  ],
                  [
                    "19",
                    "Enterprise",
                    "M&A Org Merge Mapping",
                    "Compare orgs, map overlap",
                    "Months → days",
                  ],
                  [
                    "20",
                    "Enterprise",
                    "Security Audits",
                    "Trace user access across profiles",
                    "SOX/HIPAA/GDPR compliant",
                  ],
                  [
                    "21",
                    "Enterprise",
                    "API Contract Guardian",
                    "Block integration-breaking changes",
                    "Zero breaking deploys",
                  ],
                  [
                    "22",
                    "Enterprise",
                    "Synthetic Monitoring",
                    "24/7 production health tests",
                    "Detect outages in minutes",
                  ],
                  [
                    "23",
                    "Enterprise",
                    "Legacy Migration",
                    "Auto-convert Workflows → Flows",
                    "Automated modernization",
                  ],
                ].map((row) => (
                  <Tr key={row[0]}>
                    <Td>{row[0]}</Td>
                    <Td>{row[1]}</Td>
                    <Td>
                      <strong className="text-[var(--text-primary)]">
                        {row[2]}
                      </strong>
                    </Td>
                    <Td>{row[3]}</Td>
                    <Td>{row[4]}</Td>
                  </Tr>
                ))}
              </tbody>
            </TableWrap>
          </section>

          {/* ===== ROI ===== */}
          <section
            id="roi"
            className="py-10 border-b border-[var(--border-default)]"
          >
            <SectionLabel tone="gray">Business Case</SectionLabel>
            <h2 className="text-3xl font-extrabold tracking-tight mb-3">
              Business Impact &amp; ROI
            </h2>

            <h3 className="text-xl font-bold mt-8 mb-3">Time Savings</h3>
            <TableWrap>
              <thead>
                <tr>
                  <Th>Activity</Th>
                  <Th>Without Shodh AI</Th>
                  <Th>With Shodh AI</Th>
                  <Th>Savings</Th>
                </tr>
              </thead>
              <tbody>
                <Tr>
                  <Td>Code review (limit checks)</Td>
                  <Td>2-4 hours/PR</Td>
                  <Td>Automated (0 min)</Td>
                  <Td>~3 hrs/PR</Td>
                </Tr>
                <Tr>
                  <Td>Finding field dependencies</Td>
                  <Td>30-60 min/field</Td>
                  <Td>Instant (IDE preview)</Td>
                  <Td>~45 min/field</Td>
                </Tr>
                <Tr>
                  <Td>Fixing broken UI tests post-release</Td>
                  <Td>2-4 weeks/year</Td>
                  <Td>Self-healed (0 days)</Td>
                  <Td>~3 weeks/yr</Td>
                </Tr>
                <Tr>
                  <Td>Creating test data</Td>
                  <Td>1-2 hrs/suite</Td>
                  <Td>Auto-generated (sec)</Td>
                  <Td>~1.5 hrs/suite</Td>
                </Tr>
                <Tr>
                  <Td>Security audit preparation</Td>
                  <Td>2-4 weeks/audit</Td>
                  <Td>Minutes (auto report)</Td>
                  <Td>~3 weeks/audit</Td>
                </Tr>
                <Tr>
                  <Td>M&amp;A org comparison</Td>
                  <Td>2-6 months</Td>
                  <Td>Days (auto mapping)</Td>
                  <Td>Months</Td>
                </Tr>
                <Tr>
                  <Td>Workflow → Flow migration</Td>
                  <Td>2-4 hrs/rule</Td>
                  <Td>Automated (minutes)</Td>
                  <Td>~3 hrs/rule</Td>
                </Tr>
                <Tr>
                  <Td>Org architecture questions</Td>
                  <Td>15-60 min (manual)</Td>
                  <Td>Seconds (Slack bot)</Td>
                  <Td>~30 min/question</Td>
                </Tr>
              </tbody>
            </TableWrap>

            <h3 className="text-xl font-bold mt-10 mb-3">Risk Reduction</h3>
            <TableWrap>
              <thead>
                <tr>
                  <Th>Risk</Th>
                  <Th>Without Shodh AI</Th>
                  <Th>With Shodh AI</Th>
                </tr>
              </thead>
              <tbody>
                <Tr>
                  <Td>Governor limit outages</Td>
                  <Td>5-15 per year</Td>
                  <Td>
                    <strong className="text-emerald-400">Near zero</strong>
                  </Td>
                </Tr>
                <Tr>
                  <Td>Integration breakages</Td>
                  <Td>2-5 per quarter</Td>
                  <Td>
                    <strong className="text-emerald-400">Zero</strong>
                  </Td>
                </Tr>
                <Tr>
                  <Td>Refactoring regressions</Td>
                  <Td>Unknown (silent)</Td>
                  <Td>
                    <strong className="text-emerald-400">Zero</strong>{" "}
                    (verified)
                  </Td>
                </Tr>
                <Tr>
                  <Td>Compliance audit failures</Td>
                  <Td>Possible</Td>
                  <Td>
                    <strong className="text-emerald-400">Eliminated</strong>
                  </Td>
                </Tr>
                <Tr>
                  <Td>Undetected production outages</Td>
                  <Td>Hours</Td>
                  <Td>
                    <strong className="text-emerald-400">
                      &lt;15 minutes
                    </strong>
                  </Td>
                </Tr>
              </tbody>
            </TableWrap>

            <h3 className="text-xl font-bold mt-10 mb-3">Key Metrics</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 my-6">
              {[
                {
                  label: "Production Incidents",
                  value: "-95%",
                  desc: "Governor limit related incidents",
                  color: "text-emerald-400",
                },
                {
                  label: "PR Review Speed",
                  value: "∞",
                  desc: "Unlimited automated reviews per day",
                  color: "text-indigo-400",
                },
                {
                  label: "Metadata Bloat",
                  value: "-40%",
                  desc: "Reduction in redundant metadata",
                  color: "text-violet-400",
                },
                {
                  label: "Test Maintenance",
                  value: "-90%",
                  desc: "Self-healing test maintenance",
                  color: "text-amber-400",
                },
                {
                  label: "M&A Due Diligence",
                  value: "10x",
                  desc: "Faster org merge analysis",
                  color: "text-pink-400",
                },
                {
                  label: "Onboarding Time",
                  value: "-70%",
                  desc: "New developer ramp-up time",
                  color: "text-slate-300",
                },
              ].map((m) => (
                <div key={m.label} className="stat-card">
                  <div
                    className={`text-[11px] font-bold uppercase tracking-wider mb-1 ${m.color}`}
                  >
                    {m.label}
                  </div>
                  <div
                    className={`text-3xl font-extrabold tracking-tight mb-1 ${m.color}`}
                  >
                    {m.value}
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">
                    {m.desc}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Footer */}
          <footer className="text-center py-10 text-xs text-[var(--text-muted)]">
            <p>
              <strong className="text-[var(--text-secondary)]">Shodh AI</strong>{" "}
              — The Autonomous Salesforce Governance Platform
            </p>
            <p className="mt-1">
              Confidential — For Internal &amp; Client Presentation Use &nbsp;
              |&nbsp; © 2026 Shodh AI
            </p>
          </footer>
        </main>
      </div>

      {/* Mermaid CDN script */}
      <Script
        src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"
        strategy="afterInteractive"
      />

      {/* Page-scoped styles */}
      <style jsx global>{`
        /* Mermaid diagram tweaks for dark theme readability */
        .platform-audit-root .mermaid svg {
          max-width: 100%;
          height: auto;
        }
        .platform-audit-root .mermaid .edgeLabel {
          color: #e2e8f0 !important;
        }
        .platform-audit-root .mermaid .edgeLabel rect {
          fill: #1e293b !important;
        }
        .platform-audit-root .mermaid .cluster rect {
          fill: #0f172a !important;
          stroke: #334155 !important;
        }
        .platform-audit-root .mermaid .cluster .nodeLabel,
        .platform-audit-root .mermaid .cluster text {
          fill: #cbd5e1 !important;
          color: #cbd5e1 !important;
        }

        /* Smooth anchor scrolling, offset for sticky headers */
        html {
          scroll-behavior: smooth;
        }
        .platform-audit-root section[id] {
          scroll-margin-top: 7rem;
        }

        @media print {
          aside,
          .audit-page-header,
          .audit-anchor-nav {
            display: none !important;
          }
          body,
          html {
            background: #ffffff !important;
            color: #1a1a2e !important;
          }
          .platform-audit-root,
          .platform-audit-root main,
          .platform-audit-root .audit-main {
            background: #ffffff !important;
            color: #1a1a2e !important;
            max-width: 100% !important;
            padding: 1rem !important;
          }
          .platform-audit-root section {
            page-break-inside: avoid;
          }
          .platform-audit-root h1 {
            font-size: 28px !important;
          }
          .platform-audit-root h2 {
            font-size: 22px !important;
          }
          .platform-audit-root .mermaid svg {
            max-width: 100% !important;
          }
        }
      `}</style>
    </div>
  );
}
