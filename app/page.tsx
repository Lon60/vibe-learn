"use client"

import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  MAX_DATASET_WORDS,
  MAX_DESCRIPTION_LENGTH,
  MAX_NAME_LENGTH,
  MAX_USERNAME_LENGTH,
  MAX_WORD_LENGTH,
} from "@/lib/dataset-constraints"

const parseWords = (text: string) =>
  text
    .replace(/\r\n?/g, " ")
    .split(/\s+/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)

const normalize = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase()
const shortenWord = (value: string, limit = 32) =>
  value.length > limit ? `${value.slice(0, limit)}...` : value

type FeedbackState = "correct" | "advance" | "incorrect" | "complete" | null

type DatasetSummary = {
  id: string
  name: string
  username: string
  description: string
  wordCount: number
  createdAt: string
}

type DatasetDetail = DatasetSummary & { words: string[] }
type CreateFormState = {
  name: string
  username: string
  description: string
  wordsText: string
}
type ToastTone = "success" | "error" | "info"
type ToastState = {
  id: number
  tone: ToastTone
  message: string
}

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const datasetFileInputRef = useRef<HTMLInputElement>(null)

  const [words, setWords] = useState<string[]>([])
  const [fileName, setFileName] = useState("")
  const [activeDataset, setActiveDataset] = useState<DatasetSummary | null>(null)
  const [inputValue, setInputValue] = useState("")
  const [feedback, setFeedback] = useState<FeedbackState>(null)
  const [feedbackDetail, setFeedbackDetail] = useState("")
  const [errorNotice, setErrorNotice] = useState<string | null>(null)
  const [revealedCount, setRevealedCount] = useState(0)
  const [recallIndex, setRecallIndex] = useState(0)
  const [sessionComplete, setSessionComplete] = useState(false)
  const [datasets, setDatasets] = useState<DatasetSummary[]>([])
  const [datasetsLoading, setDatasetsLoading] = useState(true)
  const [datasetsError, setDatasetsError] = useState<string | null>(null)
  const [datasetSearch, setDatasetSearch] = useState("")
  const [loadingDatasetId, setLoadingDatasetId] = useState<string | null>(null)
  const [createForm, setCreateForm] = useState<CreateFormState>({
    name: "",
    username: "",
    description: "",
    wordsText: "",
  })
  const [createFileName, setCreateFileName] = useState("")
  const [createSubmitting, setCreateSubmitting] = useState(false)
  const [createStatus, setCreateStatus] = useState<{
    tone: "success" | "error"
    message: string
  } | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)

  const masteredWords = useMemo(
    () => words.slice(0, revealedCount),
    [words, revealedCount]
  )

  const parsedCreateWords = useMemo(
    () => parseWords(createForm.wordsText),
    [createForm.wordsText]
  )
  const createWordCount = parsedCreateWords.length
  const invalidWord = useMemo(
    () => parsedCreateWords.find((word) => word.length > MAX_WORD_LENGTH) ?? null,
    [parsedCreateWords]
  )

  const canSubmitList = useMemo(
    () => {
      const name = createForm.name.trim()
      const username = createForm.username.trim()
      const descriptionLength = createForm.description.trim().length

      if (!name || !username) return false
      if (name.length > MAX_NAME_LENGTH || username.length > MAX_USERNAME_LENGTH) return false
      if (descriptionLength > MAX_DESCRIPTION_LENGTH) return false
      if (invalidWord) return false

      return createWordCount > 0 && createWordCount <= MAX_DATASET_WORDS
    },
    [
      createForm.name,
      createForm.username,
      createForm.description,
      createWordCount,
      invalidWord,
    ]
  )

  const showToast = useCallback((tone: ToastTone, message: string) => {
    setToast({ id: Date.now(), tone, message })
  }, [])

  const fetchDatasets = useCallback(
    async (query = "") => {
      setDatasetsError(null)
      setDatasetsLoading(true)

      try {
        const trimmedQuery = query.trim()
        const params = trimmedQuery ? `?q=${encodeURIComponent(trimmedQuery)}` : ""
        const response = await fetch(`/api/datasets${params}`, { cache: "no-store" })
        const payload = await response.json().catch(() => ({}))

        if (!response.ok) {
          throw new Error(
            typeof payload?.error === "string"
              ? payload.error
              : "Unable to load word lists right now."
          )
        }

        const list = Array.isArray(payload?.datasets) ? payload.datasets : []
        const sanitized: DatasetSummary[] = list
          .filter((item: DatasetSummary) => Boolean(item?.id))
          .map((item: DatasetSummary) => ({
            id: item.id,
            name: item.name,
            username: item.username,
            description: item.description,
            wordCount: item.wordCount,
            createdAt: item.createdAt,
          }))

        setDatasets(sanitized)
      } catch (error) {
        setDatasets([])
        setDatasetsError(
          error instanceof Error
            ? error.message
            : "Unable to load word lists right now."
        )
      } finally {
        setDatasetsLoading(false)
      }
    },
    []
  )

  useEffect(() => {
    fetchDatasets()
  }, [fetchDatasets])

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(null), 4200)
    return () => window.clearTimeout(timeout)
  }, [toast])

  useEffect(() => {
    const handle = setTimeout(() => {
      fetchDatasets(datasetSearch)
    }, 400)

    return () => clearTimeout(handle)
  }, [datasetSearch, fetchDatasets])

  const hydrateSession = useCallback((list: string[]) => {
    setWords(list)
    setRevealedCount(0)
    setRecallIndex(0)
    setInputValue("")
    setFeedback(null)
    setFeedbackDetail("")
    setSessionComplete(false)
    setErrorNotice(null)
    requestAnimationFrame(() => {
      inputRef.current?.focus()
    })
  }, [])

  const updateCreateForm = (field: keyof CreateFormState, value: string) => {
    setCreateForm((previous) => ({
      ...previous,
      [field]: value,
    }))
    setCreateStatus(null)
  }

  const formatCreatedAt = useCallback((value: string) => {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return "Recently"
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
    }).format(date)
  }, [])

  const currentWord =
    !sessionComplete && revealedCount < words.length ? words[revealedCount] : null

  const roundLength = sessionComplete
    ? 0
    : words.length > 0
      ? Math.min(revealedCount + 1, words.length)
      : 0

  const progressLabel =
    words.length === 0
      ? "Load a saved list or upload a .txt file to start"
      : sessionComplete
        ? `All ${words.length} words locked in ⭐`
        : `${masteredWords.length}/${words.length} words locked`

  const activeSourceLabel = useMemo(() => {
    if (activeDataset) {
      return `Loaded "${activeDataset.name}" by ${activeDataset.username} • ${activeDataset.wordCount} words`
    }

    if (fileName) {
      return `Loaded from file: ${fileName}`
    }

    return "No list loaded yet. Create one or upload a .txt file to start."
  }, [activeDataset, fileName])

  useEffect(() => {
    if (words.length === 0 || sessionComplete) return
    inputRef.current?.focus()
  }, [words.length, revealedCount, recallIndex, sessionComplete])

  useEffect(() => {
    if (!feedback || feedback === "complete") return

    const timeout = setTimeout(() => {
      setFeedback(null)
      setFeedbackDetail("")
    }, feedback === "incorrect" ? 1600 : 1100)

    return () => clearTimeout(timeout)
  }, [feedback])

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const parsed = parseWords(text)

      if (parsed.length === 0) {
        throw new Error("That file looks empty. Add some words and try again.")
      }

      hydrateSession(parsed)
      setFileName(file.name)
      setActiveDataset(null)
    } catch (error) {
      setWords([])
      setFileName("")
      setRevealedCount(0)
      setRecallIndex(0)
      setInputValue("")
      setFeedback(null)
      setFeedbackDetail("")
      setSessionComplete(false)
      setActiveDataset(null)

      setErrorNotice(
        error instanceof Error
          ? error.message
          : "Unable to read that file. Please upload a plain .txt file."
      )
    } finally {
      // allow re-uploading the same file
      event.target.value = ""
    }
  }

  const handleDatasetImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const parsed = parseWords(text)

      if (parsed.length === 0) {
        throw new Error("That file looks empty. Add some words and try again.")
      }

      const oversizedWord = parsed.find((word) => word.length > MAX_WORD_LENGTH)
      if (oversizedWord) {
        throw new Error(
          `Words are limited to ${MAX_WORD_LENGTH} characters. Shorten "${shortenWord(oversizedWord)}".`
        )
      }

      setCreateForm((previous) => ({
        ...previous,
        wordsText: parsed.join("\n"),
      }))
      setCreateFileName(file.name)
      const successMessage = `Imported ${parsed.length} words from ${file.name}.`
      setCreateStatus({
        tone: "success",
        message: successMessage,
      })
      showToast("success", successMessage)
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to read that file. Please upload a plain .txt file."
      setCreateStatus({
        tone: "error",
        message,
      })
      showToast("error", message)
    } finally {
      event.target.value = ""
    }
  }

  const handleDatasetSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (createSubmitting) return

    const words = parseWords(createForm.wordsText)
    if (words.length === 0) {
      const message = "Add at least one word to save."
      setCreateStatus({ tone: "error", message })
      showToast("error", message)
      return
    }

    if (words.length > MAX_DATASET_WORDS) {
      const message = `Lists are limited to ${MAX_DATASET_WORDS} words for now.`
      setCreateStatus({
        tone: "error",
        message,
      })
      showToast("error", message)
      return
    }

    const oversizedWord = words.find((word) => word.length > MAX_WORD_LENGTH)
    if (oversizedWord) {
      const message = `Shorten "${shortenWord(oversizedWord)}" — words are limited to ${MAX_WORD_LENGTH} characters.`
      setCreateStatus({
        tone: "error",
        message,
      })
      showToast("error", message)
      return
    }

    setCreateSubmitting(true)
    setCreateStatus(null)

    try {
      const response = await fetch("/api/datasets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createForm.name.trim(),
          username: createForm.username.trim(),
          description: createForm.description.trim(),
          words,
        }),
      })

      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(
          typeof payload?.error === "string"
            ? payload.error
            : "Unable to save that word list just yet."
        )
      }

      const successMessage = "Word list saved. Load it from the list below."
      setCreateStatus({
        tone: "success",
        message: successMessage,
      })
      showToast("success", successMessage)

      setCreateForm((previous) => ({
        ...previous,
        name: "",
        description: "",
        wordsText: "",
      }))
      setCreateFileName("")

      await fetchDatasets(datasetSearch)
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to save that word list just yet."
      setCreateStatus({
        tone: "error",
        message,
      })
      showToast("error", message)
    } finally {
      setCreateSubmitting(false)
    }
  }

  const handleLoadDataset = async (dataset: DatasetSummary) => {
    if (!dataset?.id) return

    setLoadingDatasetId(dataset.id)
    setErrorNotice(null)

    try {
      const response = await fetch(`/api/datasets/${dataset.id}`, { cache: "no-store" })
      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(
          typeof payload?.error === "string"
            ? payload.error
            : "Unable to load that word list right now."
        )
      }

      const detail = payload?.dataset as DatasetDetail | undefined
      if (!detail || !Array.isArray(detail.words) || detail.words.length === 0) {
        throw new Error("That word list looks empty.")
      }

      hydrateSession(detail.words)
      setActiveDataset({
        id: detail.id,
        name: detail.name,
        username: detail.username,
        description: detail.description,
        wordCount: detail.wordCount,
        createdAt: detail.createdAt,
      })
      setFileName("")
    } catch (error) {
      setErrorNotice(
        error instanceof Error
          ? error.message
          : "Unable to load that word list right now. Please try again."
      )
    } finally {
      setLoadingDatasetId(null)
    }
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (words.length === 0 || sessionComplete) return

    const attempt = inputValue.trim()
    if (!attempt) return

    const expectedWord = words[recallIndex]
    if (!expectedWord) return

    if (normalize(attempt) === normalize(expectedWord)) {
      const nextRecallIndex = recallIndex + 1

      if (nextRecallIndex > revealedCount) {
        const nextRevealed = Math.min(revealedCount + 1, words.length)
        const finished = nextRevealed === words.length

        setRevealedCount(nextRevealed)
        setRecallIndex(0)
        setSessionComplete(finished)
        setFeedback(finished ? "complete" : "advance")
        setFeedbackDetail(
          finished
            ? "You mastered every word in this list. Legendary focus!"
            : `Great! "${words[revealedCount]}" is locked in. Memorize the next word.`
        )
      } else {
        setRecallIndex(nextRecallIndex)
        setFeedback("correct")
        setFeedbackDetail(`Word ${nextRecallIndex} is on point. Keep the streak alive.`)
      }

      setInputValue("")
    } else {
      setFeedback("incorrect")
      setFeedbackDetail(
        `Not quite. Word ${recallIndex + 1} needs to match your list exactly.`
      )
    }
  }

  const handleReset = () => {
    if (words.length === 0) return
    setRevealedCount(0)
    setRecallIndex(0)
    setInputValue("")
    setFeedback(null)
    setFeedbackDetail("")
    setSessionComplete(false)
    requestAnimationFrame(() => {
      inputRef.current?.focus()
    })
  }

  const clearLoadedList = () => {
    setWords([])
    setFileName("")
    setActiveDataset(null)
    setRevealedCount(0)
    setRecallIndex(0)
    setInputValue("")
    setFeedback(null)
    setFeedbackDetail("")
    setSessionComplete(false)
    setErrorNotice(null)
  }

  const sequenceMarkers = useMemo(() => {
    return Array.from({ length: roundLength }, (_, index) => {
      if (index < recallIndex) return "done"
      if (index === recallIndex) return "active"
      return "pending"
    })
  }, [roundLength, recallIndex])

  return (
    <>
      {toast && (
        <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex flex-col gap-3">
          <div
            className={`pointer-events-auto rounded-xl border bg-zinc-950/90 px-4 py-3 text-sm shadow-2xl ${
              toast.tone === "error"
                ? "border-rose-500/60 text-rose-100"
                : toast.tone === "success"
                  ? "border-emerald-500/60 text-emerald-100"
                  : "border-sky-500/60 text-sky-100"
            }`}
            role="status"
            aria-live="polite"
          >
            <div className="flex items-start gap-4">
              <span className="flex-1">{toast.message}</span>
              <button
                type="button"
                aria-label="Dismiss notification"
                onClick={() => setToast(null)}
                className="text-xs uppercase tracking-[0.2em] opacity-80 transition hover:opacity-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      <main className="min-h-screen bg-background px-4 py-10 text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <Card className="border-zinc-800 bg-zinc-950/90 backdrop-blur">
            <CardHeader className="space-y-5">
              <div className="space-y-3 text-center lg:text-left">
                <CardTitle className="text-3xl font-semibold text-zinc-100">
                  Vibe Learn
                </CardTitle>
                <CardDescription className="text-base text-zinc-400">
                  Craft your own lists, search the community library, or upload a .txt anytime.
                  Lock in each word by recalling the full sequence from memory.
                </CardDescription>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center justify-center gap-3 sm:justify-start">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-11 px-5 text-sm font-semibold"
                  >
                    Upload .txt
                  </Button>
                  <span className="text-xs text-zinc-500">
                    {fileName ? `Loaded: ${fileName}` : "No file loaded"}
                  </span>
                </div>
                <div className="text-center text-sm font-medium text-zinc-500 sm:text-right">
                  {progressLabel}
                </div>
              </div>
              {errorNotice && (
                <p className="rounded-md border border-rose-800/60 bg-rose-900/40 px-4 py-2 text-xs text-rose-200">
                  {errorNotice}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-3 rounded-md border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-xs text-zinc-400">
                <span className="flex-1">{activeSourceLabel}</span>
                {(activeDataset || fileName || words.length > 0) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={clearLoadedList}
                    className="h-8 px-3 text-xs text-zinc-400 hover:text-zinc-100"
                  >
                    Clear list
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <section className="space-y-3">
                <h2 className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                  Memorize this
                </h2>
                <div className="flex min-h-[96px] items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/80 px-4 py-6 text-center">
                  {sessionComplete ? (
                    <span className="text-lg font-medium text-emerald-400">
                      You locked in every word. Reset or load a new list to keep pushing.
                    </span>
                  ) : currentWord ? (
                    <span className="text-3xl font-semibold tracking-wide text-zinc-50">
                      {currentWord}
                    </span>
                  ) : words.length === 0 ? (
                    <span className="text-zinc-500">
                      Load a saved list or upload a .txt file to reveal words.
                    </span>
                  ) : (
                    <span className="text-zinc-500">
                      Nice work—recall the sequence to go on.
                    </span>
                  )}
                </div>
              </section>

              <section className="space-y-3">
                <h2 className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                  Recall tracker
                </h2>
                <div className="flex flex-col gap-4 rounded-lg border border-zinc-800 bg-zinc-900/70 p-4">
                  {words.length === 0 ? (
                    <p className="text-sm text-zinc-500">
                      Each round, type every word from the beginning—one per enter—to unlock
                      the next.
                    </p>
                  ) : sessionComplete ? (
                    <p className="text-sm text-emerald-400">
                      Sequence complete. That memory stack is dialed in.
                    </p>
                  ) : (
                    <>
                      <div className="text-sm text-zinc-400">
                        Word{" "}
                        <span className="font-semibold text-zinc-100">
                          {recallIndex + 1}
                        </span>{" "}
                        of{" "}
                        <span className="font-semibold text-zinc-100">
                          {roundLength}
                        </span>{" "}
                        this round. Stay sharp—no peeking back.
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {sequenceMarkers.map((state, index) => (
                          <span
                            key={index}
                            className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold ${
                              state === "done"
                                ? "border-emerald-500/70 bg-emerald-500/10 text-emerald-300"
                                : state === "active"
                                  ? "border-zinc-100/60 bg-zinc-800 text-zinc-100"
                                  : "border-zinc-700 text-zinc-600"
                            }`}
                            aria-label={`Word ${index + 1} ${state}`}
                          >
                            {state === "done" ? "✓" : index + 1}
                          </span>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </section>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <form
                onSubmit={handleSubmit}
                className="flex w-full flex-col gap-3 sm:flex-row sm:items-center"
              >
                <Input
                  ref={inputRef}
                  value={inputValue}
                  onChange={(event) => setInputValue(event.target.value)}
                  placeholder={
                    words.length === 0
                      ? "Load a list to start"
                      : sessionComplete
                        ? "All words complete"
                        : `Type word ${recallIndex + 1} and press enter`
                  }
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  disabled={words.length === 0 || sessionComplete}
                  className={`h-12 flex-1 text-base ${
                    feedback === "correct"
                      ? "border-emerald-500/60 focus-visible:ring-emerald-500/40"
                      : feedback === "advance"
                        ? "border-sky-500/60 focus-visible:ring-sky-500/40"
                        : feedback === "incorrect"
                          ? "border-rose-500/60 focus-visible:ring-rose-500/40"
                          : ""
                  }`}
                />
                <Button
                  type="submit"
                  disabled={
                    words.length === 0 || sessionComplete || normalize(inputValue) === ""
                  }
                  className="h-12 px-6 text-base font-semibold"
                >
                  Submit word
                </Button>
              </form>
              <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div
                  role="status"
                  aria-live="polite"
                  className={`text-sm ${
                    feedback === "correct"
                      ? "text-emerald-400"
                      : feedback === "advance"
                        ? "text-sky-400"
                        : feedback === "incorrect"
                          ? "text-rose-400"
                          : feedback === "complete"
                            ? "text-emerald-400"
                            : "text-zinc-500"
                  }`}
                >
                  {feedbackDetail ||
                    "Press enter after every word. If you miss one, regroup and go again."}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleReset}
                    disabled={words.length === 0}
                    className="h-10 text-sm text-zinc-400 hover:text-zinc-100"
                  >
                    Restart session
                  </Button>
                </div>
              </div>
            </CardFooter>
          </Card>

          <div className="space-y-6">
            <Card className="border-zinc-800 bg-zinc-950/70">
              <CardHeader>
                <CardTitle className="text-xl text-zinc-100">
                  Create a word list
                </CardTitle>
                <CardDescription className="text-sm text-zinc-400">
                  Type, paste, or bulk import words. Everyone can spin up a personal dataset
                  in seconds.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleDatasetSubmit} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="list-name" className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                        List name
                      </Label>
                      <Input
                        id="list-name"
                        value={createForm.name}
                        onChange={(event) => updateCreateForm("name", event.target.value)}
                        placeholder="Evening mantra"
                        maxLength={MAX_NAME_LENGTH}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="list-username" className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                        Username
                      </Label>
                      <Input
                        id="list-username"
                        value={createForm.username}
                        onChange={(event) => updateCreateForm("username", event.target.value)}
                        placeholder="@you"
                        maxLength={MAX_USERNAME_LENGTH}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="list-description" className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                      Description
                    </Label>
                    <Textarea
                      id="list-description"
                      value={createForm.description}
                      onChange={(event) =>
                        updateCreateForm("description", event.target.value)
                      }
                      placeholder="Tell the vibe in a sentence."
                      className="min-h-[80px]"
                        maxLength={MAX_DESCRIPTION_LENGTH}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="list-words" className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                      Words (one per line or space)
                    </Label>
                    <Textarea
                      id="list-words"
                      value={createForm.wordsText}
                      onChange={(event) => updateCreateForm("wordsText", event.target.value)}
                      placeholder="energy\nclarity\nflow..."
                      className="min-h-[180px]"
                    />
                  </div>
                  <input
                    ref={datasetFileInputRef}
                    type="file"
                    accept=".txt"
                    onChange={handleDatasetImport}
                    className="hidden"
                  />
                  <div className="flex flex-col gap-2 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      <span>
                        {createWordCount} {createWordCount === 1 ? "word" : "words"} • max{" "}
                        {MAX_DATASET_WORDS}
                      </span>
                      {createFileName && (
                        <span className="text-zinc-400">Imported: {createFileName}</span>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => datasetFileInputRef.current?.click()}
                      className="h-8 px-3 text-xs text-zinc-300 hover:text-zinc-100"
                    >
                      Import .txt
                    </Button>
                  </div>
                  {invalidWord && (
                    <p className="text-xs text-rose-400">
                      Shorten &quot;{shortenWord(invalidWord)}&quot; — words are limited to{" "}
                      {MAX_WORD_LENGTH} characters each.
                    </p>
                  )}
                  {createStatus && (
                    <p
                      className={`text-xs ${
                        createStatus.tone === "success" ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {createStatus.message}
                    </p>
                  )}
                  <Button
                    type="submit"
                    disabled={!canSubmitList || createSubmitting}
                    className="w-full"
                  >
                    {createSubmitting ? "Saving..." : "Save word list"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="border-zinc-800 bg-zinc-950/70">
              <CardHeader>
                <CardTitle className="text-xl text-zinc-100">Saved word lists</CardTitle>
                <CardDescription className="text-sm text-zinc-400">
                  Search by name, username, or description. Load a list to start memorizing
                  instantly.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="dataset-search" className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                    Search library
                  </Label>
                  <Input
                    id="dataset-search"
                    value={datasetSearch}
                    onChange={(event) => setDatasetSearch(event.target.value)}
                    placeholder="Search by vibe name, @user, or description..."
                  />
                </div>
                <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
                  {datasetsLoading ? (
                    <p className="text-sm text-zinc-500">Syncing word lists...</p>
                  ) : datasetsError ? (
                    <p className="text-sm text-rose-400">{datasetsError}</p>
                  ) : datasets.length === 0 ? (
                    <p className="text-sm text-zinc-500">
                      No word lists found. Create one above to get the party started.
                    </p>
                  ) : (
                    datasets.map((dataset) => {
                      const isActive = activeDataset?.id === dataset.id
                      return (
                        <div
                          key={dataset.id}
                          className={`rounded-xl border px-4 py-3 transition ${
                            isActive
                              ? "border-emerald-500/60 bg-emerald-500/5"
                              : "border-zinc-800 bg-zinc-950/40 hover:border-zinc-600"
                          }`}
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-base font-semibold text-zinc-100">
                                  {dataset.name}
                                </p>
                                <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                                  {formatCreatedAt(dataset.createdAt)}
                                </span>
                              </div>
                              {dataset.description && (
                                <p className="text-sm text-zinc-400">{dataset.description}</p>
                              )}
                              <p className="text-xs text-zinc-500">
                                @{dataset.username} • {dataset.wordCount}{" "}
                                {dataset.wordCount === 1 ? "word" : "words"}
                              </p>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => handleLoadDataset(dataset)}
                              disabled={loadingDatasetId === dataset.id}
                              className="h-9 px-4 font-semibold"
                            >
                              {loadingDatasetId === dataset.id
                                ? "Loading..."
                                : isActive
                                  ? "Reload"
                                  : "Load list"}
                            </Button>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      </main>
    </>
  )
}
