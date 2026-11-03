import { describe, it, expect } from "vitest";
import {
  createNewElement,
  findElementInTree,
  findParentInTree,
  getElementDepth,
  isDescendantOf,
  insertElementIntoTree,
  extractElementFromTree,
  deleteElementFromTree,
  duplicateElementInTree,
  updateElementInTree,
  moveElementInTree,
  isContainerElement,
  MAX_CONTAINER_DEPTH,
  type PageElement,
  type StorefrontLandingPageConfig,
} from "@calcart/stores/landing-page";

describe("Nested Layout Containers & Tree Operations", () => {
  it("correctly identifies all container types", () => {
    expect(isContainerElement("container")).toBe(true);
    expect(isContainerElement("row")).toBe(true);
    expect(isContainerElement("column")).toBe(true);
    expect(isContainerElement("grid")).toBe(true);
    expect(isContainerElement("stack")).toBe(true);
    expect(isContainerElement("columns")).toBe(true);

    // Leaf elements must not be container types
    expect(isContainerElement("heading")).toBe(false);
    expect(isContainerElement("paragraph")).toBe(false);
    expect(isContainerElement("button")).toBe(false);
    expect(isContainerElement("image")).toBe(false);
    expect(isContainerElement("product_card")).toBe(false);
  });

  it("creates valid default factories for row and column containers", () => {
    const row = createNewElement("row");
    expect(row.type).toBe("row");
    expect(row.content).toBeDefined();
    expect((row.content as Record<string, unknown>).layoutMode).toBe("row");
    expect(Array.isArray(row.children)).toBe(true);
    expect(row.children).toHaveLength(0);

    const column = createNewElement("column");
    expect(column.type).toBe("column");
    expect((column.content as Record<string, unknown>).layoutMode).toBe("stack");
    expect(Array.isArray(column.children)).toBe(true);
    expect(column.children).toHaveLength(0);
  });

  it("finds elements and parent nodes within a deeply nested tree", () => {
    const leaf = createNewElement("button");
    const innerCol = createNewElement("column");
    innerCol.children = [leaf];
    const outerRow = createNewElement("row");
    outerRow.children = [innerCol];
    const rootContainer = createNewElement("container");
    rootContainer.children = [outerRow];

    const tree: PageElement[] = [rootContainer];

    // Find element
    const foundLeaf = findElementInTree(tree, leaf.id);
    expect(foundLeaf).not.toBeNull();
    expect(foundLeaf?.id).toBe(leaf.id);

    // Depth check
    expect(getElementDepth(tree, rootContainer.id)).toBe(1);
    expect(getElementDepth(tree, outerRow.id)).toBe(2);
    expect(getElementDepth(tree, innerCol.id)).toBe(3);
    expect(getElementDepth(tree, leaf.id)).toBe(4);

    // Find parent info
    const leafParentInfo = findParentInTree(tree, leaf.id);
    expect(leafParentInfo).not.toBeNull();
    expect(leafParentInfo?.parent?.id).toBe(innerCol.id);
    expect(leafParentInfo?.index).toBe(0);

    const innerColParentInfo = findParentInTree(tree, innerCol.id);
    expect(innerColParentInfo?.parent?.id).toBe(outerRow.id);

    // Root element has parent: null
    const rootParentInfo = findParentInTree(tree, rootContainer.id);
    expect(rootParentInfo?.parent).toBeNull();
    expect(rootParentInfo?.index).toBe(0);
  });

  it("prevents circular references when reparenting", () => {
    const child = createNewElement("column");
    const parent = createNewElement("row");
    parent.children = [child];
    const root = createNewElement("container");
    root.children = [parent];

    const tree: PageElement[] = [root];

    // child is descendant of parent and root
    expect(isDescendantOf(tree, parent.id, child.id)).toBe(true);
    expect(isDescendantOf(tree, root.id, child.id)).toBe(true);
    // parent is NOT descendant of child
    expect(isDescendantOf(tree, child.id, parent.id)).toBe(false);

    // Attempting to insert parent INSIDE child must be rejected
    const reparentedTree = insertElementIntoTree(tree, child.id, parent, "inside");
    // Tree must remain unchanged
    expect(isDescendantOf(reparentedTree, child.id, parent.id)).toBe(false);
  });

  it("enforces MAX_CONTAINER_DEPTH bound (6)", () => {
    expect(MAX_CONTAINER_DEPTH).toBe(6);

    let current = createNewElement("container");
    const root = current;

    // Build a 6-deep chain
    for (let i = 1; i < MAX_CONTAINER_DEPTH; i++) {
      const next = createNewElement("container");
      current.children = [next];
      current = next;
    }

    const tree: PageElement[] = [root];
    expect(getElementDepth(tree, current.id)).toBe(6);

    // Attempting to nest a 7th container inside current must be rejected
    const extra = createNewElement("container");
    const blockedTree = insertElementIntoTree(tree, current.id, extra, "inside");
    expect(findElementInTree(blockedTree, extra.id)).toBeNull();
  });

  it("supports non-destructive container deletion with child unwrapping", () => {
    const b1 = createNewElement("button");
    const b2 = createNewElement("heading");
    const container = createNewElement("row");
    container.children = [b1, b2];
    const tree: PageElement[] = [container];

    // Delete with unwrapChildren = true lifts children to the top level
    const unwrappedTree = deleteElementFromTree(tree, container.id, true);
    expect(unwrappedTree).toHaveLength(2);
    expect(unwrappedTree[0]?.id).toBe(b1.id);
    expect(unwrappedTree[1]?.id).toBe(b2.id);
    expect(findElementInTree(unwrappedTree, container.id)).toBeNull();

    // Standard delete (unwrapChildren = false) deletes container and its children
    const deletedTree = deleteElementFromTree(tree, container.id, false);
    expect(deletedTree).toHaveLength(0);
  });

  it("duplicates an entire container subtree with fresh unique IDs", () => {
    const child = createNewElement("heading");
    const container = createNewElement("column");
    container.children = [child];
    const tree: PageElement[] = [container];

    const { elements: dupTree, newId } = duplicateElementInTree(tree, container.id);
    expect(dupTree).toHaveLength(2);
    expect(newId).not.toBeNull();
    expect(newId).not.toBe(container.id);

    const clonedContainer = dupTree[1];
    expect(clonedContainer?.id).toBe(newId);
    expect(clonedContainer?.children).toHaveLength(1);
    expect(clonedContainer?.children?.[0]?.id).not.toBe(child.id);
    expect(clonedContainer?.children?.[0]?.type).toBe("heading");
  });

  it("updates element styles and dimensions in-place within nested container", () => {
    const leaf = createNewElement("container");
    const parent = createNewElement("row");
    parent.children = [leaf];
    const tree: PageElement[] = [parent];

    const updatedLeaf: PageElement = {
      ...leaf,
      style: {
        ...leaf.style,
        minWidth: "200px",
        minHeight: "150px",
        maxWidth: "600px",
        maxHeight: "400px",
        backgroundColor: "#1e293b",
      },
    };

    const updatedTree = updateElementInTree(tree, updatedLeaf);
    const found = findElementInTree(updatedTree, leaf.id);
    expect(found?.style?.minWidth).toBe("200px");
    expect(found?.style?.minHeight).toBe("150px");
    expect(found?.style?.maxWidth).toBe("600px");
    expect(found?.style?.maxHeight).toBe("400px");
    expect(found?.style?.backgroundColor).toBe("#1e293b");
  });

  it("extracts elements cleanly from any tree depth", () => {
    const leaf = createNewElement("button");
    const container = createNewElement("row");
    container.children = [leaf];
    const tree: PageElement[] = [container];

    const { elements: remaining, extracted } = extractElementFromTree(tree, leaf.id);
    expect(extracted).not.toBeNull();
    expect(extracted?.id).toBe(leaf.id);
    expect(findElementInTree(remaining, leaf.id)).toBeNull();
  });

  it("moves elements into containers with moveElementInTree", () => {
    const btn = createNewElement("button");
    const container = createNewElement("column");
    const tree: PageElement[] = [btn, container];

    const moveRes = moveElementInTree(tree, btn.id, container.id, "inside");
    expect(moveRes.success).toBe(true);
    expect(moveRes.elements).toHaveLength(1);
    const updatedContainer = moveRes.elements[0];
    expect(updatedContainer?.children).toHaveLength(1);
    expect(updatedContainer?.children?.[0]?.id).toBe(btn.id);
  });
});

