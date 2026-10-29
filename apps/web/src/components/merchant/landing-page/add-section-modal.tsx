"use client";

import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { SECTION_REGISTRY } from "@/components/storefront/landing-page/registry";
import type { SectionType } from "@shopify-clone/stores/landing-page";
import { Plus } from "lucide-react";

interface AddSectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSection: (type: SectionType) => void;
}

export function AddSectionModal({
  isOpen,
  onClose,
  onSelectSection,
}: AddSectionModalProps) {
  const sectionList = Object.values(SECTION_REGISTRY);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col p-0 bg-background border border-border shadow-2xl">
        <DialogHeader className="p-6 pb-4 border-b border-border">
          <DialogTitle className="text-xl font-bold tracking-tight">Add Section to Landing Page</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Select a section component to insert into your storefront layout. You can reorder, customize, or hide it anytime.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {sectionList.map((sec) => {
            const Icon = sec.icon;
            return (
              <button
                key={sec.type}
                type="button"
                onClick={() => {
                  onSelectSection(sec.type);
                  onClose();
                }}
                className="group flex items-start gap-4 p-4 text-left rounded-xl border border-border bg-card/60 hover:bg-card hover:border-primary/50 transition-all duration-200 active:scale-[0.98] cursor-pointer"
              >
                <div className="p-3 rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-200">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                      {sec.title}
                    </span>
                    <Plus className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {sec.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
