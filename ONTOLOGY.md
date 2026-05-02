# veribim-kg — Ontology Design: Enhanced Specification

**Knowledge Layer for Construction Compliance**

| | |
|---|---|
| **Author** | Vasil Nedev |
| **Status** | Enhanced — v2.0 |
| **Based on** | Ontology Design v1 + Enhancements Review |

> **Architectural boundary.** veribim-kg is a semantic compliance and assurance knowledge layer. It augments BIM and CDE systems governed by ISO 19650, providing traceable meaning, accountability, and evidence reasoning across the asset lifecycle. It does not replace CDEs, document management systems, or naming conventions.

---

## Contents

1. [Design Principles (Revised)](#0-design-principles-revised)
2. [New and Enhanced Entities](#1-new-and-enhanced-entities)
3. [Governance vs. Contractual Obligations — Clarified](#2-governance-vs-contractual-obligations--clarified)
4. [Revised Taxonomies — Property-Based](#3-revised-taxonomies--property-based)
5. [Complete Relationship Table](#4-complete-relationship-table)
6. [Compliance Query Patterns](#5-compliance-query-patterns)
7. [Updated Mereology Chains](#6-updated-mereology-chains)
8. [Embedding Strategy (Updated)](#7-ontology-path-augmented-embedding-strategy-updated)
9. [ISO Alignment (Updated)](#8-iso-alignment-updated)
10. [Cypher Conventions Summary](#9-cypher-conventions-summary-updated)

---

## 0. Design Principles (Revised)

The following principles govern all modelling decisions. They supersede the principles in v1 where they conflict.

### 0.1 Labels for High-Level Entities and Mereologies

> **Principle:** Neo4j node labels are reserved for high-level entities (`Asset`, `Requirement`, `Document`, `Organisation`, `Activity`, `Role`, `Consent`, `BIMContainer`, `InformationRequirement`, `RequirementStatus`, `Nonconformance`, `Concession`, `CorrectiveAction`, `IfcElement`, `AssetIdentifier`) and for structural mereologies (`Section`, `LifecyclePhase`). Labels drive index-based query performance. Every labelled concept must be semantically distinct at graph traversal level.

### 0.2 Properties for Taxonomic Classification

> **Principle:** Taxonomic sub-classifications — source, subject, organisation type, document type, activity type, deliverable type — are stored as **boolean properties** on the node, not as additional Neo4j labels. This keeps the label set stable and small while allowing rich, composable filtering in Cypher `WHERE` clauses.

Example: instead of assigning both `:Legal` and `:Performance` as labels, a Requirement node carries:

```cypher
(:Requirement {
  source_legal: true,
  source_nationalStandard: false,
  subject_performance: true,
  subject_workMethod: false,
  phase_construction: true,
  phase_design: false,
  content: '...',
  embedding: [...]
})
```

This makes queries like the following natural and efficient:

```cypher
MATCH (r:Requirement)
WHERE r.source_legal = true
  AND r.subject_performance = true
  AND r.phase_construction = true
RETURN r
```

### 0.3 Retained Principles from v1

- Every node carries exactly two semantic fields: `content` (text) and `embedding` (vector).
- The ontology is stored inside the same Neo4j database as the data it describes.
- `INSTANCE_OF` relationships connect data nodes to ontology nodes for LLM traversal and semantic enrichment.
- Ontology nodes additionally carry a `label` field as a machine key.
- Requirements may target Assets (physical outcomes) or Activities (organisational obligations), or both.
- Embeddings are enriched with ontology-path prefixes at generation time.

---

## 1. New and Enhanced Entities

### 1.1 BIMContainer (ISO 19650 Information Container)

**Definition.** A `BIMContainer` represents an ISO 19650 information container: a managed issue of information within a Common Data Environment, created to fulfil defined `InformationRequirements` at a point in the lifecycle. It governs suitability for use, CDE status, authorisation, and timing of an information exchange.

**Position.** `BIMContainer` is a first-class entity, distinct from `Document`. A Document carries compliance meaning; a BIMContainer is the managed delivery vehicle for that Document within a CDE workflow. A Document may appear in multiple BIMContainers over its version history.

> **Boundary condition.** veribim-kg records which BIMContainer carried a Document and whether that container was authorised. It does not replicate CDE workflows, naming conventions, suitability codes, or transmittal management — those remain authoritative in the CDE.

#### Key Properties

| Property | Description |
|---|---|
| `content` | Natural language description of this information container and its purpose |
| `embedding` | Vector representation |
| `containerId` | The ISO 19650-compliant document number / container identifier from the CDE |
| `suitabilityCode` | CDE suitability code at time of issue (e.g. S2, S4, A) |
| `issueDate` | ISO 8601 date of issue |
| `validFrom` | Start of validity window (ISO 8601) |
| `validTo` | End of validity window; `null` if still current (ISO 8601) |
| `revision` | Revision identifier |

#### Key Relationships

```cypher
(:BIMContainer)-[:CONTAINS]->(:Document)
(:BIMContainer)-[:ISSUED_BY]->(:Role)
(:BIMContainer)-[:REQUIRES_CONSENT]->(:Consent)
(:InformationRequirement)-[:FULFILLED_BY]->(:BIMContainer)
```

#### Separation of Concerns

| Question | Answered by | Node |
|---|---|---|
| Was the information authorised for use? | BIMContainer | `suitabilityCode`, `validFrom`/`validTo` |
| What was issued at a gateway? | BIMContainer | `issueDate`, `containerId` |
| Does it prove compliance? | VerificationRecord | `VERIFIED_BY` chain |
| What requirement drove this information? | InformationRequirement | `FULFILLED_BY` chain |

---

### 1.2 InformationRequirement (EIR / AIR / OIR)

**Definition.** An `InformationRequirement` is a subtype of `Requirement` that expresses what information must be provided, by whom, and at which lifecycle stage — rather than what a physical asset or organisational process must achieve. InformationRequirements directly correspond to ISO 19650 EIR (Exchange Information Requirements), AIR (Asset Information Requirements), and OIR (Organisational Information Requirements).

**Modelling note.** `InformationRequirement` is modelled as a Neo4j label alongside the base `Requirement` label. Its taxonomic sub-type (EIR, AIR, OIR) is stored as a boolean property.

```cypher
(:Requirement:InformationRequirement {
  infoReq_eir: true,
  infoReq_air: false,
  infoReq_oir: false,
  content: 'Structural calculation package required at Gateway 2',
  embedding: [...]
})
-[:FULFILLED_BY]->(:BIMContainer)
```

This enables ISO 19650-aligned queries such as:

```cypher
// What information was required at Gateway 2, and which
// issued container fulfilled it?
MATCH (ir:InformationRequirement)-[:FULFILLED_BY]->(bc:BIMContainer)
WHERE ir.infoReq_eir = true
RETURN ir.content, bc.containerId, bc.suitabilityCode, bc.issueDate
```

---

### 1.3 RequirementStatus / ComplianceAssessment

**Gap addressed.** In the original ontology, compliance had to be inferred implicitly from the presence or absence of a `VerificationRecord`. In real assurance practice, stakeholders require an explicit, time-bounded, role-authorised verdict.

**Definition.** A `RequirementStatus` node represents a point-in-time judgement on whether a specific Requirement is satisfied. It is time-bounded, authorised by a Role, and supported by specific VerificationRecords.

#### Status Values

| `status` property value | Meaning |
|---|---|
| `NotAssessed` | No judgement has been made; evidence gathering is pending |
| `Compliant` | The requirement is fully satisfied by the supporting evidence |
| `NonCompliant` | The requirement is not met; a Nonconformance node exists |
| `AcceptedWithConcession` | A formally accepted deviation; a Concession node exists |
| `TemporarilyAccepted` | Accepted subject to a time-bound condition or outstanding action |

#### Key Properties

| Property | Description |
|---|---|
| `status` | One of the five status values above |
| `assessedOn` | ISO 8601 date of this assessment |
| `validFrom` | Start of validity window |
| `validTo` | End of validity window; `null` if still current |
| `rationale` | Free-text explanation of the verdict |
| `content` | Natural language summary for embeddings |
| `embedding` | Vector representation |

#### Key Relationships

```cypher
(:Requirement)-[:HAS_STATUS]->(:RequirementStatus)
(:RequirementStatus)-[:SUPPORTED_BY]->(:VerificationRecord)
(:RequirementStatus)-[:AUTHORISED_BY]->(:Role)
(:RequirementStatus)-[:SUPERSEDES]->(:RequirementStatus)  // audit trail
```

> **Temporal audit trail.** When a `RequirementStatus` is revised (e.g. status changes from `TemporarilyAccepted` to `Compliant`), a new `RequirementStatus` node is created and linked to its predecessor via `SUPERSEDES`. The earlier node is never deleted, preserving the full compliance history for forensic and legal queries.

---

### 1.4 Nonconformance, Concession, and CorrectiveAction

**Gap addressed.** Real projects deviate from requirements. An assurance system that models only perfect compliance is not fit for audit or legal scrutiny. These three entities model the full non-compliance lifecycle as defined by ISO 9001 §8.7 and §10.2.

#### Nonconformance

**Definition.** An identified failure to meet a requirement — whether a physical defect, a process deviation, or a documentation gap — that has been formally recorded.

| Property | Description |
|---|---|
| `content` | Description of the nonconformance |
| `embedding` | Vector representation |
| `severity` | Minor / Major / Critical |
| `identifiedOn` | ISO 8601 date identified |
| `identifiedBy` | Role reference (denormalised for query speed; also linked via relationship) |
| `status` | Open / UnderReview / Closed |

#### Concession / Departure

**Definition.** A formally accepted deviation from a requirement, approved by an authorised Role before or after construction. Equivalent to a departure, waiver, or concession in UK construction practice.

| Property | Description |
|---|---|
| `content` | Description of the accepted deviation and its scope |
| `embedding` | Vector representation |
| `approvedOn` | ISO 8601 date of acceptance |
| `expiresOn` | ISO 8601 expiry date; `null` if permanent |
| `riskStatement` | Plain-language description of risk accepted |

#### CorrectiveAction

**Definition.** A remediation or mitigation activity raised in response to a Nonconformance. A CorrectiveAction addresses a Nonconformance and may produce a new VerificationRecord when completed.

| Property | Description |
|---|---|
| `content` | Description of the corrective action |
| `embedding` | Vector representation |
| `dueDate` | ISO 8601 target completion date |
| `completedOn` | ISO 8601 actual completion date; `null` if open |
| `status` | Open / InProgress / Closed / Verified |

#### Relationship Pattern

```cypher
(:Nonconformance)-[:AFFECTS]->(:Requirement)
(:Nonconformance)-[:IDENTIFIED_ON]->(:Asset)          // optional
(:Nonconformance)-[:IDENTIFIED_BY]->(:Role)
(:Concession)-[:ACCEPTS]->(:Nonconformance)
(:Concession)-[:APPROVED_BY]->(:Role)
(:CorrectiveAction)-[:ADDRESSES]->(:Nonconformance)
(:CorrectiveAction)-[:ASSIGNED_TO]->(:Role)
(:CorrectiveAction)-[:PRODUCES]->(:VerificationRecord) // when closed
(:RequirementStatus {status:'NonCompliant'})-[:REFERENCES_NCR]->(:Nonconformance)
(:RequirementStatus {status:'AcceptedWithConcession'})-[:REFERENCES_CONCESSION]->(:Concession)
```

This pattern allows the knowledge graph to answer:

```cypher
// Why was this requirement accepted, by whom, and what risk was taken?
MATCH (r:Requirement)<-[:AFFECTS]-(nc:Nonconformance)
      <-[:ACCEPTS]-(con:Concession)-[:APPROVED_BY]->(role:Role)
RETURN r.content, nc.content, con.riskStatement, role.content
```

---

### 1.5 Temporal Validity and Forensic Truth

**Gap addressed.** In the original ontology, relationships were effectively timeless. Regulatory and legal queries are inherently time-dependent: a certificate valid in 2022 may have expired by 2025; a compliance position accepted at Gateway 3 may have been superseded at handover.

#### Approach: `validFrom` / `validTo` Properties

All time-bounded nodes carry two properties:

| Property | Type |
|---|---|
| `validFrom` | ISO 8601 datetime — start of the validity window |
| `validTo` | ISO 8601 datetime — end of the validity window; `null` means still current |

The following node types are time-bounded:

| Node Type | What the window represents |
|---|---|
| `BIMContainer` | Period during which this issue of information is authorised for use |
| `RequirementStatus` | Period during which this compliance verdict is current |
| `Accreditation` | Period during which the accreditation or certification is valid |
| `Role` | Period during which this role assignment is active on the project |
| `Concession` | Period during which the accepted deviation remains in effect |

#### Temporal Query Pattern

```cypher
// What was considered compliant at handover date X?
MATCH (r:Requirement)-[:HAS_STATUS]->(rs:RequirementStatus)
WHERE rs.status = 'Compliant'
  AND rs.validFrom <= date('2024-11-15')
  AND (rs.validTo IS NULL OR rs.validTo >= date('2024-11-15'))
RETURN r.content, rs.assessedOn, rs.rationale
```

> **Forensic truth principle.** Historical status nodes are never overwritten. When a verdict changes, a new `RequirementStatus` node is created and the old one is superseded via `SUPERSEDES`. The graph can reconstruct the compliance picture at any past point in time without overwriting historical truth.

---

### 1.6 Asset Identity and BIM Linkage

**Gap addressed.** The original ontology did not define how Assets in the knowledge graph relate to IFC elements in BIM models or to business identifiers used in CAFM and asset management systems.

#### Strategy

Assets may carry two types of identifier, modelled as separate linked nodes:

| Identifier Type | Node / Property | Description |
|---|---|---|
| Technical (IFC) | `IfcElement {globalId}` | IFC GlobalId — machine-level geometric identity. Recognised but not treated as a contractual or business identifier. |
| Business / Contractual | `AssetIdentifier {scheme, value}` | Tags, marks, CAFM IDs, room numbers, door codes. Multiple schemes may apply to one asset. |

```cypher
(:Asset)
  -[:HAS_GEOMETRY]->(:IfcElement {globalId: 'abc123...'})
  -[:HAS_IDENTIFIER]->(:AssetIdentifier {scheme: 'CAFM', value: 'AS-DOOR-042'})
  -[:HAS_IDENTIFIER]->(:AssetIdentifier {scheme: 'Drawing', value: 'DR-101-A-12'})
```

> **IFC GlobalId note.** IFC GlobalId is a technical, model-scoped identifier. It is not stable across redesigns and must not be used as a contractual or business identity anchor. Business identity is carried by `AssetIdentifier` nodes, which persist through model changes.

---

## 2. Governance vs. Contractual Obligations — Clarified

The original ontology used **Governance** as a single subject taxonomy label covering both statutory obligations (what regulators require) and contractual obligations (what parties agree between themselves). These are materially different in legal effect, enforceability, and audit trail requirements and must be distinguished.

### 2.1 The Distinction

| Dimension | Governance (Statutory) | Contractual | Management System |
|---|---|---|---|
| **Source** | Legislation, statutory instruments, planning conditions | Contract, Employer's Requirements, NEC/JCT clauses | ISO 9001, 14001, 45001 clauses |
| **Enforced by** | Regulator, Building Control, HSE | Parties, adjudicator, courts | Internal audit, certification body |
| **Consequence of breach** | Criminal liability, prohibition notice, enforcement order | Damages, termination, retention | Audit finding, loss of certification |
| **Evidence required** | Statutory records, formal submissions | Contractual records, notices | Management system records, minutes |
| **Who approves** | Statutory authority (Role: `StatutoryAuthority`) | Employer, Contract Administrator | Management Representative |

### 2.2 Modelling — Boolean Properties

Both categories are modelled using boolean properties on Requirement nodes, not as separate labels. The properties are composable — a single clause can be simultaneously statutory and contractual (e.g. a planning condition incorporated into the Employer's Requirements).

```cypher
// A planning condition that is both statutory and contractual
(:Requirement {
  source_legal: true,
  subject_governance_statutory: true,
  subject_governance_contractual: true,
  subject_governance_managementSystem: false,
  content: 'No piling shall commence until a written scheme...',
  embedding: [...]
})
```

### 2.3 Taxonomy of Governance Properties

| Property | Meaning |
|---|---|
| `subject_governance_statutory` | Imposed by statute, regulation, or statutory instrument. Approved by a `StatutoryAuthority` Role. |
| `subject_governance_contractual` | Imposed by contract, Employer's Requirements, or specification. Approved by Client or Contract Administrator Role. |
| `subject_governance_managementSystem` | Clause from ISO 9001 / 14001 / 45001 imposing a process or system obligation on the organisation. |
| `subject_governance_informationManagement` | ISO 19650 / EIR / AIR / OIR information delivery obligation — typically linked to an `InformationRequirement` node. |

### 2.4 Updated RESPONSIBLE_FOR Semantics

The `RESPONSIBLE_FOR` relationship from Role to Requirement is unchanged structurally. Clarity comes from querying the governance properties on the target Requirement and the Organisation type of the Role:

```cypher
// Who is statutorily responsible for fire-resistance requirements?
MATCH (role:Role)-[:RESPONSIBLE_FOR]->(r:Requirement)
WHERE r.subject_performance = true
  AND r.source_legal = true
  AND r.subject_governance_statutory = true
RETURN role.content, r.content
```

---

## 3. Revised Taxonomies — Property-Based

All taxonomic classifications in the original ontology are replaced by boolean property sets. This section defines the canonical property names for each node type.

### 3.1 Requirement Properties

#### Source Properties

| Property | Meaning (`true` = node belongs to this source) |
|---|---|
| `source_legal` | Primary / secondary legislation or statutory instrument |
| `source_client` | Employer's Requirements or client brief |
| `source_nationalStandard` | BS, DIN, NF or equivalent national standard |
| `source_internationalStandard` | ISO, IEC, EN or equivalent international standard |
| `source_industryBody` | CIOB, ICE, RICS or recognised professional body guidance |
| `source_manufacturer` | Product data sheet or installation specification |

#### Subject Properties

| Property | Meaning |
|---|---|
| `subject_performance` | Outcome specification — what the asset must achieve |
| `subject_designMethod` | How to design or specify the asset |
| `subject_workMethod` | Workmanship — how construction work shall be executed |
| `subject_testMethod` | Inspection and verification procedures |
| `subject_governance_statutory` | Statutory approval, notification, or regulatory obligation |
| `subject_governance_contractual` | Contractual approval, notice, or programme obligation |
| `subject_governance_managementSystem` | ISO management system process obligation |
| `subject_governance_informationManagement` | ISO 19650 information delivery obligation |

#### Phase Properties

| Property | Meaning |
|---|---|
| `phase_inception` | Applicable in the Inception phase |
| `phase_design` | Applicable in the Design phase |
| `phase_construction` | Applicable in the Construction phase |
| `phase_maintenance` | Applicable in the Maintenance phase |
| `phase_termination` | Applicable in the Termination phase |

### 3.2 Organisation Properties

| Property | Meaning |
|---|---|
| `orgType_project` | Root project node |
| `orgType_client` | Project owner / employer |
| `orgType_contractor` | Main contractor or construction manager |
| `orgType_subcontractor` | Specialist trade contractor |
| `orgType_consultant` | Designer, engineer, or project manager |
| `orgType_statutoryAuthority` | Building control, planning authority, HSE |
| `orgType_certificationBody` | Third-party inspector or UKAS-accredited body |

### 3.3 Document and DesignDeliverable Properties

| Property | Meaning |
|---|---|
| `docType_regulatory` | Acts, statutory instruments, planning conditions |
| `docType_standard` | National and international standards |
| `docType_contract` | Specifications, drawings, Employer's Requirements |
| `docType_technical` | ITPs, method statements, design reports |
| `docType_qualityRecord` | Inspection records, test certificates, handover documentation |
| `isDesignDeliverable` | `true` = this Document is also a design deliverable |
| `deliverable_drawing` | 2D engineering or architectural drawing |
| `deliverable_calculation` | Engineering calculation |
| `deliverable_specification` | Written technical specification |
| `deliverable_report` | Design report, survey, or specialist report |
| `deliverable_model` | 3D BIM or parametric model |
| `deliverable_schedule` | Door, window, finish, or equipment schedule |

### 3.4 Activity Properties

| Property | Meaning |
|---|---|
| `actType_process` | Top-level grouping of related activities |
| `actType_activity` | Defined unit of work within a process |
| `actType_task` | Discrete step within an activity |
| `actType_inspection` | Formal check or audit activity |
| `actType_submission` | Formal document submission to an authority |
| `actType_review` | Design, document, or management review gate |

### 3.5 InformationRequirement Sub-Type Properties

| Property | Meaning |
|---|---|
| `infoReq_eir` | Exchange Information Requirement — what is needed at a specific exchange event |
| `infoReq_air` | Asset Information Requirement — what must be maintained in the asset information model |
| `infoReq_oir` | Organisational Information Requirement — what the organisation needs to manage its portfolio |

---

## 4. Complete Relationship Table

### 4.1 Compliance Relationships

| Relationship | From → To | Semantics |
|---|---|---|
| `HAS_REQUIREMENT` | Asset / Activity → Requirement | Asset or activity is governed by a requirement |
| `HAS_STATUS` | Requirement → RequirementStatus | Current (and historical) compliance verdict for this requirement |
| `FULFILLED_BY` | Requirement → DesignDeliverable | A design-stage requirement is fulfilled by a design deliverable |
| `FULFILLED_BY` | InformationRequirement → BIMContainer | An information requirement is fulfilled by an information container |
| `DEFINES` | DesignDeliverable → Requirement | Design deliverable defines construction requirements |
| `ADDRESSED_BY` | Requirement → Guidance | Requirement is addressed by guidance |
| `CITES` | Guidance → Requirement | Guidance cites a sub-requirement |
| `VERIFIED_BY` | Requirement → VerificationRecord | Requirement is evidenced by a verification record |
| `SUPPORTED_BY` | RequirementStatus → VerificationRecord | Compliance verdict is supported by this evidence |
| `PERFORMED_BY` | VerificationRecord → Accreditation | Record was produced by an accredited party |
| `AUTHORISED_BY` | VerificationRecord / RequirementStatus → Role | Record or verdict was signed off by a role |
| `CONTAINS` | Document / Section → nodes | Document or section contains a fragment or assurance node |
| `REFERENCES` | Requirement / Guidance → Table / Diagram / Section / Definition | Clause cross-references a fragment or defined term |
| `RESOLVES_TO` | Reference → Document | A captured citation resolves to a document in the graph |
| `SUPERSEDES` | Document / RequirementStatus → same type | Version or audit trail lineage |
| `AFFECTS` | Nonconformance → Requirement | A nonconformance identifies failure against a requirement |
| `ACCEPTS` | Concession → Nonconformance | A concession formally accepts a nonconformance |
| `ADDRESSES` | CorrectiveAction → Nonconformance | A corrective action remediates a nonconformance |
| `PRODUCES` | CorrectiveAction → VerificationRecord | Closed corrective action produces evidence of remediation |
| `REFERENCES_NCR` | RequirementStatus → Nonconformance | Non-compliant status references the NCR |
| `REFERENCES_CONCESSION` | RequirementStatus → Concession | Accepted-with-concession status references the concession |
| `APPROVED_BY` | Concession → Role | Concession approved by an authorised role |
| `IDENTIFIED_ON` | Nonconformance → Asset | Nonconformance located on a specific asset |
| `IDENTIFIED_BY` | Nonconformance → Role | Role that identified the nonconformance |

### 4.2 BIM and Information Management Relationships

| Relationship | From → To | Semantics |
|---|---|---|
| `CONTAINS` | BIMContainer → Document | Container carries a document |
| `ISSUED_BY` | BIMContainer → Role | Container was issued by this role |
| `REQUIRES_CONSENT` | BIMContainer → Consent | Issue of container requires a formal consent |
| `HAS_GEOMETRY` | Asset → IfcElement | Asset is geometrically represented by an IFC element |
| `HAS_IDENTIFIER` | Asset → AssetIdentifier | Asset carries a business or contractual identifier |

### 4.3 Management Relationships

| Relationship | From → To | Semantics |
|---|---|---|
| `DELIVERS` | Project → Asset | Project delivers a physical asset |
| `HAS_PART` | Organisation → Organisation | Organisational mereology |
| `HAS_ROLE` | Organisation → Role | Organisation holds a project role |
| `GOVERNS` | Organisation → Asset | Organisation has regulatory or contractual authority over asset |
| `RESPONSIBLE_FOR` | Role → Requirement | Role is accountable for satisfying a requirement (R/A in RACI) |
| `PERFORMED_BY` | Activity → Role | Role executes an activity |
| `REQUIRES_CONSENT` | Requirement → Consent | Fulfilling requirement demands a formal approval |
| `APPROVES` | Role → Consent | Role grants or issues a consent |
| `BELONGS_TO` | Activity → LifecyclePhase | Activity is a subdivision of a lifecycle phase |
| `ASSIGNED_TO` | CorrectiveAction → Role | Role responsible for executing corrective action |

### 4.4 Structural Relationships

| Relationship | From → To | Semantics |
|---|---|---|
| `PART_OF` | Asset / Requirement / Activity / Section → same type | Physical, textual, work breakdown, or document structural mereology |
| `INSTANCE_OF` | Data node → Ontology Entity or Type | Links data to its ontology definition |
| `APPLICABLE_IN` | Any node → LifecyclePhase | Associates a node with a lifecycle phase |

---

## 5. Compliance Query Patterns

This section maps the five target operational questions to their graph traversal patterns. Each query leverages the boolean property model introduced in Section 3.

### Query 1 — What are the regulatory requirements for project XYZ?

```cypher
MATCH (p:Organisation {orgType_project: true})
      -[:DELIVERS]->(a:Asset)
      -[:HAS_REQUIREMENT]->(r:Requirement)
WHERE p.content CONTAINS 'XYZ'
  AND r.source_legal = true
OPTIONAL MATCH (r)-[:HAS_STATUS]->(rs:RequirementStatus)
WHERE rs.validTo IS NULL
RETURN a.content AS asset,
       r.content AS requirement,
       coalesce(rs.status, 'NotAssessed') AS complianceStatus
ORDER BY asset, requirement
```

### Query 2 — Which design standard requirements are relevant to meet the design intent?

```cypher
MATCH (r:Requirement)
WHERE (r.source_nationalStandard = true OR r.source_internationalStandard = true)
  AND r.phase_design = true
  AND (r.subject_performance = true OR r.subject_designMethod = true)
OPTIONAL MATCH (r)<-[:DEFINES]-(dd:Document {isDesignDeliverable: true})
OPTIONAL MATCH (r)-[:HAS_STATUS]->(rs:RequirementStatus {status: 'Compliant'})
RETURN r.content AS designRequirement,
       collect(distinct dd.content) AS fulfilledByDeliverables,
       rs IS NOT NULL AS isCompliant
```

### Query 3 — Does the project design meet all requirements?

```cypher
// Returns requirements with non-compliant or unassessed status
MATCH (a:Asset)-[:HAS_REQUIREMENT]->(r:Requirement)
WHERE r.phase_design = true
OPTIONAL MATCH (r)-[:HAS_STATUS]->(rs:RequirementStatus)
WHERE rs.validTo IS NULL
WITH r, coalesce(rs.status, 'NotAssessed') AS status
WHERE status <> 'Compliant'
OPTIONAL MATCH (r)<-[:AFFECTS]-(nc:Nonconformance)
RETURN r.content AS requirement,
       status,
       collect(nc.content) AS openNonconformances
```

### Query 4 — Is the design fully compliant and ready for construction?

```cypher
// Check all design-phase requirements AND BIMContainer authorisation
MATCH (r:Requirement)
WHERE r.phase_design = true
OPTIONAL MATCH (r)-[:HAS_STATUS]->(rs:RequirementStatus)
WHERE rs.validTo IS NULL
WITH count(r) AS totalReqs,
     sum(CASE WHEN coalesce(rs.status,'NotAssessed')='Compliant'
              OR rs.status='AcceptedWithConcession' THEN 1 ELSE 0 END) AS resolvedReqs,
     collect(CASE WHEN coalesce(rs.status,'NotAssessed')<>'Compliant'
                   AND rs.status<>'AcceptedWithConcession'
              THEN r.content END) AS blockers
RETURN totalReqs, resolvedReqs,
       (totalReqs - resolvedReqs) AS openItems,
       blockers
```

### Query 5 — Does the construction output meet all design specifications, material standards, and workmanship requirements?

```cypher
MATCH (a:Asset)-[:HAS_REQUIREMENT]->(r:Requirement)
WHERE r.phase_construction = true
  AND (r.subject_workMethod = true
    OR r.subject_testMethod = true
    OR r.subject_performance = true)
OPTIONAL MATCH (r)-[:HAS_STATUS]->(rs:RequirementStatus)
WHERE rs.validTo IS NULL
OPTIONAL MATCH (rs)-[:SUPPORTED_BY]->(vr:VerificationRecord)
OPTIONAL MATCH (vr)-[:AUTHORISED_BY]->(role:Role)
OPTIONAL MATCH (r)<-[:AFFECTS]-(nc:Nonconformance)
RETURN a.content AS asset,
       r.content AS requirement,
       coalesce(rs.status,'NotAssessed') AS status,
       collect(distinct vr.content) AS evidence,
       collect(distinct role.content) AS signedOffBy,
       collect(distinct nc.content) AS openNCRs
ORDER BY status, asset
```

---

## 6. Updated Mereology Chains

### 6.1 Physical Compliance Thread

```
Asset
  -[:HAS_REQUIREMENT]-> Requirement
    -[:HAS_STATUS]-> RequirementStatus
      -[:SUPPORTED_BY]-> VerificationRecord
        -[:AUTHORISED_BY]-> Role
    -[:ADDRESSED_BY]-> Guidance
      -[:CITES]-> Requirement          // sub-requirement
    <-[:AFFECTS]- Nonconformance
      <-[:ACCEPTS]- Concession         // if deviation accepted
      <-[:ADDRESSES]- CorrectiveAction
```

### 6.2 Design-to-Construction Thread

```
[Design phase]
Requirement {phase_design: true}
  -[:FULFILLED_BY]-> DesignDeliverable
    -[:REQUIRES_CONSENT]-> Consent
      <-[:APPROVES]- Role

[Construction phase]
DesignDeliverable
  -[:DEFINES]-> Requirement {phase_construction: true}
    -[:HAS_STATUS]-> RequirementStatus
      -[:SUPPORTED_BY]-> VerificationRecord
        -[:AUTHORISED_BY]-> Role
```

### 6.3 BIM / ISO 19650 Thread

```
InformationRequirement {infoReq_eir: true}
  -[:FULFILLED_BY]-> BIMContainer
    -[:CONTAINS]-> Document
      -[:CONTAINS]-> Requirement
        -[:HAS_STATUS]-> RequirementStatus

Asset
  -[:HAS_GEOMETRY]-> IfcElement {globalId: '...'}
  -[:HAS_IDENTIFIER]-> AssetIdentifier {scheme:'CAFM', value:'AS-42'}
  -[:HAS_REQUIREMENT]-> Requirement
```

### 6.4 Management Compliance Thread

```
Project
  -[:HAS_PART]-> Organisation
    -[:HAS_ROLE]-> Role
      -[:RESPONSIBLE_FOR]-> Requirement
        -[:HAS_STATUS]-> RequirementStatus
          -[:SUPPORTED_BY]-> VerificationRecord
          -[:AUTHORISED_BY]-> Role

Activity
  -[:HAS_REQUIREMENT]-> Requirement
    -[:REQUIRES_CONSENT]-> Consent
      <-[:APPROVES]- Role
```

---

## 7. Ontology-Path-Augmented Embedding Strategy (Updated)

The embedding strategy from v1 is retained and extended to cover the new node types.

### 7.1 Prefix Construction

The ingestion pipeline assembles the ontology path prefix from the `INSTANCE_OF` chain and combines it with the resolved boolean properties:

```
Asset > Requirement [source:legal, subject:performance, phase:construction]
The structure shall achieve 60-minute fire resistance as tested per BS EN 1363-1.

Asset > RequirementStatus [status:NonCompliant]
Fire test result for slab S-07 dated 2024-09-12 recorded 47 minutes.
Requirement not met. Nonconformance NCR-0045 raised.

BIMContainer [phase:construction, suitability:S4]
Structural package Rev 4 issued 2024-10-01 — calculations and drawings
for ground floor slab construction.

InformationRequirement [type:EIR, phase:design]
Structural calculation package required for Gateway 2 design freeze.
```

### 7.2 Staleness Management

Embeddings must be regenerated when:

- An ancestor ontology node's `label` or `content` changes.
- A boolean property on the node changes (changes the prefix).
- A `RequirementStatus` `SUPERSEDES` relationship is added (the superseded node's embedding may be re-prefixed to mark it as historical).

---

## 8. ISO Alignment (Updated)

| Ontology Term | ISO 9000 / 9001 | ISO 19650 / 55000 Equivalent |
|---|---|---|
| `BIMContainer` | — | ISO 19650 information container; CDE-issued package |
| `InformationRequirement` | — | ISO 19650 EIR / AIR / OIR |
| `RequirementStatus` | §10.2 nonconformity and corrective action; §9.1 monitoring | Compliance assurance record; gateway verdict |
| `Nonconformance` | §8.7 control of nonconforming outputs; §10.2 | NCR in construction quality management |
| `Concession` | §8.7.3 concession / departure | Departure note, waiver — accepted deviation |
| `CorrectiveAction` | §10.2.1 corrective action | RFI close-out, snagging resolution |
| `IfcElement` | — | IFC GlobalId — technical geometric identity |
| `AssetIdentifier` | — | Business / CAFM / FM identity tag |
| `AFFECTS` | §8.7 — nonconformance linked to product requirement | NCR linked to specification clause |
| `HAS_STATUS` | §9.1.1 — evaluation of compliance | Assurance verdict at gateway |
| `FULFILLED_BY` (BIMContainer) | §8.3.5 — design output satisfies information input | ISO 19650 — container fulfils EIR |
| `validFrom` / `validTo` | §7.5 documented information — version control | ISO 19650 — container validity; accreditation window |
| `subject_governance_statutory` | — | Building Safety Act; Building Regulations; HSE statutory requirements |
| `subject_governance_contractual` | §8.4 — control of externally provided processes | NEC / JCT contractual obligation; Employer's Requirements clause |
| `subject_governance_managementSystem` | §4.4 — QMS process requirement | ISO 9001 / 14001 / 45001 management system clause |
| `DesignDeliverable` | §8.3.5 design and development outputs | RIBA Stage 4 technical design deliverable; IFC model; ISO 19650 information deliverable |
| `FULFILLED_BY` (DesignDeliverable) | design output satisfies design input §8.3.5 | Requirement closure at design gateway |
| `Requirement (Asset)` | requirement §3.6.4 | Technical / product requirement |
| `Requirement (Activity)` | requirement §3.6.4 | Management system clause (ISO 9001, 14001, 45001) |
| `VerificationRecord` | objective evidence §3.8.3; record §3.8.10 | Quality record, golden thread |
| `LifecyclePhase` | product realisation §8 | RIBA Plan of Work stages |
| `RESPONSIBLE_FOR` | responsibility §3.1.2 | RACI — Responsible / Accountable |

---

## 9. Cypher Conventions Summary (Updated)

### 9.1 Label Set

The following are the complete Neo4j node labels in the enhanced ontology. All taxonomic sub-classifications are **properties**, not labels.

| Label | Domain |
|---|---|
| `Ontology` / `Entity` / `Type` | Ontology meta-layer |
| `Asset` | Compliance — physical output |
| `Requirement` | Compliance — normative obligation |
| `InformationRequirement` | Compliance — information delivery obligation (sub-label alongside `Requirement`) |
| `RequirementStatus` | Compliance — explicit compliance verdict |
| `Guidance` | Compliance — normative guidance |
| `VerificationRecord` | Compliance — objective evidence |
| `Accreditation` | Compliance — competency record |
| `Nonconformance` | Compliance — identified deviation |
| `Concession` | Compliance — accepted deviation |
| `CorrectiveAction` | Compliance — remediation activity |
| `Document` | Information — content carrier |
| `BIMContainer` | Information — ISO 19650 managed issue |
| `IfcElement` | Information — IFC geometric identity |
| `AssetIdentifier` | Information — business / contractual identity |
| `Section` / `Information` / `Table` / `Diagram` / `Definition` / `Reference` | Document fragments |
| `Organisation` | Management |
| `Role` | Management |
| `Activity` | Management |
| `Consent` | Management |
| `Project` | Management (sub-label alongside `Organisation`) |
| `LifecyclePhase` | Structural |

### 9.2 Relationship Layer Map

| Layer | Relationship Types |
|---|---|
| Ontology meta-layer | `HAS_PART`, `HAS_TYPE` |
| Compliance | `HAS_REQUIREMENT`, `HAS_STATUS`, `ADDRESSED_BY`, `CITES`, `FULFILLED_BY`, `DEFINES`, `VERIFIED_BY`, `SUPPORTED_BY`, `PERFORMED_BY`, `AUTHORISED_BY`, `CONTAINS`, `REFERENCES`, `RESOLVES_TO`, `SUPERSEDES` |
| Non-conformance lifecycle | `AFFECTS`, `ACCEPTS`, `ADDRESSES`, `PRODUCES`, `REFERENCES_NCR`, `REFERENCES_CONCESSION`, `APPROVED_BY`, `IDENTIFIED_ON`, `IDENTIFIED_BY` |
| BIM / Information | `ISSUED_BY`, `HAS_GEOMETRY`, `HAS_IDENTIFIER` |
| Management | `DELIVERS`, `HAS_ROLE`, `GOVERNS`, `RESPONSIBLE_FOR`, `REQUIRES_CONSENT`, `APPROVES`, `BELONGS_TO`, `ASSIGNED_TO` |
| Structural (all types) | `PART_OF`, `APPLICABLE_IN`, `INSTANCE_OF` |

Node labels follow `PascalCase`. Relationship types follow `SCREAMING_SNAKE_CASE`. Boolean property names follow `snake_case` with a domain prefix (`source_`, `subject_`, `phase_`, `orgType_`, `docType_`, `actType_`, `infoReq_`, `deliverable_`).