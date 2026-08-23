import { createSchema, createYoga } from "graphql-yoga";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resolvers } from "./resolvers";
import { createContext, GraphQLContext } from "./context";

const typeDefs = readFileSync(join(__dirname, "schema", "schema.graphql"), "utf-8");

export const schema = createSchema<GraphQLContext>({
  typeDefs,
  resolvers,
});

export const yoga = createYoga<GraphQLContext>({
  schema,
  context: () => createContext(),
  graphqlEndpoint: "/graphql",
});

export const server = createServer(yoga);

const port = process.env.PORT || 4000;

if (process.env.NODE_ENV !== "test") {
  server.listen(port, () => {
    console.log(`Document Vault GraphQL server running on http://localhost:${port}/graphql`);
  });
}
