"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Edit2,
  FolderPlus,
  Layers,
  Package,
  Search,
  Trash2,
  X,
} from "lucide-react";
import type { CollectionDTO } from "@calcart/products";
import {
  Alert,
  Badge,
  Button,
  Dialog,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@calcart/ui";

export interface CollectionListTableProps {
  collections: CollectionDTO[];
  total: number;
  storeSlug: string;
  storeId: string;
  isLoading: boolean;
  error: Error | null;
  searchTerm: string;
  statusFilter: "ALL" | "ACTIVE" | "ARCHIVED";
  onSearchChange: (search: string) => void;
  onStatusFilterChange: (status: "ALL" | "ACTIVE" | "ARCHIVED") => void;
  onDeleteCollection: (collectionId: string) => Promise<void>;
  onRefresh: () => void;
}

export function CollectionListTable({
  collections,
  total,
  storeSlug,
  isLoading,
  error,
  searchTerm,
  statusFilter,
  onSearchChange,
  onStatusFilterChange,
  onDeleteCollection,
  onRefresh,
}: CollectionListTableProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDeleteConfirm = async () => {
    if (!deletingId) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await onDeleteCollection(deletingId);
      setDeletingId(null);
      onRefresh();
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Failed to delete collection",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const activeCount = collections.filter((c) => c.status === "ACTIVE").length;
  const archivedCount = collections.filter((c) => c.status === "ARCHIVED").length;

  return (
    <div className="space-y-4">
      {error && (
        <Alert
          variant="danger"
          title="Error loading collections"
          action={
            <Button variant="outline" size="sm" onClick={onRefresh}>
              Retry
            </Button>
          }
        >
          {error.message || "Failed to load collections. Please try again."}
        </Alert>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-card border border-border rounded-xl">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg">
          <button
            type="button"
            onClick={() => onStatusFilterChange("ALL")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              statusFilter === "ALL"
                ? "bg-card text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All ({total})
          </button>
          <button
            type="button"
            onClick={() => onStatusFilterChange("ACTIVE")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              statusFilter === "ACTIVE"
                ? "bg-card text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Active ({activeCount})
          </button>
          <button
            type="button"
            onClick={() => onStatusFilterChange("ARCHIVED")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              statusFilter === "ARCHIVED"
                ? "bg-card text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Archived ({archivedCount})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search collections..."
            className="w-full h-9 pl-9 pr-8 text-xs bg-background border border-input rounded-lg focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all text-foreground placeholder:text-muted-foreground"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center space-y-3">
          <div className="w-8 h-8 mx-auto border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-muted-foreground">Loading collections...</p>
        </div>
      ) : collections.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-10 text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <Layers size={24} />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-foreground">
              {searchTerm ? "No matching collections found" : "No collections yet"}
            </h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              {searchTerm
                ? `No collections matched "${searchTerm}". Try another search term or clear the filter.`
                : "Collections help organize your products into themed groups for seasonal launches, categories, or featured highlights."}
            </p>
          </div>
          {searchTerm ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSearchChange("")}
            >
              Clear Search
            </Button>
          ) : (
            <Link href="/merchant/collections/new">
              <Button variant="primary" size="sm">
                <FolderPlus size={14} className="mr-1.5" />
                Create First Collection
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="w-[35%] text-xs font-semibold">Collection</TableHead>
                  <TableHead className="w-[15%] text-xs font-semibold">Status</TableHead>
                  <TableHead className="w-[15%] text-xs font-semibold text-right">Products</TableHead>
                  <TableHead className="w-[20%] text-xs font-semibold">Created</TableHead>
                  <TableHead className="w-[15%] text-xs font-semibold text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {collections.map((collection) => (
                  <TableRow
                    key={collection.id}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    <TableCell>
                      <div className="space-y-1">
                        <Link
                          href={`/merchant/collections/${collection.id}`}
                          className="font-medium text-xs text-foreground hover:text-primary transition-colors flex items-center gap-1.5 group"
                        >
                          <span className="font-semibold">{collection.title}</span>
                        </Link>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
                          <span>/{collection.slug}</span>
                          {collection.status === "ACTIVE" && (
                            <Link
                              href={`/stores/${storeSlug}/collections/${collection.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline inline-flex items-center gap-0.5 opacity-80 hover:opacity-100"
                              title="View on Storefront"
                            >
                              <span>view</span>
                              <ArrowUpRight size={10} />
                            </Link>
                          )}
                        </div>
                        {collection.description && (
                          <p className="text-[11px] text-muted-foreground line-clamp-1 max-w-md">
                            {collection.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {collection.status === "ACTIVE" ? (
                        <Badge variant="success" size="sm">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="neutral" size="sm">
                          Archived
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="inline-flex items-center gap-1 text-xs font-mono font-medium text-muted-foreground">
                        <Package size={12} className="opacity-70" />
                        {collection.productCount}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(collection.createdAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link href={`/merchant/collections/${collection.id}`}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                            title="Edit Collection"
                          >
                            <Edit2 size={13} />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive transition-colors"
                          onClick={() => setDeletingId(collection.id)}
                          title="Delete Collection"
                        >
                          <Trash2 size={13} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog
        isOpen={Boolean(deletingId)}
        onClose={() => {
          if (!isDeleting) {
            setDeletingId(null);
            setDeleteError(null);
          }
        }}
        title="Delete Collection"
      >
        <div className="space-y-4 pt-2">
          {deleteError && (
            <Alert variant="danger" title="Error deleting collection">
              {deleteError}
            </Alert>
          )}
          <p className="text-xs text-muted-foreground leading-relaxed">
            Are you sure you want to delete this collection? Products assigned to
            this collection will not be deleted from your catalog, but will no
            longer be grouped under this collection.
          </p>
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              disabled={isDeleting}
              onClick={() => {
                setDeletingId(null);
                setDeleteError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={isDeleting}
              onClick={handleDeleteConfirm}
            >
              Delete Collection
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
