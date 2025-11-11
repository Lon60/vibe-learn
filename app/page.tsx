"use client"

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

const parseWords = (text: string) =>
  text
    .replace(/\r\n?/g, " ")
    .split(/\s+/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)

const normalize = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase()

type FeedbackState = "correct" | "advance" | "incorrect" | "complete" | null

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [words, setWords] = useState<string[]>([])
  const [fileName, setFileName] = useState("")
  const [inputValue, setInputValue] = useState("")
  const [feedback, setFeedback] = useState<FeedbackState>(null)
  const [feedbackDetail, setFeedbackDetail] = useState("")
  const [errorNotice, setErrorNotice] = useState<string | null>(null)
  const [revealedCount, setRevealedCount] = useState(0)
  const [recallIndex, setRecallIndex] = useState(0)
  const [sessionComplete, setSessionComplete] = useState(false)

  const masteredWords = useMemo(
    () => words.slice(0, revealedCount),
    [words, revealedCount]
  )

  const currentWord =
    !sessionComplete && revealedCount < words.length ? words[revealedCount] : null

  const roundLength = sessionComplete
    ? 0
    : words.length > 0
      ? Math.min(revealedCount + 1, words.length)
      : 0

  const progressLabel =
    words.length === 0
      ? "Upload a .txt word list to start"
      : sessionComplete
        ? `All ${words.length} words locked in ⭐`
        : `${masteredWords.length}/${words.length} words locked`

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

      setWords(parsed)
      setFileName(file.name)
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
    } catch (error) {
      setWords([])
      setFileName("")
      setRevealedCount(0)
      setRecallIndex(0)
      setInputValue("")
      setFeedback(null)
      setFeedbackDetail("")
      setSessionComplete(false)

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

  const sequenceMarkers = useMemo(() => {
    return Array.from({ length: roundLength }, (_, index) => {
      if (index < recallIndex) return "done"
      if (index === recallIndex) return "active"
      return "pending"
    })
  }, [roundLength, recallIndex])

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12 text-foreground">
      <Card className="w-full max-w-3xl border-zinc-800 bg-zinc-950/90 backdrop-blur">
        <CardHeader className="space-y-4">
          <div className="space-y-3 text-center">
            <CardTitle className="text-3xl font-semibold text-zinc-100">
              Vibe Learn
            </CardTitle>
            <CardDescription className="text-base text-zinc-400">
              Upload a plain text file, memorize each new word, then recite the entire
              phrase from the top—one word per enter key.
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
                <span className="text-zinc-500">Upload a .txt file to reveal words.</span>
              ) : (
                <span className="text-zinc-500">Nice work—recall the sequence to go on.</span>
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
                  ? "Upload a .txt to start"
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
              <Button
                type="button"
                variant="ghost"
                onClick={() => fileInputRef.current?.click()}
                className="h-10 text-sm text-zinc-400 hover:text-zinc-100"
              >
                Load another file
              </Button>
            </div>
          </div>
        </CardFooter>
      </Card>
    </main>
  )
}
