"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { MerchantShell } from "@/components/merchant/MerchantShell";
import { useStore } from "@/context/store-context";
import { apiClient, ApiClientError } from "@/lib/api-client";
import { ThemeEditor } from "@/components/merchant/landing-page/theme-editor";
import { StorefrontLandingRenderer } from "@/components/storefront/landing-page/storefront-landing-renderer";
import type {
  LandingPageTheme,
  StorefrontLandingPageConfig,
  StorefrontLandingPageDTO,
} from "@calcart/stores/landing-page";
import {
  Palette,
  Check,
  Save,
  Send,
  ExternalLink,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  Layers,
} from "lucide-react";
import { Button, Alert, Spinner } from "@calcart/ui";

export default function MerchantStoreThemePage() {
  const { activeStore, stores, selectStore, isLoading: isStoreLoading } = useStore();

  const [draftConfig, setDraftConfig] = useState<StorefrontLandingPageConfig | null>(null);
  const [theme, setTheme] = useState<LandingPageTheme | null>(null);
  const [initialThemeJson, setInitialThemeJson] = useState<string>("");

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showLivePreview, setShowLivePreview] = useState(true);

  // Load landing page and theme config
  const fetchLandingPage = useCallback(async () => {
    if (!activeStore?.id) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await apiClient.get<StorefrontLandingPageDTO>(
        `/api/v1/stores/${activeStore.id}/landing-page`,
      );
      if (data?.draftConfig) {
        setDraftConfig(data.draftConfig);
        setTheme(data.draftConfig.theme);
        setInitialThemeJson(JSON.stringify(data.draftConfig.theme));
      }
    } catch (err) {
      const message =
        err instanceof ApiClientError ? err.message : "Failed to load store theme configuration";
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  }, [activeStore?.id]);

  useEffect(() => {
    if (activeStore?.id) {
      fetchLandingPage();
    }
  }, [activeStore?.id, fetchLandingPage]);

  // Handle local theme update
  const handleUpdateTheme = (updatedTheme: LandingPageTheme) => {
    setTheme(updatedTheme);
    if (draftConfig) {
      setDraftConfig({
        ...draftConfig,
        theme: updatedTheme,
      });
    }
  };

  const isDirty = Boolean(theme && initialThemeJson && JSON.stringify(theme) !== initialThemeJson);

  // Save draft
  const handleSaveDraft = async () => {
    if (!activeStore?.id || !draftConfig || !theme) return;
    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const updatedConfig: StorefrontLandingPageConfig = {
        ...draftConfig,
        theme,
      };
      const data = await apiClient.put<StorefrontLandingPageDTO>(
        `/api/v1/stores/${activeStore.id}/landing-page`,
        { draftConfig: updatedConfig },
      );
      if (data?.draftConfig) {
        setDraftConfig(data.draftConfig);
        setTheme(data.draftConfig.theme);
        setInitialThemeJson(JSON.stringify(data.draftConfig.theme));
      }
      setSuccessMessage("Theme settings saved as draft successfully.");
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err) {
      const message =
        err instanceof ApiClientError ? err.message : "Failed to save theme settings";
      setErrorMessage(message);
    } finally {
      setIsSaving(false);
    }
  };

  // Publish theme to live storefront
  const handlePublishTheme = async () => {
    if (!activeStore?.id || !draftConfig || !theme) return;
    setIsPublishing(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const updatedConfig: StorefrontLandingPageConfig = {
        ...draftConfig,
        theme,
      };
      // Save draft first
      await apiClient.put(`/api/v1/stores/${activeStore.id}/landing-page`, {
        draftConfig: updatedConfig,
      });

      // Publish
      const data = await apiClient.post<StorefrontLandingPageDTO>(
        `/api/v1/stores/${activeStore.id}/landing-page/publish`,
        {},
      );
      if (data?.draftConfig) {
        setDraftConfig(data.draftConfig);
        setTheme(data.draftConfig.theme);
        setInitialThemeJson(JSON.stringify(data.draftConfig.theme));
      }
      setSuccessMessage("Store theme published live to storefront!");
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      const message =
        err instanceof ApiClientError ? err.message : "Failed to publish store theme";
      setErrorMessage(message);
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <MerchantShell
      title="Store Theme"
      activePath="/merchant/theme"
      currentStore={activeStore ? { id: activeStore.id, name: activeStore.name, slug: activeStore.slug } : undefined}
      stores={stores.map((s) => ({ id: s.id, name: s.name, slug: s.slug }))}
      onSelectStore={selectStore}
    >
      <div className="space-y-6 max-w-7xl mx-auto pb-16">
        {/* Header with Title and Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/80">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
                <Palette className="w-5 h-5" />
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Store Theme</h1>
              <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground font-mono">
                Global Settings
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Configure global viewport max width, typography, color palettes, and storefront visual design.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {activeStore && (
              <div className="hidden sm:flex items-center gap-1.5 mr-1 font-mono text-[11px] text-muted-foreground">
                <span className="font-semibold text-muted-foreground/80">calcart</span>
                <Link
                  href={`/stores/${encodeURIComponent(activeStore.slug)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border bg-card/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-all shadow-2xs"
                  title="Open live published storefront"
                >
                  <span>/stores/{activeStore.slug}</span>
                  <ExternalLink className="w-3 h-3 text-primary" />
                </Link>
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowLivePreview((prev) => !prev)}
              className="gap-1.5 text-xs hidden lg:inline-flex"
            >
              {showLivePreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{showLivePreview ? "Hide Preview" : "Show Preview"}</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleSaveDraft}
              disabled={isSaving || isPublishing || !isDirty}
              className="gap-1.5 text-xs"
            >
              {isSaving ? <Spinner size="sm" /> : <Save className="w-3.5 h-3.5" />}
              <span>Save Draft</span>
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={handlePublishTheme}
              disabled={isSaving || isPublishing}
              className="gap-1.5 text-xs"
            >
              {isPublishing ? <Spinner size="sm" /> : <Send className="w-3.5 h-3.5" />}
              <span>Publish Theme</span>
            </Button>
          </div>
        </div>

        {/* Feedback Alerts */}
        {errorMessage && (
          <Alert variant="danger" className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="text-xs">{errorMessage}</span>
          </Alert>
        )}

        {successMessage && (
          <Alert variant="success" className="flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span className="text-xs font-semibold">{successMessage}</span>
          </Alert>
        )}

        {/* Quick Nav Banner to Landing Page Studio */}
        <div className="flex items-center justify-between p-3.5 rounded-xl border border-primary/20 bg-primary/5 text-xs">
          <div className="flex items-center gap-2.5">
            <Layers className="w-4 h-4 text-primary shrink-0" />
            <span>
              Looking to add, remove, or reorder sections and elements? Go to the dedicated{" "}
              <strong className="text-foreground">Landing Page Studio</strong>.
            </span>
          </div>
          <Link
            href="/merchant/landing-page"
            className="inline-flex items-center gap-1.5 font-semibold text-primary hover:underline ml-4 shrink-0"
          >
            <span>Landing Page Studio</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Main Content Area */}
        {isLoading || isStoreLoading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3">
            <Spinner size="lg" />
            <p className="text-sm text-muted-foreground">Loading store theme settings...</p>
          </div>
        ) : !theme ? (
          <div className="py-20 text-center space-y-3">
            <Palette className="w-10 h-10 text-muted-foreground mx-auto stroke-1" />
            <h3 className="text-base font-semibold text-foreground">No Store Theme Found</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Select an active store from the dropdown above to configure its global theme and layout settings.
            </p>
          </div>
        ) : (
          <div className={`grid grid-cols-1 ${showLivePreview ? "lg:grid-cols-12" : ""} gap-6 items-start`}>
            {/* Left: Complete Global Theme Settings */}
            <div className={`${showLivePreview ? "lg:col-span-7 xl:col-span-6" : "w-full"} rounded-2xl border border-border bg-card shadow-sm overflow-hidden`}>
              <div className="p-4 border-b border-border/80 bg-muted/20 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-foreground">Theme & Layout Controls</h2>
                  <p className="text-[11px] text-muted-foreground">
                    Modifications update draft settings immediately. Click &quot;Publish Theme&quot; to push live.
                  </p>
                </div>
                {isDirty && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                    Unsaved edits
                  </span>
                )}
              </div>

              <div className="max-h-[calc(100vh-280px)] overflow-y-auto overscroll-contain">
                <ThemeEditor
                  theme={theme}
                  onUpdateTheme={handleUpdateTheme}
                  storeId={activeStore?.id}
                />
              </div>
            </div>

            {/* Right: Live Interactive Storefront Preview */}
            {showLivePreview && (
              <div className="hidden lg:block lg:col-span-5 xl:col-span-6 sticky top-6 rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
                <div className="p-4 border-b border-border/80 bg-muted/20 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-primary" />
                    <div>
                      <h2 className="text-sm font-bold text-foreground">Live Storefront Preview</h2>
                      <p className="text-[11px] text-muted-foreground">
                        Simulated viewport with your current theme & max width settings.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-muted-foreground">
                      Max Width: <strong className="text-foreground">{theme?.layout?.maxWidth || "standard"}</strong>
                    </span>
                  </div>
                </div>

                <div className="h-[calc(100vh-280px)] overflow-y-auto overscroll-contain bg-background/50 p-2 sm:p-4">
                  <div className="rounded-xl border border-border/60 overflow-hidden shadow-xs bg-background min-h-full">
                    {draftConfig && activeStore && (
                      <StorefrontLandingRenderer
                        config={{
                          ...draftConfig,
                          theme,
                        }}
                        storeSlug={activeStore.slug}
                        storeName={activeStore.name}
                        storeCurrency={activeStore.currency || "USD"}
                        isPreview={true}
                      />
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </MerchantShell>
  );
}
