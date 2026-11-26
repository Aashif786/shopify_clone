"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Tags, Plus, Pencil, Trash2, X, CheckCircle2, AlertTriangle } from "lucide-react";

interface StoreTypeItem {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isFashion: boolean;
  storeCount?: number;
}

type DialogState =
  | { kind: "create" }
  | { kind: "edit"; item: StoreTypeItem }
  | { kind: "delete"; item: StoreTypeItem }
  | null;

const inputClass =
  "w-full rounded-lg border border-white/10 bg-[#06090e] px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-sky-500";

export default function StoreTypesPage() {
  const [items, setItems] = useState<StoreTypeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/platform/store-types");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "Failed to load store types");
      setItems(json.data.items);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load store types");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const done = (message: string) => {
    setDialog(null);
    setToast(message);
    setTimeout(() => setToast(null), 4000);
    void load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Tags className="w-6 h-6 text-sky-400" />
            Store Types
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Classifications merchants choose from. Types flagged clothing/fashion can enable Fit Check.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDialog({ kind: "create" })}
          className="inline-flex items-center gap-1.5 rounded-lg bg-sky-500 px-3 py-2 text-xs font-medium text-white hover:bg-sky-400"
        >
          <Plus className="w-4 h-4" /> New store type
        </button>
      </div>

      {toast && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {loadError && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{loadError}</span>
          <button type="button" onClick={() => void load()} className="ml-auto underline">
            Retry
          </button>
        </div>
      )}

      <div className="rounded-xl border border-white/10 bg-[#0c111c] p-6 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-white/10 bg-white/5 text-slate-400 font-mono uppercase">
            <tr>
              <th className="py-3 px-4 font-medium">Store type</th>
              <th className="py-3 px-4 font-medium">Description</th>
              <th className="py-3 px-4 font-medium">Fashion</th>
              <th className="py-3 px-4 font-medium">Stores</th>
              <th className="py-3 px-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading && (
              <tr>
                <td colSpan={5} className="py-6 px-4 text-slate-400">
                  Loading store types…
                </td>
              </tr>
            )}
            {!loading && items.length === 0 && !loadError && (
              <tr>
                <td colSpan={5} className="py-6 px-4 text-slate-400">
                  No store types defined yet.
                </td>
              </tr>
            )}
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-white/5 transition-colors">
                <td className="py-3 px-4">
                  <div className="font-medium text-white">{item.name}</div>
                  <div className="text-[10px] text-blue-400 font-mono mt-0.5">{item.key}</div>
                </td>
                <td className="py-3 px-4 text-slate-300 max-w-xs">{item.description ?? "—"}</td>
                <td className="py-3 px-4">
                  <span
                    className={`px-2 py-0.5 rounded border text-[10px] font-mono ${
                      item.isFashion
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                        : "bg-white/5 border-white/10 text-slate-300"
                    }`}
                  >
                    {item.isFashion ? "Fit Check eligible" : "No"}
                  </span>
                </td>
                <td className="py-3 px-4 font-mono text-slate-300">{item.storeCount ?? 0}</td>
                <td className="py-3 px-4 text-right whitespace-nowrap">
                  <button
                    type="button"
                    aria-label={`Edit ${item.name}`}
                    onClick={() => setDialog({ kind: "edit", item })}
                    className="p-1.5 rounded text-slate-300 hover:bg-white/10"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${item.name}`}
                    onClick={() => setDialog({ kind: "delete", item })}
                    className="p-1.5 rounded text-red-400 hover:bg-red-500/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {dialog && (dialog.kind === "create" || dialog.kind === "edit") && (
        <EditDialog
          existing={dialog.kind === "edit" ? dialog.item : undefined}
          onClose={() => setDialog(null)}
          onDone={done}
        />
      )}
      {dialog && dialog.kind === "delete" && (
        <DeleteDialog
          item={dialog.item}
          others={items.filter((i) => i.id !== dialog.item.id)}
          onClose={() => setDialog(null)}
          onDone={done}
        />
      )}
    </div>
  );
}

function DialogFrame({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#0c111c] p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">{title}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

async function send(
  url: string,
  method: string,
  body: Record<string, unknown>,
): Promise<void> {
  const res = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new Error(json?.error?.message ?? "Request failed");
  }
}

function EditDialog({
  existing,
  onClose,
  onDone,
}: {
  existing?: StoreTypeItem;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [key, setKey] = useState(existing?.key ?? "");
  const [name, setName] = useState(existing?.name ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [isFashion, setIsFashion] = useState(existing?.isFashion ?? false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload = { key, name, description: description || null, isFashion, reason };
      if (existing) {
        await send(`/api/platform/store-types/${existing.id}`, "PATCH", payload);
        onDone(`Store type '${name}' updated.`);
      } else {
        await send("/api/platform/store-types", "POST", payload);
        onDone(`Store type '${name}' created.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
      setBusy(false);
    }
  };

  return (
    <DialogFrame title={existing ? "Edit store type" : "New store type"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <label className="block text-xs text-slate-300 space-y-1">
          Identifier
          <input
            className={inputClass}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="clothing_fashion"
            required
          />
        </label>
        <label className="block text-xs text-slate-300 space-y-1">
          Display name
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={120}
          />
        </label>
        <label className="block text-xs text-slate-300 space-y-1">
          Description
          <textarea
            className={inputClass}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
            rows={2}
          />
        </label>
        <label className="flex items-start gap-2 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={isFashion}
            onChange={(e) => setIsFashion(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            Clothing / fashion type — stores of this type may enable Fit Check. Turning this off
            disables Fit Check on every store of this type.
          </span>
        </label>
        <label className="block text-xs text-slate-300 space-y-1">
          Reason (audited)
          <input
            className={inputClass}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            minLength={5}
            required
          />
        </label>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-3 py-2 text-xs text-slate-300">
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-sky-500 px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </DialogFrame>
  );
}

function DeleteDialog({
  item,
  others,
  onClose,
  onDone,
}: {
  item: StoreTypeItem;
  others: StoreTypeItem[];
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const inUse = (item.storeCount ?? 0) > 0;
  const [reassignToId, setReassignToId] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await send(`/api/platform/store-types/${item.id}`, "DELETE", {
        reason,
        ...(inUse ? { reassignToId } : {}),
      });
      onDone(`Store type '${item.name}' deleted.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
      setBusy(false);
    }
  };

  return (
    <DialogFrame title={`Delete ${item.name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        {inUse ? (
          <>
            <p className="text-xs text-amber-400">
              {item.storeCount} store(s) use this type. Choose a type to move them to. Stores moved
              to a non-fashion type have Fit Check disabled.
            </p>
            <select
              className={inputClass}
              value={reassignToId}
              onChange={(e) => setReassignToId(e.target.value)}
              required
              aria-label="Reassign stores to"
            >
              <option value="">Select a store type…</option>
              {others.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </>
        ) : (
          <p className="text-xs text-slate-300">No stores use this type. This cannot be undone.</p>
        )}
        <label className="block text-xs text-slate-300 space-y-1">
          Reason (audited)
          <input
            className={inputClass}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            minLength={5}
            required
          />
        </label>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-3 py-2 text-xs text-slate-300">
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-red-500 px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
          >
            {busy ? "Deleting…" : "Delete"}
          </button>
        </div>
      </form>
    </DialogFrame>
  );
}
