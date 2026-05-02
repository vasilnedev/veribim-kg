# veribim-kg Ontology Design

**Project:** veribim-kg — Knowledge Layer for Construction Compliance  
**Author:** Vasil Nedev  
**Purpose:** Ontology specification for the Neo4j knowledge graph, covering node types, relationships, taxonomies, mereology, management layer, and embedding strategy.

---

## Executive Summary

Construction projects generate an enormous volume of information: regulations, standards, specifications, inspection records, test certificates, and design drawings. Today, the connections between these documents — which regulation a wall must meet, which test certificate proves it does, which standard defines how that test is performed, and which organisation is accountable for each — exist mostly in spreadsheets and in the heads of experienced professionals. When people leave a project, that knowledge leaves with them. When an audit or defect investigation demands a full compliance trail, assembling it is slow, manual, and error-prone.

veribim-kg addresses this by creating a **knowledge layer** — a structured, queryable map of everything a construction project must comply with and all the evidence that it does. Think of it as the compliance backbone of a project: every requirement, every piece of guidance, every inspection record, and every competency certificate connected to the asset or activity it relates to, traceable from law all the way through to the site photograph and the organisation responsible for it.

The technology underpinning this is a **Knowledge Graph** — a database that stores not just data, but the *relationships between data*. Unlike a spreadsheet or a document management system, a knowledge graph can answer questions that cross multiple documents and disciplines at once: *"What are all the legal requirements this structural element must meet, what does the design say about them, which contractor is responsible, and where is the evidence that the constructed outcome complies?"* Answering that question today might take hours; in a knowledge graph it is a single query.

The **ontology** described in this document is the vocabulary and grammar of that knowledge graph. It covers three interconnected domains. The first is the **compliance domain**: Assets, Requirements, Guidance, Verification Records, and Accreditations — what must be built, to what standard, and how compliance is evidenced. The second is the **management domain**: Projects, Organisations, Roles, Activities, and Consents — who is responsible, what work must be done, and what approvals are required. The third is the **design domain**: Design Deliverables — the drawings, calculations, specifications, reports, and models that translate high-level user and regulatory requirements into construction instructions. Design Deliverables are the formal handoff between design and construction: they are produced to fulfil design-stage requirements and in turn define the construction requirements the build must meet. Requirements bridge all three domains: they govern not only what a physical asset must *be* (structural capacity, fire resistance) but also what an organisation must *do* (maintain a quality management system, conduct risk assessments, submit notifications) — precisely as stipulated by ISO 9001, ISO 14001, and ISO 45001.

Crucially, the design aligns with **ISO 9000** quality management terminology and **ISO 55000** asset management principles, ensuring that the language used in the graph is recognisable to quality professionals, project managers, and auditors alike. Every node in the graph carries a plain-English description, meaning the graph can be searched in natural language — a quality manager can ask a question in plain English and receive an evidence-backed answer drawn directly from the project's own documents and records.

The result is a living **golden thread**: a continuously maintained, auditable record connecting every requirement — whether physical or organisational — to the evidence that it has been met, and to the people and organisations accountable for meeting it.

---

## 1. Design Principles

- Every node — whether ontology metadata or real data — carries exactly two fields: `content` (text) and `embedding` (vector).
- The ontology is stored **inside the same Neo4j database** as the data it describes, making the schema introspectable and participatory in semantic search.
- Neo4j **node labels** are used for query performance. **`INSTANCE_OF` relationships** connect data nodes to ontology nodes for semantic richness and LLM traversal.
- Ontology nodes additionally carry a `label` field as a machine key, keeping `content` free for natural language definitions that produce meaningful embeddings.
- Requirements may target **Assets** (what the physical output must be) or **Activities** (what the organisation must do), or both. This is expressed through the `HAS_REQUIREMENT` relationship, which is not exclusive to Assets.

---

## 2. Node Structure

All nodes — ontology and data alike — share the same two fields:

| Field | Type | Purpose |
|---|---|---|
| `content` | String | Human-readable text: a clause, definition, record, or natural language description |
| `embedding` | Float[] | Vector representation of the node, used for semantic similarity search |

Ontology nodes additionally carry:

| Field | Type | Purpose |
|---|---|---|
| `label` | String | Machine key used by the ingestion pipeline to assign Neo4j labels to data nodes |

