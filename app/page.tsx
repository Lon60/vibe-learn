"use client"

import { useEffect, useMemo, useRef, useState } from "react"

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

const WORD_SOURCE = "/words.txt"
const FALLBACK_TEXT =
  "We are what we repeatedly do. Excellence, then, is not an act, but a habit."

const parseWords = (text: string) =>
  text
    .replace(/\r\n?/g, " ")
    .split(/\s+/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)

const normalize = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase()

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [words, setWords] = useState<string[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [inputValue, setInputValue] = useState("")
  const [feedback, setFeedback] = useState<"correct" | "incorrect" | null>(null)
  const [loading, setLoading] = useState(true)
  const [dataNotice, setDataNotice] = useState<string | null>(null)

  useEffect(() => {
    const loadWords = async () => {
      try {
        const response = await fetch(WORD_SOURCE, { cache: "no-store" })

        if (!response.ok) {
          throw new Error(`Unable to load ${WORD_SOURCE}`)
        }

        const fileText = await response.text()
        const parsed = parseWords(fileText)

        if (parsed.length === 0) {
          throw new Error("No words found in file")
        }

        setWords(parsed)
      } catch {
        const fallbackWords = parseWords(FALLBACK_TEXT)
        setWords(fallbackWords)
        setDataNotice(
          "words.txt was not found. Using a short sample passage instead. Add your own words file under public/words.txt."
        )
      } finally {
        setLoading(false)
      }
    }

    void loadWords()
  }, [])

  useEffect(() => {
    inputRef.current?.focus()
  }, [currentIndex])

  useEffect(() => {
    if (!feedback) return

    const timeout = setTimeout(() => setFeedback(null), 900)
    return () => clearTimeout(timeout)
  }, [feedback])

  const typedWords = useMemo(() => words.slice(0, currentIndex), [words, currentIndex])
  const nextWord = words[currentIndex]
  const progressLabel =
    words.length > 0
      ? `${Math.min(currentIndex, words.length)}/${words.length} words unlocked`
      : "Preparing your session..."

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!nextWord) return

    const submitted = inputValue.trim()
    if (!submitted) return

    if (normalize(submitted) === normalize(nextWord)) {
      setCurrentIndex((prev) => prev + 1)
      setInputValue("")
      setFeedback("correct")
    } else {
      setFeedback("incorrect")
    }
  }

  const handleReset = () => {
    setCurrentIndex(0)
    setInputValue("")
    setFeedback(null)
    inputRef.current?.focus()
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12 text-foreground">
      <Card className="w-full max-w-2xl border-zinc-800/70 bg-zinc-950/80 backdrop-blur">
        <CardHeader className="space-y-2">
          <CardTitle className="text-center text-3xl font-semibold text-zinc-100">
            Vibe Learn
          </CardTitle>
          <CardDescription className="text-center text-base text-zinc-400">
            Type each word to reveal the next one. Stay in the flow by pressing enter
            after every word.
          </CardDescription>
          <div className="text-center text-sm font-medium text-zinc-500">{progressLabel}</div>
          {dataNotice && (
            <p className="rounded-md border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs text-zinc-400">
              {dataNotice}
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          <section className="space-y-3">
            <h2 className="text-xs uppercase tracking-[0.2em] text-zinc-500">
              Revealed words
            </h2>
            <div className="flex min-h-[96px] flex-wrap gap-2 rounded-lg border border-zinc-800/70 bg-zinc-900/70 p-4 text-lg leading-relaxed text-zinc-100">
              {loading ? (
                <span className="text-zinc-500">Loading words…</span>
              ) : typedWords.length ? (
                typedWords.map((word, index) => (
                  <span key={`${word}-${index}`} className="rounded bg-zinc-800/60 px-2 py-1">
                    {word}
                  </span>
                ))
              ) : (
                <span className="text-zinc-500">
                  Start typing to unlock the passage word-by-word.
                </span>
              )}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xs uppercase tracking-[0.2em] text-zinc-500">New word</h2>
            <div className="flex min-h-[96px] items-center justify-center rounded-lg border border-zinc-800/70 bg-zinc-900/80 px-4 py-6 text-center">
              {loading ? (
                <span className="text-zinc-500">Preparing…</span>
              ) : nextWord ? (
                <span className="text-3xl font-semibold tracking-wide text-zinc-50">
                  {nextWord}
                </span>
              ) : (
                <span className="text-lg font-medium text-emerald-400">
                  You unlocked every word. Nice work!
                </span>
              )}
            </div>
          </section>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <form
            onSubmit={handleSubmit}
            className="flex w-full flex-col gap-3 sm:flex-row sm:items-center"
          >
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              placeholder={
                loading
                  ? "Loading words..."
                  : nextWord
                    ? "Type the next word and press enter"
                    : "All words unlocked"
              }
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              disabled={loading || !nextWord}
              className={`h-12 flex-1 text-base ${
                feedback === "correct"
                  ? "border-emerald-500/60 focus-visible:ring-emerald-500/40"
                  : feedback === "incorrect"
                    ? "border-rose-500/60 focus-visible:ring-rose-500/40"
                    : ""
              }`}
            />
            <Button
              type="submit"
              disabled={loading || !nextWord || !inputValue.trim()}
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
                  : feedback === "incorrect"
                    ? "text-rose-400"
                    : "text-zinc-500"
              }`}
            >
              {feedback === "correct"
                ? "Nice! Keep going."
                : feedback === "incorrect"
                  ? "That isn’t the next word. Try again."
                  : "Enter each word exactly how it appears in your text file."}
            </div>
            <Button
              type="button"
              variant="ghost"
              onClick={handleReset}
              className="h-10 self-start text-sm text-zinc-400 hover:text-zinc-100"
            >
              Restart session
            </Button>
          </div>
        </CardFooter>
      </Card>
    </main>
  )
}
