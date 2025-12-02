use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};

#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

/// Calculate the Levenshtein distance between two strings.
/// This measures the minimum number of single-character edits
/// (insertions, deletions, or substitutions) required to change one word into the other.
fn levenshtein_distance(s1: &str, s2: &str) -> usize {
    let len1 = s1.chars().count();
    let len2 = s2.chars().count();

    if len1 == 0 {
        return len2;
    }
    if len2 == 0 {
        return len1;
    }

    let mut matrix = vec![vec![0; len2 + 1]; len1 + 1];

    // Initialize first row and column
    for i in 0..=len1 {
        matrix[i][0] = i;
    }
    for j in 0..=len2 {
        matrix[0][j] = j;
    }

    // Fill in the matrix
    let s1_chars: Vec<char> = s1.chars().collect();
    let s2_chars: Vec<char> = s2.chars().collect();

    for i in 1..=len1 {
        for j in 1..=len2 {
            let cost = if s1_chars[i - 1] == s2_chars[j - 1] {
                0
            } else {
                1
            };

            matrix[i][j] = (matrix[i - 1][j] + 1) // deletion
                .min(matrix[i][j - 1] + 1) // insertion
                .min(matrix[i - 1][j - 1] + cost); // substitution
        }
    }

    matrix[len1][len2]
}

/// Calculate similarity score (0.0 to 1.0) based on Levenshtein distance.
/// 1.0 means identical, 0.0 means completely different.
fn similarity_score(s1: &str, s2: &str) -> f64 {
    let distance = levenshtein_distance(s1, s2);
    let max_len = s1.len().max(s2.len());

    if max_len == 0 {
        return 1.0;
    }

    1.0 - (distance as f64 / max_len as f64)
}

#[derive(Serialize, Deserialize)]
pub struct MatchResult {
    pub word: String,
    pub distance: usize,
    pub similarity: f64,
}

/// Calculate Levenshtein distance between two strings (WASM export)
#[wasm_bindgen]
pub fn calculate_distance(s1: &str, s2: &str) -> usize {
    levenshtein_distance(s1, s2)
}

/// Calculate similarity score between two strings (WASM export)
#[wasm_bindgen]
pub fn calculate_similarity(s1: &str, s2: &str) -> f64 {
    similarity_score(s1, s2)
}

/// Check if two strings are similar within a given threshold (0.0 to 1.0)
#[wasm_bindgen]
pub fn is_similar(s1: &str, s2: &str, threshold: f64) -> bool {
    similarity_score(s1, s2) >= threshold
}

/// Find fuzzy matches in a list of words
#[wasm_bindgen]
pub fn find_matches(query: &str, words: JsValue, threshold: f64) -> Result<JsValue, JsValue> {
    let words_vec: Vec<String> = serde_wasm_bindgen::from_value(words)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse words: {}", e)))?;

    let mut matches: Vec<MatchResult> = words_vec
        .iter()
        .map(|word| {
            let distance = levenshtein_distance(query, word);
            let similarity = similarity_score(query, word);
            MatchResult {
                word: word.clone(),
                distance,
                similarity,
            }
        })
        .filter(|m| m.similarity >= threshold)
        .collect();

    // Sort by similarity (descending)
    matches.sort_by(|a, b| b.similarity.partial_cmp(&a.similarity).unwrap());

    serde_wasm_bindgen::to_value(&matches)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize results: {}", e)))
}

/// Find the best match in a list of words
#[wasm_bindgen]
pub fn find_best_match(query: &str, words: JsValue) -> Result<JsValue, JsValue> {
    let words_vec: Vec<String> = serde_wasm_bindgen::from_value(words)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse words: {}", e)))?;

    if words_vec.is_empty() {
        return Ok(JsValue::NULL);
    }

    let best = words_vec
        .iter()
        .map(|word| {
            let distance = levenshtein_distance(query, word);
            let similarity = similarity_score(query, word);
            MatchResult {
                word: word.clone(),
                distance,
                similarity,
            }
        })
        .max_by(|a, b| a.similarity.partial_cmp(&b.similarity).unwrap());

    match best {
        Some(result) => serde_wasm_bindgen::to_value(&result)
            .map_err(|e| JsValue::from_str(&format!("Failed to serialize result: {}", e))),
        None => Ok(JsValue::NULL),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_levenshtein_distance() {
        assert_eq!(levenshtein_distance("kitten", "sitting"), 3);
        assert_eq!(levenshtein_distance("", "test"), 4);
        assert_eq!(levenshtein_distance("test", ""), 4);
        assert_eq!(levenshtein_distance("same", "same"), 0);
    }

    #[test]
    fn test_similarity_score() {
        assert_eq!(similarity_score("same", "same"), 1.0);
        assert!(similarity_score("test", "tost") > 0.7);
        assert!(similarity_score("hello", "world") < 0.5);
    }

    #[test]
    fn test_is_similar() {
        assert!(is_similar("hello", "hallo", 0.8));
        assert!(!is_similar("hello", "world", 0.8));
    }
}
