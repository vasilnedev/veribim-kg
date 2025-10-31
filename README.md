# VeriBIM-KG

**VeriBIM-KG** is an integrated knowledge graph system designed to connect Building Information Modelling (BIM) data and technical project documentation with intelligent querying, verification, and contextual reasoning powered by Large Language Models (LLMs).

This repository outlines the overall architecture and components that make up the VeriBIM-KG application ecosystem, designed for modular, containerised, and scalable deployment.

---

## System Overview

VeriBIM-KG is organised around **three main pipelines**, each with dedicated **front-end** and **back-end** applications running in **separate Docker containers**, all connected through a shared data layer and API gateway.

### Pipelines

1. **Technical Requirements → Knowledge Graph**
   - **Input:** Technical documentation in **PDF format**
   - **Process:**
     - PDF parsing using **Apache Tika**
     - Semantic extraction and transformation into **Knowledge Graph triples**
     - Storage in **Neo4j**
   - **Output:** Structured knowledge graph representation of technical requirements

2. **BIM Models (IFC) → Knowledge Graph**
   - **Input:** BIM models in **IFC format**
   - **Process:**
     - IFC data parsing and entity extraction
     - Mapping of BIM entities and relationships into graph structures
   - **Output:** Enriched knowledge graph with BIM object relationships and attributes

3. **GraphRAG Chat Application**
   - **Function:** Conversational interface for querying and reasoning over the knowledge graph
   - **Features:**
     - Retrieval-Augmented Generation (**RAG**) powered by external **LLM providers**
     - Contextual graph traversal and summarisation
     - Dynamic prompt construction and response generation

---

## System Architecture

The VeriBIM-KG system follows a **modular, containerised architecture**, ensuring scalability, maintainability, and secure API management.

```
 ┌──────────────────────────────┐
 │          Base App            │
 │ (API Gateway / Reverse Proxy)│
 └──────────────┬───────────────┘
                │
     ┌──────────┴──────────┐
     │                     │
┌──────────┐         ┌──────────┐
│ Frontend │         │ Backend  │
│  (UI)    │         │  (API)   │
└──────────┘         └──────────┘
                         │
                         │
          ┌──────────────┴──────────────┐
          │                             │
     ┌─────────────┐              ┌─────────────┐
     │   MinIO     │              │   Neo4j      │
     │ (File store)│              │ (Graph DB)   │
     └─────────────┘              └─────────────┘
                   ┌─────────────┐
                   │ Apache Tika │
                   │ (PDF parser)│
                   └─────────────┘
```

In this architecture, **all data access is routed through the back-end containers**.  
Front-end applications communicate exclusively with their corresponding back-ends via the **Base App (API Gateway)**, ensuring consistent access control and data flow.

---

## Common Data Layer

- **MinIO** – Object storage for PDFs, IFC files, and other binary assets  
- **Neo4j** – Central graph database for storing entities, relationships, and semantic context  
- **Apache Tika** – Microservice for extracting text and metadata from PDF documents  

---

## API Gateway – Base App

The **Base App** acts as an API Gateway and **reverse proxy**, providing:

- Unified access to all front-end and back-end containers  
- Authentication, authorisation, and routing management  
- Load balancing and CORS configuration  
- Simplified client integration through a single entry point  

---

## LLM Integration

Online **LLM providers** (e.g. OpenAI, Anthropic, or similar APIs) are used for:

- **Vector embeddings** generation for semantic search and RAG workflows  
- **Conversational responses** in the GraphRAG chat application  

Embedding vectors may be stored either in Neo4j (as node properties) or in a separate vector store, depending on performance requirements.

---

## Deployment

Each component runs in an isolated Docker container, orchestrated through **Docker Compose** or **Kubernetes**.  
Typical stack includes:

- `base-app` – API Gateway / Reverse Proxy  
- `tika-service` – Apache Tika PDF parser  
- `minio` – Object storage service  
- `neo4j` – Graph database  
- `pipeline-*` – Individual pipeline back-ends and front-ends  
- `chat-app` – GraphRAG chat interface  

---

## Roadmap

- Implement core PDF-to-KG and IFC-to-KG pipelines  
- Integrate Apache Tika microservice  
- Develop Base App API Gateway  
- Deploy Neo4j and MinIO layers  
- Integrate GraphRAG chat interface with external LLMs  
- Documentation and CI/CD workflows  

---

## References

- Blog post: [VeriBIM: Towards a Verified BIM Knowledge Graph](https://nedev.digital/blog/posts/veribim-dev)  
- Technologies: Docker, Neo4j, MinIO, Apache Tika, IFC, GraphRAG, LLM APIs  

---

## Licence

This repository is licensed under the MIT Licence.  
See the `LICENCE` file for details.

