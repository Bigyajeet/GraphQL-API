import { Prisma } from "@prisma/client";
import { GraphQLContext } from "../context";
import { ValidationError } from "../errors";
import { validateSlug, validateTitle } from "../validation/rules";

export const collectionResolvers = {
  Query: {
    collections: async (_parent: unknown, _args: unknown, ctx: GraphQLContext) => {
      return ctx.prisma.collection.findMany({
        orderBy: { createdAt: "desc" },
      });
    },
    collection: async (_parent: unknown, args: { id: string }, ctx: GraphQLContext) => {
      return ctx.prisma.collection.findUnique({
        where: { id: args.id },
      });
    },
  },

  Mutation: {
    createCollection: async (
      _parent: unknown,
      args: { name: string; slug: string },
      ctx: GraphQLContext
    ) => {
      validateTitle(args.name);
      validateSlug(args.slug);

      try {
        return await ctx.prisma.collection.create({
          data: {
            name: args.name.trim(),
            slug: args.slug.trim(),
          },
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          throw new ValidationError(`Collection with slug "${args.slug}" already exists`);
        }
        throw error;
      }
    },
  },

  Collection: {
    documents: async (
      parent: { id: string; documents?: unknown[] },
      _args: unknown,
      ctx: GraphQLContext
    ) => {
      if (parent.documents !== undefined) {
        return parent.documents;
      }
      return ctx.prisma.document.findMany({
        where: { collectionId: parent.id },
        orderBy: { createdAt: "desc" },
      });
    },
  },
};
