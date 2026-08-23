import { PrismaClient } from "@prisma/client";
import { ValidationError, NotFoundError } from "../errors";

const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function validateSlug(slug: string): void {
  if (!slug || !slug.trim()) {
    throw new ValidationError("Slug cannot be empty");
  }
  if (!SLUG_REGEX.test(slug)) {
    throw new ValidationError("Slug must consist of lowercase alphanumeric characters separated by single hyphens");
  }
}

export function validateTitle(title: string): void {
  if (!title || !title.trim()) {
    throw new ValidationError("Title cannot be empty or whitespace-only");
  }
}

export function validateContent(content: string): void {
  if (!content || !content.trim()) {
    throw new ValidationError("Content cannot be empty or whitespace-only");
  }
}

export function normalizeTags(tags?: string[] | null): string[] {
  if (!tags) return [];
  return tags.map((t) => t.trim()).filter(Boolean);
}

export async function validateCollectionExists(
  prisma: PrismaClient,
  collectionId: string
): Promise<void> {
  const collection = await prisma.collection.findUnique({
    where: { id: collectionId },
    select: { id: true },
  });
  if (!collection) {
    throw new NotFoundError(`Collection with ID "${collectionId}" not found`);
  }
}

export async function validateDocumentExists(
  prisma: PrismaClient,
  documentId: string
): Promise<void> {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: { id: true },
  });
  if (!document) {
    throw new NotFoundError(`Document with ID "${documentId}" not found`);
  }
}
