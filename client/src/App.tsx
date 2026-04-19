import { useState, useEffect } from "react";
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


  
  useEffect(() => {
    fetch("/api/health")
      .then(res => res.json())
      .then(data => {
        if (data && data.ttsProviders && data.ttsProviders.length > 0) {
          if (!data.ttsProviders.includes(ttsProvider)) {
            setTtsProvider(data.ttsProviders[0]);
          }
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectTopic = (topicId: string | null, topicTitle: string | null) => {
    setActiveTopic({ id: topicId, title: topicTitle });
    setActiveScenario(null); // очищаем сценарий при выборе темы
  };

  return (
    <QueryClientProvider client={queryClient}>
      <Router hook={useHashLocation}>
        <Switch>
          <Route path="/">
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
          </Route>
          <Route path="/vocab" component={VocabPage} />
          <Route path="/review" component={ReviewPage} />
          <Route path="/settings">
            <SettingsPage ttsProvider={ttsProvider} onTtsChange={setTtsProvider} />
          </Route>
          <Route path="/scenarios">
            <ScenariosPage
              sessionId={sessionId}
              activeScenario={activeScenario}
              cefrLevel={cefrLevel}
              onSelectScenario={(id) => { setActiveScenario(id); setActiveTopic({ id: null, title: null }); }}
            />
          </Route>
          <Route path="/topics">
            <TopicsPage
              sessionId={sessionId}
              cefrLevel={cefrLevel}
              language={language}
              kidMode={mode === "kid"}
              onSelectTopic={handleSelectTopic}
            />
          </Route>
          <Route path="/exercises">
            <ExercisesPage
              sessionId={sessionId}
              language={language}
              mode={mode}
              onXPGained={setTotalXP}
            />
          </Route>
          <Route path="/achievements">
            <AchievementsPage
              sessionId={sessionId}
              mode={mode}
              totalXP={totalXP}
              streak={streak}
            />
          </Route>
        </Switch>
      </Router>
      <Toaster />
    </QueryClientProvider>
  );
}
