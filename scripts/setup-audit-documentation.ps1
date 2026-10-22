# PowerShell script: setup-audit-documentation.ps1
# Repeatable, idempotent documentation structure initializer for Cal Cart Product Maturity Audit

$ErrorActionPreference = "Stop"

$docsRoot = Join-Path $PSScriptRoot "..\docs"
if (-not (Test-Path $docsRoot)) {
    $docsRoot = Resolve-Path "docs"
}

Write-Host "Verifying documentation structure at: $docsRoot"

$directories = @(
    "audit",
    "frontend",
    "observability",
    "security",
    "engineering"
)

foreach ($dir in $directories) {
    $targetDir = Join-Path $docsRoot $dir
    if (-not (Test-Path $targetDir)) {
        New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
        Write-Host "Created directory: docs/$dir"
    } else {
        Write-Host "Directory already exists: docs/$dir"
    }
}

$placeholderFiles = @(
    @{
        Path = "audit/product-maturity-audit.md"
        Title = "# Cal Cart: Product Maturity Audit"
        Description = "Comprehensive evidence-based audit across modules, user journeys, architecture, and reliability."
    },
    @{
        Path = "audit/gap-register.md"
        Title = "# Cal Cart: Prioritized Gap Register"
        Description = "Structured inventory of confirmed defects, missing features, technical debt, and suspected risks."
    },
    @{
        Path = "audit/implementation-roadmap.md"
        Title = "# Cal Cart: Dependency-Aware Implementation Roadmap"
        Description = "Milestones and prioritized delivery plan grouped into small, dependency-aware increments."
    },
    @{
        Path = "frontend/routes-and-navigation.md"
        Title = "# Frontend Routes, Navigation & Layout Architecture"
        Description = "Inventory of merchant and customer storefront route trees, layouts, and access rules."
    },
    @{
        Path = "frontend/design-system-and-tokens.md"
        Title = "# Design System, Themes & Component Tokens"
        Description = "Unified color tokens, typography, dark/light theme tokens, and shared UI component usage."
    },
    @{
        Path = "observability/performance-and-monitoring.md"
        Title = "# Performance, Observability & Health Monitoring"
        Description = "System performance benchmarks, health check conventions, structured logging, and tracing."
    },
    @{
        Path = "security/threat-model.md"
        Title = "# Security Threat Model & Defense-in-Depth Strategy"
        Description = "Threat modeling across tenant boundaries, auth sessions, payments, and external integrations."
    },
    @{
        Path = "engineering/technical-debt.md"
        Title = "# Technical Debt & Codebase Maintainability Register"
        Description = "Inventory of architectural debt, redundant implementations, and refactoring targets."
    }
)

foreach ($file in $placeholderFiles) {
    $targetPath = Join-Path $docsRoot $file.Path
    if (-not (Test-Path $targetPath)) {
        $content = @"
$($file.Title)

> $($file.Description)

## Status
Audit in progress.

## Overview
This document is established as part of the Cal Cart Comprehensive Product Maturity Audit.
"@
        Set-Content -Path $targetPath -Value $content -Encoding UTF8
        Write-Host "Created placeholder: docs/$($file.Path)"
    } else {
        Write-Host "File already exists: docs/$($file.Path)"
    }
}

Write-Host "Documentation structure setup completed successfully."
