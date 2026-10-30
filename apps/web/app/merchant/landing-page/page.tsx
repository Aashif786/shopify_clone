"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Maximize2,
  Minimize2,
  Monitor,
  Palette,
  PanelLeft,
  PanelRightClose,
  RotateCcw,
  Save,
  ShieldCheck,
  Sliders,
  Smartphone,
  Sparkles,
  Tablet,
  X,
} from "lucide-react";
import { MerchantShell } from "@/components/merchant/MerchantShell";
import { useAuth } from "@/context/auth-context";
import { useStore } from "@/context/store-context";
import { apiClient } from "@/lib/api-client";
import type {
  StorefrontLandingPageConfig,
  StorefrontLandingPageDTO,
  LandingPageSection,
  LandingPageTheme,
  SectionType,
  PageElement,
  ElementType,
} from "@calcart/stores/landing-page";
import { createNewElement } from "@calcart/stores/landing-page";
import type { ProductSummaryDTO } from "@calcart/products";
import { StorefrontLandingRenderer } from "@/components/storefront/landing-page/storefront-landing-renderer";
import { createNewSection } from "@/components/storefront/landing-page/registry";
import { StructurePanel } from "@/components/merchant/landing-page/structure-panel";
import { SectionEditor } from "@/components/merchant/landing-page/section-editor";
import { ElementEditor } from "@/components/merchant/landing-page/element-editor";
import { ThemeEditor } from "@/components/merchant/landing-page/theme-editor";
import { AddSectionModal } from "@/components/merchant/landing-page/add-section-modal";
import { AddElementModal } from "@/components/merchant/landing-page/add-element-modal";
import { Badge } from "@/components/ui/badge";

type PreviewDevice = "desktop" | "tablet" | "mobile";

