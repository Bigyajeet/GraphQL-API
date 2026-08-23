import { describe, it, expect, beforeAll, beforeEach, afterAll } from "bun:test";
import { createYoga } from "graphql-yoga";
import { schema } from "../../src/server";
import { testPrisma, resetTestDatabase, isDatabaseAvailable } from "../setupIntegration";

describe("GraphQL API Integration Tests (PostgreSQL)", () => {
  let dbAvailable = false;

  const yoga = createYoga({
    schema,
    context: () => ({ prisma: testPrisma }),
    graphqlEndpoint: "/graphql",
  });

  async function executeGraphQL(query: string, variables?: Record<string, unknown>) {
    const response = await yoga.fetch("http://localhost:4000/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        variables,
      }),
    });
    return response.json();
  }

  beforeAll(async () => {
    dbAvailable = await isDatabaseAvailable();
    if (!dbAvailable) {
      console.warn("⚠️ PostgreSQL database not reachable at localhost:5432. Integration tests skipped in offline environment.");
      return;
    }
    await resetTestDatabase();
  });

  beforeEach(async () => {
    if (dbAvailable) {
      await resetTestDatabase();
    }
  });

  afterAll(async () => {
    if (dbAvailable) {
      await resetTestDatabase();
      await testPrisma.$disconnect();
    }
  });

  it("Flow 1: create collection -> create document -> move document -> query collection with documents", async () => {
    if (!dbAvailable) return;

    // 1. Create source collection
    const colRes1 = await executeGraphQL(`
      mutation {
        createCollection(name: "Source Contracts", slug: "source-contracts") {
          id
          name
          slug
        }
      }
    `);
    expect(colRes1.errors).toBeUndefined();
    const sourceCol = colRes1.data.createCollection;
    expect(sourceCol.slug).toBe("source-contracts");

    // 2. Create target collection
    const colRes2 = await executeGraphQL(`
      mutation {
        createCollection(name: "Target Contracts", slug: "target-contracts") {
          id
          name
          slug
        }
      }
    `);
    expect(colRes2.errors).toBeUndefined();
    const targetCol = colRes2.data.createCollection;

    // 3. Create document in source collection
    const docRes = await executeGraphQL(
      `
      mutation CreateDoc($colId: ID!) {
        createDocument(
          title: "Master Service Agreement 2026"
          content: "Comprehensive terms for client engagement."
          tags: ["legal", "contract"]
          collectionId: $colId
        ) {
          id
          title
          collectionId
        }
      }
    `,
      { colId: sourceCol.id }
    );
    expect(docRes.errors).toBeUndefined();
    const doc = docRes.data.createDocument;
    expect(doc.collectionId).toBe(sourceCol.id);

    // 4. Move document to target collection
    const moveRes = await executeGraphQL(
      `
      mutation MoveDoc($docId: ID!, $targetId: ID!) {
        moveDocument(id: $docId, collectionId: $targetId) {
          id
          collectionId
        }
      }
    `,
      { docId: doc.id, targetId: targetCol.id }
    );
    expect(moveRes.errors).toBeUndefined();
    expect(moveRes.data.moveDocument.collectionId).toBe(targetCol.id);

    // 5. Query target collection with nested documents
    const queryRes = await executeGraphQL(
      `
      query GetCol($id: ID!) {
        collection(id: $id) {
          id
          name
          documents {
            id
            title
          }
        }
      }
    `,
      { id: targetCol.id }
    );
    expect(queryRes.errors).toBeUndefined();
    expect(queryRes.data.collection.documents).toHaveLength(1);
    expect(queryRes.data.collection.documents[0].title).toBe("Master Service Agreement 2026");
  });

  it("Flow 2: Search, filter by isArchived, and cursor pagination", async () => {
    if (!dbAvailable) return;

    // Create collection
    const colRes = await executeGraphQL(`
      mutation {
        createCollection(name: "Engineering", slug: "engineering") {
          id
        }
      }
    `);
    const colId = colRes.data.createCollection.id;

    // Create 3 documents
    await executeGraphQL(`
      mutation {
        createDocument(
          title: "Alpha Tech Spec"
          content: "High performance database design"
          tags: ["tech"]
          collectionId: "${colId}"
        ) { id }
      }
    `);

    const doc2 = await executeGraphQL(`
      mutation {
        createDocument(
          title: "Beta Roadmap"
          content: "Quarterly objectives and deliverables"
          tags: ["planning"]
          collectionId: "${colId}"
        ) { id }
      }
    `);

    await executeGraphQL(`
      mutation {
        createDocument(
          title: "Gamma Architecture"
          content: "System spec and service mesh"
          tags: ["tech"]
          collectionId: "${colId}"
        ) { id }
      }
    `);

    // Archive doc2
    await executeGraphQL(`
      mutation {
        updateDocument(id: "${doc2.data.createDocument.id}", isArchived: true) {
          id
          isArchived
        }
      }
    `);

    // 1. Search substring (case-insensitive "SPEC")
    const searchRes = await executeGraphQL(`
      query {
        documents(search: "SPEC") {
          totalCount
          nodes {
            title
          }
        }
      }
    `);
    expect(searchRes.errors).toBeUndefined();
    expect(searchRes.data.documents.totalCount).toBe(2);

    // 2. Filter isArchived = true
    const archivedRes = await executeGraphQL(`
      query {
        documents(isArchived: true) {
          totalCount
          nodes {
            title
          }
        }
      }
    `);
    expect(archivedRes.errors).toBeUndefined();
    expect(archivedRes.data.documents.totalCount).toBe(1);
    expect(archivedRes.data.documents.nodes[0].title).toBe("Beta Roadmap");

    // 3. Cursor pagination (take 2)
    const page1Res = await executeGraphQL(`
      query {
        documents(take: 2) {
          nodes {
            id
            title
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `);
    expect(page1Res.errors).toBeUndefined();
    expect(page1Res.data.documents.nodes).toHaveLength(2);
    expect(page1Res.data.documents.pageInfo.hasNextPage).toBe(true);

    const cursor = page1Res.data.documents.pageInfo.endCursor;

    // Page 2 using cursor
    const page2Res = await executeGraphQL(`
      query {
        documents(take: 2, cursor: "${cursor}") {
          nodes {
            id
            title
          }
          pageInfo {
            hasNextPage
          }
        }
      }
    `);
    expect(page2Res.errors).toBeUndefined();
    expect(page2Res.data.documents.nodes).toHaveLength(1);
    expect(page2Res.data.documents.pageInfo.hasNextPage).toBe(false);
  });

  it("Flow 3: Validation and Error Codes", async () => {
    if (!dbAvailable) return;

    // 1. Invalid slug validation error
    const errSlugRes = await executeGraphQL(`
      mutation {
        createCollection(name: "Test", slug: "INVALID SLUG!") {
          id
        }
      }
    `);
    expect(errSlugRes.errors).toBeDefined();
    expect(errSlugRes.errors[0].extensions.code).toBe("VALIDATION_ERROR");

    // 2. Empty title validation error
    const errTitleRes = await executeGraphQL(`
      mutation {
        createDocument(title: "   ", content: "Valid content", collectionId: "c1") {
          id
        }
      }
    `);
    expect(errTitleRes.errors).toBeDefined();
    expect(errTitleRes.errors[0].extensions.code).toBe("VALIDATION_ERROR");

    // 3. Non-existent collection ID NotFoundError
    const errNotFndRes = await executeGraphQL(`
      mutation {
        createDocument(title: "Valid Title", content: "Valid content", collectionId: "non-existent-col-id") {
          id
        }
      }
    `);
    expect(errNotFndRes.errors).toBeDefined();
    expect(errNotFndRes.errors[0].extensions.code).toBe("NOT_FOUND");
  });
});