---

## 3. Ontology Meta-Layer

The ontology is modelled as graph data using three generic node labels and two relationship types:

```
(:Ontology)-[:HAS_PART]->(:Entity)-[:HAS_TYPE]->(:Type)
```

| Label | Role |
|---|---|
| `Ontology` | Root node representing the ontology itself |
| `Entity` | A core domain concept (e.g. Asset, Requirement, Organisation) |
| `Type` | A taxonomic subtype of an Entity (e.g. Legal, NationalStandard, Contractor) |

| Relationship | Semantics |
|---|---|
| `HAS_PART` | Mereology — expresses that one concept is structurally part of another |
| `HAS_TYPE` | Taxonomy — expresses that a Type is a subtype of an Entity |

These two relationship types are **reserved for the ontology meta-layer only** and are never used between data nodes.

---

## 4. Core Entity Types

### 4.1 Compliance Domain

#### Asset
A physical output of construction work: a wall, door, structural frame, HVAC unit, pile. Assets are recursively decomposable via `PART_OF` (system → subsystem → component → element).

Aligns with: ISO 55000 §3.2.1 physical asset.

#### Requirement
A normative statement expressing a need or expectation that must be satisfied — either by an asset (what it must *be*) or by an organisation through its activities (what it must *do*). Requirements from management system standards such as ISO 9001, ISO 14001, and ISO 45001 are Activity Requirements; requirements from Building Regulations and structural standards are Asset Requirements. A single requirement clause may govern both.

Aligns with: ISO 9000:2015 §3.6.4 requirement.

#### Guidance
A recommendation describing an acceptable route to meeting one or more requirements. Compliance is not obligatory — Guidance says *how*, Requirements say *what*. Guidance may cite further sub-requirements on method, tolerance, or testing.

#### Verification Record
Documented evidence of fulfilment of a requirement: a signed inspection checklist, test certificate, photographic record, completed ITP entry, or management review minute.

Aligns with: ISO 9000:2015 §3.8.3 objective evidence; §3.8.10 record. UK Building Safety Act golden thread.

#### Accreditation
A competency record attesting that the person or organisation who produced a Verification Record was authorised to do so: a CSCS card, third-party inspector certificate, UKAS accreditation, or auditor qualification.

#### Document
The carrier of content. All Requirements, Guidance, Verification Records, and document fragment nodes are contained within a Document. Documents carry version lineage via `SUPERSEDES`. The Document entity is further decomposed into four sub-entities representing the structural and informational fragments a document can yield during ingestion:

**Section** — a named subdivision of a document: a chapter, clause group, or headed block of text. Sections are recursively decomposable via `PART_OF` (chapter → section → subsection) and act as the immediate container for Requirements, Guidance, Information, Tables, and Diagrams within the document hierarchy. The `content` field holds the section heading and any introductory text.

**Information** — a passage of text that carries contextual or background value but has no direct normative force and does not form part of the assurance chain. Typical examples include scope statements, definitions, explanatory notes, and forewords. Information nodes participate in semantic search and RAG retrieval but never appear as nodes in a compliance thread.

**Table** — a structured data element within a document. Because raw tabular data is not suitable for a text embedding, the `content` field holds the table caption and a natural language description of what the table contains and its relevance. The full table data may be stored externally and referenced by URI within `content` if required.

**Diagram** — a graphic illustration within a document. The `content` field holds the figure caption and a natural language description of what the diagram depicts. As with Table, the image itself is not stored in the graph. Diagrams and Tables may be cross-referenced from Requirements or Guidance nodes via `REFERENCES`.

**Definition** — an explicit explanation of a term as stated within the document itself. The `content` field holds the term and its definition exactly as the document expresses it. Definition nodes are particularly valuable for legal and standards documents where terms carry precise technical meanings that differ from everyday usage. Requirements and Guidance nodes may cross-reference Definition nodes via `REFERENCES` to resolve terms unambiguously during RAG retrieval.

