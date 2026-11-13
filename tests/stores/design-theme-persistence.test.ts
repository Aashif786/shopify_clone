import { afterEach, describe, expect, it } from "vitest";
import { generateUuidV7, runMigrations } from "@calcart/db";
import { StoreService, normalizeLandingPageConfig } from "@calcart/stores";
import { applyDesignThemeToTheme } from "@calcart/stores/landing-page";
import { createIsolatedDatabase } from "../helpers/postgres.js";

describe("design theme draft / publish lifecycle", { timeout: 60_000 }, () => {
  let close: (() => Promise<void>) | undefined;
  const storeService = new StoreService();

  afterEach(async () => {
    if (close) {
      await close();
      close = undefined;
    }
  });

  async function setup() {
    const isolated = await createIsolatedDatabase();
    close = isolated.close;
    await runMigrations(isolated.database);
    const db = isolated.database;
    const ownerId = generateUuidV7();
    await db.query(
      `INSERT INTO users (id, email, name, password_hash, status)
       VALUES ($1, 'theme-owner@example.com', 'Owner', 'scrypt:hash', 'ACTIVE')`,
      [ownerId],
    );
    const store = await storeService.createStore(db, ownerId, { name: "Theme Store", slug: "theme-store" });
    return { db, ownerId, store };
  }

  it("persists the chosen theme and appearance toggle through save and publish", async () => {
    const { db, ownerId, store } = await setup();
    const initial = await storeService.getLandingPage(db, store.id, ownerId);
    // A store that never chose a theme starts on the original look.
    expect(normalizeLandingPageConfig(initial.draftConfig).theme.designTheme).toBe("rustic-heritage");

    const draft = {
      ...initial.draftConfig,
      theme: {
        ...applyDesignThemeToTheme(initial.draftConfig.theme, "luxury-editorial"),
        appearanceToggle: true,
      },
    };
    const saved = await storeService.saveLandingPageDraft(db, store.id, ownerId, draft);
    expect(saved.draftConfig.theme.designTheme).toBe("luxury-editorial");
    expect(saved.draftConfig.theme.appearanceToggle).toBe(true);

    const published = await storeService.publishLandingPage(db, store.id, ownerId);
    expect(published.publishedConfig?.theme.designTheme).toBe("luxury-editorial");
    expect(published.publishedConfig?.theme.appearanceToggle).toBe(true);
  });

  it("serves the storefront the published theme, never unsaved or unpublished draft state", async () => {
    const { db, ownerId, store } = await setup();
    const initial = await storeService.getLandingPage(db, store.id, ownerId);

    await storeService.saveLandingPageDraft(db, store.id, ownerId, {
      ...initial.draftConfig,
      theme: applyDesignThemeToTheme(initial.draftConfig.theme, "bold-contemporary"),
    });
    await storeService.publishLandingPage(db, store.id, ownerId);

    // The merchant keeps editing: the draft moves on, the published page must not.
    const afterEdit = await storeService.getLandingPage(db, store.id, ownerId);
    await storeService.saveLandingPageDraft(db, store.id, ownerId, {
      ...afterEdit.draftConfig,
      theme: applyDesignThemeToTheme(afterEdit.draftConfig.theme, "modern-minimal"),
    });

    const live = await storeService.getPublishedLandingPageBySlug(db, store.slug);
    expect(live.config?.theme.designTheme).toBe("bold-contemporary");

    const draftNow = await storeService.getLandingPage(db, store.id, ownerId);
    expect(draftNow.draftConfig.theme.designTheme).toBe("modern-minimal");
  });

  it("keeps merchant sections byte-for-byte when the theme changes", async () => {
    const { db, ownerId, store } = await setup();
    const initial = await storeService.getLandingPage(db, store.id, ownerId);
    const withCustomSection = {
      ...initial.draftConfig,
      sections: [
        ...initial.draftConfig.sections,
        {
          id: "sec_custom_cta",
          type: "promotional_banner" as const,
          title: "Custom Banner",
          isVisible: true,
          config: { bannerText: "Winter Sale Now On" },
        },
      ],
    };
    await storeService.saveLandingPageDraft(db, store.id, ownerId, withCustomSection);
    const before = JSON.stringify((await storeService.getLandingPage(db, store.id, ownerId)).draftConfig.sections);

    const current = await storeService.getLandingPage(db, store.id, ownerId);
    await storeService.saveLandingPageDraft(db, store.id, ownerId, {
      ...current.draftConfig,
      theme: applyDesignThemeToTheme(current.draftConfig.theme, "modern-minimal"),
    });
    const after = JSON.stringify((await storeService.getLandingPage(db, store.id, ownerId)).draftConfig.sections);
    expect(after).toBe(before);
  });
});
