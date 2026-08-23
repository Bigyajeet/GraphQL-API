import { createSchema, createYoga } from "graphql-yoga";
import { createServer } from "node:http";
import { typeDefs } from "./schema/sdl";
import { resolvers } from "./resolvers";
import { createContext, GraphQLContext } from "./context";

export const schema = createSchema<GraphQLContext>({
  typeDefs,
  resolvers,
});

export const yoga = createYoga<GraphQLContext>({
  schema,
  context: () => createContext(),
});

export const server = createServer(yoga);

const port = process.env.PORT || 4000;

if (process.env.NODE_ENV !== "test") {
  server.listen(port, () => {
    console.log(`Document Vault GraphQL server running on http://localhost:${port}/graphql`);
  });
}

export default async function handler(req: any, res: any) {
  return yoga(req, res);
}