export default function MerchantLandingPageStudio() {
  const { user } = useAuth();
  const { activeStore, stores, selectStore, isLoading: isStoreLoading } = useStore();

  const [landingRecord, setLandingRecord] = useState<StorefrontLandingPageDTO | null>(null);
  const [draftConfig, setDraftConfig] = useState<StorefrontLandingPageConfig | null>(null);
  const [initialConfigString, setInitialConfigString] = useState<string>("");
  const [products, setProducts] = useState<ProductSummaryDTO[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAddElementModalOpen, setIsAddElementModalOpen] = useState(false);
  const [targetSectionForAddElement, setTargetSectionForAddElement] = useState<string | null>(null);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetLiveToo, setResetLiveToo] = useState(true);

  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [previewDevice, setPreviewDevice] = useState<PreviewDevice>("desktop");
  const [activeTab, setActiveTab] = useState<"section" | "theme">("section");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Layout control states for full-viewport studio experience
  const [leftPanelOpen, setLeftPanelOpen] = useState<boolean>(true);
  const [rightPanelOpen, setRightPanelOpen] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Auto-adapt panels based on screen width on mount
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 1280) {
      setLeftPanelOpen(false);
    }
  }, []);

  // Check if draft has unsaved local edits
  const isDirty = useMemo(() => {
    if (!draftConfig || !initialConfigString) return false;
    return JSON.stringify(draftConfig) !== initialConfigString;
  }, [draftConfig, initialConfigString]);

  // Load landing page and store products
  const loadData = useCallback(async (storeId: string, storeSlug: string) => {
    setIsLoading(true);
    setFeedback(null);
    try {
      const [landingRes, productsRes] = await Promise.allSettled([
        apiClient.get<StorefrontLandingPageDTO>(
          `/api/v1/stores/${encodeURIComponent(storeId)}/landing-page`,
        ),
        apiClient.get<{ items: ProductSummaryDTO[] }>(
          `/api/v1/storefront/${encodeURIComponent(storeSlug)}/products`,
          { params: { limit: 12 } },
        ),
      ]);

      if (landingRes.status === "fulfilled" && landingRes.value) {
        setLandingRecord(landingRes.value);
        setDraftConfig(landingRes.value.draftConfig);
        setInitialConfigString(JSON.stringify(landingRes.value.draftConfig));
        // Select first section by default
        if (landingRes.value.draftConfig?.sections && landingRes.value.draftConfig.sections.length > 0) {
          const first = landingRes.value.draftConfig.sections[0];
          if (first) {
            setSelectedSectionId(first.id);
          }
        }
      }

      if (productsRes.status === "fulfilled" && productsRes.value?.items) {
        setProducts(productsRes.value.items);
      }
    } catch (err) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to load landing page data",
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeStore?.id && activeStore?.slug) {
      loadData(activeStore.id, activeStore.slug);
    }
  }, [activeStore?.id, activeStore?.slug, loadData]);

  const selectedSection = useMemo(() => {
    if (!draftConfig || !selectedSectionId) return null;
    return draftConfig.sections.find((s) => s.id === selectedSectionId) || null;
  }, [draftConfig, selectedSectionId]);

  const selectedElement = useMemo(() => {
    if (!selectedSection || !selectedElementId || !selectedSection.elements) return null;
    return selectedSection.elements.find((el) => el.id === selectedElementId) || null;
  }, [selectedSection, selectedElementId]);

  // Section & Element manipulation handlers
  const handleSelectSection = (id: string) => {
    setSelectedSectionId(id);
    setSelectedElementId(null);
    setActiveTab("section");
    setRightPanelOpen(true);
  };

  const handleSelectElement = (sectionId: string, elementId: string) => {
    setSelectedSectionId(sectionId);
    setSelectedElementId(elementId);
    setActiveTab("section");
    setRightPanelOpen(true);
  };

  const handleOpenAddElement = (sectionId?: string) => {
    const secId = sectionId || selectedSectionId || draftConfig?.sections[0]?.id || null;
    setTargetSectionForAddElement(secId);
    setIsAddElementModalOpen(true);
  };

  const handleAddElement = (type: ElementType) => {
    if (!draftConfig) return;
    const targetId = targetSectionForAddElement || selectedSectionId || draftConfig.sections[0]?.id;
    if (!targetId) return;

    const newElement = createNewElement(type);
    const updatedSections = draftConfig.sections.map((sec) => {
      if (sec.id !== targetId) return sec;
      const elements = Array.isArray(sec.elements) ? [...sec.elements, newElement] : [newElement];
      return {
        ...sec,
        elements,
        layout: sec.layout || {
          mode: "stack",
          containerWidth: "standard",
          gap: "md",
        },
      };
    });

    setDraftConfig({
      ...draftConfig,
      sections: updatedSections,
    });
    setSelectedSectionId(targetId);
    setSelectedElementId(newElement.id);
    setActiveTab("section");
    setRightPanelOpen(true);
  };

  const handleUpdateElement = (updatedElement: PageElement) => {
    if (!draftConfig || !selectedSectionId) return;
    const updatedSections = draftConfig.sections.map((sec) => {
      if (sec.id !== selectedSectionId || !sec.elements) return sec;
      return {
        ...sec,
        elements: sec.elements.map((el) => (el.id === updatedElement.id ? updatedElement : el)),
      };
    });
    setDraftConfig({
      ...draftConfig,
      sections: updatedSections,
    });
  };

  const handleDeleteElement = (sectionId: string, elementId: string) => {
    if (!draftConfig) return;
    const updatedSections = draftConfig.sections.map((sec) => {
      if (sec.id !== sectionId || !sec.elements) return sec;
      return {
        ...sec,
        elements: sec.elements.filter((el) => el.id !== elementId),
      };
    });
    setDraftConfig({
      ...draftConfig,
      sections: updatedSections,
    });
    if (selectedElementId === elementId) {
      setSelectedElementId(null);
    }
  };

  const handleDuplicateElement = (sectionId: string, elementId: string) => {
    if (!draftConfig) return;
    let newElementId: string | null = null;
    const updatedSections = draftConfig.sections.map((sec) => {
      if (sec.id !== sectionId || !sec.elements) return sec;
      const idx = sec.elements.findIndex((el) => el.id === elementId);
      if (idx === -1) return sec;
      const target = sec.elements[idx];
      if (!target) return sec;
      const clone: PageElement = {
        ...JSON.parse(JSON.stringify(target)),
        id: `el_${target.type}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        label: `${target.label || target.type} (Copy)`,
      };
      newElementId = clone.id;
      const elements = [...sec.elements];
      elements.splice(idx + 1, 0, clone);
      return {
        ...sec,
        elements,
      };
    });
    setDraftConfig({
      ...draftConfig,
      sections: updatedSections,
    });
    if (newElementId) {
      setSelectedElementId(newElementId);
    }
  };

  const handleMoveElement = (sectionId: string, elementIndex: number, direction: "up" | "down") => {
    if (!draftConfig) return;
    const updatedSections = draftConfig.sections.map((sec) => {
      if (sec.id !== sectionId || !sec.elements) return sec;
      const elements = [...sec.elements];
      const targetIdx = direction === "up" ? elementIndex - 1 : elementIndex + 1;
      if (targetIdx < 0 || targetIdx >= elements.length) return sec;
      const item = elements[elementIndex];
      const target = elements[targetIdx];
      if (!item || !target) return sec;
      elements[elementIndex] = target;
      elements[targetIdx] = item;
      return {
        ...sec,
        elements,
      };
    });
    setDraftConfig({
      ...draftConfig,
      sections: updatedSections,
    });
  };

  const handleUpdateSection = (updated: LandingPageSection) => {
    if (!draftConfig) return;
    setDraftConfig({
      ...draftConfig,
      sections: draftConfig.sections.map((s) => (s.id === updated.id ? updated : s)),
    });
  };

  const handleUpdateTheme = (updatedTheme: LandingPageTheme) => {
    if (!draftConfig) return;
    setDraftConfig({
      ...draftConfig,
      theme: updatedTheme,
    });
  };

  const handleMoveUp = (index: number) => {
    if (!draftConfig || index <= 0) return;
    const newSections = [...draftConfig.sections];
    const prev = newSections[index - 1];
    const curr = newSections[index];
    if (prev && curr) {
      newSections[index - 1] = curr;
      newSections[index] = prev;
      setDraftConfig({ ...draftConfig, sections: newSections });
    }
  };

  const handleMoveDown = (index: number) => {
    if (!draftConfig || index >= draftConfig.sections.length - 1) return;
    const newSections = [...draftConfig.sections];
    const next = newSections[index + 1];
    const curr = newSections[index];
    if (next && curr) {
      newSections[index + 1] = curr;
      newSections[index] = next;
      setDraftConfig({ ...draftConfig, sections: newSections });
    }
  };

  const handleToggleVisibility = (id: string) => {
    if (!draftConfig) return;
    setDraftConfig({
      ...draftConfig,
      sections: draftConfig.sections.map((s) =>
        s.id === id ? { ...s, isVisible: !s.isVisible } : s,
      ),
    });
  };

  const handleDuplicate = (id: string) => {
    if (!draftConfig) return;
    const idx = draftConfig.sections.findIndex((s) => s.id === id);
    if (idx === -1) return;
    const target = draftConfig.sections[idx];
    if (!target) return;
    const clone: LandingPageSection = {
      ...JSON.parse(JSON.stringify(target)),
      id: `sec_${target.type}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title: `${target.title} (Copy)`,
    };
    const newSections = [...draftConfig.sections];
    newSections.splice(idx + 1, 0, clone);
    setDraftConfig({ ...draftConfig, sections: newSections });
    setSelectedSectionId(clone.id);
    setRightPanelOpen(true);
  };

  const handleDelete = (id: string) => {
    if (!draftConfig) return;
    const remaining = draftConfig.sections.filter((s) => s.id !== id);
    setDraftConfig({ ...draftConfig, sections: remaining });
    if (selectedSectionId === id) {
      setSelectedSectionId(remaining[0]?.id || null);
    }
  };

  const handleAddSection = (type: SectionType) => {
    if (!draftConfig) return;
    const newSec = createNewSection(type);
    setDraftConfig({
      ...draftConfig,
      sections: [...draftConfig.sections, newSec],
    });
    setSelectedSectionId(newSec.id);
    setActiveTab("section");
    setRightPanelOpen(true);
  };

  // Save Draft API Call
  const handleSaveDraft = async () => {
    if (!activeStore || !draftConfig) return;
    setIsSaving(true);
    setFeedback(null);
    try {
      const updated = await apiClient.put<StorefrontLandingPageDTO>(
        `/api/v1/stores/${encodeURIComponent(activeStore.id)}/landing-page`,
        { draftConfig },
      );
      setLandingRecord(updated);
      setDraftConfig(updated.draftConfig);
      setInitialConfigString(JSON.stringify(updated.draftConfig));
      setFeedback({ type: "success", text: "Draft changes saved successfully." });
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to save draft",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Publish API Call
  const handlePublish = async () => {
    if (!activeStore || !draftConfig) return;
    setIsPublishing(true);
    setFeedback(null);
    try {
      const updated = await apiClient.post<StorefrontLandingPageDTO>(
        `/api/v1/stores/${encodeURIComponent(activeStore.id)}/landing-page/publish`,
        { config: draftConfig },
      );
      setLandingRecord(updated);
      setDraftConfig(updated.draftConfig);
      setInitialConfigString(JSON.stringify(updated.draftConfig));
      setFeedback({
        type: "success",
        text: "Storefront landing page published to live store!",
      });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to publish landing page",
      });
    } finally {
      setIsPublishing(false);
    }
  };

  // Reset to Default Execution
  const handleConfirmReset = async () => {
    if (!activeStore) return;
    setIsResetting(true);
    setFeedback(null);
    try {
      const updated = await apiClient.post<StorefrontLandingPageDTO>(
        `/api/v1/stores/${encodeURIComponent(activeStore.id)}/landing-page/reset`,
        { toDefault: true, resetLive: resetLiveToo },
      );
      setLandingRecord(updated);
      setDraftConfig(updated.draftConfig);
      setInitialConfigString(JSON.stringify(updated.draftConfig));
      if (updated.draftConfig?.sections && updated.draftConfig.sections.length > 0) {
        setSelectedSectionId(updated.draftConfig.sections[0]?.id || null);
      }
      setIsResetModalOpen(false);
      setFeedback({
        type: "success",
        text: resetLiveToo
          ? "Storefront draft & live site restored to pristine default appearance."
          : "Storefront draft restored to clean default appearance.",
      });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to reset storefront",
      });
    } finally {
      setIsResetting(false);
    }
  };

  if (isStoreLoading || isLoading) {
    return (
      <MerchantShell
        activePath="/merchant/landing-page"
        currentStore={activeStore}
        stores={stores}
        onSelectStore={selectStore}
        userName={user?.name}
        fullBleed={true}
        hideHeader={true}
      >
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-3">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground">Loading Landing Page Studio...</p>
        </div>
      </MerchantShell>
    );
  }

  if (!activeStore) {
    return (
      <MerchantShell
        activePath="/merchant/landing-page"
        currentStore={activeStore}
        stores={stores}
        onSelectStore={selectStore}
        userName={user?.name}
      >
        <div className="p-8 text-center space-y-2">
          <h2 className="text-lg font-bold">No Store Selected</h2>
          <p className="text-sm text-muted-foreground">Please select an active store to build its landing page.</p>
        </div>
      </MerchantShell>
    );
  }

  return (
    <MerchantShell
      activePath="/merchant/landing-page"
      currentStore={activeStore}
      stores={stores}
      onSelectStore={selectStore}
      userName={user?.name}
      fullBleed={true}
      hideHeader={true}
    >
      <div
        className={
          isFullscreen
            ? "fixed inset-0 z-50 flex flex-col h-[100dvh] w-screen overflow-hidden bg-background"
            : "flex flex-col h-[100dvh] w-full overflow-hidden bg-background"
        }
      >
        {/* Top Header Control Bar */}
        <header className="h-14 border-b border-border bg-card/80 backdrop-blur-md px-3 sm:px-4 flex items-center justify-between gap-2 sm:gap-4 shrink-0 z-30 select-none">
          {/* Left: Exit Link, Store Title, Section Toggle & Live Link */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Link
              href="/merchant"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-xs font-semibold text-muted-foreground hover:text-foreground transition-all shadow-xs cursor-pointer shrink-0"
              title="Exit to Merchant Console"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Dashboard</span>
            </Link>

            <div className="h-4 w-px bg-border hidden sm:block shrink-0" />

            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-bold tracking-tight truncate hidden sm:inline">Landing Page Studio</span>
              <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 hidden md:inline shrink-0">
                {activeStore.slug}
              </Badge>
            </div>

            {/* Toggle Structure Panel Button */}
            <button
              type="button"
              onClick={() => setLeftPanelOpen((prev) => !prev)}
              title={leftPanelOpen ? "Hide sections panel" : "Show sections panel"}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                leftPanelOpen
                  ? "bg-primary/10 border-primary/30 text-primary shadow-xs"
                  : "bg-card border-border text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <PanelLeft className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Sections</span>
              <Badge variant={leftPanelOpen ? "secondary" : "outline"} className="text-[10px] px-1 py-0 h-4 font-mono">
                {draftConfig?.sections?.length || 0}
              </Badge>
            </button>

            <Link
              href={`/stores/${encodeURIComponent(activeStore.slug)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden xl:inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors ml-1 shrink-0"
              title="Open live published storefront in new tab"
            >
              <span>View live</span>
              <ExternalLink className="w-3 h-3" />
            </Link>

            {landingRecord?.publishedAt && (
              <span className="text-[10px] text-muted-foreground hidden 2xl:inline shrink-0 font-mono">
                Live: v{landingRecord.version}
              </span>
            )}

            {isDirty && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                <span className="hidden sm:inline">Unsaved</span>
              </span>
            )}
          </div>

          {/* Center: Device Switcher */}
          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border border-border shrink-0">
            <button
              type="button"
              onClick={() => setPreviewDevice("desktop")}
              title="Full Desktop view"
              className={`p-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                previewDevice === "desktop"
                  ? "bg-background text-foreground shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span className="hidden lg:inline text-[11px]">Desktop</span>
            </button>
            <button
              type="button"
              onClick={() => setPreviewDevice("tablet")}
              title="Tablet view (768px)"
              className={`p-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                previewDevice === "tablet"
                  ? "bg-background text-foreground shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Tablet className="w-3.5 h-3.5" />
              <span className="hidden lg:inline text-[11px]">Tablet</span>
            </button>
            <button
              type="button"
              onClick={() => setPreviewDevice("mobile")}
              title="Mobile view (375px)"
              className={`p-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                previewDevice === "mobile"
                  ? "bg-background text-foreground shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span className="hidden lg:inline text-[11px]">Mobile</span>
            </button>
          </div>

          {/* Right: Actions, Reset, Full-screen & Inspector Toggle */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Inspector Toggle Button */}
            <button
              type="button"
              onClick={() => setRightPanelOpen((prev) => !prev)}
              title={rightPanelOpen ? "Hide controls panel" : "Show controls panel"}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                rightPanelOpen
                  ? "bg-primary/10 border-primary/30 text-primary shadow-xs"
                  : "bg-card border-border text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Controls</span>
            </button>

            {/* Fullscreen Focus Mode Toggle */}
            <button
              type="button"
              onClick={() => setIsFullscreen((prev) => !prev)}
              title={isFullscreen ? "Exit Full-Screen Studio" : "Enter Full-Screen Studio"}
              className={`p-1.5 rounded-lg border text-xs font-semibold flex items-center justify-center transition-all cursor-pointer ${
                isFullscreen
                  ? "bg-primary/10 border-primary/30 text-primary shadow-xs"
                  : "bg-card border-border text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>

            {/* Reset to Default Button */}
            <button
              type="button"
              onClick={() => setIsResetModalOpen(true)}
              disabled={isResetting}
              title="Reset entire storefront to default appearance"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-destructive/30 bg-destructive/10 hover:bg-destructive/20 text-xs font-semibold text-destructive active:scale-95 transition-all cursor-pointer disabled:opacity-40"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reset to Default</span>
              <span className="sm:hidden">Reset</span>
            </button>

            {/* Save Draft Button */}
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={isSaving || !isDirty}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-card/90 text-xs font-semibold text-foreground active:scale-95 transition-all disabled:opacity-40 shadow-xs cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isSaving ? "Saving..." : "Save Draft"}</span>
            </button>

            {/* Publish Button */}
            <button
              type="button"
              onClick={handlePublish}
              disabled={isPublishing}
              className="inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 active:scale-95 transition-all shadow-md cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isPublishing ? "Publishing..." : "Publish"}</span>
            </button>
          </div>
        </header>

        {/* Global Feedback Banner if applicable */}
        {feedback && (
          <div
            className={`px-4 py-2 text-xs font-medium flex items-center justify-between border-b ${
              feedback.type === "success"
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : "bg-destructive/10 text-destructive border-destructive/20"
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{feedback.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-current opacity-70 hover:opacity-100 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Main 3-Panel Studio Layout */}
        <div className="flex-1 flex overflow-hidden min-h-0 relative">
          {/* 1. Left Panel: Structure & Reordering */}
          {leftPanelOpen && draftConfig && (
            <div className="absolute inset-y-0 left-0 z-40 lg:static flex h-full shadow-2xl lg:shadow-none bg-card">
              <StructurePanel
                sections={draftConfig.sections}
                selectedSectionId={selectedSectionId}
                selectedElementId={selectedElementId}
                onSelectSection={handleSelectSection}
                onSelectElement={handleSelectElement}
                onMoveUp={handleMoveUp}
                onMoveDown={handleMoveDown}
                onToggleVisibility={handleToggleVisibility}
                onDuplicate={handleDuplicate}
                onDelete={handleDelete}
                onOpenAddModal={() => setIsAddModalOpen(true)}
                onOpenAddElementModal={handleOpenAddElement}
                onMoveElement={handleMoveElement}
                onDeleteElement={handleDeleteElement}
                onClose={() => setLeftPanelOpen(false)}
              />
            </div>
          )}

          {/* 2. Center Panel: Live Storefront Preview Canvas */}
          <main
            data-testid="storefront-preview-canvas"
            className={`flex-1 h-full min-w-0 overflow-hidden relative flex flex-col ${
              previewDevice === "desktop"
                ? "bg-background"
                : "bg-neutral-950/60 p-4 sm:p-6 overflow-y-auto items-center justify-start"
            }`}
          >
            {previewDevice === "desktop" ? (
              /* Real Desktop Full-Viewport Storefront Preview */
              <div className="w-full h-full overflow-y-auto scrollbar-thin relative flex flex-col">
                {draftConfig ? (
                  <StorefrontLandingRenderer
                    config={draftConfig}
                    storeSlug={activeStore.slug}
                    storeName={activeStore.name}
                    storeCurrency={activeStore.role ? "USD" : "USD"}
                    products={products}
                    isPreview={true}
                    selectedSectionId={selectedSectionId || undefined}
                    selectedElementId={selectedElementId}
                    onSelectSection={handleSelectSection}
                    onSelectElement={handleSelectElement}
                    onOpenAddElement={handleOpenAddElement}
                  />
                ) : (
                  <div className="p-12 text-center text-muted-foreground my-auto">
                    No layout configuration available.
                  </div>
                )}
              </div>
            ) : previewDevice === "tablet" ? (
              /* Tablet Frame (768px) */
              <div className="w-[768px] max-w-full my-auto rounded-2xl border border-border/80 shadow-2xl overflow-hidden bg-background flex flex-col shrink-0 max-h-full">
                {/* Device Frame Top Bar */}
                <div className="h-8 px-4 bg-muted/80 border-b border-border flex items-center justify-between shrink-0 select-none text-[11px] font-mono text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-neutral-500/30" />
                    <div className="w-2.5 h-2.5 rounded-full bg-neutral-500/30" />
                    <div className="w-2.5 h-2.5 rounded-full bg-neutral-500/30" />
                  </div>
                  <div className="truncate max-w-xs font-semibold">
                    iPad / Tablet (768px) • {activeStore.slug}
                  </div>
                  <div className="w-6" />
                </div>

                <div className="overflow-y-auto max-h-[calc(100vh-160px)] scrollbar-thin">
                  {draftConfig ? (
                    <StorefrontLandingRenderer
                      config={draftConfig}
                      storeSlug={activeStore.slug}
                      storeName={activeStore.name}
                      storeCurrency={activeStore.role ? "USD" : "USD"}
                      products={products}
                      isPreview={true}
                      selectedSectionId={selectedSectionId || undefined}
                      selectedElementId={selectedElementId}
                      onSelectSection={handleSelectSection}
                      onSelectElement={handleSelectElement}
                      onOpenAddElement={handleOpenAddElement}
                    />
                  ) : (
                    <div className="p-12 text-center text-muted-foreground">
                      No layout configuration available.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Mobile Frame (375px) */
              <div className="w-[375px] max-w-full my-auto rounded-[2.5rem] border-4 border-neutral-700/80 shadow-2xl overflow-hidden bg-background flex flex-col shrink-0 max-h-full">
                {/* Dynamic Island Header */}
                <div className="h-9 px-6 bg-muted/90 border-b border-border flex items-center justify-between shrink-0 select-none text-[11px] font-mono text-muted-foreground">
                  <span className="text-[10px] font-semibold">9:41</span>
                  <div className="w-16 h-4 bg-neutral-900 rounded-full" />
                  <span className="text-[10px]">5G</span>
                </div>

                <div className="overflow-y-auto max-h-[calc(100vh-170px)] scrollbar-thin">
                  {draftConfig ? (
                    <StorefrontLandingRenderer
                      config={draftConfig}
                      storeSlug={activeStore.slug}
                      storeName={activeStore.name}
                      storeCurrency={activeStore.role ? "USD" : "USD"}
                      products={products}
                      isPreview={true}
                      selectedSectionId={selectedSectionId || undefined}
                      selectedElementId={selectedElementId}
                      onSelectSection={handleSelectSection}
                      onSelectElement={handleSelectElement}
                      onOpenAddElement={handleOpenAddElement}
                    />
                  ) : (
                    <div className="p-12 text-center text-muted-foreground">
                      No layout configuration available.
                    </div>
                  )}
                </div>
              </div>
            )}
          </main>

          {/* 3. Right Panel: Contextual Inspector */}
          {rightPanelOpen && (
            <div className="absolute inset-y-0 right-0 z-40 lg:static flex h-full shadow-2xl lg:shadow-none bg-card">
              <aside className="w-80 sm:w-[340px] shrink-0 border-l border-border bg-card/95 backdrop-blur-md flex flex-col h-full overflow-hidden z-20 shadow-xs">
                {/* Inspector Tabs */}
                <div className="flex items-center justify-between border-b border-border bg-muted/40 p-1.5 shrink-0">
                  <div className="flex items-center gap-1 flex-1">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedElementId(null);
                        setActiveTab("section");
                      }}
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-md flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        activeTab === "section" && !selectedElementId
                          ? "bg-card text-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Sliders className="w-3.5 h-3.5" />
                      <span>{selectedElementId ? "Section Settings" : "Section"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedElementId(null);
                        setActiveTab("theme");
                      }}
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-md flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        activeTab === "theme"
                          ? "bg-card text-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Palette className="w-3.5 h-3.5" />
                      <span>Theme</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setRightPanelOpen(false)}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer ml-1"
                    title="Collapse inspector"
                    aria-label="Collapse inspector"
                  >
                    <PanelRightClose className="w-4 h-4" />
                  </button>
                </div>

                {/* Inspector Content */}
                <div className="flex-1 overflow-y-auto">
                  {selectedElement && selectedSection ? (
                    <ElementEditor
                      element={selectedElement}
                      section={selectedSection}
                      onUpdate={handleUpdateElement}
                      onDelete={(id) => handleDeleteElement(selectedSection.id, id)}
                      onDuplicate={(id) => handleDuplicateElement(selectedSection.id, id)}
                      onBackToSection={() => setSelectedElementId(null)}
                      products={products}
                    />
                  ) : activeTab === "section" ? (
                    <SectionEditor
                      section={selectedSection}
                      onUpdateSection={handleUpdateSection}
                      onSelectElement={(elemId) => setSelectedElementId(elemId)}
                      onOpenAddElement={() => handleOpenAddElement(selectedSection?.id)}
                    />
                  ) : draftConfig ? (
                    <ThemeEditor
                      theme={draftConfig.theme}
                      onUpdateTheme={handleUpdateTheme}
                    />
                  ) : null}
                </div>
              </aside>
            </div>
          )}
        </div>
      </div>

      {/* Add Section Library Modal */}
      <AddSectionModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSelectSection={handleAddSection}
      />

      {/* Add Element Library Modal */}
      <AddElementModal
        isOpen={isAddElementModalOpen}
        onClose={() => setIsAddElementModalOpen(false)}
        onSelectElement={handleAddElement}
        sectionTitle={
          draftConfig?.sections.find((s) => s.id === (targetSectionForAddElement || selectedSectionId))?.title
        }
      />

      {/* Reset Website to Default Modal */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in-0 duration-200">
          <div className="w-full max-w-md rounded-2xl bg-card border border-border shadow-2xl p-6 space-y-5 text-foreground">
            {/* Modal Header */}
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-full bg-destructive/15 text-destructive flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-foreground">
                  Reset Website to Default
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Restore your entire storefront landing page to its original appearance before any customizations.
                </p>
              </div>
            </div>

            {/* Impact Details */}
            <div className="p-3.5 rounded-xl bg-muted/50 border border-border/80 space-y-2 text-xs">
              <p className="font-semibold text-foreground">What will be reset:</p>
              <ul className="space-y-1 text-muted-foreground list-disc list-inside">
                <li>All customized sections, ordering, and layouts</li>
                <li>Global and section background images and styles</li>
                <li>Custom typography, colors, animations, and buttons</li>
                <li>Custom carousel slides and promotional banners</li>
              </ul>
            </div>

            {/* Safe & Untouched Guarantee */}
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>
                <strong>Zero data loss:</strong> Products, orders, inventory, customers, and domain mappings remain safe.
              </span>
            </div>

            {/* Checkbox for Live Storefront */}
            <label className="flex items-center gap-2.5 text-xs text-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={resetLiveToo}
                onChange={(e) => setResetLiveToo(e.target.checked)}
                className="w-4 h-4 rounded border-border accent-primary cursor-pointer"
              />
              <span>Also reset published live storefront immediately</span>
            </label>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setIsResetModalOpen(false)}
                disabled={isResetting}
                className="px-4 py-2 rounded-xl border border-border bg-card text-xs font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                disabled={isResetting}
                className="px-4 py-2 rounded-xl bg-destructive text-destructive-foreground text-xs font-bold hover:bg-destructive/90 active:scale-95 transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? "animate-spin" : ""}`} />
                <span>{isResetting ? "Resetting..." : "Reset Everything to Default"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </MerchantShell>
  );
}
