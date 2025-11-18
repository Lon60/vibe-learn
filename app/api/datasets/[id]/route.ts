import { NextResponse } from "next/server"
import { ObjectId } from "mongodb"

import { DatasetDoc, getDatasetsCollection } from "@/lib/mongodb"

const serializeDataset = (dataset: DatasetDoc & { _id: ObjectId }) => ({
  id: dataset._id.toString(),
  name: dataset.name,
  username: dataset.username,
  description: dataset.description ?? "",
  words: dataset.words,
  wordCount: dataset.wordCount,
  createdAt: dataset.createdAt,
})

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const datasetId = params.id
    if (!datasetId) {
      return NextResponse.json({ error: "Missing dataset id." }, { status: 400 })
    }

    if (!ObjectId.isValid(datasetId)) {
      return NextResponse.json({ error: "Invalid dataset id." }, { status: 400 })
    }

    const objectId = new ObjectId(datasetId)
    const collection = await getDatasetsCollection()
    const dataset = await collection.findOne({ _id: objectId })

    if (!dataset) {
      return NextResponse.json({ error: "Word list not found." }, { status: 404 })
    }

    return NextResponse.json({ dataset: serializeDataset({ ...dataset, _id: objectId }) })
  } catch (error) {
    console.error("Failed to load dataset", error)
    return NextResponse.json(
      { error: "Unable to load that word list. Please try again later." },
      { status: 500 }
    )
  }
}