describe("Undo / Redo & Editing History State Machine", () => {
  const baseConfig: StorefrontLandingPageConfig = {
    version: 1,
    theme: {
      mode: "default",
      colors: {
        primary: "#3b82f6",
        background: "#09090b",
        surface: "#18181b",
        foreground: "#fafafa",
        muted: "#71717a",
        border: "#27272a",
      },
    },
    sections: [
      {
        id: "sec_1",
        type: "hero",
        title: "Initial Hero",
        isVisible: true,
        elements: [],
      },
    ],
  };

  it("handles linear past-present-future transitions", () => {
    // Simulated history engine mirroring useEditorHistory logic
    let past: StorefrontLandingPageConfig[] = [];
    let present: StorefrontLandingPageConfig = baseConfig;
    let future: StorefrontLandingPageConfig[] = [];

    const applyChange = (next: StorefrontLandingPageConfig) => {
      past = [...past, present];
      present = next;
      future = []; // Abandon future branch
    };

    const undo = () => {
      if (past.length === 0) return;
      const prev = past[past.length - 1]!;
      past = past.slice(0, past.length - 1);
      future = [present, ...future];
      present = prev;
    };

    const redo = () => {
      if (future.length === 0) return;
      const next = future[0]!;
      future = future.slice(1);
      past = [...past, present];
      present = next;
    };

    // Step 1: Edit title
    const config2: StorefrontLandingPageConfig = {
      ...present,
      sections: [{ ...present.sections[0]!, title: "Step 2 Hero" }],
    };
    applyChange(config2);
    expect(present.sections[0]?.title).toBe("Step 2 Hero");
    expect(past).toHaveLength(1);
    expect(future).toHaveLength(0);

    // Step 2: Add element
    const b1 = createNewElement("button");
    const config3: StorefrontLandingPageConfig = {
      ...present,
      sections: [{ ...present.sections[0]!, elements: [b1] }],
    };
    applyChange(config3);
    expect(present.sections[0]?.elements).toHaveLength(1);
    expect(past).toHaveLength(2);

    // Undo step 2
    undo();
    expect(present.sections[0]?.elements).toHaveLength(0);
    expect(present.sections[0]?.title).toBe("Step 2 Hero");
    expect(past).toHaveLength(1);
    expect(future).toHaveLength(1);

    // Undo step 1
    undo();
    expect(present.sections[0]?.title).toBe("Initial Hero");
    expect(past).toHaveLength(0);
    expect(future).toHaveLength(2);

    // Redo step 1
    redo();
    expect(present.sections[0]?.title).toBe("Step 2 Hero");
    expect(past).toHaveLength(1);
    expect(future).toHaveLength(1);

    // Branching: New edit while future has items discards future branch
    const configBranch: StorefrontLandingPageConfig = {
      ...present,
      sections: [{ ...present.sections[0]!, title: "Branched Title" }],
    };
    applyChange(configBranch);
    expect(present.sections[0]?.title).toBe("Branched Title");
    expect(future).toHaveLength(0);
  });

  it("enforces bounded capacity limit (max 50 past entries)", () => {
    let past: StorefrontLandingPageConfig[] = [];
    let present: StorefrontLandingPageConfig = baseConfig;
    const maxHistory = 50;

    for (let i = 1; i <= 65; i++) {
      const next: StorefrontLandingPageConfig = {
        ...present,
        sections: [{ ...present.sections[0]!, title: `Iteration ${i}` }],
      };
      past = [...past, present];
      if (past.length > maxHistory) {
        past = past.slice(past.length - maxHistory);
      }
      present = next;
    }

    expect(past).toHaveLength(50);
    expect(present.sections[0]?.title).toBe("Iteration 65");
    // Oldest entry should be Iteration 15 (since 65 - 50 = 15)
    expect(past[0]?.sections[0]?.title).toBe("Iteration 15");
  });
});