**Reference** — a citation of another document as it appears within the source document (e.g. a normative references clause in a standard, a drawing schedule entry, or a contractual reference to a specification). The `content` field holds the cited document's identifier, title, and any edition or date information present in the source. Reference nodes are created during ingestion regardless of whether the cited document exists in the database, ensuring that all normative dependencies are captured. When the cited document is subsequently added to the graph, the pipeline may connect the Reference node to the target Document via `RESOLVES_TO`. This complements the `CITES` relationship — `CITES` connects Guidance to a Requirement already resolved in the graph; `Reference` captures the raw citation at document level as a stable ingestion record.

---

### 4.3 Design Domain

#### DesignDeliverable
A formal document produced during the Design phase that translates high-level user and regulatory requirements into construction instructions. DesignDeliverable is modelled as a **subtype of Document** — it carries an additional `DesignDeliverable` label alongside its document type label (e.g. `Drawing`, `Calculation`) and inherits all Document relationships: `CONTAINS`, `SUPERSEDES`, fragment nodes, and version lineage.

DesignDeliverables occupy the critical handoff position between the design and construction stages of the lifecycle. They are produced to fulfil Inception and Design phase Requirements (`FULFILLED_BY`) and in turn define the construction Requirements the build must meet (`DEFINES`). Approval of a DesignDeliverable before issue for construction is captured via the existing `REQUIRES_CONSENT` and `APPROVES` relationships.

```cypher
// A structural drawing fulfils a client requirement and defines a construction requirement
(:Requirement:Client:Performance:Design)
  <-[:FULFILLED_BY]-(:Document:DesignDeliverable:Drawing:Design
    {content:"Structural layout S-101 Rev 3 — ground floor slab", embedding:[...]})
  -[:DEFINES]->(:Requirement:NationalStandard:WorkMethod:Construction)

// Approval before issue for construction
(:Document:DesignDeliverable:Calculation)
  -[:REQUIRES_CONSENT]->(:Consent)<-[:APPROVES]-(:Role:StatutoryAuthority)
```

Aligns with: ISO 9001 §8.3 design and development outputs; RIBA Plan of Work Stage 4 Technical Design deliverables.

---

### 4.4 Management Domain

#### Project
The root aggregator node for the organisational and governance structure of a specific project. `Project` is a subtype of `Organisation` and inherits all Organisation relationships. Its `HAS_PART` children are the participating organisations; its `HAS_ROLE` children are project-level roles (Project Manager, CDM Principal Contractor, etc.). A Project connects to the assets it delivers via `DELIVERS`, and to the DesignDeliverables produced for it via `DELIVERS`.

#### Organisation
Any legal or contractual entity involved in the project: client, main contractor, subcontractor, consultant, statutory authority, or certification body. Organisations are recursively decomposable via `PART_OF` (group → subsidiary → division → team).

#### Role
A named function within a project or organisation: Site Manager, Structural Engineer, Building Control Officer, Quality Manager. A Role is held by an Organisation and scoped to lifecycle phases via `APPLICABLE_IN`. No named persons are modelled — the Role is stable across staff changes. Roles carry accountability for both Asset Requirements (physical outcomes) and Activity Requirements (organisational processes).

#### Activity
A unit of work that is a subdivision of a LifecyclePhase. Activities are recursively decomposable via `PART_OF` (Process → Activity → Task), giving a full work breakdown structure nested within the lifecycle. Activities carry their own Requirements — primarily from management system standards — expressing what the organisation must do during that activity.

#### Consent
A formal approval, submission, or regulatory decision: a planning permission, building control approval, third-party sign-off, or internal gateway decision. Consents are required by Requirements and granted by Roles.

---

## 5. Data Relationships

### 5.1 Compliance Relationships

| Relationship | From → To | Semantics |
|---|---|---|
| `HAS_REQUIREMENT` | Asset → Requirement | An asset is governed by a requirement |
| `HAS_REQUIREMENT` | Activity → Requirement | An activity is governed by a requirement |
| `FULFILLED_BY` | Requirement → DesignDeliverable | A design-stage requirement is fulfilled by a design deliverable |
| `DEFINES` | DesignDeliverable → Requirement | A design deliverable defines construction requirements the build must meet |
| `ADDRESSED_BY` | Requirement → Guidance | A requirement is addressed by guidance |
| `CITES` | Guidance → Requirement | Guidance cites a sub-requirement (method, tolerance, test) |
| `VERIFIED_BY` | Requirement → Verification Record | A requirement is evidenced by a verification record |
| `PERFORMED_BY` | Verification Record → Accreditation | A record was produced by an accredited party |
| `AUTHORISED_BY` | Verification Record → Role | A verification record was signed off by a role |
| `CONTAINS` | Document → Section / Requirement / Guidance / Verification Record / Information / Table / Diagram / Definition / Reference | Document contains a fragment or assurance node |
| `CONTAINS` | Section → Requirement / Guidance / Information / Table / Diagram / Definition / Reference | Section contains a fragment or assurance node |
| `REFERENCES` | Requirement / Guidance → Table / Diagram / Section / Information / Definition | A clause cross-references a document fragment or defined term |
| `RESOLVES_TO` | Reference → Document | A captured citation resolves to a Document present in the database |
| `SUPERSEDES` | Document → Document | Version lineage |

