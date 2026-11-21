export function geminiBatch(body) {
  const prompt = body.contents[0].parts[0].text;
  const counts = prompt.match(/\{[^}]*\}/);
  const categories = counts ? Object.entries(JSON.parse(counts[0]))
    .flatMap(([category, count]) => Array(count).fill(category)) : [];
  return { count: Number(prompt.match(/Luo (\d+)/)[1]), categories, prompt };
}

export function geminiResponse(questions, categories) {
  const items = questions.map((question, index) => categories[index]
    ? { ...question, category: categories[index] } : question);
  return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ questions: items }) }] } }] });
}
