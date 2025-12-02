import { MongoClient, MongoClientOptions, ObjectId, ServerApiVersion } from "mongodb"

const uri = process.env.MONGODB_URI

if (!uri) {
  throw new Error(
    "Missing MONGODB_URI. Set it in your environment to enable dataset storage."
  )
}

const options: MongoClientOptions = {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
}

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined
}

const client = new MongoClient(uri, options)

const clientPromise = global._mongoClientPromise ?? client.connect()

if (process.env.NODE_ENV !== "production") {
  global._mongoClientPromise = clientPromise
}

const DB_NAME = "vibelearn"

export async function getDb() {
  const mongoClient = await clientPromise
  return mongoClient.db(DB_NAME)
}

export interface DatasetDoc {
  _id?: ObjectId
  name: string
  username: string
  description?: string
  words: string[]
  wordCount: number
  createdAt: Date
}

export async function getDatasetsCollection() {
  const db = await getDb()
  return db.collection<DatasetDoc>("datasets")
}

