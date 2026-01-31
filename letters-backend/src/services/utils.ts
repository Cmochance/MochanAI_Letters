/**
 * Count Chinese and English words
 */
export function countWords(text: string): number {
  // Count Chinese characters
  const chineseChars = text.match(/[\u4e00-\u9fa5]/g) || [];
  // Count English words
  const englishWords = text.match(/[a-zA-Z]+/g) || [];
  return chineseChars.length + englishWords.length;
}
