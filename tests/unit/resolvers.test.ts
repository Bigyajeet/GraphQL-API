import { describe, it, expect, mock } from "bun:test";
import { collectionResolvers } from "../../src/resolvers/collection";
import { documentResolvers } from "../../src/resolvers/document";
import { ValidationError, NotFoundError } from "../../src/errors";
import { GraphQLContext } from "../../src/context";
import { PrismaClient } from "@prisma/client";

describe("GraphQL Resolvers Unit Tests (Mocked Prisma)", () => {
  describe("Collection Resolvers", () => {
    it("collections query returns list of collections", async () => {
      const mockCollections = [
        { id: "c1", name: "Contracts", slug: "contracts", createdAt: new Date() },
      ];

      const mockCtx: GraphQLContext = {
        prisma: {
          collection: {
            findMany: mock().mockResolvedValue(mockCollections),
          },
        } as unknown as PrismaClient,
      };

      const result = await collectionResolvers.Query.collections({}, {}, mockCtx);
      expect(result).toEqual(mockCollections);
    });

    it("collection query returns single collection or null", async () => {
      const mockCollection = { id: "c1", name: "Contracts", slug: "contracts", createdAt: new Date() };

      const mockCtx: GraphQLContext = {
        prisma: {
          collection: {
            findUnique: mock().mockResolvedValue(mockCollection),
          },
        } as unknown as PrismaClient,
      };

      const res = await collectionResolvers.Query.collection({}, { id: "c1" }, mockCtx);
      expect(res).toEqual(mockCollection);
    });

    it("createCollection validates inputs and creates collection", async () => {
      const mockCreated = { id: "c2", name: "Legal", slug: "legal", createdAt: new Date() };

      const mockCtx: GraphQLContext = {
        prisma: {
          collection: {
            create: mock().mockResolvedValue(mockCreated),
          },
        } as unknown as PrismaClient,
      };

      const res = await collectionResolvers.Mutation.createCollection(
        {},
        { name: "Legal", slug: "legal" },
        mockCtx
      );
      expect(res).toEqual(mockCreated);
    });

    it("createCollection throws ValidationError on invalid slug format", async () => {
      const mockCtx: GraphQLContext = {
        prisma: {} as unknown as PrismaClient,
      };

      await expect(
        collectionResolvers.Mutation.createCollection({}, { name: "Legal", slug: "INVALID SLUG" }, mockCtx)
      ).rejects.toThrow(ValidationError);
    });
  });

  describe("Document Resolvers", () => {
    it("createDocument validates collection and inputs", async () => {
      const mockDoc = {
        id: "d1",
        title: "MSA 2026",
        content: "Content body",
        tags: ["legal"],
        isArchived: false,
        createdAt: new Date(),
        collectionId: "c1",
      };

      const mockCtx: GraphQLContext = {
        prisma: {
          collection: {
            findUnique: mock().mockResolvedValue({ id: "c1" }),
          },
          document: {
            create: mock().mockResolvedValue(mockDoc),
          },
        } as unknown as PrismaClient,
      };

      const res = await documentResolvers.Mutation.createDocument(
        {},
        { title: "MSA 2026", content: "Content body", tags: ["legal"], collectionId: "c1" },
        mockCtx
      );
      expect(res).toEqual(mockDoc);
    });

    it("createDocument throws NotFoundError if target collection does not exist", async () => {
      const mockCtx: GraphQLContext = {
        prisma: {
          collection: {
            findUnique: mock().mockResolvedValue(null),
          },
        } as unknown as PrismaClient,
      };

      await expect(
        documentResolvers.Mutation.createDocument(
          {},
          { title: "MSA 2026", content: "Content body", collectionId: "non-existent" },
          mockCtx
        )
      ).rejects.toThrow(NotFoundError);
    });

    it("moveDocument validates target collection and document existence", async () => {
      const mockUpdated = {
        id: "d1",
        title: "MSA 2026",
        content: "Content",
        tags: [],
        isArchived: false,
        createdAt: new Date(),
        collectionId: "c2",
      };

      const mockCtx: GraphQLContext = {
        prisma: {
          document: {
            findUnique: mock().mockResolvedValue({ id: "d1" }),
            update: mock().mockResolvedValue(mockUpdated),
          },
          collection: {
            findUnique: mock().mockResolvedValue({ id: "c2" }),
          },
        } as unknown as PrismaClient,
      };

      const res = await documentResolvers.Mutation.moveDocument(
        {},
        { id: "d1", collectionId: "c2" },
        mockCtx
      );
      expect(res).toEqual(mockUpdated);
    });

    it("deleteDocument hard deletes document and returns true", async () => {
      const mockCtx: GraphQLContext = {
        prisma: {
          document: {
            findUnique: mock().mockResolvedValue({ id: "d1" }),
            delete: mock().mockResolvedValue({ id: "d1" }),
          },
        } as unknown as PrismaClient,
      };

      const res = await documentResolvers.Mutation.deleteDocument({}, { id: "d1" }, mockCtx);
      expect(res).toBe(true);
    });
  });
});
