export const MAX_DATASET_WORDS = 1000
export const MAX_WORD_LENGTH = 48
export const MAX_NAME_LENGTH = 80
export const MAX_USERNAME_LENGTH = 40
export const MAX_DESCRIPTION_LENGTH = 240

export const DATASET_LIMITS = {
  wordsPerList: MAX_DATASET_WORDS,
  wordLength: MAX_WORD_LENGTH,
  nameLength: MAX_NAME_LENGTH,
  usernameLength: MAX_USERNAME_LENGTH,
  descriptionLength: MAX_DESCRIPTION_LENGTH,
} as const