### 5.2 Management Relationships

| Relationship | From → To | Semantics |
|---|---|---|
| `DELIVERS` | Project → Asset | A project delivers a physical asset |
| `HAS_PART` | Organisation → Organisation | Organisational mereology |
| `HAS_ROLE` | Organisation → Role | An organisation holds a project role |
| `GOVERNS` | Organisation → Asset | An organisation has regulatory or contractual authority over an asset |
| `RESPONSIBLE_FOR` | Role → Requirement | A role is accountable for satisfying a requirement (R/A in RACI) |
| `PERFORMED_BY` | Activity → Role | A role is responsible for executing an activity |
| `REQUIRES_CONSENT` | Requirement → Consent | Fulfilling a requirement demands a formal consent or approval |
| `APPROVES` | Role → Consent | A role grants or issues a consent or approval |
| `BELONGS_TO` | Activity → LifecyclePhase | An activity is a subdivision of a lifecycle phase |

### 5.3 Structural Relationships (all node types)

| Relationship | From → To | Semantics |
|---|---|---|
| `PART_OF` | Asset → Asset | Physical mereology — system/component/element breakdown |
| `PART_OF` | Requirement → Requirement | Textual mereology — document/clause/sub-clause nesting |
| `PART_OF` | Activity → Activity | Work breakdown mereology — process/activity/task |
| `PART_OF` | Section → Section | Document structural mereology — chapter/section/subsection |
| `INSTANCE_OF` | Data node → Ontology Entity or Type | Links data to its ontology definition |
| `APPLICABLE_IN` | Any node → LifecyclePhase | Associates a node with an asset lifecycle phase |

---

## 6. Mereology Chains

### 6.1 Physical Compliance Thread

```
Asset
  -[:HAS_REQUIREMENT]-> Requirement [Asset Requirement]
    -[:ADDRESSED_BY]-> Guidance
      -[:CITES]-> Requirement        ← sub-requirement
        -[:VERIFIED_BY]-> Verification Record
          -[:AUTHORISED_BY]-> Role
            -[:HAS_ROLE]-> Organisation
```

### 6.2 Management Compliance Thread

```
Project
  -[:HAS_PART]-> Organisation
    -[:HAS_ROLE]-> Role
      -[:RESPONSIBLE_FOR]-> Requirement [Activity Requirement]
        -[:VERIFIED_BY]-> Verification Record
          -[:AUTHORISED_BY]-> Role

Activity
  -[:BELONGS_TO]-> LifecyclePhase
  -[:HAS_REQUIREMENT]-> Requirement [Activity Requirement]
  -[:PERFORMED_BY]-> Role

Requirement
  -[:REQUIRES_CONSENT]-> Consent
    <-[:APPROVES]- Role
```

### 6.3 Cross-Domain Link

A single Requirement clause may appear in both threads simultaneously:

```cypher
// CDM Regulation 12 — governs both design output (Asset) and organisational process (Activity)
(:Asset)-[:HAS_REQUIREMENT]->(:Requirement:Legal:Governance)
(:Activity)-[:HAS_REQUIREMENT]->(:Requirement:Legal:Governance)
(:Role)-[:RESPONSIBLE_FOR]->(:Requirement:Legal:Governance)
```

### 6.4 Document Decomposition Thread

