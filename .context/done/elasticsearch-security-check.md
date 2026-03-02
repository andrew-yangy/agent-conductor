# Directive: Verify Elasticsearch version against LZ4 info disclosure CVE

**Source**: Scout 2026-03-02, proposed by Sarah
**Priority**: P2
**Risk**: low
**Recommended process**: fix
**Goal alignment**: platform

## Objective

ESA-2026-07 (CVE-2025-66566) affects Elasticsearch's LZ4 library in the transport layer. Crafted compressed input can read previous buffer contents. Need to verify if our ES instance is affected.

## Scope

Check current Elasticsearch version. If below patched versions (8.19.10, 9.1.10, 9.2.4), plan upgrade. Verify transport layer is not exposed to public networks.

## Intelligence Context

- CVE-2025-66566 in yawkat LZ4 Java library used by ES transport layer
- Fixed in Elasticsearch 8.19.10, 9.1.10, 9.2.4
- Lower risk if transport layer is internal-only

## Success Criteria

- ES version identified
- Vulnerability applicability confirmed or denied
- Upgrade plan if needed
