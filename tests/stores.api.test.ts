import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  generateUuidV7,
  runMigrations,
  type Database,
} from "@shopify-clone/db";
import { serializeSessionCookie } from "@shopify-clone/auth";
import { createIsolatedDatabase } from "./helpers/postgres.js";

import {
  GET as getStores,
  POST as postStores,
} from "../apps/web/app/api/v1/stores/route.js";
import {
  GET as getStore,
  PATCH as patchStore,
} from "../apps/web/app/api/v1/stores/[storeId]/route.js";
import { POST as activateStore } from "../apps/web/app/api/v1/stores/[storeId]/activate/route.js";
import { POST as suspendStore } from "../apps/web/app/api/v1/stores/[storeId]/suspend/route.js";
import { POST as reactivateStore } from "../apps/web/app/api/v1/stores/[storeId]/reactivate/route.js";
import { POST as archiveStore } from "../apps/web/app/api/v1/stores/[storeId]/archive/route.js";
import {
  GET as getMembers,
  POST as postMember,
} from "../apps/web/app/api/v1/stores/[storeId]/members/route.js";
import {
  DELETE as deleteMember,
  PATCH as patchMember,
} from "../apps/web/app/api/v1/stores/[storeId]/members/[memberId]/route.js";

declare global {
  var __shopify_clone_web_db: unknown;
}

