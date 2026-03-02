# Directive: Database Ops Batch

## Context
Database-ops has 4 P1 items, the most critical being backup setup and storage optimization. Two items are pure code changes, two are research/planning that produce actionable scripts.

## Items

### P1: Migrate Archival to R2
Update `apps/jobs/src/archival/` to upload Parquet files to Cloudflare R2 instead of S3. Zero egress cost vs S3. Use R2 Infrequent Access tier (~$0.01/GB/mo). Code change — update the S3 client config and bucket references.

### P1: Storage Capacity Planning
Calculate current DB growth rate from offers table, project when 2TB NVMe fills up. Produce a report with: current size, daily growth, projected fill date, and recommended action timeline. Research-only.

### P1: TimescaleDB Compression Plan
Research TimescaleDB compatibility with our CNPG PostgreSQL setup. Produce a step-by-step migration script for: installing the extension, converting the offers table to a hypertable, enabling compression on data >7 days old. Research + script output — CEO will execute manually.

### P1: DB Backup Configuration
Research CNPG automated backup options. Produce configuration YAML for: WAL archiving to R2, scheduled base backups, retention policy. CEO will apply the K8s config manually.
