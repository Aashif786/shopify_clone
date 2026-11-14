"use client";

import React, { useState, useMemo } from "react";
import {
  Search,
  Check,
  Type,
  Sliders,
  Plus,
  Trash2,
  X,
  Sparkles,
} from "lucide-react";
import {
  FONT_LIBRARY,
  type FontCategory,
  getFontById,
  resolveFontFamily,
  getGoogleFontsUrl,
} from "@/lib/font-library";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface FontPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeHeadingFont: string;
  activeBodyFont: string;
  customFonts?: string[];
  onSelectHeading: (fontId: string) => void;
  onSelectBody: (fontId: string) => void;
  onAddFontToWebsite: (fontId: string) => void;
  onRemoveFontFromWebsite?: (fontId: string) => void;
}

export function FontPickerModal({
  isOpen,
  onClose,
  activeHeadingFont,
  activeBodyFont,
  customFonts = [],
  onSelectHeading,
  onSelectBody,
  onAddFontToWebsite,
  onRemoveFontFromWebsite,
}: FontPickerModalProps) {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<"all" | FontCategory>("all");
  const [previewHeading, setPreviewHeading] = useState("Modern Luxury & Conscious Craft");
  const [previewBody, setPreviewBody] = useState(
    "Engineered for responsive high-conversion commerce with fluid typography and deliberate motion.",
  );

  const categories: Array<{ id: "all" | FontCategory; label: string }> = [
    { id: "all", label: "All Fonts" },
    { id: "sans-serif", label: "Sans-Serif" },
    { id: "serif", label: "Serif" },
    { id: "display", label: "Display" },
    { id: "monospace", label: "Monospace" },
  ];

  const filteredFonts = useMemo(() => {
    return FONT_LIBRARY.filter((font) => {
      const matchesCategory =
        selectedCategory === "all" || font.category === selectedCategory;
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        font.name.toLowerCase().includes(q) ||
        font.category.toLowerCase().includes(q) ||
        font.tags.some((t) => t.toLowerCase().includes(q));
      return matchesCategory && matchesSearch;
    });
  }, [search, selectedCategory]);

  // Load Google Fonts for all filtered fonts so live specimens render properly
  const fontUrls = useMemo(() => {
    return getGoogleFontsUrl(filteredFonts.map((f) => f.id));
  }, [filteredFonts]);

  const activeHeadingDef = getFontById(activeHeadingFont);
  const activeBodyDef = getFontById(activeBodyFont);

  const headingFamily = resolveFontFamily(activeHeadingFont);
  const bodyFamily = resolveFontFamily(activeBodyFont);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden bg-background border-border">
        {fontUrls && (
          <link rel="stylesheet" href={fontUrls} />
        )}

        <DialogHeader className="p-6 pb-4 border-b border-border bg-card/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                <Type className="w-4 h-4" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold tracking-tight">
                  Font Library &amp; Typography
                </DialogTitle>
                <p className="text-xs text-muted-foreground">
                  Browse, preview, and assign primary heading and secondary body fonts.
                </p>
              </div>
            </div>
          </div>

          {/* Search & Category Filter */}
          <div className="flex flex-col sm:flex-row gap-3 pt-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search fonts by name, style (e.g. editorial, modern, luxury)..."
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-input bg-background text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                    selectedCategory === cat.id
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        </DialogHeader>

        {/* Live Pair Preview Stage */}
        <div className="p-4 bg-muted/20 border-b border-border">
          <div className="rounded-xl border border-border bg-card/60 p-4 space-y-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-semibold uppercase tracking-wider flex items-center gap-1.5 text-primary">
                <Sparkles className="w-3.5 h-3.5" />
                Active Pairing Preview
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[11px]">
                  Heading:{" "}
                  <strong className="text-foreground">
                    {activeHeadingDef?.name || activeHeadingFont || "Display"}
                  </strong>
                </span>
                <span>•</span>
                <span className="text-[11px]">
                  Body:{" "}
                  <strong className="text-foreground">
                    {activeBodyDef?.name || activeBodyFont || "Sans"}
                  </strong>
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <input
                type="text"
                value={previewHeading}
                onChange={(e) => setPreviewHeading(e.target.value)}
                style={{ fontFamily: headingFamily }}
                className="w-full text-xl sm:text-2xl font-bold bg-transparent border-0 border-b border-transparent hover:border-border/60 focus:border-primary text-foreground focus:outline-hidden transition-colors"
                title="Edit preview headline"
              />
              <textarea
                rows={2}
                value={previewBody}
                onChange={(e) => setPreviewBody(e.target.value)}
                style={{ fontFamily: bodyFamily }}
                className="w-full text-xs sm:text-sm bg-transparent border-0 border-b border-transparent hover:border-border/60 focus:border-primary text-muted-foreground focus:outline-hidden transition-colors resize-none"
                title="Edit preview body text"
              />
            </div>
          </div>
        </div>

        {/* Font Cards List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {filteredFonts.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <Sliders className="w-8 h-8 text-muted-foreground mx-auto opacity-50" />
              <p className="text-sm font-semibold text-foreground">No fonts match &quot;{search}&quot;</p>
              <p className="text-xs text-muted-foreground">
                Try searching for another style or clear your filter.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredFonts.map((font) => {
                const isHeading =
                  activeHeadingFont === font.id ||
                  (activeHeadingFont === "display" && font.id === "bricolage-grotesque") ||
                  (activeHeadingFont === "serif" && font.id === "fraunces") ||
                  (activeHeadingFont === "sans" && font.id === "inter") ||
                  (activeHeadingFont === "mono" && font.id === "jetbrains-mono");

                const isBody =
                  activeBodyFont === font.id ||
                  (activeBodyFont === "sans" && font.id === "inter") ||
                  (activeBodyFont === "mono" && font.id === "jetbrains-mono");

                const isAddedToWebsite = customFonts.includes(font.id) || isHeading || isBody;

                return (
                  <div
                    key={font.id}
                    className={`group relative rounded-2xl border p-4 transition-all ${
                      isHeading || isBody
                        ? "border-primary bg-primary/[0.03] ring-1 ring-primary/40 shadow-xs"
                        : "border-border/80 bg-card/40 hover:border-border hover:bg-card/70"
                    }`}
                  >
                    {/* Header: Name, Category, Tags */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-foreground">{font.name}</h4>
                          <Badge variant="outline" className="text-[10px] uppercase font-mono py-0 px-1.5">
                            {font.category}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap mt-1">
                          {font.tags.slice(0, 3).map((tag) => (
                            <span key={tag} className="text-[10px] text-muted-foreground">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Active Badges */}
                      <div className="flex flex-col items-end gap-1">
                        {isHeading && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full">
                            <Check className="w-2.5 h-2.5" /> Heading
                          </span>
                        )}
                        {isBody && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                            <Check className="w-2.5 h-2.5" /> Body
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Specimen Preview */}
                    <div className="my-3 p-3 rounded-xl bg-background/80 border border-border/60">
                      <p
                        style={{ fontFamily: font.family }}
                        className="text-lg font-bold text-foreground leading-snug line-clamp-1"
                      >
                        {font.sampleText}
                      </p>
                      <p
                        style={{ fontFamily: font.family }}
                        className="text-xs text-muted-foreground mt-1 line-clamp-2"
                      >
                        ABCDEFGHIJKLM NOPQRSTUVWXYZ abcdefghijklm nopqrstuvwxyz 0123456789
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/50">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onSelectHeading(font.id)}
                          className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all ${
                            isHeading
                              ? "bg-primary text-primary-foreground border-primary"
                              : "border-input bg-background hover:bg-muted text-foreground"
                          }`}
                        >
                          {isHeading ? "Active Heading" : "Use for Heading"}
                        </button>

                        <button
                          type="button"
                          onClick={() => onSelectBody(font.id)}
                          className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all ${
                            isBody
                              ? "bg-emerald-600 text-white border-emerald-600"
                              : "border-input bg-background hover:bg-muted text-foreground"
                          }`}
                        >
                          {isBody ? "Active Body" : "Use for Body"}
                        </button>
                      </div>

                      {/* Add/Remove font on website */}
                      {isAddedToWebsite ? (
                        <button
                          type="button"
                          disabled={isHeading || isBody}
                          onClick={() => onRemoveFontFromWebsite?.(font.id)}
                          title={isHeading || isBody ? "Cannot remove font currently in use" : "Remove from website fonts"}
                          className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-lg ${
                            isHeading || isBody
                              ? "text-muted-foreground opacity-50 cursor-not-allowed"
                              : "text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          }`}
                        >
                          {isHeading || isBody ? (
                            <span className="text-[10px] text-muted-foreground">In Use</span>
                          ) : (
                            <>
                              <Trash2 className="w-3 h-3" />
                              <span>Remove</span>
                            </>
                          )}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onAddFontToWebsite(font.id)}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline px-2 py-1"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Add to Website</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