```
Document
  -[:CONTAINS]-> Section
    -[:PART_OF]-> Section           ← recursive subsection nesting
    -[:CONTAINS]-> Requirement
    -[:CONTAINS]-> Guidance
    -[:CONTAINS]-> Information
    -[:CONTAINS]-> Table
    -[:CONTAINS]-> Diagram
    -[:CONTAINS]-> Definition
    -[:CONTAINS]-> Reference
      -[:RESOLVES_TO]-> Document    ← populated when cited document exists in graph

Requirement / Guidance
  -[:REFERENCES]-> Table            ← "see Table 3"
  -[:REFERENCES]-> Diagram          ← "as shown in Figure 2"
  -[:REFERENCES]-> Section          ← "refer to Section 4.2"
  -[:REFERENCES]-> Information      ← "as defined in the scope"
  -[:REFERENCES]-> Definition       ← "as defined in clause 3.1"
```

`Asset`, `Requirement`, `Activity`, and `Section` are all recursively decomposable via `PART_OF`, enabling full physical, textual, work breakdown, and document structural hierarchies without depth limits.

### 6.5 Design-to-Construction Thread

```
[Inception / Design phase]
Requirement [Client, Performance, Design]       ← user or regulatory requirement
  -[:FULFILLED_BY]-> DesignDeliverable [Drawing / Calculation / Specification...]
    -[:REQUIRES_CONSENT]-> Consent              ← approval before issue for construction
      <-[:APPROVES]- Role

[Construction phase]
DesignDeliverable
  -[:DEFINES]-> Requirement [WorkMethod / TestMethod / Performance, Construction]
    -[:ADDRESSED_BY]-> Guidance
      -[:CITES]-> Requirement
        -[:VERIFIED_BY]-> Verification Record
          -[:AUTHORISED_BY]-> Role
```

This thread makes the design-to-construction handoff an explicit, traversable graph path. A query starting from a user requirement can follow the chain all the way to the construction verification record, passing through the design deliverable that bridges the two stages.

---

## 7. Hybrid Label + INSTANCE_OF Strategy

Data nodes carry **both** Neo4j labels (for query performance) **and** `INSTANCE_OF` edges (for semantic richness):

```cypher
// Asset Requirement example
(:Requirement:Legal:Performance:Construction
  {content:"The structure shall achieve 60-minute fire resistance...", embedding:[...]})
  -[:INSTANCE_OF]->(:Entity {label:"Requirement", content:"A Requirement is a normative statement..."})

// Activity Requirement example
(:Requirement:InternationalStandard:Governance:Design
  {content:"The organisation shall establish, implement and maintain a QMS...", embedding:[...]})
  -[:INSTANCE_OF]->(:Entity {label:"Requirement", content:"A Requirement is a normative statement..."})

// DesignDeliverable example
(:Document:DesignDeliverable:Drawing:Design
  {content:"Structural layout S-101 Rev 3 — ground floor slab reinforcement", embedding:[...]})
  -[:INSTANCE_OF]->(:Entity {label:"DesignDeliverable", content:"A DesignDeliverable is a formal design output..."})

// Project / Organisation example
(:Organisation:Project
  {content:"Crossrail Station Upgrade — Liverpool Street", embedding:[...]})
  -[:INSTANCE_OF]->(:Entity {label:"Project", content:"A Project is the root organisational node..."})
```

| Mechanism | Purpose |
|---|---|
| Neo4j labels | Fast index-based filtering in Cypher queries |
| `INSTANCE_OF` edge | Traversable type definition; LLM reasoning; semantic search over ontology |

The `label` field on ontology nodes is used by the ingestion pipeline to assign the correct Neo4j labels to data nodes programmatically, without string-matching against `content`.

---

## 8. Taxonomies

### 8.1 Requirement — Source Taxonomy

| Label | Description |
|---|---|
| `Legal` | Primary or secondary legislation; statutory instruments |
| `Client` | Employer's Requirements, client brief |
| `NationalStandard` | BS, DIN, NF and equivalent national standards |
| `InternationalStandard` | ISO, IEC, EN and equivalent international standards |
| `IndustryBody` | CIOB, ICE, RICS and recognised professional bodies |
| `Manufacturer` | Product data sheets, installation specifications |

### 8.2 Requirement — Subject Taxonomy

