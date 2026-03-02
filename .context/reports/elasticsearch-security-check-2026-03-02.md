# Directive Report: Elasticsearch Security Check

**Date**: 2026-03-02
**Directive**: elasticsearch-security-check
**Source**: Scout 2026-03-02, proposed by Sarah

## Summary

Investigated CVE-2025-66566 (LZ4 info disclosure in ES transport layer). Client libraries are outdated but the CVE affects the **server** transport layer, not client libraries. Server version needs AWS console verification.

## Findings

### ES Client Library Versions
- **BuyWisely**: `@elastic/elasticsearch@8.15.0` (pinned)
- **Offers**: `@elastic/elasticsearch@^8.10.0` (resolves to 8.10.0)
- **Jobs**: `@elastic/elasticsearch@^8` (latest 8.x)

### CVE-2025-66566 Applicability
- CVE affects Elasticsearch **server** transport layer (LZ4 Java library)
- Fixed in server versions 8.19.10, 9.1.10, 9.2.4
- Client library version ≠ server version — these are independent
- No ES server provisioning found in SST config (server is managed externally in AWS)
- All connections use environment variables (`ES_CLIENT_ENDPOINT`, `ES_API_KEY`)
- Used in 4 apps: BuyWisely (search), Offers (crawling), Jobs (metrics), SellWisely (indexing)

### Risk Assessment
- **Transport layer exposure**: Low — likely internal-only (VPC)
- **Client library updates**: Recommended but not security-critical

## Action Required

1. **Check AWS console** for actual Elasticsearch/OpenSearch server version
2. If server version < 8.19.10: plan upgrade
3. **Recommended**: Update client libraries to latest 8.x regardless (8.15.0 → current)

## Status: REQUIRES MANUAL VERIFICATION
Cannot determine server version from codebase alone. CEO should check AWS OpenSearch console.
