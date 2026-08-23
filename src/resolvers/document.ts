import { Prisma } from "@prisma/client";
import { GraphQLContext } from "../context";
import {
  validateTitle,
  validateContent,
  validateCollectionExists,
  validateDocumentExists,
  normalizeTags,
} from "../validation/rules";

interface DocumentsArgs {
  collectionId?: string | null;
  search?: string | null;
  isArchived?: boolean | null;
  take?: number | null;
  cursor?: string | null;
}

interface CreateDocumentArgs {
  title: string;
  content: string;
  tags?: string[] | null;
  collectionId: string;
}

interface UpdateDocumentArgs {
  id: string;
  title?: string | null;
  content?: string | null;
  tags?: string[] | null;
  isArchived?: boolean | null;
}

interface MoveDocumentArgs {
  id: string;
  collectionId: string;
}

export const documentResolvers = {
  Query: {
    documents: async (_parent: unknown, args: DocumentsArgs, ctx: GraphQLContext) => {
      const limit = Math.max(1, Math.min(args.take ?? 20, 100));
      const cursor = args.cursor ?? undefined;

      const where: Prisma.DocumentWhereInput = {};

      if (args.collectionId) {
        where.collectionId = args.collectionId;
      }

      if (args.isArchived !== undefined && args.isArchived !== null) {
        where.isArchived = args.isArchived;
      }

      if (args.search && args.search.trim()) {
        const searchTerm = args.search.trim();
        where.OR = [
          { title: { contains: searchTerm, mode: "insensitive" } },
          { content: { contains: searchTerm, mode: "insensitive" } },
        ];
      }

      const totalCount = await ctx.prisma.document.count({ where });

      const findManyArgs: Prisma.DocumentFindManyArgs = {
        where,
        take: limit + 1,
        orderBy: { id: "asc" },
      };

      if (cursor) {
        findManyArgs.cursor = { id: cursor };
        findManyArgs.skip = 1;
      }

      const items = await ctx.prisma.document.findMany(findManyArgs);

      const hasNextPage = items.length > limit;
      const nodes = hasNextPage ? items.slice(0, limit) : items;
      const hasPreviousPage = Boolean(cursor);

      const startCursor = nodes.length > 0 ? nodes[0].id : null;
      const endCursor = nodes.length > 0 ? nodes[nodes.length - 1].id : null;

      const edges = nodes.map((node) => ({
        cursor: node.id,
        node,
      }));

      return {
        edges,
        nodes,
        pageInfo: {
          hasNextPage,
          hasPreviousPage,
          startCursor,
          endCursor,
        },
        totalCount,
      };
    },
  },

  Mutation: {
    createDocument: async (_parent: unknown, args: CreateDocumentArgs, ctx: GraphQLContext) => {
      validateTitle(args.title);
      validateContent(args.content);
      await validateCollectionExists(ctx.prisma, args.collectionId);

      const tags = normalizeTags(args.tags);

      return ctx.prisma.document.create({
        data: {
          title: args.title.trim(),
          content: args.content.trim(),
          tags,
          collectionId: args.collectionId,
        },
      });
    },

    updateDocument: async (_parent: unknown, args: UpdateDocumentArgs, ctx: GraphQLContext) => {
      await validateDocumentExists(ctx.prisma, args.id);

      const data: Prisma.DocumentUpdateInput = {};

      if (args.title !== undefined && args.title !== null) {
        validateTitle(args.title);
        data.title = args.title.trim();
      }

      if (args.content !== undefined && args.content !== null) {
        validateContent(args.content);
        data.content = args.content.trim();
      }

      if (args.tags !== undefined && args.tags !== null) {
        data.tags = normalizeTags(args.tags);
      }

      if (args.isArchived !== undefined && args.isArchived !== null) {
        data.isArchived = args.isArchived;
      }

      return ctx.prisma.document.update({
        where: { id: args.id },
        data,
      });
    },

    deleteDocument: async (_parent: unknown, args: { id: string }, ctx: GraphQLContext) => {
      await validateDocumentExists(ctx.prisma, args.id);

      await ctx.prisma.document.delete({
        where: { id: args.id },
      });

      return true;
    },

    moveDocument: async (_parent: unknown, args: MoveDocumentArgs, ctx: GraphQLContext) => {
      await validateDocumentExists(ctx.prisma, args.id);
      await validateCollectionExists(ctx.prisma, args.collectionId);

      return ctx.prisma.document.update({
        where: { id: args.id },
        data: {
          collectionId: args.collectionId,
        },
      });
    },
  },

  Document: {
    collection: async (
      parent: { collectionId: string; collection?: unknown },
      _args: unknown,
      ctx: GraphQLContext
    ) => {
      if (parent.collection !== undefined) {
        return parent.collection;
      }
      return ctx.prisma.collection.findUnique({
        where: { id: parent.collectionId },
      });
    },
  },
};