| Label | Description | Applies to |
|---|---|---|
| `Performance` | Outcome specification — what the asset must achieve | Asset |
| `DesignMethod` | How to design or specify the asset | Asset |
| `WorkMethod` | Workmanship — how construction work shall be executed | Asset |
| `TestMethod` | Inspection and verification procedures | Asset / Activity |
| `Governance` | Approvals, sign-offs, statutory notifications, management system obligations | Activity |

### 8.3 Organisation Type Taxonomy

| Label | Description |
|---|---|
| `Project` | Root project node — aggregates all participating organisations and roles |
| `Client` | Project owner, employer |
| `Contractor` | Main contractor or construction manager |
| `Subcontractor` | Specialist trade contractor |
| `Consultant` | Designer, engineer, project manager |
| `StatutoryAuthority` | Building control, planning authority, HSE |
| `CertificationBody` | Third-party inspector, UKAS-accredited body |

### 8.4 Activity Type Taxonomy

| Label | Description |
|---|---|
| `Process` | Top-level grouping of related activities |
| `Activity` | A defined unit of work within a process |
| `Task` | A discrete step within an activity |
| `Inspection` | A formal check or audit activity |
| `Submission` | A formal document submission to an authority |
| `Review` | A design, document, or management review gate |

### 8.5 DesignDeliverable Type Taxonomy

DesignDeliverables are subtypes of Document. A node carries both the `DesignDeliverable` label and one of the following type labels:

| Label | Description |
|---|---|
| `Drawing` | 2D engineering or architectural drawing (general arrangement, detail, section) |
| `Calculation` | Structural, thermal, acoustic, geotechnical, or other engineering calculation |
| `Specification` | Written technical specification of materials, systems, or workmanship standards |
| `Report` | Design report, survey, assessment, feasibility study, or specialist design report |
| `Model` | 3D BIM model, parametric design model, or digital twin source model |
| `Schedule` | Door, window, finish, room data, or equipment schedule derived from the design |

### 8.6 Document Type Taxonomy

| Label | Description |
|---|---|
| `Regulatory` | Acts of Parliament, statutory instruments, planning conditions |
| `Standard` | National and international standards |
| `Contract` | Specifications, drawings, Employer's Requirements |
| `Technical` | ITPs, method statements, design reports |
| `QualityRecord` | Inspection records, test certificates, handover documentation |

### 8.7 Document Fragment Taxonomy

Sub-entities of Document representing the complete set of structural, normative, and informational units produced during ingestion. Every fragment extracted from a Document or Section is assigned one of the following labels:

| Label | Content field holds | Role in graph |
|---|---|---|
| `Section` | Heading and introductory text | Structural container; recursively decomposable via `PART_OF` |
| `Requirement` | The normative statement exactly as written | Assurance chain node; governs Asset or Activity; source of compliance thread |
| `Guidance` | The recommendation text exactly as written | Assurance chain node; addresses a Requirement; may cite sub-requirements |
| `Information` | Full passage text | Contextual / background; semantic search only; not in compliance thread |
| `Table` | Caption and natural language description | Cross-referenced from Requirements or Guidance via `REFERENCES` |
| `Diagram` | Caption and natural language description | Cross-referenced from Requirements or Guidance via `REFERENCES` |
| `Definition` | Term and its document-stated explanation | Resolves defined terms; cross-referenced via `REFERENCES`; enriches RAG retrieval |
| `Reference` | Cited document identifier, title, edition | Captures all external citations at ingestion; resolved to Document via `RESOLVES_TO` when available |

### 8.8 Asset Lifecycle Taxonomy

Lifecycle phases are modelled as `LifecyclePhase` nodes. Any node type can be associated with one or more phases via `APPLICABLE_IN`. Activities are additionally linked to phases via `BELONGS_TO`.

| Label | Description |
|---|---|
| `Inception` | Project brief, feasibility, scope definition |
| `Design` | Concept, developed, and technical design |
| `Construction` | Build, inspection, and testing |
| `Maintenance` | Operation, planned maintenance, repair |
| `Termination` | Decommissioning, demolition, disposal |

---

## 9. Ontology-Path-Augmented Embeddings

### Rationale

A bare content string is semantically ambiguous in isolation. Two clauses with near-identical wording but different types — one a `Performance` asset requirement, one a `Governance` activity requirement — would produce near-identical embeddings without contextual enrichment, degrading retrieval precision. The ontology path encodes the full semantic context of a node into its embedding.

### Method

