import { useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";
import Results from "@/pages/Results";
import type { ParsedQuestion, PolicyMetadata } from "@/lib/types";

export default function App() {
  const [questions, setQuestions] = useState<ParsedQuestion[]>([]);
  const [policies, setPolicies] = useState<PolicyMetadata[]>([]);

  function handleReady(q: ParsedQuestion[], p: PolicyMetadata[]) {
    setQuestions(q);
    setPolicies(p);
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home onReady={handleReady} />} />
        <Route path="/results" element={<Results questions={questions} policies={policies} />} />
      </Routes>
    </BrowserRouter>
  );
}