describe("Stores API Endpoints (/api/v1/stores/*)", { timeout: 30_000 }, () => {
  let close: (() => Promise<void>) | undefined;
  let db: Database;

  beforeEach(async () => {
    const isolated = await createIsolatedDatabase();
    close = isolated.close;
    await runMigrations(isolated.database);
    db = isolated.database;
    global.__shopify_clone_web_db = isolated.database;
  });

  afterEach(async () => {
    global.__shopify_clone_web_db = undefined;
    if (close) {
      await close();
      close = undefined;
    }
  });

  async function createAuthenticatedUser(email: string) {
    const userId = generateUuidV7();
    const sessionId = generateUuidV7();

    await db.query(
      `INSERT INTO users (id, email, name, password_hash, status)
       VALUES ($1, $2, 'User', 'scrypt:hash', 'ACTIVE')`,
      [userId, email],
    );

    const expiresAt = new Date(Date.now() + 86400000);
    await db.query(
      `INSERT INTO sessions (id, user_id, expires_at)
       VALUES ($1, $2, $3)`,
      [sessionId, userId, expiresAt],
    );

    const cookie = serializeSessionCookie(sessionId, { expires: expiresAt });
    return { userId, sessionId, cookie };
  }

  describe("POST /api/v1/stores", () => {
    it("rejects unauthenticated request with 401 AUTHENTICATION_REQUIRED", async () => {
      const req = new Request("http://localhost:3000/api/v1/stores", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Unauthenticated Store" }),
      });

      const res = await postStores(req);
      expect(res.status).toBe(401);

      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("AUTHENTICATION_REQUIRED");
    });

    it("rejects invalid request body with 400 VALIDATION_ERROR", async () => {
      const user = await createAuthenticatedUser("owner@test.com");
      const req = new Request("http://localhost:3000/api/v1/stores", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: user.cookie,
        },
        body: JSON.stringify({ name: "" }), // empty name
      });

      const res = await postStores(req);
      expect(res.status).toBe(400);

      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("creates a new store and returns 201 with store DTO", async () => {
      const user = await createAuthenticatedUser("owner@test.com");
      const req = new Request("http://localhost:3000/api/v1/stores", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: user.cookie,
        },
        body: JSON.stringify({
          name: "My First Store",
          slug: "my-first-store",
          currency: "USD",
          locale: "en-US",
          timezone: "UTC",
          contactEmail: "hello@myfirststore.com",
        }),
      });

      const res = await postStores(req);
      expect(res.status).toBe(201);

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.name).toBe("My First Store");
      expect(body.data.slug).toBe("my-first-store");
      expect(body.data.status).toBe("DRAFT");
      expect(body.data.settings.contactEmail).toBe("hello@myfirststore.com");
    });

    it("rejects duplicate slug with 409 STORE_SLUG_ALREADY_EXISTS", async () => {
      const user = await createAuthenticatedUser("owner@test.com");
      const firstReq = new Request("http://localhost:3000/api/v1/stores", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: user.cookie,
        },
        body: JSON.stringify({ name: "Store Alpha", slug: "store-alpha" }),
      });
      await postStores(firstReq);

      const secondReq = new Request("http://localhost:3000/api/v1/stores", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: user.cookie,
        },
        body: JSON.stringify({ name: "Store Alpha Dupe", slug: "store-alpha" }),
      });
      const res = await postStores(secondReq);
      expect(res.status).toBe(409);

      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("STORE_SLUG_ALREADY_EXISTS");
    });
  });

  describe("GET /api/v1/stores", () => {
    it("returns stores accessible to the authenticated user", async () => {
      const user = await createAuthenticatedUser("owner@test.com");
      const postReq = new Request("http://localhost:3000/api/v1/stores", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: user.cookie,
        },
        body: JSON.stringify({ name: "Listed Store" }),
      });
      await postStores(postReq);

      const getReq = new Request("http://localhost:3000/api/v1/stores", {
        headers: { cookie: user.cookie },
      });
      const res = await getStores(getReq);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.items).toHaveLength(1);
      expect(body.data.items[0].name).toBe("Listed Store");
    });
  });

  describe("GET & PATCH /api/v1/stores/[storeId]", () => {
    it("returns 200 with store details for authorized member", async () => {
      const user = await createAuthenticatedUser("owner@test.com");
      const createRes = await postStores(
        new Request("http://localhost:3000/api/v1/stores", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: user.cookie,
          },
          body: JSON.stringify({ name: "Get Test Store" }),
        }),
      );
      const created = (await createRes.json()).data;

      const getRes = await getStore(
        new Request(`http://localhost:3000/api/v1/stores/${created.id}`, {
          headers: { cookie: user.cookie },
        }),
        { params: Promise.resolve({ storeId: created.id }) },
      );
      expect(getRes.status).toBe(200);

      const body = await getRes.json();
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(created.id);
    });

    it("returns 404 NOT_FOUND when accessed by user with no membership (tenant-safe 404)", async () => {
      const owner = await createAuthenticatedUser("owner@test.com");
      const stranger = await createAuthenticatedUser("stranger@other.com");

      const createRes = await postStores(
        new Request("http://localhost:3000/api/v1/stores", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: owner.cookie,
          },
          body: JSON.stringify({ name: "Private Store" }),
        }),
      );
      const created = (await createRes.json()).data;

      const res = await getStore(
        new Request(`http://localhost:3000/api/v1/stores/${created.id}`, {
          headers: { cookie: stranger.cookie },
        }),
        { params: Promise.resolve({ storeId: created.id }) },
      );
      // Safe 404 so existence is not revealed across tenants
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error.code).toBe("NOT_FOUND");
    });

    it("updates store configuration via PATCH", async () => {
      const user = await createAuthenticatedUser("owner@test.com");
      const createRes = await postStores(
        new Request("http://localhost:3000/api/v1/stores", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: user.cookie,
          },
          body: JSON.stringify({ name: "Initial Store Name" }),
        }),
      );
      const created = (await createRes.json()).data;

      const patchRes = await patchStore(
        new Request(`http://localhost:3000/api/v1/stores/${created.id}`, {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            cookie: user.cookie,
          },
          body: JSON.stringify({
            name: "Updated Store Name",
            description: "Updated description",
          }),
        }),
        { params: Promise.resolve({ storeId: created.id }) },
      );
      expect(patchRes.status).toBe(200);

      const body = await patchRes.json();
      expect(body.data.name).toBe("Updated Store Name");
      expect(body.data.settings.description).toBe("Updated description");
    });
  });

  describe("Lifecycle Endpoints: /activate, /suspend, /reactivate, /archive", () => {
    it("transitions store through full lifecycle via endpoints", async () => {
      const user = await createAuthenticatedUser("owner@test.com");
      const createRes = await postStores(
        new Request("http://localhost:3000/api/v1/stores", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: user.cookie,
          },
          body: JSON.stringify({ name: "Lifecycle Store" }),
        }),
      );
      const storeId = (await createRes.json()).data.id;

      // 1. Activate
      const actRes = await activateStore(
        new Request(`http://localhost:3000/api/v1/stores/${storeId}/activate`, {
          method: "POST",
          headers: { cookie: user.cookie },
        }),
        { params: Promise.resolve({ storeId }) },
      );
      expect(actRes.status).toBe(200);
      expect((await actRes.json()).data.status).toBe("ACTIVE");

      // 2. Suspend
      const suspRes = await suspendStore(
        new Request(`http://localhost:3000/api/v1/stores/${storeId}/suspend`, {
          method: "POST",
          headers: { cookie: user.cookie },
        }),
        { params: Promise.resolve({ storeId }) },
      );
      expect(suspRes.status).toBe(200);
      expect((await suspRes.json()).data.status).toBe("SUSPENDED");

      // 3. Reactivate
      const reactRes = await reactivateStore(
        new Request(
          `http://localhost:3000/api/v1/stores/${storeId}/reactivate`,
          {
            method: "POST",
            headers: { cookie: user.cookie },
          },
        ),
        { params: Promise.resolve({ storeId }) },
      );
      expect(reactRes.status).toBe(200);
      expect((await reactRes.json()).data.status).toBe("ACTIVE");

      // 4. Archive
      const archRes = await archiveStore(
        new Request(`http://localhost:3000/api/v1/stores/${storeId}/archive`, {
          method: "POST",
          headers: { cookie: user.cookie },
        }),
        { params: Promise.resolve({ storeId }) },
      );
      expect(archRes.status).toBe(200);
      expect((await archRes.json()).data.status).toBe("ARCHIVED");
    });
  });

  describe("Member Management Endpoints: /members and /members/[memberId]", () => {
    it("manages members and prevents deleting the last active owner", async () => {
      const owner = await createAuthenticatedUser("owner@test.com");
      const colleague = await createAuthenticatedUser("colleague@test.com");

      const createRes = await postStores(
        new Request("http://localhost:3000/api/v1/stores", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: owner.cookie,
          },
          body: JSON.stringify({ name: "Team Store" }),
        }),
      );
      const storeId = (await createRes.json()).data.id;

      // Add colleague as staff
      const addRes = await postMember(
        new Request(`http://localhost:3000/api/v1/stores/${storeId}/members`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: owner.cookie,
          },
          body: JSON.stringify({ userId: colleague.userId, role: "staff" }),
        }),
        { params: Promise.resolve({ storeId }) },
      );
      expect(addRes.status).toBe(201);
      const addedMember = (await addRes.json()).data;
      expect(addedMember.role).toBe("staff");

      // List members
      const listRes = await getMembers(
        new Request(`http://localhost:3000/api/v1/stores/${storeId}/members`, {
          headers: { cookie: owner.cookie },
        }),
        { params: Promise.resolve({ storeId }) },
      );
      expect(listRes.status).toBe(200);
      const members = (await listRes.json()).data.items;
      expect(members).toHaveLength(2);

      // Promote colleague to admin
      const patchMemberRes = await patchMember(
        new Request(
          `http://localhost:3000/api/v1/stores/${storeId}/members/${addedMember.id}`,
          {
            method: "PATCH",
            headers: {
              "content-type": "application/json",
              cookie: owner.cookie,
            },
            body: JSON.stringify({ role: "admin" }),
          },
        ),
        { params: Promise.resolve({ storeId, memberId: addedMember.id }) },
      );
      expect(patchMemberRes.status).toBe(200);
      expect((await patchMemberRes.json()).data.role).toBe("admin");

      // Attempting to delete the only owner must fail with 400
      const ownerMember = members.find(
        (m: { userId: string; id: string }) => m.userId === owner.userId,
      )!;
      const deleteOwnerRes = await deleteMember(
        new Request(
          `http://localhost:3000/api/v1/stores/${storeId}/members/${ownerMember.id}`,
          {
            method: "DELETE",
            headers: { cookie: owner.cookie },
          },
        ),
        { params: Promise.resolve({ storeId, memberId: ownerMember.id }) },
      );
      expect(deleteOwnerRes.status).toBe(400);
      expect((await deleteOwnerRes.json()).error.code).toBe(
        "CANNOT_REMOVE_LAST_OWNER",
      );

      // Deleting colleague should succeed
      const deleteColleagueRes = await deleteMember(
        new Request(
          `http://localhost:3000/api/v1/stores/${storeId}/members/${addedMember.id}`,
          {
            method: "DELETE",
            headers: { cookie: owner.cookie },
          },
        ),
        { params: Promise.resolve({ storeId, memberId: addedMember.id }) },
      );
      expect(deleteColleagueRes.status).toBe(200);
    });
  });
});
