import { useState } from "react";
import { Router, Switch, Route } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import TutorPage from "@/pages/tutor";
import VocabPage from "@/pages/vocab";
import ReviewPage from "@/pages/review";
import SettingsPage from "@/pages/settings";
import ScenariosPage from "@/pages/scenarios";
import TopicsPage from "@/pages/topics";
import ExercisesPage from "@/pages/exercises";
import AchievementsPage from "@/pages/achievements";

export type AppMode = "adult" | "kid";

export default function App() {
  const [ttsProvider, setTtsProvider] = useState<string>("google");
  const [cefrLevel, setCefrLevel] = useState<string>("A1");
  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  const [activeTopic, setActiveTopic] = useState<{ id: string | null; title: string | null }>({ id: null, title: null });
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [language, setLanguage] = useState<"bg" | "en">("bg");
  const [mode, setMode] = useState<AppMode>("adult");
  const [totalXP, setTotalXP] = useState(0);
  const [streak, setStreak] = useState(0);

  const handleSelectTopic = (topicId: string | null, topicTitle: string | null) => {
    setActiveTopic({ id: topicId, title: topicTitle });
    setActiveScenario(null); // очищаем сценарий при выборе темы
  };

  return (
    <QueryClientProvider client={queryClient}>
      <Router hook={useHashLocation}>
        <Switch>
          <Route path="/" component={() => (
            <TutorPage
              ttsProvider={ttsProvider}
              cefrLevel={cefrLevel}
              activeScenario={activeScenario}
              activeTopicId={activeTopic.id}
              activeTopicTitle={activeTopic.title}
              mode={mode}
              onSessionInit={setSessionId}
              onCefrLevelChange={setCefrLevel}
              onLanguageChange={setLanguage}
              onModeChange={setMode}
              onXPUpdate={setTotalXP}
              onStreakUpdate={setStreak}
            />
          )} />
          <Route path="/vocab" component={VocabPage} />
          <Route path="/review" component={ReviewPage} />
          <Route path="/settings" component={() => (
            <SettingsPage ttsProvider={ttsProvider} onTtsChange={setTtsProvider} />
          )} />
          <Route path="/scenarios" component={() => (
            <ScenariosPage
              sessionId={sessionId}
              activeScenario={activeScenario}
              cefrLevel={cefrLevel}
              onSelectScenario={(id) => { setActiveScenario(id); setActiveTopic({ id: null, title: null }); }}
            />
          )} />
          <Route path="/topics" component={() => (
            <TopicsPage
              sessionId={sessionId}
              cefrLevel={cefrLevel}
              language={language}
              kidMode={mode === "kid"}
              onSelectTopic={handleSelectTopic}
            />
          )} />
          <Route path="/exercises" component={() => (
            <ExercisesPage
              sessionId={sessionId}
              language={language}
              mode={mode}
              onXPGained={setTotalXP}
            />
          )} />
          <Route path="/achievements" component={() => (
            <AchievementsPage
              sessionId={sessionId}
              mode={mode}
              totalXP={totalXP}
              streak={streak}
            />
          )} />
        </Switch>
      </Router>
      <Toaster />
    </QueryClientProvider>
  );
}