At embedding generation time, the ingestion pipeline traverses the ontology from the root to the data node via `INSTANCE_OF` and assembles a structured prefix:

```cypher
MATCH path = (:Ontology)-[:HAS_PART*]->(e:Entity)<-[:INSTANCE_OF]-(n)
WHERE id(n) = $nodeId
WITH n, [node IN nodes(path) | node.label] AS ontologyPath
RETURN ontologyPath, n.content
```

The embedding model receives:

```
[ontologyPath joined with " > "] + "\n" + n.content
```

**Asset Requirement example:**
```
Asset > Requirement [NationalStandard, TestMethod, Construction]
Tensile strength shall not be less than 500 MPa.
```

**Activity Requirement example:**
```
Activity > Requirement [InternationalStandard, Governance, Design]
The organisation shall establish, implement and maintain a quality management system.
```

**DesignDeliverable example:**
```
DesignDeliverable > Drawing [Design, Construction]
Structural layout S-101 Rev 3 — ground floor slab reinforcement: shows bar sizes,
spacing, cover, and laps for the 250mm RC slab as specified in calculation C-045.
```

### Benefits

- Disambiguates near-identical clauses by domain, type, and lifecycle phase
- Correctly separates Asset Requirements from Activity Requirements in vector space
- Improves vector search precision — semantically similar queries retrieve correctly typed nodes
- Aligns with LLM training patterns — contextualised text produces better embeddings
- Makes RAG-retrieved nodes self-explanatory — the LLM receives full type context alongside content

### Staleness Management

Embeddings must be regenerated whenever an ancestor ontology node's `label` or `content` changes. The pipeline should flag all data nodes downstream of a modified ontology node for re-embedding.

---

## 10. ISO Alignment

| Ontology term | ISO 9000:2015 | ISO 55000 / PM / MSS equivalent |
|---|---|---|
| DesignDeliverable | design and development outputs §8.3.5 | RIBA Stage 4 technical design deliverable; IFC model; information deliverable (ISO 19650) |
| FULFILLED_BY | design output satisfies design input §8.3.5 | requirement closure at design gateway |
| DEFINES | design output specifies construction requirement | construction information release |
| Requirement (Asset) | requirement §3.6.4 | technical / product requirement |
| Requirement (Activity) | requirement §3.6.4 | management system clause (ISO 9001, 14001, 45001) |
| Verification Record | objective evidence §3.8.3; record §3.8.10 | quality record, golden thread |
| Guidance | informative guidance (ISO 9001 notes) | method statement, ITP |
| Accreditation | competence §3.10.4 | resource qualification |
| Asset | object §3.6.1 | physical asset ISO 55000 §3.2.1 |
| Document SUPERSEDES | document control — obsolete editions | document revision management |
| LifecyclePhase | product realisation §8 | RIBA Plan of Work stages |
| Organisation | interested party §3.2.3 | contracting organisation |
| Role | competence §3.10.4 | project role, responsibility assignment |
| Activity | process §3.4.1 | work package, activity (ISO 21500) |
| Consent | statutory / contractual approval | gateway approval, permit to proceed |
| RESPONSIBLE_FOR | responsibility §3.1.2 | RACI — Responsible / Accountable |
| Project | project §3.4.2 | project (ISO 21500 §3.1) |

---

## 11. Cypher Conventions Summary

| Layer | Relationship types used |
|---|---|
| Ontology meta-layer | `HAS_PART`, `HAS_TYPE` |
| Compliance data | `HAS_REQUIREMENT`, `ADDRESSED_BY`, `CITES`, `FULFILLED_BY`, `DEFINES`, `VERIFIED_BY`, `PERFORMED_BY`, `AUTHORISED_BY`, `CONTAINS`, `REFERENCES`, `RESOLVES_TO`, `SUPERSEDES` |
| Management data | `DELIVERS`, `HAS_ROLE`, `GOVERNS`, `RESPONSIBLE_FOR`, `REQUIRES_CONSENT`, `APPROVES`, `BELONGS_TO` |
| Structural (all) | `PART_OF`, `APPLICABLE_IN` |
| Cross-layer | `INSTANCE_OF` |

Node labels follow PascalCase. Relationship types follow SCREAMING_SNAKE_CASE. Both are Neo4j conventions.