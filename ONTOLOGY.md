# veribim-kg — Ontology Design: V3.0

**Knowledge Layer for Construction Assurance**

| | |
|---|---|
| **Author** | Vasil Nedev |
| **Status** | V3.0 |
| **Based on** | V2.0 + ISO 19650-1/2, ISO 9000/9001, ISO 55000/55001/55002, ISO 14001, ISO 45001, ISO 21500/21502 |

> **Architectural boundary.** veribim-kg is a semantic compliance and assurance knowledge layer. It augments BIM and CDE systems governed by ISO 19650, providing traceable meaning, accountability, and evidence reasoning across the asset lifecycle. It does not replace CDEs, document management systems, naming conventions, or management system registers.

---

## Contents

1. [Design Principles](#0-design-principles)
2. [Entities and Properties](#1-entities-and-properties)
3. [Governance vs. Contractual Obligations](#2-governance-vs-contractual-obligations)
4. [Taxonomies — Enumeration-Based](#3-taxonomies--enumeration-based)
5. [Complete Relationship Table](#4-complete-relationship-table)
6. [Compliance Query Patterns](#5-compliance-query-patterns)
7. [Mereology Chains](#6-mereology-chains)
8. [Embedding Strategy](#7-embedding-strategy)
9. [ISO Alignment](#8-iso-alignment)
10. [Cypher Conventions Summary](#9-cypher-conventions-summary)

---

## 0. Design Principles

The following principles govern all modelling decisions.

### 0.1 Labels for High-Level Entities and Mereologies

> **Principle:** Neo4j node labels are reserved for high-level entities (`Asset`, `Requirement`, `Document`, `DesignDeliverable`, `Organisation`, `Activity`, `Role`, `Consent`, `BIMContainer`, `InformationRequirement`, `RequirementStatus`, `Nonconformance`, `Concession`, `CorrectiveAction`, `PreventiveAction`, `Risk`, `VerificationRecord`, `Accreditation`, `AcceptanceCriteria`, `KeyDecisionPoint`, `IfcElement`, `AssetIdentifier`) and for structural mereologies (`Section`, `LifecyclePhase`). Labels drive index-based query performance. Every labelled concept must be semantically distinct at graph traversal level.
>
> `InformationRequirement` is used as a sub-label alongside `Requirement`. `DesignDeliverable` is used as a sub-label alongside `Document`. `Project` is used as a sub-label alongside `Organisation`.

### 0.2 Enumerations for Taxonomic Classification

> **Principle:** Taxonomic sub-classifications — source, subject, phase, organisation type, document type, activity type, deliverable type, information requirement type — are stored as **enumeration properties** on the node, not as boolean flags or additional Neo4j labels. Single-value classifications use a `String` property; multi-value classifications use a `[String]` array property. This keeps the label set stable and small, eliminates property proliferation, and produces readable, composable Cypher `WHERE` clauses.

Example: a Requirement node carries:

```cypher
(:Requirement {
  source: 'legal',
  subject: ['performance', 'governance'],
  governance: ['statutory'],
  phase: ['construction'],
  text: 'The structure shall achieve 60-minute fire resistance...',
  embedding: [...]
})
```

This makes queries natural and efficient:

```cypher
MATCH (r:Requirement)
WHERE r.source IN ['legal', 'regulatory']
  AND ANY(s IN r.subject WHERE s = 'performance')
  AND 'construction' IN r.phase
RETURN r
```

### 0.3 Retained Principles

- Every node carries exactly two semantic fields: `text` (natural language description) and `embedding` (vector). `content` is not used.
- The ontology is stored inside the same Neo4j database as the data it describes.
- `INSTANCE_OF` relationships connect data nodes to ontology nodes for LLM traversal and semantic enrichment.
- Ontology nodes additionally carry a `label` field as a machine key.
- Requirements may target Assets (physical outcomes) or Activities (organisational obligations), or both.
- Embeddings are enriched with ontology-path prefixes at generation time.
- Historical nodes are never overwritten. Version lineage is captured via `SUPERSEDES`.

---

## 1. Entities and Properties

### 1.1 BIMContainer (ISO 19650 Information Container)

**Definition.** A `BIMContainer` represents an ISO 19650 information container: a managed issue of information within a Common Data Environment (CDE), created to fulfil defined `InformationRequirements`. It governs suitability for use, CDE workflow state, authorisation, and timing of an information exchange.

**Position.** `BIMContainer` is a first-class entity, distinct from `Document`. A Document carries compliance meaning; a BIMContainer is the managed delivery vehicle within a CDE workflow. A Document may appear in multiple BIMContainers over its version history.

> **Boundary condition.** veribim-kg records which BIMContainer carried a Document and whether that container was authorised. CDE workflows, naming conventions, suitability code management, and transmittal management remain authoritative in the CDE.

#### Properties

| Property | Type | Description |
|---|---|---|
| `text` | String | Natural language description of this information container and its purpose |
| `embedding` | [Float] | Vector representation |
| `containerId` | String | ISO 19650-compliant container identifier from the CDE |
| `suitabilityCode` | String | CDE suitability code at time of issue (e.g. S2, S4, A) |
| `state` | String | CDE workflow state: `'workInProgress'`, `'shared'`, `'published'`, `'archived'` |
| `issueDate` | String | ISO 8601 date of issue |
| `validFrom` | String | Start of validity window (ISO 8601) |
| `validTo` | String | End of validity window; `null` if still current |
| `revision` | String | Revision identifier |

#### Key Relationships

```cypher
(:BIMContainer)-[:CONTAINS]->(:Document)
(:BIMContainer)-[:ISSUED_BY]->(:Role)
(:BIMContainer)-[:REQUIRES_CONSENT]->(:Consent)
(:InformationRequirement)-[:FULFILLED_BY]->(:BIMContainer)
```

#### Separation of Concerns

| Question | Answered by | Property |
|---|---|---|
| Was the information authorised for use? | BIMContainer | `suitabilityCode`, `validFrom`/`validTo` |
| What CDE workflow stage is the container at? | BIMContainer | `state` |
| What requirement drove this information? | InformationRequirement | `FULFILLED_BY` chain |
| Does it prove compliance? | VerificationRecord | `VERIFIED_BY` chain |

---

### 1.2 InformationRequirement (ISO 19650 EIR / AIR / OIR / PIR)

**Definition.** An `InformationRequirement` is a sub-type of `Requirement` (modelled as a sub-label alongside `Requirement`) that expresses what information must be provided, by whom, and at which lifecycle stage. It corresponds to ISO 19650 Exchange Information Requirements (EIR), Asset Information Requirements (AIR), Organisational Information Requirements (OIR), and Project Information Requirements (PIR).

```cypher
(:Requirement:InformationRequirement {
  infoReqType: 'eir',
  phase: ['design'],
  text: 'Structural calculation package required at Gateway 2',
  embedding: [...]
})-[:FULFILLED_BY]->(:BIMContainer)
```

#### AcceptanceCriteria

Each `InformationRequirement` should carry explicit acceptance criteria defining what constitutes fulfilment (ISO 19650-2). `AcceptanceCriteria` are modelled as separate linked nodes:

```cypher
(:InformationRequirement)-[:HAS_ACCEPTANCE_CRITERIA]->(:AcceptanceCriteria {
  text: 'Structural calculations issued at Suitability S4 before Gateway 2 planned date',
  embedding: [...]
})
```

---

### 1.3 RequirementStatus

**Definition.** A `RequirementStatus` node represents a point-in-time judgement on whether a specific Requirement is satisfied. It is time-bounded, authorised by a Role, and supported by specific VerificationRecords.

#### Status Values

| `status` value | Meaning |
|---|---|
| `notAssessed` | No judgement has been made |
| `compliant` | The requirement is fully satisfied |
| `nonCompliant` | The requirement is not met; a Nonconformance node exists |
| `acceptedWithConcession` | A formally accepted deviation; a Concession node exists |
| `temporarilyAccepted` | Accepted subject to a time-bound condition |

#### Properties

| Property | Type | Description |
|---|---|---|
| `status` | String | One of the five values above |
| `assessedOn` | String | ISO 8601 date of this assessment |
| `validFrom` | String | Start of validity window |
| `validTo` | String | End of validity window; `null` if still current |
| `rationale` | String | Free-text explanation of the verdict |
| `text` | String | Natural language summary |
| `embedding` | [Float] | Vector representation |

#### Key Relationships

```cypher
(:Requirement)-[:HAS_STATUS]->(:RequirementStatus)
(:RequirementStatus)-[:SUPPORTED_BY]->(:VerificationRecord)
(:RequirementStatus)-[:AUTHORISED_BY]->(:Role)
(:RequirementStatus)-[:SUPERSEDES]->(:RequirementStatus)
```

> **Temporal audit trail.** When a `RequirementStatus` is revised, a new node is created and linked to its predecessor via `SUPERSEDES`. The earlier node is never deleted.

---

### 1.4 Nonconformance, Concession, CorrectiveAction, PreventiveAction

**Scope.** These four entities model the full non-compliance and risk-prevention lifecycle as defined by ISO 9001 §8.7, §10.2, §10.3, and ISO 55000/55001.

#### Nonconformance

An identified failure to meet a requirement — physical defect, process deviation, or documentation gap.

| Property | Type | Description |
|---|---|---|
| `text` | String | Description of the nonconformance |
| `embedding` | [Float] | Vector representation |
| `severity` | String | `'minor'`, `'major'`, or `'critical'` |
| `identifiedOn` | String | ISO 8601 date identified |
| `status` | String | `'open'`, `'underReview'`, or `'closed'` |

#### Concession

A formally accepted deviation from a requirement, approved by an authorised Role before or after construction (ISO 9001 §8.7.3). Note: planning permissions and statutory licences are modelled as `Consent` nodes, not Concessions.

| Property | Type | Description |
|---|---|---|
| `text` | String | Description of the accepted deviation and its scope |
| `embedding` | [Float] | Vector representation |
| `approvedOn` | String | ISO 8601 date of acceptance |
| `expiresOn` | String | ISO 8601 expiry date; `null` if permanent |
| `riskStatement` | String | Plain-language description of risk accepted |

#### CorrectiveAction

A remediation activity raised in response to a Nonconformance (ISO 9001 §10.2).

| Property | Type | Description |
|---|---|---|
| `text` | String | Description of the corrective action |
| `embedding` | [Float] | Vector representation |
| `dueDate` | String | ISO 8601 target completion date |
| `completedOn` | String | ISO 8601 actual completion date; `null` if open |
| `status` | String | `'open'`, `'inProgress'`, `'closed'`, or `'verified'` |

#### PreventiveAction

An action to eliminate the cause of a potential nonconformance before it occurs (ISO 9001 §10.3, ISO 55001 §10.3). Distinct from CorrectiveAction which responds to an actual nonconformance.

| Property | Type | Description |
|---|---|---|
| `text` | String | Description of the preventive action |
| `embedding` | [Float] | Vector representation |
| `triggerType` | String | `'audit'`, `'managementReview'`, `'riskAssessment'`, or `'trendAnalysis'` |
| `dueDate` | String | ISO 8601 target completion date |
| `completedOn` | String | ISO 8601 actual completion date; `null` if open |
| `status` | String | `'open'`, `'inProgress'`, `'closed'`, or `'verified'` |

#### Relationship Pattern

```cypher
(:Nonconformance)-[:AFFECTS]->(:Requirement)
(:Nonconformance)-[:IDENTIFIED_ON]->(:Asset)           // optional
(:Nonconformance)-[:IDENTIFIED_BY]->(:Role)
(:Concession)-[:ACCEPTS]->(:Nonconformance)
(:Concession)-[:APPROVED_BY]->(:Role)
(:CorrectiveAction)-[:ADDRESSES]->(:Nonconformance)
(:CorrectiveAction)-[:ASSIGNED_TO]->(:Role)
(:CorrectiveAction)-[:PRODUCES]->(:VerificationRecord)  // when closed
(:PreventiveAction)-[:PREVENTS]->(:Risk)
(:PreventiveAction)-[:ASSIGNED_TO]->(:Role)
(:PreventiveAction)-[:PRODUCES]->(:VerificationRecord)  // when closed
(:RequirementStatus {status:'nonCompliant'})-[:REFERENCES_NCR]->(:Nonconformance)
(:RequirementStatus {status:'acceptedWithConcession'})-[:REFERENCES_CONCESSION]->(:Concession)
```

---

### 1.5 Temporal Validity and Forensic Truth

All time-bounded nodes carry:

| Property | Type | Description |
|---|---|---|
| `validFrom` | String | ISO 8601 start of validity window |
| `validTo` | String | ISO 8601 end of validity window; `null` means still current |

Time-bounded node types:

| Node Type | What the window represents |
|---|---|
| `BIMContainer` | Period during which this issue is authorised for use |
| `RequirementStatus` | Period during which this compliance verdict is current |
| `Accreditation` | Period during which the accreditation is valid |
| `Role` | Period during which this role assignment is active |
| `Concession` | Period during which the accepted deviation remains in effect |

> **Forensic truth principle.** Historical status nodes are never overwritten. When a verdict changes, a new `RequirementStatus` node is created and the old one is superseded via `SUPERSEDES`. The graph reconstructs the compliance picture at any past point in time.

---

### 1.6 Asset Identity and BIM Linkage

Assets may carry two types of identifier:

| Identifier Type | Node / Property | Description |
|---|---|---|
| Technical (IFC) | `IfcElement {globalId}` | IFC GlobalId — model-scoped geometric identity; not stable across redesigns |
| Business / Contractual | `AssetIdentifier {scheme, value}` | CAFM IDs, room numbers, door codes; persists through model changes |

```cypher
(:Asset)
  -[:HAS_GEOMETRY]->(:IfcElement {globalId: 'abc123...'})
  -[:HAS_IDENTIFIER]->(:AssetIdentifier {scheme: 'CAFM', value: 'AS-DOOR-042'})
  -[:HAS_IDENTIFIER]->(:AssetIdentifier {scheme: 'Drawing', value: 'DR-101-A-12'})
```

Asset criticality (per ISO 55000 §3.1.8) is stored as a single enumeration property:

```cypher
(:Asset {
  text: 'Ground floor primary structural slab',
  criticality: 'safety',   // 'safety' | 'environmental' | 'performance' | 'operational' | 'nonCritical'
  embedding: [...]
})
```

---

### 1.7 Risk

**Definition.** A `Risk` node represents a circumstance that could adversely affect the ability to meet a requirement or deliver a compliant outcome. Risk is modelled at the assurance layer — delivery, compliance, quality, programme, and information risks that directly affect requirement fulfilment. Detailed risk management registers remain authoritative in project management systems.

| Property | Type | Description |
|---|---|---|
| `text` | String | Description of the risk |
| `embedding` | [Float] | Vector representation |
| `riskType` | String | `'delivery'`, `'compliance'`, `'quality'`, `'programme'`, or `'information'` |
| `likelihood` | String | `'veryLow'`, `'low'`, `'medium'`, `'high'`, or `'veryHigh'` |
| `impact` | String | `'negligible'`, `'minor'`, `'moderate'`, `'major'`, or `'critical'` |
| `status` | String | `'identified'`, `'assessed'`, `'mitigated'`, `'accepted'`, or `'closed'` |

```cypher
(:Requirement)-[:HAS_RISK]->(:Risk)
(:Asset)-[:HAS_RISK]->(:Risk)
(:Risk)-[:MITIGATED_BY]->(:CorrectiveAction)
(:Risk)-[:MITIGATED_BY]->(:PreventiveAction)
```

---

### 1.8 KeyDecisionPoint

**Definition.** A `KeyDecisionPoint` represents a specific point in the lifecycle at which a critical decision is made — typically a gateway, milestone, or handover event (ISO 19650-1 §3.2.14, ISO 21502 §4.4). It defines when compliance verdicts, information authorisations, and phase transitions must be resolved.

| Property | Type | Description |
|---|---|---|
| `text` | String | Name and description of the decision point |
| `embedding` | [Float] | Vector representation |
| `plannedDate` | String | ISO 8601 planned date |
| `actualDate` | String | ISO 8601 actual date; `null` if future |

```cypher
(:KeyDecisionPoint)-[:DECIDES_ON]->(:Requirement)
(:KeyDecisionPoint)-[:AUTHORISED_BY]->(:Role)
(:LifecyclePhase)-[:BOUNDED_BY]->(:KeyDecisionPoint)
```

---

## 2. Governance vs. Contractual Obligations

### 2.1 The Distinction

| Dimension | Statutory | Contractual | Management System |
|---|---|---|---|
| **Source** | Legislation, statutory instruments, planning conditions | Contract, Employer's Requirements, NEC/FIDIC clauses | ISO 9001/14001/45001 clauses |
| **Enforced by** | Regulator, Building Control | Parties, adjudicator, courts | Internal audit, certification body |
| **Consequence of breach** | Criminal liability, enforcement order | Damages, termination | Audit finding, loss of certification |
| **Who approves** | Statutory authority | Employer, Contract Administrator | Management Representative |

### 2.2 Modelling — Enumeration Properties

Governance types are modelled as an array property on Requirement nodes. The `governance` property is populated only when `subject` contains `'governance'`. A single clause can simultaneously carry multiple governance types.

```cypher
// A planning condition that is both statutory and contractual
(:Requirement {
  source: 'legal',
  subject: ['governance'],
  governance: ['statutory', 'contractual'],
  phase: ['construction'],
  text: 'No piling shall commence until a written scheme has been approved by the structural engineer.',
  embedding: [...]
})
```

### 2.3 Governance Value Taxonomy

| Value | Meaning |
|---|---|
| `statutory` | Imposed by statute, regulation, or statutory instrument. Approved by a Role with `roleType: 'statutoryAuthority'`. |
| `contractual` | Imposed by contract, Employer's Requirements, or specification. Approved by client or contract administrator. |
| `managementSystem` | Clause from ISO 9001/14001/45001 imposing a process or system obligation. |
| `informationManagement` | ISO 19650 information delivery obligation — typically linked to an `InformationRequirement` node. |

---

## 3. Taxonomies — Enumeration-Based

All taxonomic classifications are stored as enumeration properties. Single-value classifications use `String`; multi-value classifications use `[String]` arrays.

### 3.1 Requirement Properties

#### `source` — String (single value)

| Value | Meaning |
|---|---|
| `legal` | Primary or secondary legislation, statutory instrument |
| `regulatory` | Requirement specified by a mandated regulatory authority (building control, HSE) |
| `client` | Employer's Requirements or client brief |
| `internationalStandard` | ISO, IEC, EN or equivalent international standard |
| `nationalStandard` | National standard not adopted as international standard |
| `industryBody` | Professional body guidance (CIOB, ICE, RICS) |
| `manufacturer` | Product data sheet or installation specification |

Note: `legal` and `regulatory` are distinct per ISO 9000 §3.6.6–3.6.7. Legislation imposes the requirement; a regulatory authority may specify its own technical requirements under a legislative mandate.

#### `subject` — [String] (array, one or more values)

| Value | Meaning |
|---|---|
| `performance` | Outcome specification — what the asset must achieve |
| `designMethod` | How to design or specify the asset |
| `workMethod` | Workmanship — how construction work shall be executed |
| `testMethod` | Inspection and verification procedures |
| `governance` | Regulatory, contractual, or management system obligation — use with `governance` property |

#### `governance` — [String] (array, populated only when `subject` contains `'governance'`)

See Section 2.3.

#### `phase` — [String] (array, one or more values)

| Value | Meaning |
|---|---|
| `inception` | Project initiation and requirements definition |
| `design` | Detailed design stage |
| `delivery` | Composite delivery phase — design, construction and commissioning (ISO 19650-1 §3.2.11) |
| `construction` | Physical construction execution |
| `commissioning` | Testing, handover and commissioning |
| `operational` | Asset in use and operation (ISO 19650-1 §3.2.12) |
| `maintenance` | Routine and planned maintenance |
| `renewal` | Asset renewal, replacement, or refurbishment (ISO 55000 §3.1.3) |
| `termination` | Decommissioning and disposal |

---

### 3.2 Organisation Properties

#### `orgType` — String (single value)

| Value | Meaning |
|---|---|
| `client` | Project owner / employer |
| `appointingParty` | ISO 19650: party that appoints others and receives information |
| `leadAppointedParty` | ISO 19650: party responsible for coordinating the delivery team |
| `appointedParty` | ISO 19650: member of a delivery team providing information |
| `contractor` | Main contractor or construction manager |
| `subcontractor` | Specialist trade contractor |
| `consultant` | Designer, engineer, or project manager |
| `statutoryAuthority` | Building control, planning authority, or regulator |
| `certificationBody` | Third-party inspector or accredited certification body |
| `assetManager` | ISO 55000: party responsible for managing the asset on behalf of the owner |

The `Project` sub-label (alongside `Organisation`) identifies the root project node; it does not use the `orgType` property.

---

### 3.3 Document and DesignDeliverable Properties

`DesignDeliverable` is a sub-label applied alongside `Document`. It does not require a separate `isDesignDeliverable` flag.

#### `docType` — [String] (array, one or more values on Document nodes)

| Value | Meaning |
|---|---|
| `regulatory` | Acts, statutory instruments, planning conditions |
| `standard` | National and international standards |
| `contract` | Specifications, Employer's Requirements, contract documents |
| `technical` | ITPs, method statements, design reports |
| `qualityRecord` | Inspection records, test certificates, handover documentation |
| `plan` | Management plans, BIM execution plans, information delivery plans |
| `policy` | Quality, environmental, or OH&S management system policy documents |

#### `deliverableType` — String (single value, on DesignDeliverable nodes only)

| Value | Meaning |
|---|---|
| `drawing` | 2D engineering or architectural drawing |
| `calculation` | Engineering calculation |
| `specification` | Written technical specification |
| `report` | Design report, survey, or specialist report |
| `model` | 3D BIM or parametric model |
| `schedule` | Door, window, finish, or equipment schedule |

---

### 3.4 Activity Properties

#### `actType` — String (single value)

| Value | Meaning |
|---|---|
| `process` | Top-level grouping of related activities |
| `activity` | Defined unit of work within a process |
| `task` | Discrete step within an activity |
| `inspection` | Formal site inspection, check, or physical test |
| `submission` | Formal document submission to a statutory or project authority |
| `review` | Design, document, or management review gate |
| `audit` | Internal or external audit of conformance (ISO 9001 §9.2) |
| `managementReview` | Top management review of the management system (ISO 9001 §9.3) |
| `verification` | Ensuring outputs meet specified input requirements (ISO 9001 §8.3.4) |
| `validation` | Ensuring a product or service meets its requirements for the intended use (ISO 9001 §8.3.4) |

---

### 3.5 InformationRequirement Sub-Type

#### `infoReqType` — String (single value)

| Value | Standard Reference | Meaning |
|---|---|---|
| `eir` | ISO 19650-1 §3.3.4 | Exchange Information Requirement — what information is needed at a specific exchange event |
| `air` | ISO 19650-1 §3.3.3 | Asset Information Requirement — what must be maintained in the asset information model |
| `oir` | ISO 19650-1 §3.3.2 | Organisational Information Requirement — what the organisation needs to manage its portfolio |
| `pir` | ISO 19650-1 §3.3.5 | Project Information Requirement — what information is needed to manage the project |

---

### 3.6 BIMContainer State

#### `state` — String (single value)

Reflects the ISO 19650-1 CDE workflow states (Clause 12):

| Value | ISO 19650-1 CDE State | Meaning |
|---|---|---|
| `workInProgress` | Work in progress | Being authored and checked within the task team |
| `shared` | Shared | Released within the delivery team for coordination and clash detection |
| `published` | Published | Approved and issued to the appointing party |
| `archived` | Archive | No longer active; retained for record |

---

### 3.7 Asset Criticality

#### `criticality` — String (single value, on Asset nodes)

Derived from ISO 55000 §3.1.8:

| Value | Meaning |
|---|---|
| `safety` | Failure could cause injury, loss of life, or statutory safety breach |
| `environmental` | Failure could cause significant environmental harm |
| `performance` | Failure would significantly degrade the service provided by the asset |
| `operational` | Failure would interrupt normal operations but not to a significant degree |
| `nonCritical` | Failure has negligible consequence |

---

### 3.8 LifecyclePhase

#### `phase` — String (single value, the specific phase name)

Uses the same controlled vocabulary defined in §3.1 (`inception`, `design`, `delivery`, `construction`, `commissioning`, `operational`, `maintenance`, `renewal`, `termination`).

#### `lifecycle` — String (single value, which lifecycle definition applies)

| Value | Meaning |
|---|---|
| `project` | Project lifecycle — from initiation to close-out (ISO 21502) |
| `asset` | Asset lifecycle — from conception of need to end of life (ISO 19650-1, ISO 55000) |
| `information` | Information management lifecycle — from requirements to archive (ISO 19650) |

---

### 3.9 Role Type

#### `roleType` — String (single value, on Role nodes)

| Value | Source | Meaning |
|---|---|---|
| `appointingParty` | ISO 19650-1 §3.2.4 | Representative of the party that appoints and receives information |
| `leadAppointedParty` | ISO 19650-1 §3.2.3 | Representative responsible for coordinating the delivery team |
| `appointedParty` | ISO 19650-1 §3.2.3 | Member of a delivery team providing information |
| `projectInformationManager` | ISO 19650-1 §7.3 | Responsible for project information standard and CDE management |
| `assetInformationManager` | ISO 19650-1 §7.2 | Responsible for validating and authorising AIM content |
| `taskInformationManager` | ISO 19650-1 §7.4 | Coordinating information at task team level |
| `projectManager` | ISO 21502 §4.5.6 | Accountable for completing project scope |
| `projectSponsor` | ISO 21502 §4.5.4 | Responsible for business case and project governance |
| `designer` | — | Design professional responsible for deliverable production |
| `inspector` | — | Inspection and verification specialist |
| `certifier` | — | Third-party certification authority |
| `contractor` | — | Main or specialist contractor representative |
| `assetManager` | ISO 55000 | Operational asset management representative |
| `statutoryAuthority` | ISO 9000 §3.6.7 | Building control, planning, or regulatory authority representative |

---

## 4. Complete Relationship Table

### 4.1 Compliance Relationships

| Relationship | From → To | Semantics |
|---|---|---|
| `HAS_REQUIREMENT` | Asset / Activity → Requirement | Asset or activity is governed by this requirement |
| `HAS_STATUS` | Requirement → RequirementStatus | Current (and historical) compliance verdict |
| `FULFILLED_BY` | Requirement:DesignDeliverable → Document:DesignDeliverable | Design-stage requirement fulfilled by a design deliverable |
| `FULFILLED_BY` | InformationRequirement → BIMContainer | Information requirement fulfilled by an information container |
| `DEFINES` | Document:DesignDeliverable → Requirement | Design deliverable defines construction requirements |
| `ADDRESSED_BY` | Requirement → Guidance | Requirement is addressed by guidance |
| `CITES` | Guidance → Requirement | Guidance cites a sub-requirement |
| `VERIFIED_BY` | Requirement → VerificationRecord | Requirement is evidenced by a verification record |
| `SUPPORTED_BY` | RequirementStatus → VerificationRecord | Compliance verdict is supported by this evidence |
| `PERFORMED_BY` | VerificationRecord → Accreditation | Record was produced by an accredited party |
| `AUTHORISED_BY` | VerificationRecord / RequirementStatus / KeyDecisionPoint → Role | Record, verdict, or gateway was signed off by a role |
| `CONTAINS` | Document / Section → nodes | Document or section contains a fragment or assurance node |
| `REFERENCES` | Requirement / Guidance → Table / Diagram / Section / Definition | Cross-reference to a document fragment |
| `RESOLVES_TO` | Reference → Document | Citation resolves to a document in the graph |
| `SUPERSEDES` | Document / RequirementStatus → same type | Version or audit trail lineage |
| `HAS_ACCEPTANCE_CRITERIA` | InformationRequirement → AcceptanceCriteria | Defines what constitutes fulfilment of an information requirement |

### 4.2 Non-Conformance Lifecycle Relationships

| Relationship | From → To | Semantics |
|---|---|---|
| `AFFECTS` | Nonconformance → Requirement | Nonconformance identifies failure against a requirement |
| `ACCEPTS` | Concession → Nonconformance | Concession formally accepts the nonconformance |
| `ADDRESSES` | CorrectiveAction → Nonconformance | Corrective action remediates a nonconformance |
| `PREVENTS` | PreventiveAction → Risk | Preventive action addresses a potential future nonconformance |
| `PRODUCES` | CorrectiveAction / PreventiveAction → VerificationRecord | Closed action produces evidence of resolution |
| `REFERENCES_NCR` | RequirementStatus → Nonconformance | Non-compliant status references the NCR |
| `REFERENCES_CONCESSION` | RequirementStatus → Concession | Accepted-with-concession status references the concession |
| `APPROVED_BY` | Concession → Role | Concession approved by an authorised role |
| `IDENTIFIED_ON` | Nonconformance → Asset | Nonconformance located on a specific asset |
| `IDENTIFIED_BY` | Nonconformance → Role | Role that identified the nonconformance |

### 4.3 Risk Relationships

| Relationship | From → To | Semantics |
|---|---|---|
| `HAS_RISK` | Asset / Activity / Requirement → Risk | Entity is exposed to this risk |
| `MITIGATED_BY` | Risk → CorrectiveAction / PreventiveAction | Risk is addressed by this action |

### 4.4 BIM and Information Management Relationships

| Relationship | From → To | Semantics |
|---|---|---|
| `CONTAINS` | BIMContainer → Document | Container carries a document |
| `ISSUED_BY` | BIMContainer → Role | Container was issued by this role |
| `REQUIRES_CONSENT` | BIMContainer → Consent | Issue of container requires a formal consent |
| `HAS_GEOMETRY` | Asset → IfcElement | Asset is geometrically represented by an IFC element |
| `HAS_IDENTIFIER` | Asset → AssetIdentifier | Asset carries a business or contractual identifier |

### 4.5 Management Relationships

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
| `ASSIGNED_TO` | CorrectiveAction / PreventiveAction → Role | Role responsible for executing the action |
| `DECIDES_ON` | KeyDecisionPoint → Requirement | Requirements that must be resolved at this gateway |
| `BOUNDED_BY` | LifecyclePhase → KeyDecisionPoint | Decision point marks phase boundary |

### 4.6 Structural Relationships

| Relationship | From → To | Semantics |
|---|---|---|
| `PART_OF` | Asset / Requirement / Activity / Section → same type | Physical, textual, work breakdown, or document structural mereology |
| `INSTANCE_OF` | Data node → Ontology Entity or Type | Links data to its ontology definition |
| `APPLICABLE_IN` | Any node → LifecyclePhase | Associates a node with a lifecycle phase |

---

## 5. Compliance Query Patterns

This section maps five target operational questions to their graph traversal patterns. All queries use the enumeration property model defined in Section 3.

### Query 1 — What are the regulatory requirements for project XYZ?

```cypher
MATCH (p:Organisation:Project)
      -[:DELIVERS]->(a:Asset)
      -[:HAS_REQUIREMENT]->(r:Requirement)
WHERE p.text CONTAINS 'XYZ'
  AND r.source IN ['legal', 'regulatory']
OPTIONAL MATCH (r)-[:HAS_STATUS]->(rs:RequirementStatus)
WHERE rs.validTo IS NULL
RETURN a.text AS asset,
       r.text AS requirement,
       coalesce(rs.status, 'notAssessed') AS complianceStatus
ORDER BY asset, requirement
```

### Query 2 — Which design standard requirements are relevant to meet the design intent?

```cypher
MATCH (r:Requirement)
WHERE r.source IN ['nationalStandard', 'internationalStandard']
  AND 'design' IN r.phase
  AND ANY(s IN r.subject WHERE s IN ['performance', 'designMethod'])
OPTIONAL MATCH (r)<-[:DEFINES]-(dd:Document:DesignDeliverable)
OPTIONAL MATCH (r)-[:HAS_STATUS]->(rs:RequirementStatus {status: 'compliant'})
RETURN r.text AS designRequirement,
       collect(distinct dd.text) AS fulfilledByDeliverables,
       rs IS NOT NULL AS isCompliant
```

### Query 3 — Does the project design meet all requirements?

```cypher
// Returns requirements with non-compliant or unassessed status
MATCH (a:Asset)-[:HAS_REQUIREMENT]->(r:Requirement)
WHERE 'design' IN r.phase
OPTIONAL MATCH (r)-[:HAS_STATUS]->(rs:RequirementStatus)
WHERE rs.validTo IS NULL
WITH r, coalesce(rs.status, 'notAssessed') AS status
WHERE status <> 'compliant'
OPTIONAL MATCH (r)<-[:AFFECTS]-(nc:Nonconformance)
RETURN r.text AS requirement,
       status,
       collect(nc.text) AS openNonconformances
```

### Query 4 — Is the design fully compliant and ready for construction?

```cypher
// Check all design-phase requirements for compliance or accepted concession
MATCH (r:Requirement)
WHERE 'design' IN r.phase
OPTIONAL MATCH (r)-[:HAS_STATUS]->(rs:RequirementStatus)
WHERE rs.validTo IS NULL
WITH count(r) AS totalReqs,
     sum(CASE WHEN coalesce(rs.status, 'notAssessed') IN ['compliant', 'acceptedWithConcession']
              THEN 1 ELSE 0 END) AS resolvedReqs,
     collect(CASE WHEN coalesce(rs.status, 'notAssessed') NOT IN ['compliant', 'acceptedWithConcession']
              THEN r.text END) AS blockers
RETURN totalReqs, resolvedReqs,
       (totalReqs - resolvedReqs) AS openItems,
       blockers
```

### Query 5 — Does the construction output meet all design specifications, material standards, and workmanship requirements?

```cypher
MATCH (a:Asset)-[:HAS_REQUIREMENT]->(r:Requirement)
WHERE 'construction' IN r.phase
  AND ANY(s IN r.subject WHERE s IN ['workMethod', 'testMethod', 'performance'])
OPTIONAL MATCH (r)-[:HAS_STATUS]->(rs:RequirementStatus)
WHERE rs.validTo IS NULL
OPTIONAL MATCH (rs)-[:SUPPORTED_BY]->(vr:VerificationRecord)
OPTIONAL MATCH (vr)-[:AUTHORISED_BY]->(role:Role)
OPTIONAL MATCH (r)<-[:AFFECTS]-(nc:Nonconformance)
RETURN a.text AS asset,
       r.text AS requirement,
       coalesce(rs.status, 'notAssessed') AS status,
       collect(distinct vr.text) AS evidence,
       collect(distinct role.text) AS signedOffBy,
       collect(distinct nc.text) AS openNCRs
ORDER BY status, asset
```

---

## 6. Mereology Chains

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
  -[:HAS_RISK]-> Risk
    -[:MITIGATED_BY]-> PreventiveAction
```

### 6.2 Design-to-Construction Thread

```
[Design phase]
Requirement {phase: ['design']}
  -[:FULFILLED_BY]-> Document:DesignDeliverable
    -[:REQUIRES_CONSENT]-> Consent
      <-[:APPROVES]- Role

[Construction phase]
Document:DesignDeliverable
  -[:DEFINES]-> Requirement {phase: ['construction']}
    -[:HAS_STATUS]-> RequirementStatus
      -[:SUPPORTED_BY]-> VerificationRecord
        -[:AUTHORISED_BY]-> Role
```

### 6.3 BIM / ISO 19650 Thread

```
InformationRequirement {infoReqType: 'eir', phase: ['design']}
  -[:HAS_ACCEPTANCE_CRITERIA]-> AcceptanceCriteria
  -[:FULFILLED_BY]-> BIMContainer {state: 'published'}
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

Activity {actType: 'audit'}
  -[:HAS_REQUIREMENT]-> Requirement {subject: ['governance']}
    -[:REQUIRES_CONSENT]-> Consent
      <-[:APPROVES]- Role
```

### 6.5 Gateway Assurance Thread

```
KeyDecisionPoint {text: 'Gateway 2 — Design Freeze'}
  -[:DECIDES_ON]-> Requirement {phase: ['design']}
  -[:AUTHORISED_BY]-> Role {roleType: 'appointingParty'}
  <-[:BOUNDED_BY]- LifecyclePhase {phase: 'design'}
```

---

## 7. Embedding Strategy

### 7.1 Prefix Construction

The ingestion pipeline assembles the ontology path prefix from the `INSTANCE_OF` chain, the node label, and the resolved enumeration properties:

```
Asset > Requirement [source:legal, subject:performance, phase:construction]
The structure shall achieve 60-minute fire resistance as tested per EN 1363-1.

Asset > RequirementStatus [status:nonCompliant]
Fire test result for slab S-07 dated 2024-09-12 recorded 47 minutes.
Requirement not met. Nonconformance NCR-0045 raised.

BIMContainer [state:published, suitabilityCode:S4, phase:design]
Structural package Rev 4 issued 2024-10-01 — calculations and drawings
for ground floor slab construction.

InformationRequirement [infoReqType:eir, phase:design]
Structural calculation package required for Gateway 2 design freeze.

Risk [riskType:compliance, likelihood:high, impact:major]
Risk of structural calculations not being issued before Gateway 2.
```

### 7.2 Staleness Management

Embeddings must be regenerated when:

- An ancestor ontology node's `label` or `text` changes.
- An enumeration property on the node changes (changes the prefix).
- A `RequirementStatus` `SUPERSEDES` relationship is added.

---

## 8. ISO Alignment

| Ontology Term | ISO 9000/9001 | ISO 19650 | ISO 55000/55001 | ISO 14001/45001 | ISO 21500/21502 |
|---|---|---|---|---|---|
| `BIMContainer` | — | Information container (19650-1 §3.3.6) | — | — | — |
| `InformationRequirement` | — | EIR/AIR/OIR/PIR (19650-1 §3.3.2–5) | — | — | — |
| `AcceptanceCriteria` | Acceptance criteria (9001 §8.6) | Acceptance criteria (19650-2 §3.1.1.1) | — | — | — |
| `BIMContainer.state` | — | CDE workflow states (19650-1 §12) | — | — | — |
| `RequirementStatus` | §9.1.1 evaluation of compliance; §10.2 | Assurance verdict at gateway | — | Evaluation of compliance (14001 §9.1.2) | — |
| `Nonconformance` | §8.7 control of nonconforming outputs | NCR in construction quality management | — | Nonconformity (14001 §10.2) | — |
| `Concession` | §8.7.3 concession / departure | — | — | — | — |
| `CorrectiveAction` | §10.2.1 corrective action | RFI close-out, snagging resolution | — | §10.2 | — |
| `PreventiveAction` | §10.3 continual improvement | — | §10.3 predictive/preventive action | — | — |
| `Risk` | §6.1 actions to address risks | — | §6.1 risk and opportunity (55001) | §6.1 | §7.8 risk management |
| `KeyDecisionPoint` | — | Key decision point (19650-1 §3.2.14) | — | — | Phase gate (21502 §4.4) |
| `IfcElement` | — | IFC GlobalId — technical identity | — | — | — |
| `AssetIdentifier` | — | Business / CAFM identity | Asset register entry | — | — |
| `Asset.criticality` | — | — | Critical asset (55000 §3.1.8) | — | — |
| `source: 'legal'` | Statutory requirement (9000 §3.6.6) | — | — | Legal requirements (14001 §3.2.9) | — |
| `source: 'regulatory'` | Regulatory requirement (9000 §3.6.7) | — | — | Other requirements (14001 §3.2.9) | — |
| `subject: ['governance', 'statutory']` | — | — | — | Compliance obligations (14001 §3.2.9) | — |
| `subject: ['governance', 'managementSystem']` | §4.4 QMS process requirement | — | §4.4 asset management system | §4.4 EMS/OHSMS clause | — |
| `subject: ['governance', 'informationManagement']` | — | ISO 19650 EIR/AIR/OIR obligation | — | — | — |
| `phase: 'delivery'` | — | Delivery phase (19650-1 §3.2.11) | — | — | — |
| `phase: 'operational'` | — | Operational phase (19650-1 §3.2.12) | Utilisation stage (55000) | — | — |
| `phase: 'renewal'` | — | — | Renewal/replacement (55000 §3.1.3) | — | — |
| `orgType: 'appointingParty'` | — | Appointing party (19650-1 §3.2.4) | — | — | — |
| `orgType: 'leadAppointedParty'` | — | Lead appointed party (19650-1 §3.2.3) | — | — | — |
| `orgType: 'assetManager'` | — | Asset information manager perspective | Asset manager (55000) | — | — |
| `roleType: 'projectInformationManager'` | — | Project information manager (19650-1 §7.3) | — | — | — |
| `roleType: 'projectSponsor'` | — | — | — | — | Project sponsor (21502 §4.5.4) |
| `actType: 'audit'` | Internal audit (9001 §9.2) | — | Internal audit (55001 §9.2) | §9.2 | — |
| `actType: 'managementReview'` | Management review (9001 §9.3) | — | Management review (55001 §9.3) | §9.3 | — |
| `actType: 'verification'` | Design verification (9001 §8.3.4c) | — | — | — | — |
| `actType: 'validation'` | Design validation (9001 §8.3.4d) | — | — | — | — |
| `infoReqType: 'pir'` | — | PIR (19650-1 §3.3.5) | — | — | — |
| `DesignDeliverable` | Design outputs (9001 §8.3.5) | Information deliverable | — | — | Project deliverable (21502) |
| `VerificationRecord` | Objective evidence (9000 §3.8.3); record (9000 §3.8.10) | Quality record, golden thread | — | — | — |
| `LifecyclePhase` | Product realisation §8 | Asset lifecycle stages (19650-1 §4) | Asset lifecycle (55000 §3.1.3) | Life cycle perspective (14001 §8.1) | Project lifecycle (21502 §3.23) |
| `RESPONSIBLE_FOR` | Responsibility §3.1.2 | RACI — Responsible/Accountable | — | — | — |
| `validFrom` / `validTo` | §7.5 documented information | Container validity (19650) | — | — | — |

---

## 9. Cypher Conventions Summary

### 9.1 Label Set

The following are the complete Neo4j node labels. All taxonomic sub-classifications are **enumeration properties**, not labels.

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
| `AcceptanceCriteria` | Compliance — fulfilment criteria for information requirements |
| `KeyDecisionPoint` | Compliance — gateway or milestone decision point |
| `Risk` | Compliance — potential adverse event affecting requirement fulfilment |
| `Nonconformance` | Compliance — identified deviation |
| `Concession` | Compliance — formally accepted deviation |
| `CorrectiveAction` | Compliance — remediation activity |
| `PreventiveAction` | Compliance — prevention activity |
| `Document` | Information — content carrier |
| `DesignDeliverable` | Information — design output (sub-label alongside `Document`) |
| `BIMContainer` | Information — ISO 19650 managed issue |
| `IfcElement` | Information — IFC geometric identity |
| `AssetIdentifier` | Information — business or contractual identity |
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
| Compliance | `HAS_REQUIREMENT`, `HAS_STATUS`, `ADDRESSED_BY`, `CITES`, `FULFILLED_BY`, `DEFINES`, `VERIFIED_BY`, `SUPPORTED_BY`, `PERFORMED_BY`, `AUTHORISED_BY`, `CONTAINS`, `REFERENCES`, `RESOLVES_TO`, `SUPERSEDES`, `HAS_ACCEPTANCE_CRITERIA` |
| Non-conformance lifecycle | `AFFECTS`, `ACCEPTS`, `ADDRESSES`, `PREVENTS`, `PRODUCES`, `REFERENCES_NCR`, `REFERENCES_CONCESSION`, `APPROVED_BY`, `IDENTIFIED_ON`, `IDENTIFIED_BY` |
| Risk | `HAS_RISK`, `MITIGATED_BY` |
| BIM / Information | `ISSUED_BY`, `HAS_GEOMETRY`, `HAS_IDENTIFIER` |
| Management | `DELIVERS`, `HAS_ROLE`, `GOVERNS`, `RESPONSIBLE_FOR`, `REQUIRES_CONSENT`, `APPROVES`, `BELONGS_TO`, `ASSIGNED_TO`, `DECIDES_ON`, `BOUNDED_BY` |
| Structural (all types) | `PART_OF`, `APPLICABLE_IN`, `INSTANCE_OF` |

### 9.3 Naming Conventions

- Node labels: `PascalCase`
- Relationship types: `SCREAMING_SNAKE_CASE`
- Enumeration property names: `camelCase` (`source`, `orgType`, `actType`, `infoReqType`, `riskType`, `roleType`, `deliverableType`, `criticality`, `state`, `lifecycle`)
- Array enumeration property names: `camelCase` (`subject`, `phase`, `governance`, `docType`)
- Temporal properties: `camelCase` (`validFrom`, `validTo`, `assessedOn`, `plannedDate`, `actualDate`)
- All node text fields: `text` (the universal field replacing `content` from V2.0)
- All node embedding fields: `embedding`
