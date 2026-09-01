"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { FilePlus, FileText, GripVertical, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  createDocument,
  deleteDocument,
  reorderDocuments,
  updateDocument,
} from "@/actions/documents";
import { formatHebrewShortDate } from "@/lib/dates";
import type { DocumentRecord } from "@/lib/types";
import { DocumentEditor } from "@/components/notes/document-editor";
import { PageHeader, Surface } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Draft = {
  title: string;
  content: string;
  savedTitle: string;
  savedContent: string;
};

function draftFrom(document: DocumentRecord): Draft {
  return {
    title: document.title,
    content: document.content,
    savedTitle: document.title,
    savedContent: document.content,
  };
}

function isDirty(draft: Draft) {
  return draft.title !== draft.savedTitle || draft.content !== draft.savedContent;
}

function textPreview(html: string) {
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.slice(0, 72);
}

export function NotesView({ documents }: { documents: DocumentRecord[] }) {
  const [order, setOrder] = useState(documents.map((document) => document.id));
  const [selectedId, setSelectedId] = useState<string | null>(documents[0]?.id ?? null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [saveLabel, setSaveLabel] = useState("נשמר");
  const [docQuery, setDocQuery] = useState("");
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(documents.map((document) => [document.id, draftFrom(document)])),
  );

  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;
  const savingRef = useRef<Set<string>>(new Set());
  const retrySaveRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setOrder((current) => {
      const incoming = documents.map((document) => document.id);
      const stillThere = current.filter((id) => incoming.includes(id));
      const added = incoming.filter((id) => !stillThere.includes(id));
      return [...added, ...stillThere];
    });
    setDrafts((current) => {
      const next = { ...current };
      const incoming = new Set(documents.map((document) => document.id));
      for (const document of documents) {
        if (!next[document.id]) next[document.id] = draftFrom(document);
      }
      for (const id of Object.keys(next)) {
        if (!incoming.has(id)) delete next[id];
      }
      return next;
    });
  }, [documents]);

  const orderedDocuments = useMemo(() => {
    const byId = new Map(documents.map((document) => [document.id, document]));
    return order
      .map((id) => byId.get(id))
      .filter((document): document is DocumentRecord => Boolean(document));
  }, [documents, order]);

  const visibleDocuments = useMemo(() => {
    const needle = docQuery.trim().toLowerCase();
    if (!needle) return orderedDocuments;
    return orderedDocuments.filter((document) => {
      const title = drafts[document.id]?.title ?? document.title;
      return title.toLowerCase().includes(needle);
    });
  }, [docQuery, drafts, orderedDocuments]);

  const selected =
    orderedDocuments.find((document) => document.id === selectedId) ?? null;
  const selectedDraft = selected ? drafts[selected.id] : undefined;
  const dirty = selectedDraft ? isDirty(selectedDraft) : false;

  const saveDraft = useCallback(async (id: string, opts?: { silent?: boolean }) => {
    const draft = draftsRef.current[id];
    if (!draft || !isDirty(draft)) return true;
    if (savingRef.current.has(id)) {
      retrySaveRef.current.add(id);
      return true;
    }
    savingRef.current.add(id);
    setSaveLabel("שומר...");
    const result = await updateDocument({
      id,
      title: draft.title,
      content: draft.content,
      revalidate: false,
    });
    savingRef.current.delete(id);
    if (!result.ok) {
      setSaveLabel("שמירה נכשלה");
      if (!opts?.silent) toast.error(result.error ?? "שמירה נכשלה");
      return false;
    }
    setDrafts((current) => {
      const latest = current[id];
      if (!latest) return current;
      if (latest.title !== draft.title || latest.content !== draft.content) return current;
      return {
        ...current,
        [id]: { ...latest, savedTitle: draft.title, savedContent: draft.content },
      };
    });
    const latest = draftsRef.current[id];
    const needsRetry =
      retrySaveRef.current.has(id) ||
      Boolean(latest && (latest.title !== draft.title || latest.content !== draft.content));
    retrySaveRef.current.delete(id);
    if (needsRetry) return saveDraft(id, opts);
    setSaveLabel("נשמר");
    return true;
  }, []);

  useEffect(() => {
    if (!selectedId || !dirty) return;
    const id = selectedId;
    setSaveLabel("לא נשמר");
    const timer = window.setTimeout(() => {
      void saveDraft(id, { silent: true });
    }, 800);
    return () => window.clearTimeout(timer);
  }, [selectedId, selectedDraft?.title, selectedDraft?.content, dirty, saveDraft]);

  const saveBeacon = useCallback(() => {
    const id = selectedId;
    if (!id) return false;
    const draft = draftsRef.current[id];
    if (!draft || !isDirty(draft)) return false;
    void fetch("/api/documents/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        title: draft.title,
        content: draft.content,
      }),
      keepalive: true,
    });
    return true;
  }, [selectedId]);

  useEffect(() => {
    const onLeave = (event: BeforeUnloadEvent) => {
      if (!saveBeacon()) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const onHide = () => {
      saveBeacon();
    };
    const onVisibility = () => {
      if (window.document.visibilityState === "hidden") onHide();
    };
    window.addEventListener("beforeunload", onLeave);
    window.addEventListener("pagehide", onHide);
    window.document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("beforeunload", onLeave);
      window.removeEventListener("pagehide", onHide);
      window.document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [saveBeacon]);

  function selectDocument(id: string) {
    if (id === selectedId) return;
    const previous = selectedId;
    setSelectedId(id);
    setSaveLabel(draftsRef.current[id] && isDirty(draftsRef.current[id]) ? "לא נשמר" : "נשמר");
    if (previous) void saveDraft(previous, { silent: true });
  }

  function onEditorChange(documentId: string, html: string) {
    setDrafts((current) => {
      const existing = current[documentId];
      if (!existing || existing.content === html) return current;
      return { ...current, [documentId]: { ...existing, content: html } };
    });
  }

  function create() {
    const previous = selectedId;
    startTransition(async () => {
      if (previous) await saveDraft(previous, { silent: true });
      const result = await createDocument({ title: "מסמך חדש", content: "" });
      if (!result.ok || !result.id) {
        toast.error(result.error ?? "יצירה נכשלה");
        return;
      }
      setDrafts((current) => ({
        ...current,
        [result.id!]: draftFrom({
          id: result.id!,
          title: "מסמך חדש",
          content: "",
          sortOrder: 0,
          updatedAt: new Date().toISOString(),
        }),
      }));
      setSelectedId(result.id);
    });
  }

  function save() {
    if (!selectedId) return;
    startTransition(async () => {
      const ok = await saveDraft(selectedId);
      if (ok) toast.success("המסמך נשמר");
    });
  }

  function remove() {
    if (!selected) return;
    if (!window.confirm(`למחוק את "${selectedDraft?.title ?? selected.title}"? המחיקה סופית ולא ניתן לשחזר מהמסך.`)) {
      return;
    }
    startTransition(async () => {
      const result = await deleteDocument(selected.id);
      if (!result.ok) {
        toast.error(result.error ?? "מחיקה נכשלה");
        return;
      }
      setDrafts((current) => {
        const next = { ...current };
        delete next[selected.id];
        return next;
      });
      const remaining = orderedDocuments.filter((document) => document.id !== selected.id);
      setSelectedId(remaining[0]?.id ?? null);
      toast.success("המסמך נמחק");
    });
  }

  function persistOrder(nextIds: string[]) {
    setOrder(nextIds);
    startTransition(async () => {
      const result = await reorderDocuments(nextIds);
      if (!result.ok) toast.error(result.error ?? "לא ניתן היה לשמור את הסדר");
    });
  }

  function onDrop(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const next = [...order];
    const from = next.indexOf(dragId);
    const to = next.indexOf(targetId);
    if (from < 0 || to < 0) return;
    next.splice(from, 1);
    next.splice(to, 0, dragId);
    persistOrder(next);
    setDragId(null);
  }

  return (
    <>
      <PageHeader
        title="מסמכים"
        description="עורך טקסט חופשי עם שמירה אוטומטית. גרירה משנה את סדר המסמכים."
        actions={
          <Button onClick={create} disabled={pending}>
            <FilePlus className="size-4" />
            מסמך חדש
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <Surface className="flex h-[calc(100vh-11rem)] flex-col">
          <div className="space-y-3 border-b bg-[#F4F8F5] px-4 py-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">המסמכים שלי</p>
              <span className="rounded-full bg-white px-2 py-0.5 text-[11px] text-muted-foreground">
                {orderedDocuments.length}
              </span>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 start-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={docQuery}
                onChange={(event) => setDocQuery(event.target.value)}
                placeholder="חיפוש מסמך"
                className="h-9 bg-white ps-9"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {visibleDocuments.length === 0 ? (
              <div className="px-3 py-10 text-center text-sm text-muted-foreground">
                {orderedDocuments.length === 0 ? "אין מסמכים עדיין." : "אין תוצאות לחיפוש."}
              </div>
            ) : (
              visibleDocuments.map((document) => {
                const active = selected?.id === document.id;
                const preview = textPreview(drafts[document.id]?.content ?? document.content);
                return (
                  <div
                    key={document.id}
                    draggable
                    onDragStart={() => setDragId(document.id)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => onDrop(document.id)}
                    className={cn(
                      "mb-1 flex items-stretch rounded-xl transition-colors",
                      active ? "bg-[#E8F5E9] ring-1 ring-[#A5D6A7]" : "hover:bg-muted/60",
                      dragId === document.id && "opacity-60",
                    )}
                  >
                    <button
                      type="button"
                      className="flex cursor-grab items-center px-2 text-muted-foreground"
                      aria-label="גרירת מסמך לשינוי סדר"
                      onClick={(event) => event.preventDefault()}
                    >
                      <GripVertical className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => selectDocument(document.id)}
                      className="flex min-w-0 flex-1 items-start gap-2 py-2.5 pe-3 text-start"
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg",
                          active ? "bg-[#C8E6C9] text-[#1B5E20]" : "bg-muted text-muted-foreground",
                        )}
                      >
                        <FileText className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {drafts[document.id]?.title ?? document.title}
                        </span>
                        <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                          {preview || "מסמך ריק"}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-muted-foreground/80" suppressHydrationWarning>
                          {formatHebrewShortDate(document.updatedAt)}
                        </span>
                      </span>
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </Surface>

        <Surface className="flex h-[calc(100vh-11rem)] flex-col overflow-hidden">
          {selected && selectedDraft ? (
            <>
              <div className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center">
                <Input
                  value={selectedDraft.title}
                  onChange={(event) => {
                    const title = event.target.value;
                    setDrafts((current) => {
                      const existing = current[selected.id];
                      if (!existing) return current;
                      return { ...current, [selected.id]: { ...existing, title } };
                    });
                  }}
                  className="h-11 border-0 bg-transparent px-0 text-xl font-semibold shadow-none focus-visible:ring-0"
                />
                <div className="flex items-center gap-2 sm:ms-auto">
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[11px] font-medium whitespace-nowrap",
                      saveLabel === "נשמר" && "bg-[#E8F5E9] text-[#1B5E20]",
                      saveLabel === "שומר..." && "bg-amber-50 text-amber-800",
                      saveLabel === "לא נשמר" && "bg-amber-50 text-amber-800",
                      saveLabel === "שמירה נכשלה" && "bg-rose-50 text-rose-800",
                    )}
                  >
                    {saveLabel}
                  </span>
                  <Button variant="ghost" size="icon-sm" onClick={remove} disabled={pending} aria-label="מחיקת מסמך">
                    <Trash2 className="size-4" />
                  </Button>
                  <Button size="sm" onClick={save} disabled={pending || !dirty}>
                    {pending ? "שומר..." : dirty ? "שמירה" : "נשמר"}
                  </Button>
                </div>
              </div>
              <DocumentEditor
                key={selected.id}
                documentId={selected.id}
                content={selectedDraft.content}
                onChange={onEditorChange}
              />
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
              <span className="flex size-14 items-center justify-center rounded-2xl bg-[#E8F5E9] text-[#2E7D32]">
                <FileText className="size-7" />
              </span>
              <p className="text-sm font-medium">אין מסמך נבחר</p>
              <p className="max-w-xs text-sm text-muted-foreground">בחרו מסמך מהרשימה או צרו אחד חדש כדי להתחיל לכתוב.</p>
            </div>
          )}
        </Surface>
      </div>
    </>
  );
}
