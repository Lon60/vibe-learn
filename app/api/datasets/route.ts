import { NextResponse } from "next/server"

import {
  MAX_DATASET_WORDS,
  MAX_DESCRIPTION_LENGTH,
  MAX_NAME_LENGTH,
  MAX_USERNAME_LENGTH,
  MAX_WORD_LENGTH,
} from "@/lib/dataset-constraints"
import { DatasetDoc, getDatasetsCollection } from "@/lib/mongodb"

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
    const nameInput = typeof body?.name === "string" ? body.name : ""
    const usernameInput = typeof body?.username === "string" ? body.username : ""
    const descriptionInput =
      typeof body?.description === "string" ? body.description : undefined
    const rawWords: unknown = body?.words

    const name = nameInput.trim()
    const username = usernameInput.trim()
    const description = descriptionInput?.trim()

    if (!name || !username) {
      return NextResponse.json(
        { error: "Name and username are required." },
        { status: 400 }
      )
    }

    if (name.length > MAX_NAME_LENGTH) {
      return NextResponse.json(
        { error: `List name cannot exceed ${MAX_NAME_LENGTH} characters.` },
        { status: 400 }
      )
    }

    if (username.length > MAX_USERNAME_LENGTH) {
      return NextResponse.json(
        { error: `Username cannot exceed ${MAX_USERNAME_LENGTH} characters.` },
        { status: 400 }
      )
    }

    if (description && description.length > MAX_DESCRIPTION_LENGTH) {
      return NextResponse.json(
        { error: `Description cannot exceed ${MAX_DESCRIPTION_LENGTH} characters.` },
        { status: 400 }
      )
    }

    if (!Array.isArray(rawWords) || rawWords.length === 0) {
      return NextResponse.json(
        { error: "Provide at least one word for your list." },
        { status: 400 }
      )
    }

    if (rawWords.length > MAX_DATASET_WORDS) {
      return NextResponse.json(
        { error: `Lists are limited to ${MAX_DATASET_WORDS} words for now.` },
        { status: 400 }
      )
    }

    const words = rawWords
      .map((word) => String(word ?? "").trim())
      .filter(Boolean)

    if (words.length === 0) {
      return NextResponse.json(
        { error: "Provide at least one word for your list." },
        { status: 400 }
      )
    }

    const invalidWord = words.find((word) => word.length > MAX_WORD_LENGTH)
    if (invalidWord) {
      return NextResponse.json(
        { error: `Every word must be ${MAX_WORD_LENGTH} characters or fewer.` },
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

