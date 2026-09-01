"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  FilePlus,
  FileText,
  Folder,
  FolderPlus,
  GripVertical,
  Pencil,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  createDocument,
  createFolder,
  deleteDocument,
  deleteFolder,
  moveDocument,
  renameFolder,
  reorderDocuments,
  updateDocument,
} from "@/actions/documents";
import { formatHebrewShortDate } from "@/lib/dates";
import type { DocumentRecord, FolderRecord } from "@/lib/types";
import { DocumentEditor } from "@/components/notes/document-editor";
import { PageHeader, Surface } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

function htmlToText(html: string) {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function textPreview(html: string) {
  return htmlToText(html).slice(0, 72);
}

export function NotesView({
  folders: initialFolders,
  documents,
}: {
  folders: FolderRecord[];
  documents: DocumentRecord[];
}) {
  const router = useRouter();
  const [order, setOrder] = useState(documents.map((document) => document.id));
  const [folders, setFolders] = useState(initialFolders);
  const [localDocuments, setLocalDocuments] = useState<DocumentRecord[]>([]);
  const [folderOverrides, setFolderOverrides] = useState<Record<string, string | null>>({});
  const [selectedId, setSelectedId] = useState<string | null>(documents[0]?.id ?? null);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(documents[0]?.folderId ?? null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(initialFolders.map((folder) => [folder.id, true])),
  );
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [saveLabel, setSaveLabel] = useState("נשמר");
  const [docQuery, setDocQuery] = useState("");
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(documents.map((document) => [document.id, draftFrom(document)])),
  );

  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;
  const localDocumentsRef = useRef(localDocuments);
  localDocumentsRef.current = localDocuments;
  const savingRef = useRef<Set<string>>(new Set());
  const retrySaveRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setFolders((current) => {
      const incomingIds = new Set(initialFolders.map((folder) => folder.id));
      const extras = current.filter((folder) => !incomingIds.has(folder.id));
      return extras.length === 0 ? initialFolders : [...initialFolders, ...extras];
    });
    setExpanded((current) => {
      const next = { ...current };
      for (const folder of initialFolders) {
        if (next[folder.id] === undefined) next[folder.id] = true;
      }
      return next;
    });
  }, [initialFolders]);

  useEffect(() => {
    setOrder((current) => {
      const incoming = documents.map((document) => document.id);
      const localIds = localDocumentsRef.current.map((document) => document.id);
      const stillThere = current.filter((id) => incoming.includes(id) || localIds.includes(id));
      const added = incoming.filter((id) => !stillThere.includes(id));
      return [...added, ...stillThere];
    });
    setLocalDocuments((current) =>
      current.filter((document) => !documents.some((incoming) => incoming.id === document.id)),
    );
    setFolderOverrides((current) => {
      let changed = false;
      const next = { ...current };
      for (const document of documents) {
        if (next[document.id] !== undefined && next[document.id] === (document.folderId ?? null)) {
          delete next[document.id];
          changed = true;
        }
      }
      return changed ? next : current;
    });
    setDrafts((current) => {
      const next = { ...current };
      const incoming = new Set(documents.map((document) => document.id));
      for (const document of documents) {
        if (!next[document.id]) next[document.id] = draftFrom(document);
      }
      for (const id of Object.keys(next)) {
        if (
          !incoming.has(id) &&
          !localDocumentsRef.current.some((document) => document.id === id)
        ) {
          delete next[id];
        }
      }
      return next;
    });
  }, [documents]);

  const resolvedDocuments = useMemo(() => {
    const byId = new Map(documents.map((document) => [document.id, document]));
    for (const document of localDocuments) {
      if (!byId.has(document.id)) byId.set(document.id, document);
    }
    return [...byId.values()].map((document) =>
      Object.prototype.hasOwnProperty.call(folderOverrides, document.id)
        ? { ...document, folderId: folderOverrides[document.id] }
        : document,
    );
  }, [documents, folderOverrides, localDocuments]);

  const orderedDocuments = useMemo(() => {
    const byId = new Map(resolvedDocuments.map((document) => [document.id, document]));
    const leftover = resolvedDocuments
      .filter((document) => !order.includes(document.id))
      .map((document) => document.id);
    return [...leftover, ...order]
      .map((id) => byId.get(id))
      .filter((document): document is DocumentRecord => Boolean(document));
  }, [order, resolvedDocuments]);

  const matchingIds = useMemo(() => {
    const needle = docQuery.trim().toLowerCase();
    if (!needle) return null;
    const ids = new Set<string>();
    for (const document of orderedDocuments) {
      const draft = drafts[document.id];
      const title = (draft?.title ?? document.title).toLowerCase();
      const body = htmlToText(draft?.content ?? document.content).toLowerCase();
      const folderName =
        folders.find((folder) => folder.id === document.folderId)?.name.toLowerCase() ?? "";
      if (title.includes(needle) || body.includes(needle) || folderName.includes(needle)) {
        ids.add(document.id);
      }
    }
    return ids;
  }, [docQuery, drafts, folders, orderedDocuments]);

  const visibleDocuments = matchingIds
    ? orderedDocuments.filter((document) => matchingIds.has(document.id))
    : orderedDocuments;

  const searching = matchingIds !== null;

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

  function docsInFolder(folderId: string | null) {
    return visibleDocuments.filter((document) => (document.folderId ?? null) === folderId);
  }

  function selectDocument(id: string) {
    if (id === selectedId) return;
    const previous = selectedId;
    const next = orderedDocuments.find((document) => document.id === id);
    setSelectedId(id);
    setActiveFolderId(next?.folderId ?? null);
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
    const folderId = activeFolderId;
    startTransition(async () => {
      if (previous) await saveDraft(previous, { silent: true });
      const result = await createDocument({ title: "מסמך חדש", content: "", folderId });
      if (!result.ok || !result.id) {
        toast.error(result.error ?? "יצירה נכשלה");
        return;
      }
      const created: DocumentRecord = {
        id: result.id!,
        title: "מסמך חדש",
        content: "",
        sortOrder: 0,
        folderId: folderId ?? null,
        updatedAt: new Date().toISOString(),
      };
      setLocalDocuments((current) => [created, ...current]);
      setOrder((current) => [created.id, ...current.filter((id) => id !== created.id)]);
      setDrafts((current) => ({
        ...current,
        [created.id]: draftFrom(created),
      }));
      if (folderId) setExpanded((current) => ({ ...current, [folderId]: true }));
      setSelectedId(created.id);
      router.refresh();
    });
  }

  function addFolder() {
    startTransition(async () => {
      const result = await createFolder({ name: "תיקייה חדשה" });
      if (!result.ok || !result.id) {
        toast.error(result.error ?? "יצירת תיקייה נכשלה");
        return;
      }
      setFolders((current) => [
        { id: result.id!, name: "תיקייה חדשה", sortOrder: (current[0]?.sortOrder ?? 0) - 1 },
        ...current.filter((folder) => folder.id !== result.id),
      ]);
      setExpanded((current) => ({ ...current, [result.id!]: true }));
      setActiveFolderId(result.id);
      toast.success("תיקייה חדשה נוספה");
      router.refresh();
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
      setLocalDocuments((current) => current.filter((document) => document.id !== selected.id));
      setFolderOverrides((current) => {
        if (!(selected.id in current)) return current;
        const next = { ...current };
        delete next[selected.id];
        return next;
      });
      setSelectedId(remaining[0]?.id ?? null);
      toast.success("המסמך נמחק");
      router.refresh();
    });
  }

  function persistOrder(nextIds: string[]) {
    setOrder((current) => {
      const remaining = current.filter((id) => !nextIds.includes(id));
      return [...nextIds, ...remaining];
    });
    startTransition(async () => {
      const result = await reorderDocuments(nextIds);
      if (!result.ok) toast.error(result.error ?? "לא ניתן היה לשמור את הסדר");
    });
  }

  function moveToFolder(documentId: string, folderId: string | null) {
    const current = orderedDocuments.find((document) => document.id === documentId);
    if (!current || (current.folderId ?? null) === folderId) return;
    setFolderOverrides((overrides) => ({ ...overrides, [documentId]: folderId }));
    if (folderId) setExpanded((currentExpanded) => ({ ...currentExpanded, [folderId]: true }));
    if (documentId === selectedId) setActiveFolderId(folderId);
    startTransition(async () => {
      const result = await moveDocument({ id: documentId, folderId });
      if (!result.ok) {
        setFolderOverrides((overrides) => {
          const next = { ...overrides };
          delete next[documentId];
          return next;
        });
        toast.error(result.error ?? "העברה נכשלה");
        return;
      }
      router.refresh();
    });
  }

  function onDropOnDocument(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const dragged = orderedDocuments.find((document) => document.id === dragId);
    const target = orderedDocuments.find((document) => document.id === targetId);
    if (!dragged || !target) return;
    const targetFolder = target.folderId ?? null;
    if ((dragged.folderId ?? null) !== targetFolder) {
      moveToFolder(dragId, targetFolder);
      setDragId(null);
      setDropTarget(null);
      return;
    }
    const ids = docsInFolder(targetFolder).map((document) => document.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    ids.splice(from, 1);
    ids.splice(to, 0, dragId);
    persistOrder(ids);
    setDragId(null);
    setDropTarget(null);
  }

  function onDropOnFolder(folderId: string | null) {
    if (!dragId) return;
    moveToFolder(dragId, folderId);
    setDragId(null);
    setDropTarget(null);
  }

  function rename(folder: FolderRecord) {
    const next = window.prompt("שם התיקייה", folder.name);
    if (next === null) return;
    const trimmed = next.trim() || folder.name;
    setFolders((current) =>
      current.map((item) => (item.id === folder.id ? { ...item, name: trimmed } : item)),
    );
    startTransition(async () => {
      const result = await renameFolder({ id: folder.id, name: trimmed });
      if (!result.ok) {
        setFolders((current) =>
          current.map((item) => (item.id === folder.id ? { ...item, name: folder.name } : item)),
        );
        toast.error(result.error ?? "שינוי השם נכשל");
        return;
      }
      router.refresh();
    });
  }

  function removeFolder(folder: FolderRecord) {
    if (
      !window.confirm(
        `למחוק את התיקייה "${folder.name}"? המסמכים שבתוכה יישארו, בלי תיקייה.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await deleteFolder(folder.id);
      if (!result.ok) {
        toast.error(result.error ?? "מחיקה נכשלה");
        return;
      }
      setFolders((current) => current.filter((item) => item.id !== folder.id));
      setFolderOverrides((current) => {
        const next = { ...current };
        for (const document of orderedDocuments) {
          if ((document.folderId ?? null) === folder.id) next[document.id] = null;
        }
        return next;
      });
      if (activeFolderId === folder.id) setActiveFolderId(null);
      toast.success("התיקייה נמחקה");
      router.refresh();
    });
  }

  function renderDocument(document: DocumentRecord, nested: boolean) {
    const active = selected?.id === document.id;
    const preview = textPreview(drafts[document.id]?.content ?? document.content);
    return (
      <div
        key={document.id}
        draggable
        onDragStart={() => setDragId(document.id)}
        onDragOver={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onDrop={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onDropOnDocument(document.id);
        }}
        className={cn(
          "mb-1 flex items-stretch rounded-xl transition-colors",
          nested && "ms-4",
          active ? "bg-[#E8F5E9] ring-1 ring-[#A5D6A7]" : "hover:bg-muted/60",
          dragId === document.id && "opacity-60",
        )}
      >
        <button
          type="button"
          className="flex cursor-grab items-center px-2 text-muted-foreground"
          aria-label="גרירת מסמך לשינוי סדר או תיקייה"
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
  }

  function renderFolder(folder: FolderRecord) {
    const items = docsInFolder(folder.id);
    const open = searching || expanded[folder.id] !== false;
    const isDrop = dropTarget === folder.id;
    const folderMatches =
      searching && folder.name.toLowerCase().includes(docQuery.trim().toLowerCase());
    if (searching && items.length === 0 && !folderMatches) return null;
    return (
      <div
        key={folder.id}
        onDragOver={(event) => {
          event.preventDefault();
          setDropTarget(folder.id);
        }}
        onDragLeave={() => setDropTarget((current) => (current === folder.id ? null : current))}
        onDrop={(event) => {
          event.preventDefault();
          onDropOnFolder(folder.id);
        }}
        className={cn("mb-2 rounded-xl", isDrop && "ring-1 ring-[#A5D6A7] bg-[#F4F8F5]")}
      >
        <div
          className={cn(
            "flex items-center gap-1 rounded-xl px-1 py-1",
            activeFolderId === folder.id && "bg-muted/70",
          )}
        >
          <button
            type="button"
            className="flex size-8 shrink-0 items-center justify-center text-muted-foreground"
            aria-label={open ? "כיווץ תיקייה" : "הרחבת תיקייה"}
            onClick={() => setExpanded((current) => ({ ...current, [folder.id]: !open }))}
          >
            <ChevronDown className={cn("size-4 transition-transform", !open && "-rotate-90")} />
          </button>
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-2 py-1.5 pe-2 text-start"
            onClick={() => setActiveFolderId(folder.id)}
          >
            <Folder className="size-4 shrink-0 text-[#2E7D32]" />
            <span className="truncate text-sm font-medium">{folder.name}</span>
            <span className="rounded-full bg-white px-1.5 text-[10px] text-muted-foreground">
              {items.length}
            </span>
          </button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="שינוי שם תיקייה"
            onClick={() => rename(folder)}
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="מחיקת תיקייה"
            onClick={() => removeFolder(folder)}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
        {open ? items.map((document) => renderDocument(document, true)) : null}
      </div>
    );
  }

  const unfiled = docsInFolder(null);
  const showUnfiledHeader = folders.length > 0;

  return (
    <>
      <PageHeader
        title="מסמכים"
        description="עורך טקסט חופשי עם שמירה אוטומטית. אפשר לארגן מסמכים בתיקיות, ולגרור מסמך לתיקייה."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={addFolder} disabled={pending}>
              <FolderPlus className="size-4" />
              תיקייה חדשה
            </Button>
            <Button onClick={create} disabled={pending}>
              <FilePlus className="size-4" />
              מסמך חדש
            </Button>
          </div>
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
                placeholder="חיפוש בכותרת, תיקייה או בתוך המסמך"
                className="h-9 bg-white ps-9"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {searching && visibleDocuments.length === 0 ? (
              <div className="px-3 py-10 text-center text-sm text-muted-foreground">
                אין תוצאות לחיפוש.
              </div>
            ) : visibleDocuments.length === 0 && folders.length === 0 ? (
              <div className="px-3 py-10 text-center text-sm text-muted-foreground">
                אין מסמכים עדיין.
              </div>
            ) : (
              <>
                {folders.map(renderFolder)}
                {showUnfiledHeader ? (
                  <div
                    onDragOver={(event) => {
                      event.preventDefault();
                      setDropTarget("unfiled");
                    }}
                    onDragLeave={() =>
                      setDropTarget((current) => (current === "unfiled" ? null : current))
                    }
                    onDrop={(event) => {
                      event.preventDefault();
                      onDropOnFolder(null);
                    }}
                    className={cn(
                      "mb-1 rounded-xl",
                      dropTarget === "unfiled" && "ring-1 ring-[#A5D6A7] bg-[#F4F8F5]",
                    )}
                  >
                    <button
                      type="button"
                      className={cn(
                        "mb-1 flex w-full items-center gap-2 rounded-xl px-3 py-1.5 text-start text-sm",
                        activeFolderId === null && "bg-muted/70",
                      )}
                      onClick={() => setActiveFolderId(null)}
                    >
                      <FileText className="size-4 text-muted-foreground" />
                      ללא תיקייה
                      <span className="rounded-full bg-white px-1.5 text-[10px] text-muted-foreground">
                        {unfiled.length}
                      </span>
                    </button>
                    {unfiled.map((document) => renderDocument(document, false))}
                  </div>
                ) : (
                  unfiled.map((document) => renderDocument(document, false))
                )}
              </>
            )}
          </div>
        </Surface>

        <Surface className="flex h-[calc(100vh-11rem)] flex-col overflow-hidden">
          {selected && selectedDraft ? (
            <>
              <div className="flex flex-col gap-3 border-b px-5 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
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
                <div className="flex items-center gap-2">
                  <Folder className="size-4 text-muted-foreground" />
                  <Select
                    value={selected.folderId ?? "none"}
                    onValueChange={(value) => moveToFolder(selected.id, value === "none" ? null : value)}
                  >
                    <SelectTrigger className="h-8 w-[220px]">
                      <SelectValue placeholder="תיקייה" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">ללא תיקייה</SelectItem>
                      {folders.map((folder) => (
                        <SelectItem key={folder.id} value={folder.id}>
                          {folder.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
