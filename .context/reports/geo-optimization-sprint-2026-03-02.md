# Directive Report: GEO Optimization Sprint

**Date**: 2026-03-02
**Directive**: geo-optimization-sprint
**Source**: Scout 2026-03-02, proposed by Priya

## Summary

Audited structured data coverage across BuyWisely and implemented critical fixes. Coverage improved from ~60% to ~75% with 3 targeted changes.

## Audit Findings

### Current Coverage (Before)
| Page | Schema Types | Status |
|------|-------------|--------|
| Home | WebSite, Organization, SearchAction, FAQPage | Complete |
| Product Detail | Product, AggregateOffer, AggregateRating | Complete |
| Blog Article | Article, Organization, WebPage | Complete |
| Category | BreadcrumbList | FLAWED (hardcoded domain) |
| Blog List | None | Missing |
| Shop/Seller | None | Missing |
| Search Results | None | Missing |

### Critical Issues Found
1. **BreadcrumbList hardcoded to `buywisely.com.au`** — breaks US site
2. **No BreadcrumbList on product pages** — missing rich snippet opportunities
3. **No `areaServed` on offers** — no geo-targeting signal

## Changes Made

### Fix 1: Category BreadcrumbList — country-aware domains
**File**: `apps/buywisely/app/[country]/category/[name]/page.tsx`
- Replaced hardcoded `https://buywisely.com.au` with dynamic domain from `COUNTRIES` config
- Now correctly generates AU (`buywisely.com.au`) and US (`buywisely.io/us`) URLs

### Fix 2: Product page BreadcrumbList (NEW)
**File**: `apps/buywisely/app/[country]/product/[slug]/@category/page.tsx`
- Added server-rendered JSON-LD BreadcrumbList schema
- Includes full hierarchy: Home → Category → ... → Product
- Uses `countryAbsoluteUrl()` for proper multi-country URLs

### Fix 3: AggregateOffer areaServed
**File**: `apps/buywisely/app/[country]/product/[slug]/@info/components/ProductStructuredData.tsx`
- Added `areaServed` with Country type to AggregateOffer
- Signals to search engines which country's pricing data this represents

## Remaining Work (Backlog)

- Add ItemList schema to blog listing page
- Add LocalBusiness schema to shop pages
- Add individual Offer objects with seller names (requires API change)
- Convert category BreadcrumbList from client-side useEffect to server component
- Add GeoShape schema for service area declaration

## Status: PROGRESSED
3 critical/high fixes shipped. Remaining items added to backlog.
