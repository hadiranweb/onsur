# Technical Documentation

This directory contains the technical source of truth for Element Plus. Start with the guide that matches the task, then follow the linked ADRs for durable architectural decisions.

| Document                                | Purpose                                                                      |
| --------------------------------------- | ---------------------------------------------------------------------------- |
| [Architecture](./architecture.md)       | Layers, dependencies, domain boundaries, authority and runtime integrations. |
| [Development](./development.md)         | Local workflow, package ownership, contracts, branches and pull requests.    |
| [Configuration](./configuration.md)     | Environment variables, sessions, PostgreSQL, migrations and health.          |
| [Testing](./testing.md)                 | Test layers, validation commands, end-to-end proof and failure diagnosis.    |
| [Release and CI](./release.md)          | GitHub Actions, branch promotion, production build and rollback evidence.    |
| [Operations](./operations.md)           | Running and troubleshooting the application in an environment.               |
| [Security](./security.md)               | Trust boundaries, authentication, authorization and residual risks.          |
| [Architecture Decision Records](./adr/) | Context, decisions, alternatives and consequences.                           |
| [Audits](./audits/)                     | Verification evidence and hardening records.                                 |

When a change makes one of these guides inaccurate, update the guide in the same pull request as the code. When a decision is durable or cross-cutting, add an ADR rather than hiding the rationale in an implementation comment.
