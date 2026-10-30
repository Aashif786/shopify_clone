"use client";

import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  ELEMENT_REGISTRY,
  ELEMENT_CATEGORIES,
} from "@/components/storefront/landing-page/elements/element-registry";
import type { ElementType } from "@calcart/stores/landing-page";
import { Search, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface AddElementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectElement: (type: ElementType) => void;
  sectionTitle?: string;
}

export function AddElementModal({
  isOpen,
  onClose,
  onSelectElement,
  sectionTitle,
}: AddElementModalProps) {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const elementList = useMemo(() => Object.values(ELEMENT_REGISTRY), []);

  const filteredElements = useMemo(() => {
    return elementList.filter((el) => {
      const matchesCategory =
        selectedCategory === "all" || el.category === selectedCategory;
      const matchesSearch =
        search.trim() === "" ||
        el.name.toLowerCase().includes(search.toLowerCase()) ||
        el.description.toLowerCase().includes(search.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [elementList, selectedCategory, search]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col p-0 bg-background border border-border shadow-2xl">
        <DialogHeader className="p-6 pb-4 border-b border-border">
          <div className="flex items-center justify-between gap-4">
            <div>
              <DialogTitle className="text-xl font-bold tracking-tight">
                Add Element to Section
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-0.5">
                {sectionTitle
                  ? `Inserting into "${sectionTitle}". Choose a modular block to add.`
                  : "Choose an element block to insert into your container layout."}
              </DialogDescription>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative mt-4">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search elements (heading, product card, columns, video...)"
              className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-border bg-card/60 focus:bg-background focus:outline-hidden focus:ring-2 focus:ring-primary/40 text-foreground placeholder:text-muted-foreground transition-all"
            />
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 mt-3 overflow-x-auto pb-1 scrollbar-none">
            <button
              type="button"
              onClick={() => setSelectedCategory("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategory === "all"
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              All Elements ({elementList.length})
            </button>
            {ELEMENT_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedCategory === cat.id
                    ? "bg-primary text-primary-foreground shadow-2xs"
                    : "bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </DialogHeader>

        {/* Elements Grid */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {filteredElements.length > 0 ? (
            filteredElements.map((el) => {
              const Icon = el.icon;
              return (
                <button
                  key={el.type}
                  type="button"
                  onClick={() => {
                    onSelectElement(el.type);
                    onClose();
                  }}
                  className="group flex items-start gap-3.5 p-3.5 text-left rounded-xl border border-border bg-card/50 hover:bg-card hover:border-primary/50 transition-all duration-200 active:scale-[0.98] cursor-pointer"
                >
                  <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-200">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                        {el.name}
                      </span>
                      {el.badge ? (
                        <Badge variant="outline" className="text-[10px] uppercase font-mono py-0 px-1.5">
                          {el.badge}
                        </Badge>
                      ) : (
                        <Plus className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {el.description}
                    </p>
                  </div>
                </button>
              );
            })
          ) : (
            <div className="col-span-2 py-12 text-center text-muted-foreground space-y-1">
              <p className="text-sm font-semibold">No elements match &quot;{search}&quot;</p>
              <p className="text-xs">Try selecting a different category or clearing the search.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
