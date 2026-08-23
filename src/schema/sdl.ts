export const typeDefs = /* GraphQL */ `
type Collection {
  id: ID!
  name: String!
  slug: String!
  createdAt: String!
  documents: [Document!]!
}

type Document {
  id: ID!
  title: String!
  content: String!
  tags: [String!]!
  isArchived: Boolean!
  createdAt: String!
  collectionId: ID!
  collection: Collection!
}

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: ID
  endCursor: ID
}

type DocumentEdge {
  cursor: ID!
  node: Document!
}

type DocumentConnection {
  edges: [DocumentEdge!]!
  nodes: [Document!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type Query {
  collections: [Collection!]!
  collection(id: ID!): Collection
  documents(
    collectionId: ID
    search: String
    isArchived: Boolean
    take: Int = 20
    cursor: ID
  ): DocumentConnection!
}

type Mutation {
  createCollection(name: String!, slug: String!): Collection!
  createDocument(
    title: String!
    content: String!
    tags: [String!]
    collectionId: ID!
  ): Document!
  updateDocument(
    id: ID!
    title: String
    content: String
    tags: [String!]
    isArchived: Boolean
  ): Document!
  deleteDocument(id: ID!): Boolean!
  moveDocument(id: ID!, collectionId: ID!): Document!
}
`;
