# Directive Report: SellWisely Competitor Comparison Pages

**Date**: 2026-03-02
**Directive**: sellwisely-competitor-comparison-pages
**Source**: Scout 2026-03-02, proposed by Marcus + Priya

## Summary

Comparison pages are the #1 bottom-funnel content format. None of 8 major competitors claim AU specialization. This is a content creation directive that requires Priya (CMO) to design the pages and an engineer to build them on sellwisely.io.

## Planned Pages

1. **"SellWisely vs Prisync"** — AU data depth, zero setup, pricing comparison
2. **"SellWisely vs Price2Spy"** — Accuracy (own data vs scraping), UX, transparency
3. **"Best Price Monitoring Tools for Australian Retailers 2026"** — Listicle format
4. **"SellWisely vs Competera"** — SMB-friendly vs enterprise-only

## Competitive Differentiation Points

| Feature | SellWisely | Prisync | Price2Spy | Competera |
|---------|-----------|---------|-----------|-----------|
| AU retailers pre-loaded | 10,000+ | 0 (scrape only) | 0 (scrape only) | 0 |
| Setup time | Instant | Days-weeks | Days | Weeks |
| Scraping errors | None (own data) | Frequent | Frequent | N/A |
| Pricing | From free | $99/mo | $20/mo | Enterprise |
| Self-service cancel | Yes | Hostile process | Can't self-serve | N/A |
| Data source | Own crawling + partnerships | Customer-provided URLs | Customer-provided URLs | Enterprise |

## User Pain Points (from scout intelligence)
- Prisync: "data still requires manual gathering", hostile cancellation
- Price2Spy: scraping errors, complex UI, can't self-service unsubscribe
- Competera: enterprise-only, no SMB option
- No competitor claims AU specialization

## Technical Requirements
- New pages on sellwisely.io (Next.js)
- Comparison tables with structured data (FAQ schema)
- SEO-optimized for "[competitor] alternative" keywords

## Status: REQUIRES SEPARATE DIRECTIVE
This is a content + code directive that needs Priya for copy strategy and an engineer for implementation. Should be executed as a full `/directive sellwisely-competitor-comparison-pages` when ready.
