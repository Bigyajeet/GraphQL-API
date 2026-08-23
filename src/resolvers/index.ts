import { collectionResolvers } from "./collection";
import { documentResolvers } from "./document";

export const resolvers = {
  Query: {
    ...collectionResolvers.Query,
    ...documentResolvers.Query,
  },
  Mutation: {
    ...collectionResolvers.Mutation,
    ...documentResolvers.Mutation,
  },
  Collection: {
    ...collectionResolvers.Collection,
  },
  Document: {
    ...documentResolvers.Document,
  },
};
