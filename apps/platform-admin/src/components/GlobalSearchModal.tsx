import React, { useState, useEffect, useRef } from "react";
import { Search, Building, Store, User, ShoppingBag, CreditCard, ArrowRight, X } from "lucide-react";
import { useRouter } from "next/navigation";

interface SearchHit {
  id: string;
  type: "organization" | "store" | "merchant" | "order" | "payment";
  title: string;
  subtitle: string;
  url: string;
  status?: string;
}

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GlobalSearchModal({ isOpen, onClose }: GlobalSearchModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setResults([]);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/platform/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const json = await res.json();
          setResults(json.data?.items ?? []);
          setSelectedIndex(0);
        }
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (results.length > 0 ? (prev + 1) % results.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (results.length > 0 ? (prev - 1 + results.length) % results.length : 0));
    } else if (e.key === "Enter" && results[selectedIndex]) {
      e.preventDefault();
      router.push(results[selectedIndex].url);
      onClose();
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  if (!isOpen) return null;

  const getIcon = (type: SearchHit["type"]) => {
    switch (type) {
      case "organization":
        return <Building className="w-4 h-4 text-indigo-400" />;
      case "store":
        return <Store className="w-4 h-4 text-emerald-400" />;
      case "merchant":
        return <User className="w-4 h-4 text-sky-400" />;
      case "order":
        return <ShoppingBag className="w-4 h-4 text-amber-400" />;
      case "payment":
        return <CreditCard className="w-4 h-4 text-purple-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl rounded-xl border border-white/10 bg-[#0c111c] shadow-2xl overflow-hidden">
        <div className="flex items-center px-4 border-b border-white/10">
          <Search className="w-5 h-5 text-slate-400 mr-3" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search organizations, stores, merchants, orders, payments (min 2 chars)..."
            className="w-full py-4 bg-transparent text-white placeholder-slate-500 text-sm focus:outline-none font-sans"
          />
          {query && (
            <button onClick={() => setQuery("")} className="text-slate-400 hover:text-white mr-2">
              <X className="w-4 h-4" />
            </button>
          )}
          <span className="text-xs px-2 py-0.5 rounded bg-white/5 border border-white/10 text-slate-400 font-mono">
            ESC
          </span>
        </div>

        <div className="max-h-96 overflow-y-auto p-2">
          {loading && (
            <div className="py-8 text-center text-xs text-slate-400">Searching SaaS ecosystem...</div>
          )}

          {!loading && results.length === 0 && query.length >= 2 && (
            <div className="py-8 text-center text-xs text-slate-400">
              No matching records found across Cal Cart platform.
            </div>
          )}

          {!loading && results.length === 0 && query.length < 2 && (
            <div className="py-8 text-center text-xs text-slate-500">
              Type at least 2 characters or paste an exact UUID to search.
            </div>
          )}

          {!loading &&
            results.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={`${item.type}-${item.id}`}
                  onClick={() => {
                    router.push(item.url);
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                    isSelected ? "bg-blue-600/15 border border-blue-500/30" : "hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-white/5 border border-white/5">
                      {getIcon(item.type)}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white flex items-center gap-2">
                        {item.title}
                        {item.status && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/10 text-slate-300 font-mono">
                            {item.status}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">{item.subtitle}</div>
                    </div>
                  </div>
                  <ArrowRight
                    className={`w-4 h-4 transition-transform ${
                      isSelected ? "text-blue-400 translate-x-1" : "text-slate-600"
                    }`}
                  />
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
