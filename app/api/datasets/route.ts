import { NextResponse } from "next/server"

import { DatasetDoc, getDatasetsCollection } from "@/lib/mongodb"

const MAX_WORDS = 1000

const datasetSummary = (dataset: DatasetDoc & { _id: NonNullable<DatasetDoc["_id"]> }) => ({
  id: dataset._id.toString(),
  name: dataset.name,
  username: dataset.username,
  description: dataset.description ?? "",
  wordCount: dataset.wordCount,
  createdAt: dataset.createdAt,
})

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get("q")?.trim()

    const collection = await getDatasetsCollection()
    const filter = q
      ? {
          $or: [
            { name: { $regex: q, $options: "i" } },
            { username: { $regex: q, $options: "i" } },
            { description: { $regex: q, $options: "i" } },
          ],
        }
      : {}

    const datasets = await collection
      .find(filter, { projection: { words: 0 } })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray()

    return NextResponse.json({
      datasets: datasets.map(datasetSummary),
    })
  } catch (error) {
    console.error("Failed to load datasets", error)
    return NextResponse.json(
      { error: "Unable to load word lists right now. Please try again later." },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const name = body?.name?.trim()
    const username = body?.username?.trim()
    const description = body?.description?.trim()
    const rawWords: unknown = body?.words

    if (!name || !username) {
      return NextResponse.json(
        { error: "Name and username are required." },
        { status: 400 }
      )
    }

    if (!Array.isArray(rawWords) || rawWords.length === 0) {
      return NextResponse.json(
        { error: "Provide at least one word for your list." },
        { status: 400 }
      )
    }

    if (rawWords.length > MAX_WORDS) {
      return NextResponse.json(
        { error: `Lists are limited to ${MAX_WORDS} words for now.` },
        { status: 400 }
      )
    }

    const words = rawWords.map((word) => String(word).trim()).filter(Boolean)
    if (words.length === 0) {
      return NextResponse.json(
        { error: "Provide at least one word for your list." },
        { status: 400 }
      )
    }
    const now = new Date()

    const dataset: DatasetDoc = {
      name,
      username,
      description,
      words,
      wordCount: words.length,
      createdAt: now,
    }

    const collection = await getDatasetsCollection()
    const insert = await collection.insertOne(dataset)

    return NextResponse.json({
      dataset: datasetSummary({ ...dataset, _id: insert.insertedId }),
    })
  } catch (error) {
    console.error("Failed to create dataset", error)
    return NextResponse.json(
      { error: "Unable to save that word list. Please try again later." },
      { status: 500 }
    )
  }
}

