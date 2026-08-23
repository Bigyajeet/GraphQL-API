import { describe, it, expect, mock } from "bun:test";
import {
  validateSlug,
  validateTitle,
  validateContent,
  normalizeTags,
  validateCollectionExists,
  validateDocumentExists,
} from "../../src/validation/rules";
import { ValidationError, NotFoundError } from "../../src/errors";
import { PrismaClient } from "@prisma/client";

describe("Validation Rules Unit Tests", () => {
  describe("validateSlug", () => {
    it("should accept valid lower-kebab slugs", () => {
      expect(() => validateSlug("contracts")).not.toThrow();
      expect(() => validateSlug("legal-2026")).not.toThrow();
      expect(() => validateSlug("hr-docs-v1")).not.toThrow();
    });

    it("should throw ValidationError for empty or invalid slugs", () => {
      expect(() => validateSlug("")).toThrow(ValidationError);
      expect(() => validateSlug("   ")).toThrow(ValidationError);
      expect(() => validateSlug("INVALID SLUG")).toThrow(ValidationError);
      expect(() => validateSlug("slug_with_underscore")).toThrow(ValidationError);
      expect(() => validateSlug("-leading-hyphen")).toThrow(ValidationError);
      expect(() => validateSlug("trailing-hyphen-")).toThrow(ValidationError);
      expect(() => validateSlug("double--hyphen")).toThrow(ValidationError);
    });
  });

  describe("validateTitle & validateContent", () => {
    it("should accept non-empty strings", () => {
      expect(() => validateTitle("Valid Title")).not.toThrow();
      expect(() => validateContent("Valid content body")).not.toThrow();
    });

    it("should throw ValidationError for empty or whitespace-only strings", () => {
      expect(() => validateTitle("")).toThrow(ValidationError);
      expect(() => validateTitle("   ")).toThrow(ValidationError);
      expect(() => validateContent("")).toThrow(ValidationError);
      expect(() => validateContent("   \n\t")).toThrow(ValidationError);
    });
  });

  describe("normalizeTags", () => {
    it("should trim and remove empty tags", () => {
      expect(normalizeTags([" legal ", "", "  ", "2026"])).toEqual(["legal", "2026"]);
      expect(normalizeTags(null)).toEqual([]);
      expect(normalizeTags(undefined)).toEqual([]);
    });
  });

  describe("validateCollectionExists", () => {
    it("should not throw if collection exists", async () => {
      const mockPrisma = {
        collection: {
          findUnique: mock().mockResolvedValue({ id: "col-1" }),
        },
      } as unknown as PrismaClient;

      await expect(validateCollectionExists(mockPrisma, "col-1")).resolves.toBeUndefined();
    });

    it("should throw NotFoundError if collection does not exist", async () => {
      const mockPrisma = {
        collection: {
          findUnique: mock().mockResolvedValue(null),
        },
      } as unknown as PrismaClient;

      await expect(validateCollectionExists(mockPrisma, "non-existent")).rejects.toThrow(NotFoundError);
    });
  });

  describe("validateDocumentExists", () => {
    it("should not throw if document exists", async () => {
      const mockPrisma = {
        document: {
          findUnique: mock().mockResolvedValue({ id: "doc-1" }),
        },
      } as unknown as PrismaClient;

      await expect(validateDocumentExists(mockPrisma, "doc-1")).resolves.toBeUndefined();
    });

    it("should throw NotFoundError if document does not exist", async () => {
      const mockPrisma = {
        document: {
          findUnique: mock().mockResolvedValue(null),
        },
      } as unknown as PrismaClient;

      await expect(validateDocumentExists(mockPrisma, "non-existent")).rejects.toThrow(NotFoundError);
    });
  });
});
