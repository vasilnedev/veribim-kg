# Doc2KG Workbench: User Guide

## 1. Introduction

This application is a specialised tool for converting assurance documentation into a **Knowledge Graph (KG)**.

The core principle of this workbench is that the conversion process is a **human-guided, computer-assisted process**. The software performs the heavy lifting of text extraction and graph generation, but it relies on human expertise to interpret the meaning and intent of the document’s parts in the context of governance and assurance.

The user maintains the document’s structure and applies the appropriate semantic labels to blocks of text, which then form the nodes of the Knowledge Graph. This collaboration ensures that the final graph is an accurate and meaningful representation of the original document, suitable for advanced querying and analysis in a graph database.

### Labels for Document Blocks

The user can apply the following labels to categorise different blocks of text:

* `Document` – a single root block (node), which includes the document title and any subtitles;
* `Section` – structural parts used to organise the content;
* `Information` – informative (non-normative) content;
* `Requirement` – a mandatory stipulation;
* `Guidance` – generally, recommendations on how to comply with linked requirements in specific cases;
* `Reference` – a reference to another document;
* `References` – see the note below;
* `Definition` – a definition of a term;
* `Definitions` – see the note below;
* `Table` – a table title or caption;
* `Diagram` – a diagram title or caption.

**Note:**
The plural labels `References` and `Definitions` act as convenient *container labels*. They allow the user to enter multiple individual items (for example, several definitions) within a single block by placing each item on a new line.

---

## 2. Workflow Overview

The application is organised into four primary tabs, each representing a key stage in the conversion process. You should proceed through them in the following order:

**Explorer (Step 1)** ➡️ **Range Selector (Step 2)** ➡️ **Editor (Step 3)** ➡️ **Graph (Step 4)**

---

## 3. Step 1: Explorer

This is the starting point for loading a document.

**Select Existing Document**
Browse and select a previously uploaded PDF document from the list in order to continue working on it.

**Upload New PDF**
Use the upload dialog to select a file and provide a URL.

* If a file is uploaded, text extraction will be performed from the attached file, while the URL parameter will be stored for reference.
* If only a URL is provided, the application will attempt to download the PDF file and extract the text from it.

---

## 4. Step 2: Range Selector

Before text extraction, the user must define the specific page ranges from which the text will be processed. This allows boilerplate text to be skipped and enables correct handling of multi-column layouts.

When all ranges have been defined, press **Save** to store the ranges on the server. You can then proceed to the next step.

---

## 5. Step 3: Editor

This is the central workspace where the user structures and labels the raw text in order to define the graph’s nodes and their types.

The text extracted from the selected ranges is loaded here. The process involves two main actions.

### 5.1 Structure via Indentation

The application uses indentation to determine the hierarchical relationships between blocks of text (nodes).

**Text Blocks**
The raw text is split into blocks, typically separated by **at least one blank line**. Each block will become a node in the graph.

**Indent / Outdent**

You can adjust the indentation level of a block using:

* **Tab** – indent
* **Shift + Tab** – outdent

**Parent–Child Relationship**
A block indented beneath another becomes a *child node* of the block above it (the *parent node*). This creates the document’s tree structure.

For example, a `Section` node may contain multiple `Information` or `Requirement` child nodes.

---

### 5.2 Define Labels and Properties

At the beginning of each text block, the user must define its **Label** and any associated **Properties**.

**Syntax**

The first line of each block must follow this format:

```
(:Label {"property": "value"})
```

**Label**

Use one of the predefined labels listed in Section 1.

**Properties (optional)**

After the label, JSON-encoded key–value pairs may be added to store additional metadata.

Example:

```
(:Requirement {"page": 5})
```

The `page` property refers to the page within the PDF where the text appears.

For the `References` and `Definitions` labels, the main body of the text block may contain multiple lines. Each line will be treated as a separate node with the specified label, inheriting any defined properties.

---

### Example in the Editor

```
(:Document {"page": 1})
The document title and any subtitles

(:Information {"page": 1})
Non-normative information such as Introduction, Foreword, etc.
This part will be linked to the Document node in the graph.

  (:Section {"page": 1})
  The Section blocks create a sub-level in the document structure.

  (:Requirement {"page": 1})
  This block will be linked to the Section block at the same indentation level.

  (:Information {"page": 1})
  Another block linked to the Section block.

(:Requirement {"page": 1})
This block will be linked to the Document block at the same indentation level.
...
```

In this example:

* A single `Document` block should appear at the top of the text.
* `Section` blocks can create a tree structure that mirrors the document hierarchy.

---

### Tips

* When you press the **Extract** button, text is extracted from the source PDF.
* **Important:** If you edit the text and press **Extract** again, your work will be overwritten by a new extraction.
* Use the **Save** button frequently to avoid losing changes.
* Use the **Test** button to check the syntax when you are ready.

---

## 6. Step 4: Graph

This is the final stage, where the structured and labelled document is transformed into a Knowledge Graph.

**Generate Graph**

Click **Generate Graph**.
The application processes all nodes, their labels, properties, and the hierarchical structure (parent–child relationships) defined in the Editor.

**Export / Import to Neo4j**

At this stage, the generated graph is imported into a Neo4j database on the server.

---

## 7. Tips for Best Results

**Consistency**
Use labels consistently throughout the document. For example, always use `Requirement` for mandatory or normative text (usually containing *shall* or *must*).

**Properties**
Adding metadata using properties is recommended. In particular, setting a `page` property for each node can be very useful.

**Indentation Is Key**
The graph structure is determined entirely by indentation. Review the structure carefully in the Editor before generating the graph.


