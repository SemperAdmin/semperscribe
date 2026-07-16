import React from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  BookOpen,
  FileText,
  FileUp,
  Landmark,
  Layers,
  Lock,
  MonitorDown,
  Paperclip,
  Radio,
  ShieldCheck,
  Stamp,
  Undo2,
  Wand2,
} from 'lucide-react';

interface LandingPageProps {
  /** Starts a document of the given type (same path as the sidebar). */
  onSelectType?: (type: string) => void;
}

const QUICK_STARTS = [
  { type: 'basic', icon: FileText, name: 'Standard Naval Letter', blurb: 'The workhorse of official correspondence' },
  { type: 'endorsement', icon: Stamp, name: 'Endorsement', blurb: 'Route a package up or down the chain' },
  { type: 'mfr', icon: BookOpen, name: 'Memo for the Record', blurb: 'Document a call or decision for the file' },
  { type: 'amhs', icon: Radio, name: 'AMHS Message', blurb: 'GENADMIN with wrapping and DTG built in' },
];

const FEATURES = [
  {
    icon: BadgeCheck,
    title: 'Compliance engine',
    body: 'Live validation against SECNAV M-5216.5 and MCO 5215.1K while you type - reference citations, paragraph structure, window-envelope rules. Hard violations block export before they reach a reviewer.',
  },
  {
    icon: ShieldCheck,
    title: 'Classification markings',
    body: 'Banner lines, CUI designation block, and per-paragraph portion markings on every page of PDF and DOCX output - with consistency validation that flags a portion exceeding the banner.',
  },
  {
    icon: Lock,
    title: 'Encrypted sharing',
    body: 'Share links are AES-256 encrypted in your browser with a password and optional expiry. The payload never touches a server log, and the password travels separately.',
  },
  {
    icon: Layers,
    title: 'Library and auto backup',
    body: 'Every draft saves to an on-device library - search, rename, duplicate, no cap. Point auto backup at a folder and each save mirrors a portable file that re-imports anywhere.',
  },
  {
    icon: MonitorDown,
    title: 'Installs and works offline',
    body: 'Install as a desktop app and keep working with zero connectivity - author, validate, and export in disconnected spaces. Nothing ever leaves your machine.',
  },
  {
    icon: Wand2,
    title: 'Power tools',
    body: 'Batch-generate one PDF per row of a CSV into a single ZIP. Import an existing Word or PDF letter and it reformats with the type auto-detected. Find and replace, undo across every edit, reusable clauses, and a searchable reference library.',
  },
];

const WORKFLOW = [
  { step: '1', title: 'Pick a type', body: '25 document types from the sidebar - letters, directives, staffing papers, forms, messages.' },
  { step: '2', title: 'Fill guided sections', body: 'Unit lookup, profile auto-fill, reference suggestions, clause inserts.' },
  { step: '3', title: 'Validate live', body: 'The preview and compliance banner update as you type. Fix issues before anyone kicks it back.' },
  { step: '4', title: 'Export or share', body: 'Formatted PDF or DOCX, merged enclosures, batch runs, or an encrypted share link.' },
];

export function LandingPage({ onSelectType }: LandingPageProps) {
  return (
    <div className="max-w-5xl mx-auto space-y-10 py-8 animate-in fade-in duration-700">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-secondary via-secondary to-primary/40 px-8 py-12 text-center shadow-lg">
        <div className="relative space-y-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-primary-foreground/60">
            Semper Admin Suite
          </p>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-primary font-headline">
            Semper Scribe
          </h1>
          <p className="text-lg md:text-xl text-primary-foreground/90 max-w-2xl mx-auto">
            Naval correspondence, formatted to standard and validated as you type.
            You bring the content - the formatting, citations, and compliance checks are handled.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            {['25 document types', 'SECNAV M-5216.5 aligned', 'Live compliance checks', '100% on-device - no server'].map((chip) => (
              <span
                key={chip}
                className="rounded-full border border-primary-foreground/20 bg-primary-foreground/10 px-3 py-1 text-xs font-medium text-primary-foreground/90"
              >
                {chip}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Quick start */}
      <section aria-labelledby="quick-start-heading" className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 id="quick-start-heading" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Start something
          </h2>
          <span className="text-xs text-muted-foreground">Every type lives in the sidebar</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {QUICK_STARTS.map(({ type, icon: Icon, name, blurb }) => (
            <button
              key={type}
              type="button"
              onClick={() => onSelectType?.(type)}
              disabled={!onSelectType}
              className="group rounded-xl border border-border bg-card p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-ring disabled:pointer-events-none"
            >
              <div className="flex items-center justify-between">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
              <p className="mt-3 text-sm font-semibold text-foreground">{name}</p>
              <p className="mt-1 text-xs text-muted-foreground">{blurb}</p>
            </button>
          ))}
        </div>
      </section>

      {/* Workflow */}
      <section aria-labelledby="workflow-heading" className="space-y-3">
        <h2 id="workflow-heading" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          How it works
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {WORKFLOW.map(({ step, title, body }) => (
            <div key={step} className="rounded-xl border border-border bg-card/60 p-4">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {step}
                </span>
                <p className="text-sm font-semibold text-foreground">{title}</p>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Capabilities */}
      <section aria-labelledby="capabilities-heading" className="space-y-3">
        <h2 id="capabilities-heading" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Built in
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </span>
                <h3 className="text-sm font-semibold text-foreground">{title}</h3>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Coverage strip */}
      <section aria-label="Document coverage" className="rounded-xl border border-border bg-muted/30 px-5 py-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" /> Letters, endorsements, memorandums</span>
          <span className="flex items-center gap-1.5"><Landmark className="h-3.5 w-3.5" /> Directives (MCO, MCBul, SECNAV)</span>
          <span className="flex items-center gap-1.5"><Layers className="h-3.5 w-3.5" /> Staffing and decision papers</span>
          <span className="flex items-center gap-1.5"><Paperclip className="h-3.5 w-3.5" /> Forms (NAVMC 10274, Page 11)</span>
          <span className="flex items-center gap-1.5"><Radio className="h-3.5 w-3.5" /> AMHS messages</span>
          <span className="flex items-center gap-1.5"><FileUp className="h-3.5 w-3.5" /> Word/PDF import</span>
          <span className="flex items-center gap-1.5"><Undo2 className="h-3.5 w-3.5" /> Full undo history</span>
        </div>
      </section>

      {/* Disclaimers - compact, complete */}
      <section
        aria-labelledby="disclaimer-heading"
        className="rounded-xl border-l-4 border-l-amber-500 border border-border bg-amber-50/60 dark:bg-amber-950/20 px-5 py-4"
      >
        <h2 id="disclaimer-heading" className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4" /> Important Disclaimers
        </h2>
        <div className="mt-2 space-y-1.5 text-xs leading-relaxed text-amber-800/90 dark:text-amber-200/90">
          <p><strong>UNCLASSIFIED USE ONLY:</strong> This tool is strictly for processing UNCLASSIFIED information. Do not input, process, or store Classified, CUI, or PII data on unauthorized systems.</p>
          <p><strong>VERIFICATION REQUIRED:</strong> While Semper Scribe automates formatting, the final content is the responsibility of the originator. Always verify references and administrative details against current directives.</p>
          <p><strong>BROWSER COMPATIBILITY:</strong> Optimized for modern browsers. Some legacy systems may experience rendering issues.</p>
        </div>
      </section>

      <p className="pb-4 text-center text-sm text-muted-foreground">
        Pick a document type from the sidebar - or use a quick start above.
      </p>
    </div>
  );
}
